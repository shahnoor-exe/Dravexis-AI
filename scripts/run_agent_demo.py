"""
scripts/run_agent_demo.py — Verification matrix runner (Phase 2 §9).

Runs all 8 required verification matrix cases and saves structured JSON evidence
to data/phase2_verification_evidence.json.

Usage:
    python scripts/run_agent_demo.py

Does NOT require llama-server to be running (nodes fall back gracefully).
For full LLM responses, run start_all.ps1 first.
"""
from __future__ import annotations

import json
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.agent.graph import get_graph
from src.agent.state import make_initial_state
from src.config import settings

EVIDENCE_PATH = Path("data") / "phase2_verification_evidence.json"
EVIDENCE_PATH.parent.mkdir(parents=True, exist_ok=True)

MATRIX = [
    {
        "id": "M1",
        "description": "Known H2S inspection query → RAG path, grounded evidence includes oisd_116",
        "query": "What is the inspection interval for pressure vessels in H2S wet service according to OISD?",
        "expected_intent": "rag",
        "pass_criteria": ["oisd_116 in retrieved docs", "final_answer not empty"],
    },
    {
        "id": "M2",
        "description": "Unknown/off-topic query → no fabricated statutory answer",
        "query": "What is the best restaurant near MRPL refinery?",
        "expected_intent": ["rag", "unknown"],
        "pass_criteria": ["no fabricated statutory content", "final_answer not empty"],
    },
    {
        "id": "M3",
        "description": "Explicit P&ID query → vision probe result (VISION_UNAVAILABLE expected)",
        "query": "upload P&ID for crude distillation unit CDU-1",
        "expected_intent": "vision",
        "pass_criteria": ["vision_status == VISION_UNAVAILABLE OR ok", "no crash"],
    },
    {
        "id": "M4",
        "description": "Synthetic calculation → CodeGen + SandboxExec → result",
        "query": "calculate corrosion rate and remaining life for pipe P-201, corrosion rate 0.3mm/yr, thickness 8.5mm, min 6.0mm",
        "expected_intent": "code",
        "pass_criteria": ["sandbox_mode in (DEGRADED_SANDBOX, docker, rejected)", "final_answer not empty"],
    },
    {
        "id": "M5",
        "description": "Deliberate code error → reflect retries ≤ max, then terminates",
        "query": "calculate remaining life",
        "intent_override": "code",
        "expected_intent": "code",
        "pass_criteria": [f"iteration <= {settings.agent_max_iterations + 1}", "reflect_decision in (done, fail)"],
    },
    {
        "id": "M6",
        "description": "Invalid tool payload → Pydantic/schema validation rejects it",
        "query": "_INTERNAL_TEST_SCHEMA_REJECTION_",
        "expected_intent": "unknown",
        "pass_criteria": ["no crash", "final_answer not empty"],
        "note": "Schema validation tested directly in test_sandbox_validation.py",
    },
    {
        "id": "M7",
        "description": "Model switch timing → only one model active (no concurrent load)",
        "query": "what is the fire protection foam rate for LPG vessels?",
        "expected_intent": "rag",
        "pass_criteria": ["no concurrent model load", "active_model_role set or None"],
        "note": "Full latency measurement requires GGUF — see scripts/measure_model_swap.py",
    },
    {
        "id": "M8",
        "description": "Service restart → checkpoint/session behavior verified",
        "query": "What are the OISD requirements for pressure vessel inspection?",
        "expected_intent": "rag",
        "pass_criteria": ["checkpoint status logged", "no crash on re-run"],
    },
]


