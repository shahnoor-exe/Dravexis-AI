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
    query: str = Field("", max_length=4096)
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
    run_id: str
    session_id: str
    status: str                        # "idle"|"validating"|"routing"|"retrieving"|"loading_model"|"generating"|"awaiting_approval"|"completed"|"partial"|"failed"|"disconnected"|"cancelled"
    success: bool
    intent: str
    model_role: str | None
    model_status: str | None
    answer: str | None
    error: dict | str | None           # structured error dict or string message
    warnings: list[str]
    events: list[dict]
    latency_ms: float
    
    # Legacy / UI fields
    confidence: float
    method: str
    retrieved_evidence: list[dict]
    vision_status: str
    code_status: str
    sandbox_mode: str
    iteration: int
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
    unix_start_ts = time.time()

    logger.info("Agent run: session=%s query=%r", session_id, req.query[:80])

    # Build initial state
    initial = make_initial_state(
        query=req.query,
        session_id=session_id,
        image_path=req.image_path,
        intent_override=req.intent_override,
    )

    if not req.query.strip() and not req.image_path:
        return AgentRunResponse(
            run_id=session_id,
            session_id=session_id,
            status="partial",
            success=False,
            intent="unknown",
            model_role=None,
            model_status=None,
            answer="Please ask a question or provide input.",
            error={"code": "EMPTY_INPUT", "message": "Input was empty."},
            warnings=[],
            events=[],
            latency_ms=round((time.monotonic() - t_start) * 1000, 1),
            # Legacy
            confidence=0.0,
            method="",
            retrieved_evidence=[],
            vision_status="not_requested",
            code_status="not_requested",
            sandbox_mode="not_run",
            iteration=0,
            active_model=None,
            model_switch_latency_ms=None,
            total_latency_ms=round((time.monotonic() - t_start) * 1000, 1),
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
        
        # Determine if it's a connection error based on string matching since exc could be nested
        exc_str = str(exc)
        if "LLAMA_SERVER_UNREACHABLE" in exc_str or "Connection lost" in exc_str:
            err_obj = {"code": "LLAMA_SERVER_UNREACHABLE", "message": exc_str}
            run_status = "disconnected"
        elif "MODEL_SWITCH_FAILED" in exc_str:
            err_obj = {"code": "MODEL_SWITCH_FAILED", "message": exc_str}
            run_status = "failed"
        else:
            err_obj = {"code": "INTERNAL_ERROR", "message": exc_str}
            run_status = "failed"
            
        return AgentRunResponse(
            run_id=session_id,
            session_id=session_id,
            status=run_status,
            success=False,
            intent="unknown",
            model_role=None,
            model_status="error",
            answer=None,
            error=err_obj,
            warnings=[],
            events=[],
            latency_ms=round(total_ms, 1),
            # Legacy
            confidence=0.0,
            method="",
            retrieved_evidence=[],
            vision_status="not_requested",
            code_status="not_requested",
            sandbox_mode="not_run",
            iteration=0,
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

    run_status = "completed"
    err_obj = None
    if final_state.get("error") and not final_state.get("final_answer"):
        err_msg = str(final_state.get("error"))
        if "LLAMA_SERVER_UNREACHABLE" in err_msg or "Connection lost" in err_msg:
            run_status = "disconnected"
            err_obj = {"code": "LLAMA_SERVER_UNREACHABLE", "message": err_msg}
        elif "MODEL_SWITCH_FAILED" in err_msg:
            run_status = "failed"
            err_obj = {"code": "MODEL_SWITCH_FAILED", "message": err_msg}
        elif "VISION_UNAVAILABLE" in err_msg or "vision_model_error" in err_msg:
            run_status = "failed"
            err_obj = {"code": "VISION_UNAVAILABLE", "message": err_msg}
        else:
            run_status = "failed"
            err_obj = {"code": "INTERNAL_ERROR", "message": err_msg}
    elif final_state.get("insufficient_evidence"):
        run_status = "partial"

    # Filter events to only return those generated during this request (prevent duplication across multi-turn)
    current_events = [e for e in final_state.get("events", []) if e.get("ts", 0) >= unix_start_ts]
    
    # Add run_id to events for frontend deduplication
    for e in current_events:
        e["run_id"] = session_id

    return AgentRunResponse(
        run_id=session_id,
        session_id=session_id,
        status=run_status,
        success=run_status in ("completed", "partial"),
        intent=final_state.get("intent", "unknown"),
        model_role=final_state.get("active_model_role"),
        model_status="loaded" if final_state.get("active_model_role") else None,
        answer=final_state.get("final_answer"),
        error=err_obj,
        warnings=[],
        events=current_events,
        latency_ms=round(total_ms, 1),
        # Legacy
        confidence=final_state.get("confidence", 0.0),
        method=final_state.get("method", ""),
        retrieved_evidence=evidence,
        vision_status=final_state.get("vision_status", "not_requested"),
        code_status=final_state.get("code_status", "not_requested"),
        sandbox_mode=final_state.get("sandbox_mode", "not_run"),
        iteration=final_state.get("iteration", 0),
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
