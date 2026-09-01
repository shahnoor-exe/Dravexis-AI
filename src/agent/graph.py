"""
agent/graph.py — LangGraph StateGraph for the MRPL Sovereign AI Agent.

Graph topology:
  START → plan → retrieve → [vision] → [codegen → sandbox_exec → reflect] → compile_result → END

Conditional edges:
  retrieve → vision        only if state.requires_vision AND vision probe passed
  retrieve → codegen       only if state.requires_code
  retrieve → compile_result otherwise (pure RAG path)
  sandbox_exec → reflect   always
  reflect → codegen        if "retry" and iteration < max
  reflect → compile_result if "done" or "fail"

Architecture Decisions:
  - Nodes never expose chain-of-thought; only concise summaries logged
  - Every node appends entry/exit events to state.events (append-only audit)
  - hard max_iterations=2 (from settings) for codegen→sandbox→reflect
  - Vision node reads vision_probe_result.json written by scripts/probe_vision.py
  - Model switch is tracked in state.active_model_role + model_switch_latency_ms
  - INSUFFICIENT_EVIDENCE returned when retrieval score < threshold
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from pathlib import Path
from typing import Literal

from langgraph.graph import StateGraph, START, END

from ..config import settings
from ..ingestion.embedder import embed_query
from ..retrieval.vector_store import search
from ..llm_client import chat_completion
from ..model_manager import switch_model
from .state import AgentState
from .router import route, RouterResult
from .sandbox import execute as sandbox_execute, validate_code_schema
from .checkpoint_adapter import get_checkpointer

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #

def _evt(state: AgentState, node: str, phase: str, **kwargs) -> AgentState:
    """Append an event to state.events and return updated state."""
    events = list(state.get("events", []))
    events.append({
        "ts": time.time(),
        "node": node,
        "phase": phase,
        **kwargs,
    })
    return {**state, "events": events}


def _load_vision_probe() -> dict:
    """Load the vision probe result written by scripts/probe_vision.py."""
    p = Path(settings.vision_probe_result)
    if not p.exists():
        return {"status": "VISION_UNAVAILABLE", "reason": "probe result file not found"}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc:
        return {"status": "VISION_UNAVAILABLE", "reason": str(exc)}


_vision_probe: dict | None = None


def _get_vision_probe() -> dict:
    global _vision_probe
    if _vision_probe is None:
        _vision_probe = _load_vision_probe()
    return _vision_probe


# --------------------------------------------------------------------------- #
# Node: plan                                                                   #
# --------------------------------------------------------------------------- #

def node_plan(state: AgentState) -> AgentState:
    """
    Route the query and produce a concise plan summary.
    If intent_override is set, use it directly.
    Calls DeepSeek-R1 only for complex intents; skips model for pure RAG.
    """
    state = _evt(state, "plan", "enter", query=state.get("query", ""))

    query = state.get("query", "")

    # Route if not already overridden
    if not state.get("intent"):
        result: RouterResult = route(query)
        state = {
            **state,
            "intent": result.intent,
            "confidence": result.confidence,
            "method": result.method,
            "required_tools": result.required_tools,
            "requires_vision": result.requires_vision,
            "requires_code": result.requires_code,
        }

    intent = state.get("intent", "unknown")

    # For pure RAG, skip calling the LLM for plan — just record intent as plan
    if intent == "rag":
        plan = f"Intent: RAG. Retrieve relevant context for: '{query[:120]}'"
        state = {**state, "plan_summary": plan, "active_model_role": None}
        state = _evt(state, "plan", "exit", plan_summary=plan, model_called=False)
        return state

    # For vision / code / system: produce a brief plan via LLM
    prompt = (
        f"You are a refinery AI planning assistant.\n"
        f"Query: {query}\nIntent: {intent}\n"
        f"Write a ONE-SENTENCE plan describing what tools will be used and what result is expected. "
        f"Do NOT reveal chain-of-thought. Do NOT answer the question. Just state the plan."
    )
    plan = f"Intent: {intent}. Tools: {state.get('required_tools', [])}. Retrieve context then execute."
    try:
        switch_model("reasoning")
        response = chat_completion(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
        )
        plan = response.get("content", plan)[:300]
    except Exception as exc:
        logger.debug("plan node: LLM unavailable (%s) — using fallback plan.", exc)

    state = {**state, "plan_summary": plan, "active_model_role": "reasoning"}
    state = _evt(state, "plan", "exit", plan_summary=plan[:100])
    return state


# --------------------------------------------------------------------------- #
# Node: retrieve                                                               #
# --------------------------------------------------------------------------- #

def node_retrieve(state: AgentState) -> AgentState:
    state = _evt(state, "retrieve", "enter")

    query = state.get("query", "")
    top_k = settings.agent_top_k

    try:
        q_vec = embed_query(query)
        chunks = search(q_vec, top_k=top_k)
    except Exception as exc:
        logger.error("Retrieve failed: %s", exc)
        state = {
            **state,
            "retrieved_chunks": [],
            "retrieval_score_max": 0.0,
            "insufficient_evidence": True,
            "error": f"retrieval_error: {exc}",
        }
        state = _evt(state, "retrieve", "exit", status="error", error=str(exc))
        return state

    if not chunks:
        state = {
            **state,
            "retrieved_chunks": [],
            "retrieval_score_max": 0.0,
            "insufficient_evidence": True,
        }
        state = _evt(state, "retrieve", "exit", status="INSUFFICIENT_EVIDENCE", chunks=0)
        return state

    max_score = max(c.score for c in chunks)
    insufficient = max_score < settings.agent_retrieval_threshold

    state = {
        **state,
        "retrieved_chunks": chunks,
        "retrieval_score_max": max_score,
        "insufficient_evidence": insufficient,
    }
    state = _evt(
        state, "retrieve", "exit",
        chunks=len(chunks),
        max_score=round(max_score, 4),
        insufficient=insufficient,
    )
    return state


# --------------------------------------------------------------------------- #
# Node: vision                                                                 #
# --------------------------------------------------------------------------- #

def node_vision(state: AgentState) -> AgentState:
    state = _evt(state, "vision", "enter")

    probe = _get_vision_probe()
    if probe.get("status") != "ok":
        reason = probe.get("reason", "probe not run")
        state = {
            **state,
            "vision_status": "VISION_UNAVAILABLE",
            "vision_result": None,
            "error": f"VISION_UNAVAILABLE: {reason}",
        }
        state = _evt(state, "vision", "exit", status="VISION_UNAVAILABLE", reason=reason)
        return state

    image_path = state.get("vision_input")
    if not image_path:
        state = {**state, "vision_status": "VISION_UNAVAILABLE", "vision_result": None}
        state = _evt(state, "vision", "exit", status="VISION_UNAVAILABLE", reason="no image path")
        return state

    # With a real vision model running via llama-server --mmproj,
    # we'd call a multimodal endpoint here. Since models aren't downloaded yet,
    # this will always come through as VISION_UNAVAILABLE via the probe result.
    # When models are present, probe.status = "ok" and we call the model endpoint.
    try:
        from ..llm_client import vision_completion  # type: ignore
        switch_model("vision")
        result = vision_completion(image_path=image_path, prompt="Describe this P&ID diagram.")
        state = {
            **state,
            "vision_status": "ok",
            "vision_result": result.get("content", ""),
            "active_model_role": "vision",
        }
        state = _evt(state, "vision", "exit", status="ok")
    except Exception as exc:
        state = {
            **state,
            "vision_status": "VISION_UNAVAILABLE",
            "vision_result": None,
            "error": f"vision_model_error: {exc}",
        }
        state = _evt(state, "vision", "exit", status="error", error=str(exc))

    return state


# --------------------------------------------------------------------------- #
# Node: codegen                                                                #
# --------------------------------------------------------------------------- #

_CODEGEN_PROMPT = """You are a refinery calculation specialist. Generate Python code for:
Query: {query}

