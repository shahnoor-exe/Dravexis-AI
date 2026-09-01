"""
routers/agent.py — Phase 2 /agent/run endpoint.

POST /agent/run
    Runs the full LangGraph agent pipeline:
    query → intent router → plan → retrieve → [vision] → [codegen → sandbox → reflect] → result

Does NOT break any Phase 1 endpoint.
All image paths are validated against the data/ workspace root.
"""
from __future__ import annotations

import logging
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from ..config import settings, BASE_DIR
from ..agent.router import route, get_router_info
from ..agent.graph import get_graph
from ..agent.state import make_initial_state

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["agent"])

# --------------------------------------------------------------------------- #
# Request / Response schemas                                                   #
# --------------------------------------------------------------------------- #

_APPROVED_WORKSPACE = BASE_DIR / "data"


class AgentRunRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4096)
    session_id: str | None = None
    image_path: str | None = None          # local path, validated to data/ root
    intent_override: str | None = None    # test-only; never bypasses tool safety

    @field_validator("image_path")
    @classmethod
    def validate_image_path(cls, v: str | None) -> str | None:
        if v is None:
            return None
        p = Path(v).resolve()
        try:
            p.relative_to(_APPROVED_WORKSPACE.resolve())
        except ValueError:
            raise ValueError(
                f"image_path must be under {_APPROVED_WORKSPACE}. Got: {v}"
            )
        if not p.exists():
            raise ValueError(f"image_path does not exist: {v}")
        return str(p)

    @field_validator("intent_override")
    @classmethod
    def validate_intent_override(cls, v: str | None) -> str | None:
        if v is None:
            return v
        allowed = {"rag", "vision", "code", "system", "unknown"}
        if v not in allowed:
            raise ValueError(f"intent_override must be one of {allowed}")
        return v


class AgentRunResponse(BaseModel):
    session_id: str
    status: str                        # "ok" | "error" | "partial"
    intent: str
    confidence: float
    method: str
    events: list[dict]
    retrieved_evidence: list[dict]     # {doc_id, score, text_preview}
    vision_status: str
    code_status: str
    sandbox_mode: str
    iteration: int
    final_answer: str | None
    error: str | None
    active_model: str | None
    model_switch_latency_ms: float | None
    total_latency_ms: float


# --------------------------------------------------------------------------- #
# Endpoint                                                                     #
# --------------------------------------------------------------------------- #

@router.post("/run", response_model=AgentRunResponse)
async def agent_run(req: AgentRunRequest) -> AgentRunResponse:
    """
    Run the full agent pipeline for a given query.

    The graph runs synchronously inside the async handler via run_in_executor
    to avoid blocking the event loop.
    """
    session_id = req.session_id or str(uuid.uuid4())
    t_start = time.monotonic()

    logger.info("Agent run: session=%s query=%r", session_id, req.query[:80])

    # Build initial state
    initial = make_initial_state(
        query=req.query,
        session_id=session_id,
        image_path=req.image_path,
        intent_override=req.intent_override,
    )

    # Run the graph (synchronous; wrap in executor for FastAPI async context)
    import asyncio
    import functools

    graph = get_graph()
    config = {"configurable": {"thread_id": session_id}}

    try:
        loop = asyncio.get_event_loop()
        final_state = await loop.run_in_executor(
            None,
            functools.partial(graph.invoke, initial, config),
        )
    except Exception as exc:
        logger.error("Graph invocation failed: %s", exc, exc_info=True)
        total_ms = (time.monotonic() - t_start) * 1000
        return AgentRunResponse(
            session_id=session_id,
            status="error",
            intent="unknown",
            confidence=0.0,
            method="",
            events=[],
            retrieved_evidence=[],
            vision_status="not_requested",
            code_status="not_requested",
            sandbox_mode="not_run",
            iteration=0,
            final_answer=None,
            error=str(exc),
            active_model=None,
            model_switch_latency_ms=None,
            total_latency_ms=round(total_ms, 1),
        )

    total_ms = (time.monotonic() - t_start) * 1000

    # Build evidence list
    evidence = [
        {
            "doc_id": c.doc_id,
            "chunk_index": c.chunk_index,
            "score": round(c.score, 4),
            "text_preview": c.text[:200],
        }
        for c in (final_state.get("retrieved_chunks") or [])
    ]

    run_status = "ok"
    if final_state.get("error") and not final_state.get("final_answer"):
        run_status = "error"
    elif final_state.get("insufficient_evidence"):
        run_status = "partial"

    return AgentRunResponse(
        session_id=session_id,
        status=run_status,
        intent=final_state.get("intent", "unknown"),
        confidence=final_state.get("confidence", 0.0),
        method=final_state.get("method", ""),
        events=final_state.get("events", []),
        retrieved_evidence=evidence,
        vision_status=final_state.get("vision_status", "not_requested"),
        code_status=final_state.get("code_status", "not_requested"),
        sandbox_mode=final_state.get("sandbox_mode", "not_run"),
        iteration=final_state.get("iteration", 0),
        final_answer=final_state.get("final_answer"),
        error=final_state.get("error"),
        active_model=final_state.get("active_model_role"),
        model_switch_latency_ms=final_state.get("model_switch_latency_ms"),
        total_latency_ms=round(total_ms, 1),
    )


@router.get("/router-info")
async def router_info() -> dict:
    """Return diagnostic info about the current router mode."""
    return get_router_info()


@router.get("/graph-info")
async def graph_info() -> dict:
    """Return graph compilation status and checkpoint availability."""
    from ..agent.checkpoint_adapter import get_compatibility_status
    return {
        "graph_compiled": True,
        "checkpoint": get_compatibility_status(),
        "vision_probe": _get_vision_probe_summary(),
        "max_iterations": settings.agent_max_iterations,
        "retrieval_threshold": settings.agent_retrieval_threshold,
    }


def _get_vision_probe_summary() -> dict:
    import json as _json
    from pathlib import Path as _Path
    p = _Path(settings.vision_probe_result)
    if not p.exists():
        return {"status": "VISION_UNAVAILABLE", "reason": "probe not run yet"}
    try:
        return _json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc:
        return {"status": "VISION_UNAVAILABLE", "reason": str(exc)}
