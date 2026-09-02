"""
agent/state.py — Typed state container for the LangGraph agent.

All fields that may be absent at a given point in the graph are Optional.
The 'events' list is an append-only audit trail; every node appends on entry and exit.
"""
from __future__ import annotations

from typing import Any, Optional
from typing_extensions import TypedDict

from ..schemas import SourceChunk


class AgentState(TypedDict, total=False):
    # ------------------------------------------------------------------ #
    # Identity                                                             #
    # ------------------------------------------------------------------ #
    session_id: str
    query: str

    # ------------------------------------------------------------------ #
    # Routing                                                              #
    # ------------------------------------------------------------------ #
    intent: str               # e.g. "rag", "vision", "code", "unknown"
    confidence: float
    method: str               # "regex", "keyword", "onnx"
    required_tools: list[str]
    requires_vision: bool
    requires_code: bool

    # ------------------------------------------------------------------ #
    # Retrieval                                                            #
    # ------------------------------------------------------------------ #
    retrieved_chunks: list[SourceChunk]
    retrieval_score_max: float
    insufficient_evidence: bool   # True if best score < threshold

    # ------------------------------------------------------------------ #
    # Vision                                                               #
    # ------------------------------------------------------------------ #
    vision_input: Optional[str]   # local path to image (validated)
    vision_result: Optional[str]  # extracted text / analysis from model
    vision_status: str            # "ok" | "VISION_UNAVAILABLE" | "error"

    # ------------------------------------------------------------------ #
    # PDF Upload                                                           #
    # ------------------------------------------------------------------ #
    uploaded_pdf_text: Optional[str]

    # ------------------------------------------------------------------ #
    # Code generation                                                      #
    # ------------------------------------------------------------------ #
    generated_code: Optional[str]
    code_schema_valid: bool
    code_declared_inputs: dict[str, Any]
    code_expected_outputs: list[str]
    code_status: str              # "ok" | "schema_error" | "not_requested"

    # ------------------------------------------------------------------ #
    # Sandbox execution                                                    #
    # ------------------------------------------------------------------ #
    sandbox_stdout: Optional[str]
    sandbox_stderr: Optional[str]
    sandbox_exit_code: Optional[int]
    sandbox_timed_out: bool
    sandbox_mode: str             # "docker" | "DEGRADED_SANDBOX" | "not_run"

    # ------------------------------------------------------------------ #
    # Reflection / iteration control                                       #
    # ------------------------------------------------------------------ #
    reflection_notes: list[str]
    iteration: int                # starts at 0; incremented each retry
    reflect_decision: str         # "retry" | "done" | "fail"

    # ------------------------------------------------------------------ #
    # Model / latency metadata                                             #
    # ------------------------------------------------------------------ #
    active_model_role: Optional[str]
    model_switch_latency_ms: Optional[float]

    # ------------------------------------------------------------------ #
    # Audit trail                                                          #
    # ------------------------------------------------------------------ #
    events: list[dict]            # append-only; every node appends entry/exit

    # ------------------------------------------------------------------ #
    # Final output                                                         #
    # ------------------------------------------------------------------ #
    final_answer: Optional[str]
    error: Optional[str]
    plan_summary: Optional[str]


def make_initial_state(
    query: str,
    session_id: str,
    image_path: str | None = None,
    intent_override: str | None = None,
) -> AgentState:
    """Create a fresh AgentState for a new request."""
    return AgentState(
        session_id=session_id,
        query=query,
        intent=intent_override or "",
        confidence=0.0,
        method="",
        required_tools=[],
        requires_vision=bool(image_path) or intent_override == "vision",
        requires_code=intent_override == "code",
        retrieved_chunks=[],
        retrieval_score_max=0.0,
        insufficient_evidence=False,
        vision_input=image_path,
        vision_result=None,
        vision_status="not_requested",
        uploaded_pdf_text=None,
        generated_code=None,
        code_schema_valid=False,
        code_declared_inputs={},
        code_expected_outputs=[],
        code_status="not_requested",
        sandbox_stdout=None,
        sandbox_stderr=None,
        sandbox_exit_code=None,
        sandbox_timed_out=False,
        sandbox_mode="not_run",
        reflection_notes=[],
        iteration=0,
        reflect_decision="",
        active_model_role=None,
        model_switch_latency_ms=None,
        events=[],
        final_answer=None,
        error=None,
        plan_summary=None,
    )