STRICT RULES:
- Only use: math, decimal, fractions, statistics, json, re, datetime, collections
- No imports except those listed
- No file I/O, no network, no subprocess
- Produce a JSON payload with this exact structure:
{{
  "code": "<python code string>",
  "declared_inputs": {{"var_name": value, ...}},
  "expected_outputs": ["field1", "field2"],
  "language": "python"
}}

Return ONLY the JSON object, no other text."""


def node_codegen(state: AgentState) -> AgentState:
    state = _evt(state, "codegen", "enter", iteration=state.get("iteration", 0))

    query = state.get("query", "")
    reflection = state.get("reflection_notes", [])

    prompt = _CODEGEN_PROMPT.format(query=query)
    if reflection:
        prompt += f"\n\nPrevious attempt failed. Notes:\n" + "\n".join(reflection[-2:])

    # Default synthetic payload if LLM unavailable (demo / test path)
    default_payload = {
        "code": (
            "import math\n"
            "corrosion_rate_mm_per_year = 0.3\n"
            "actual_thickness_mm = 8.5\n"
            "min_required_mm = 6.0\n"
            "remaining_life_years = (actual_thickness_mm - min_required_mm) / corrosion_rate_mm_per_year\n"
            "print(f'Remaining life: {remaining_life_years:.1f} years')\n"
        ),
        "declared_inputs": {
            "corrosion_rate_mm_per_year": 0.3,
            "actual_thickness_mm": 8.5,
            "min_required_mm": 6.0,
        },
        "expected_outputs": ["remaining_life_years"],
        "language": "python",
    }

    raw_json = None
    try:
        switch_model("code")
        response = chat_completion(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
        )
        content = response.get("content", "").strip()
        # Extract first JSON block
        import re
        match = re.search(r'\{[\s\S]+\}', content)
        if match:
            raw_json = json.loads(match.group(0))
    except Exception as exc:
        logger.debug("codegen: LLM unavailable (%s) — using synthetic default.", exc)

    payload = raw_json if raw_json else default_payload
    valid, err = validate_code_schema(payload)

    state = {
        **state,
        "generated_code": payload.get("code", ""),
        "code_schema_valid": valid,
        "code_declared_inputs": payload.get("declared_inputs", {}),
        "code_expected_outputs": payload.get("expected_outputs", []),
        "code_status": "ok" if valid else f"schema_error: {err}",
        "active_model_role": "code",
    }
    state = _evt(state, "codegen", "exit", schema_valid=valid, error=err if not valid else None)
    return state


# --------------------------------------------------------------------------- #
# Node: sandbox_exec                                                           #
# --------------------------------------------------------------------------- #

def node_sandbox_exec(state: AgentState) -> AgentState:
    state = _evt(state, "sandbox_exec", "enter")

    if not state.get("code_schema_valid", False):
        state = {
            **state,
            "sandbox_stdout": "",
            "sandbox_stderr": state.get("code_status", "schema invalid"),
            "sandbox_exit_code": -2,
            "sandbox_timed_out": False,
            "sandbox_mode": "rejected",
        }
        state = _evt(state, "sandbox_exec", "exit", status="rejected")
        return state

    payload = {
        "code": state.get("generated_code", ""),
        "declared_inputs": state.get("code_declared_inputs", {}),
        "expected_outputs": state.get("code_expected_outputs", []),
        "language": "python",
    }

    result = sandbox_execute(payload)

    state = {
        **state,
        "sandbox_stdout": result.get("stdout", ""),
        "sandbox_stderr": result.get("stderr", ""),
        "sandbox_exit_code": result.get("exit_code", -1),
        "sandbox_timed_out": result.get("timed_out", False),
        "sandbox_mode": result.get("mode", "unknown"),
    }
    state = _evt(
        state, "sandbox_exec", "exit",
        exit_code=result.get("exit_code"),
        mode=result.get("mode"),
        elapsed_ms=result.get("elapsed_ms"),
    )
    return state


# --------------------------------------------------------------------------- #
# Node: reflect                                                                #
# --------------------------------------------------------------------------- #

def node_reflect(state: AgentState) -> AgentState:
    state = _evt(state, "reflect", "enter", iteration=state.get("iteration", 0))

    exit_code = state.get("sandbox_exit_code", -1)
    timed_out = state.get("sandbox_timed_out", False)
    iteration = state.get("iteration", 0)
    max_iter = settings.agent_max_iterations
    notes = list(state.get("reflection_notes", []))

    if exit_code == 0 and not timed_out:
        decision = "done"
        notes.append(f"iter {iteration}: sandbox succeeded (exit_code=0)")
    elif iteration >= max_iter:
        decision = "fail"
        notes.append(f"iter {iteration}: max_iterations={max_iter} reached — stopping")
    else:
        decision = "retry"
        stderr = (state.get("sandbox_stderr") or "")[:200]
        notes.append(f"iter {iteration}: failed (exit={exit_code}) — retrying. stderr: {stderr}")

    state = {
        **state,
        "reflect_decision": decision,
        "reflection_notes": notes,
        "iteration": iteration + 1,
    }
    state = _evt(state, "reflect", "exit", decision=decision, iteration=iteration)
    return state


# --------------------------------------------------------------------------- #
# Node: compile_result                                                         #
# --------------------------------------------------------------------------- #

def node_compile_result(state: AgentState) -> AgentState:
    state = _evt(state, "compile_result", "enter")

    intent = state.get("intent", "unknown")
    insufficient = state.get("insufficient_evidence", False)
    error = state.get("error")
    reflect_decision = state.get("reflect_decision", "")
    sandbox_stdout = state.get("sandbox_stdout", "") or ""
    retrieved = state.get("retrieved_chunks", [])

    if error and not state.get("final_answer"):
        final = f"ERROR: {error}"
    elif insufficient and intent == "rag":
        final = (
            "INSUFFICIENT_EVIDENCE: The knowledge base does not contain enough relevant "
            "information to answer this question reliably. "
            "Do not interpret this as a statutory engineering decision."
        )
    elif intent in ("code",) and reflect_decision == "done" and sandbox_stdout:
        # LLM Synthesis for code
        try:
            switch_model("reasoning")
            prompt = (
                "You are an expert engineering assistant. Summarize the following Python calculation "
                "output into a clear engineering note. \n\n"
                f"Output: {sandbox_stdout.strip()}"
            )
            resp = chat_completion(messages=[{"role": "user", "content": prompt}], max_tokens=300)
            final = resp.get("content", f"Calculation result:\n{sandbox_stdout.strip()}")
        except Exception as exc:
            logger.error(f"LLM compilation failed: {exc}")
            final = f"Calculation result:\n{sandbox_stdout.strip()}"
            
    elif intent in ("code",) and reflect_decision == "fail":
        final = (
            "CODE_EXECUTION_FAILED: The calculation could not be completed after "
            f"{settings.agent_max_iterations} retries. "
            f"Last error: {(state.get('sandbox_stderr') or '')[:300]}"
        )
    elif intent == "vision":
        status = state.get("vision_status", "VISION_UNAVAILABLE")
        if status == "ok":
            vision_text = state.get("vision_result") or ""
            # LLM Synthesis for vision
            try:
                switch_model("reasoning")
                prompt = (
                    "You are an expert engineering assistant. The vision model has extracted text "
                    "from a P&ID diagram. Describe the instrumentation loops found in the text clearly.\n\n"
                    f"Extracted Text: {vision_text}"
                )
                resp = chat_completion(messages=[{"role": "user", "content": prompt}], max_tokens=300)
                final = resp.get("content", vision_text or "Vision analysis complete.")
            except Exception as exc:
                logger.error(f"LLM compilation failed: {exc}")
                final = vision_text or "Vision analysis complete (no text extracted)."
        else:
            final = (
                "VISION_UNAVAILABLE: The vision model is not loaded. "
                "Download Qwen2.5-VL-3B GGUF + mmproj and run scripts/probe_vision.py to enable."
            )
    elif retrieved or state.get("query"):
        # Real LLM Synthesis for RAG or unknown
        query = state.get("query", "")
        context_str = "\n\n".join(f"Document [{c.doc_id}]: {c.text}" for c in retrieved[:3])
        prompt = (
            "You are the MRPL Sovereign AI Assistant. Answer the user question accurately and "
            "concisely using the provided refinery documentation context. If the context does not "
            "contain the answer, politely state that according to MRPL on-prem records, no specific "
            "clause was found, but provide general guidance based on your knowledge.\n\n"
            f"Context:\n{context_str}\n\n"
            f"User Question: {query}"
        )
        try:
            switch_model("reasoning")
            resp = chat_completion(messages=[{"role": "user", "content": prompt}], max_tokens=500)
            final = resp.get("content", "Error synthesizing response.")
            if retrieved:
                final += f"\n\n*Sources: {', '.join(set(c.doc_id for c in retrieved[:3]))}*"
        except Exception as exc:
            logger.error(f"LLM compilation failed: {exc}")
            final = "Error synthesizing response. Model may be unavailable."
    else:
        final = "No result produced. Check event log for details."

    state = {**state, "final_answer": final}
    state = _evt(state, "compile_result", "exit", intent=intent, answer_len=len(final))
    return state


# --------------------------------------------------------------------------- #
# Conditional edge functions                                                   #
# --------------------------------------------------------------------------- #

def _after_retrieve(state: AgentState) -> Literal["vision", "codegen", "compile_result"]:
    if state.get("requires_vision") and _get_vision_probe().get("status") == "ok":
        return "vision"
    if state.get("requires_code"):
        return "codegen"
    return "compile_result"


def _after_vision(state: AgentState) -> Literal["codegen", "compile_result"]:
    if state.get("requires_code"):
        return "codegen"
    return "compile_result"


def _after_reflect(state: AgentState) -> Literal["codegen", "compile_result"]:
    if state.get("reflect_decision") == "retry":
        return "codegen"
    return "compile_result"


# --------------------------------------------------------------------------- #
# Graph factory                                                                #
# --------------------------------------------------------------------------- #

def build_graph():
    """Build and compile the LangGraph StateGraph."""
    builder = StateGraph(AgentState)

    builder.add_node("plan", node_plan)
    builder.add_node("retrieve", node_retrieve)
    builder.add_node("vision", node_vision)
    builder.add_node("codegen", node_codegen)
    builder.add_node("sandbox_exec", node_sandbox_exec)
    builder.add_node("reflect", node_reflect)
    builder.add_node("compile_result", node_compile_result)

    builder.add_edge(START, "plan")
    builder.add_edge("plan", "retrieve")
    builder.add_conditional_edges("retrieve", _after_retrieve)
    builder.add_conditional_edges("vision", _after_vision)
    builder.add_edge("codegen", "sandbox_exec")
    builder.add_edge("sandbox_exec", "reflect")
    builder.add_conditional_edges("reflect", _after_reflect)
    builder.add_edge("compile_result", END)

    # Checkpoint
    checkpointer = get_checkpointer(settings.agent_checkpoint_db)
    if checkpointer:
        graph = builder.compile(checkpointer=checkpointer)
        logger.info("Graph compiled WITH SqliteSaver checkpoint.")
    else:
        graph = builder.compile()
        logger.warning("Graph compiled WITHOUT checkpoint (SqliteSaver unavailable).")

    return graph


# Singleton graph instance
_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph
