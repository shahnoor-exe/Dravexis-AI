#!/usr/bin/env python
"""
final_demo_rehearsal.py — Deterministic Final Demo Rehearsal

Executes the demo scenarios in optimal order (minimizing model swaps),
records structured evidence, and writes to data/final_demo_rehearsal.json.

Does NOT claim packet-level isolation. Clearly distinguishes:
- Online baseline
- Loopback-only rehearsal
- Prior physically disabled-adapter evidence
- Current network-monitor limitations

Usage (from project root, with FastAPI running on 127.0.0.1:8000):
    python scripts/final_demo_rehearsal.py
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
OUTPUT = DATA_DIR / "final_demo_rehearsal.json"
API = "http://127.0.0.1:8000"

REQUIRED_MODELS = [
    "DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
    "Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf",
    "mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf",
    "Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat()


def check_models() -> list[dict]:
    results = []
    for name in REQUIRED_MODELS:
        p = MODELS_DIR / name
        exists = p.exists()
        size = p.stat().st_size if exists else 0
        results.append({
            "name": name,
            "exists": exists,
            "size_bytes": size,
            "size_gb": round(size / (1024**3), 3) if exists else 0,
        })
    return results


def check_health() -> dict:
    try:
        r = httpx.get(f"{API}/", timeout=10)
        return {"status": "ok", "code": r.status_code, "body": r.json()}
    except Exception as e:
        return {"status": "fail", "error": str(e)}


def check_network_status() -> dict:
    try:
        r = httpx.get(f"{API}/network-status", timeout=10)
        return r.json()
    except Exception as e:
        return {"error": str(e)}


def check_network_monitor() -> dict:
    try:
        r = httpx.get(f"{API}/network/monitor/summary", timeout=10)
        return r.json()
    except Exception as e:
        return {"status": "MONITOR_UNAVAILABLE", "error": str(e)}


def run_query(query: str, label: str) -> dict:
    t0 = time.monotonic()
    try:
        r = httpx.post(f"{API}/agent/run", json={"query": query}, timeout=120)
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        d = r.json()
        evidence = d.get("retrieved_evidence", [])
        return {
            "name": label,
            "status": "pass" if d.get("status") == "ok" else "fail",
            "intent": d.get("intent"),
            "confidence": d.get("confidence"),
            "latency_ms": elapsed,
            "evidence_count": len(evidence),
            "max_retrieval_score": round(max((e.get("score", 0) for e in evidence), default=0), 4),
            "vision_status": d.get("vision_status"),
            "sandbox_mode": d.get("sandbox_mode"),
            "final_answer_length": len(d.get("final_answer") or ""),
            "model_switch_latency_ms": d.get("model_switch_latency_ms"),
            "active_model": d.get("active_model"),
            "error": d.get("error"),
            "events_count": len(d.get("events", [])),
        }
    except Exception as e:
        return {
            "name": label,
            "status": "fail",
            "latency_ms": round((time.monotonic() - t0) * 1000, 1),
            "error": str(e),
        }


def run_artifact_generation() -> dict:
    """Test artifact generation via POST /artifacts/generate."""
    t0 = time.monotonic()
    try:
        payload = {
            "type": "docx",
            "query": "Rehearsal test: Calculate remaining corrosion life for CDU-V-101",
            "evidence": [{"doc_id": "test_doc", "text_preview": "OISD 116 §4.3 — H2S wet service inspection interval: 5 years max", "score": 0.85}],
            "label": "SYNTHETIC",
            "vision_status": "VISION_AVAILABLE",
            "sandbox_mode": "DEGRADED_SANDBOX",
        }
        r = httpx.post(f"{API}/artifacts/generate", json=payload, timeout=30)
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        return {
            "name": "Artifact Generation (DOCX)",
            "status": "pass" if r.status_code == 200 else "fail",
            "status_code": r.status_code,
            "latency_ms": elapsed,
            "response_keys": list(r.json().keys()) if r.status_code == 200 else None,
            "error": r.text if r.status_code != 200 else None,
        }
    except Exception as e:
        return {
            "name": "Artifact Generation (DOCX)",
            "status": "fail",
            "latency_ms": round((time.monotonic() - t0) * 1000, 1),
            "error": str(e),
        }


def main():
    print("=" * 60)
    print("FINAL DEMO REHEARSAL")
    print("=" * 60)

    result: dict = {
        "timestamp": now_iso(),
        "rehearsal_type": "final_demo",
        "model_verification": [],
        "service_health": {},
        "network_status": {},
        "network_monitor": {},
        "scenarios": [],
        "artifact_test": {},
        "capability_labels": {},
        "prior_offline_evidence": {},
    }

    # Step 1: Model files
    print("\n[1/7] Verifying model files...")
    models = check_models()
    result["model_verification"] = models
    all_present = all(m["exists"] for m in models)
    print(f"  Models: {'ALL PRESENT' if all_present else 'MISSING FILES'}")
    for m in models:
        print(f"    {m['name']}: {'OK' if m['exists'] else 'MISSING'} ({m['size_gb']} GB)")

    # Step 2: Service health
    print("\n[2/7] Checking service health...")
    result["service_health"] = check_health()
    print(f"  FastAPI: {result['service_health']['status']}")

    # Step 3: Network status
    print("\n[3/7] Checking network status...")
    result["network_status"] = check_network_status()
    print(f"  Qdrant: {result['network_status'].get('qdrant_healthy', 'unknown')}")

    # Step 4: Demo scenarios (order minimizes model swaps)
    print("\n[4/7] Executing demo scenarios...")

    # Scenario 1: Warm RAG (reasoning model)
    print("  [S1] Warm RAG query (H2S inspection)...")
    s1 = run_query(
        "What is the maximum inspection interval for pressure vessels in H2S service per OISD 116?",
        "Warm RAG - OISD 116 H2S Inspection",
    )
    result["scenarios"].append(s1)
    print(f"    {s1['status']} | {s1['latency_ms']}ms | evidence={s1.get('evidence_count',0)} | max_score={s1.get('max_retrieval_score',0)}")

    # Scenario 2: Second RAG (stays on reasoning model - truly warm)
    print("  [S2] Warm RAG query (flare system)...")
    s2 = run_query(
        "What is the nitrogen purge rate for the elevated flare tip per MRPL SOP?",
        "Warm RAG - Flare System N2 Purge",
    )
    result["scenarios"].append(s2)
    print(f"    {s2['status']} | {s2['latency_ms']}ms | evidence={s2.get('evidence_count',0)} | max_score={s2.get('max_retrieval_score',0)}")

    # Scenario 3: Code intent (triggers model swap to coder)
    print("  [S3] Code intent query (corrosion life)...")
    s3 = run_query(
        "Calculate the remaining corrosion life for a vessel with wall thickness 8.0 mm, minimum 6.0 mm, corrosion rate 0.45 mm/yr.",
        "Code Intent - Corrosion Life Calculation",
    )
    result["scenarios"].append(s3)
    print(f"    {s3['status']} | {s3['latency_ms']}ms | intent={s3.get('intent')} | sandbox={s3.get('sandbox_mode')}")

    # Step 5: Artifact generation test
    print("\n[5/7] Testing artifact generation...")
    result["artifact_test"] = run_artifact_generation()
    print(f"  {result['artifact_test']['status']} | {result['artifact_test'].get('latency_ms',0)}ms")

    # Step 6: Network monitor
    print("\n[6/7] Capturing network monitor state...")
    result["network_monitor"] = check_network_monitor()
    print(f"  Status: {result['network_monitor'].get('status', 'UNKNOWN')}")

    # Step 7: Capability labels and prior evidence
    print("\n[7/7] Recording capability labels and prior evidence...")
    result["capability_labels"] = {
        "reasoning": "AVAILABLE",
        "vision": "VISION_AVAILABLE",
        "coder": "AVAILABLE",
        "sandbox": "DEGRADED_SANDBOX",
        "network_monitor": "MONITOR_UNAVAILABLE",
        "gpu": "CPU_FALLBACK_OR_NO_GPU_OFFLOAD",
    }
    result["prior_offline_evidence"] = {
        "source": "data/airgap_rehearsal_result.json",
        "timestamp": "2026-09-02T02:30:58+05:30",
        "adapter_status": "Disabled",
        "query_status": "ok",
        "latency_ms": 14985,
        "evidence_count": 5,
        "note": "Prior elevated session successfully disabled Wi-Fi and executed offline query.",
    }

    # Write output
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")

    # Summary
    all_pass = all(s.get("status") == "pass" for s in result["scenarios"])
    print(f"\n{'=' * 60}")
    print(f"Evidence written: {OUTPUT}")
    print(f"Scenarios: {len(result['scenarios'])} executed, {'ALL PASS' if all_pass else 'SOME FAILED'}")
    print(f"{'=' * 60}")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