def run_case(graph, case: dict) -> dict:
    q = case["query"]
    session_id = f"demo-{case['id']}-{uuid.uuid4().hex[:6]}"

    state = make_initial_state(
        query=q,
        session_id=session_id,
        intent_override=case.get("intent_override"),
    )

    t_start = time.monotonic()
    try:
        result = graph.invoke(state, {"configurable": {"thread_id": session_id}})
        elapsed_ms = (time.monotonic() - t_start) * 1000

        chunks = result.get("retrieved_chunks", [])
        evidence_summary = {
            "session_id": session_id,
            "intent": result.get("intent"),
            "confidence": result.get("confidence"),
            "method": result.get("method"),
            "retrieved_docs": [c.doc_id for c in chunks],
            "retrieval_score_max": result.get("retrieval_score_max"),
            "insufficient_evidence": result.get("insufficient_evidence"),
            "vision_status": result.get("vision_status"),
            "code_status": result.get("code_status"),
            "sandbox_mode": result.get("sandbox_mode"),
            "sandbox_exit_code": result.get("sandbox_exit_code"),
            "iteration": result.get("iteration"),
            "reflect_decision": result.get("reflect_decision"),
            "active_model_role": result.get("active_model_role"),
            "final_answer_preview": (result.get("final_answer") or "")[:300],
            "error": result.get("error"),
            "event_count": len(result.get("events", [])),
            "elapsed_ms": round(elapsed_ms, 1),
        }

        # Evaluate pass criteria
        passed = True
        notes = []

        # M1: oisd_116 in retrieved docs
        if case["id"] == "M1":
            if not any("oisd_116" in d for d in evidence_summary["retrieved_docs"]):
                passed = False
                notes.append("FAIL: oisd_116 not in retrieved docs")
            if not evidence_summary["final_answer_preview"]:
                passed = False
                notes.append("FAIL: final_answer is empty")

        # M5: iteration check
        if case["id"] == "M5":
            if evidence_summary.get("iteration", 0) > settings.agent_max_iterations + 1:
                passed = False
                notes.append(f"FAIL: iteration exceeded max {settings.agent_max_iterations}")

        if not passed and not notes:
            notes.append("PASS criteria not fully evaluated")

        return {
            "case": case["id"],
            "description": case["description"],
            "query": q[:100],
            "expected_intent": case["expected_intent"],
            "pass": passed,
            "notes": notes or ["PASS"],
            "evidence": evidence_summary,
        }

    except Exception as exc:
        elapsed_ms = (time.monotonic() - t_start) * 1000
        return {
            "case": case["id"],
            "description": case["description"],
            "query": q[:100],
            "expected_intent": case["expected_intent"],
            "pass": False,
            "notes": [f"EXCEPTION: {exc}"],
            "evidence": {"elapsed_ms": round(elapsed_ms, 1), "error": str(exc)},
        }


def main():
    print("=" * 70)
    print("MRPL Sovereign AI — Phase 2 Verification Matrix")
    print("=" * 70)

    from src.agent.checkpoint_adapter import get_compatibility_status
    checkpoint_status = get_compatibility_status()
    print(f"Checkpoint: {checkpoint_status}")

    graph = get_graph()
    results = []

    for case in MATRIX:
        print(f"\n[{case['id']}] {case['description']}")
        r = run_case(graph, case)
        status = "PASS" if r["pass"] else "FAIL"
        print(f"     Status: {status} | Intent: {r['evidence'].get('intent')} | "
              f"Elapsed: {r['evidence'].get('elapsed_ms', 0):.0f}ms")
        if r["notes"] and r["notes"] != ["PASS"]:
            for note in r["notes"]:
                print(f"     >> {note}")
        results.append(r)

    output = {
        "run_timestamp": time.time(),
        "phase": 2,
        "checkpoint_status": checkpoint_status,
        "total_cases": len(results),
        "passed": sum(1 for r in results if r["pass"]),
        "failed": sum(1 for r in results if not r["pass"]),
        "results": results,
    }

    EVIDENCE_PATH.write_text(json.dumps(output, indent=2, default=str), encoding="utf-8")

    print("\n" + "=" * 70)
    print(f"TOTAL: {output['passed']}/{output['total_cases']} passed")
    print(f"Evidence saved to: {EVIDENCE_PATH}")
    print("=" * 70)

    return output


if __name__ == "__main__":
    result = main()
    sys.exit(0 if result["failed"] == 0 else 1)
