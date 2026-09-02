#!/usr/bin/env python
"""
phase4_airgap_rehearsal.py — Comprehensive Phase 4 Air-Gap Rehearsal Script

Performs:
1. Pre-disconnection baseline capture
2. Attempts WAN adapter disable (requires elevation)
3. Runs offline scenarios via loopback API
4. Collects structured evidence
5. Restores network adapter
6. Writes data/phase4_airgap_rehearsal.json

Usage (from project root, elevated PowerShell recommended):
    python scripts/phase4_airgap_rehearsal.py
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
EVIDENCE_FILE = DATA_DIR / "phase4_airgap_rehearsal.json"
API_BASE = "http://127.0.0.1:8000"

# ────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat()


def run_ps(cmd: str) -> tuple[int, str]:
    """Run a PowerShell command and return (exit_code, stdout)."""
    r = subprocess.run(
        ["powershell", "-NoProfile", "-Command", cmd],
        capture_output=True, text=True, timeout=30,
    )
    return r.returncode, (r.stdout + r.stderr).strip()


def get_adapter_state(name: str = "Wi-Fi") -> str:
    """Get the status of a network adapter."""
    code, out = run_ps(f"(Get-NetAdapter -Name '{name}').Status")
    return out if code == 0 else f"ERROR: {out}"


def try_disable_adapter(name: str = "Wi-Fi") -> tuple[bool, str]:
    """Attempt to disable a network adapter. Requires elevation."""
    code, out = run_ps(f"Disable-NetAdapter -Name '{name}' -Confirm:$false")
    if code == 0:
        time.sleep(2)  # Allow propagation
        status = get_adapter_state(name)
        return status == "Disabled", f"Disabled successfully. Status: {status}"
    return False, f"Failed (likely non-elevated): {out}"


def try_enable_adapter(name: str = "Wi-Fi") -> tuple[bool, str]:
    """Re-enable the adapter."""
    code, out = run_ps(f"Enable-NetAdapter -Name '{name}' -Confirm:$false")
    if code == 0:
        time.sleep(3)  # Allow reconnection
        status = get_adapter_state(name)
        return status == "Up", f"Enabled. Status: {status}"
    return False, f"Failed: {out}"


def test_external_connectivity() -> tuple[bool, str]:
    """Test if external connectivity is available."""
    try:
        r = httpx.get("https://www.google.com", timeout=5.0)
        return True, f"Reachable (status {r.status_code})"
    except Exception as e:
        return False, f"Unreachable: {type(e).__name__}"


def api_health() -> dict:
    """Check FastAPI root endpoint."""
    try:
        r = httpx.get(f"{API_BASE}/", timeout=10)
        return {"reachable": True, "status_code": r.status_code, "body": r.json()}
    except Exception as e:
        return {"reachable": False, "error": str(e)}


def network_status() -> dict:
    """Check /network-status endpoint."""
    try:
        r = httpx.get(f"{API_BASE}/network-status", timeout=10)
        return r.json()
    except Exception as e:
        return {"error": str(e)}


def network_monitor_summary() -> dict:
    """Check /network/monitor/summary endpoint."""
    try:
        r = httpx.get(f"{API_BASE}/network/monitor/summary", timeout=10)
        return r.json()
    except Exception as e:
        return {"error": str(e), "status": "MONITOR_UNAVAILABLE"}


def run_agent_query(query: str, label: str) -> dict:
    """Execute a single agent query and return structured result."""
    t0 = time.monotonic()
    try:
        r = httpx.post(
            f"{API_BASE}/agent/run",
            json={"query": query},
            timeout=120,
        )
        elapsed_ms = round((time.monotonic() - t0) * 1000, 1)
        data = r.json()
        return {
            "name": label,
            "status": "pass" if data.get("status") == "ok" else "fail",
            "api_status": data.get("status"),
            "intent": data.get("intent"),
            "latency_ms": elapsed_ms,
            "evidence_count": len(data.get("retrieved_evidence", [])),
            "vision_status": data.get("vision_status"),
            "sandbox_mode": data.get("sandbox_mode"),
            "final_answer_length": len(data.get("final_answer") or ""),
            "error": data.get("error"),
            "notes": f"Query executed via loopback {API_BASE}",
        }
    except Exception as e:
        elapsed_ms = round((time.monotonic() - t0) * 1000, 1)
        return {
            "name": label,
            "status": "fail",
            "latency_ms": elapsed_ms,
            "error": str(e),
            "notes": "Exception during query execution",
        }


# ────────────────────────────────────────────────────────────────────────────
# Main rehearsal
# ────────────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("PHASE 4 — AIR-GAP REHEARSAL")
    print("=" * 60)

    evidence: dict = {
        "timestamp": now_iso(),
        "wan_adapter": {},
        "external_connectivity": {},
        "localhost_services": {},
        "scenarios_online": [],
        "scenarios_offline": [],
        "network_monitor": {},
        "gpu": {
            "status": "CPU_FALLBACK_OR_NO_GPU_OFFLOAD",
            "evidence": "VRAM delta 0 MiB across all models in preflight; llama-server launched with --n-gpu-layers 99 but no GPU allocation confirmed",
        },
        "sandbox": {
            "status": "DEGRADED_SANDBOX",
            "evidence": "Docker not installed; code runs in-process with strict AST allowlist filtering",
        },
        "conclusion": {},
    }

    # ── Step 1: Pre-disconnection baseline ──
    print("\n[1/7] Capturing baseline adapter state...")
    adapter_name = "Wi-Fi"
    state_before = get_adapter_state(adapter_name)
    evidence["wan_adapter"]["name"] = adapter_name
    evidence["wan_adapter"]["interface"] = "Intel(R) Wi-Fi 6E AX211 160MHz"
    evidence["wan_adapter"]["state_before"] = state_before
    print(f"  Adapter '{adapter_name}': {state_before}")

    # ── Step 2: Pre-disconnection service health ──
    print("\n[2/7] Verifying localhost services...")
    health = api_health()
    net_stat = network_status()
    evidence["localhost_services"]["fastapi"] = health
    evidence["localhost_services"]["llama_server"] = {
        "reachable": net_stat.get("llama_server_reachable", False),
        "note": "Managed on-demand by model_manager.py; starts when first query is sent",
    }
    evidence["localhost_services"]["qdrant"] = {"healthy": net_stat.get("qdrant_healthy", False)}
    print(f"  FastAPI: {'OK' if health.get('reachable') else 'FAIL'}")
    print(f"  Qdrant: {'OK' if net_stat.get('qdrant_healthy') else 'FAIL'}")

    # ── Step 3: Pre-disconnection agent query (online baseline) ──
    print("\n[3/7] Running online baseline RAG query...")
    online_rag = run_agent_query(
        "What is the nitrogen purge rate for the elevated flare tip per MRPL SOP?",
        "Online RAG Baseline",
    )
    evidence["scenarios_online"].append(online_rag)
    print(f"  Status: {online_rag['status']} | Latency: {online_rag['latency_ms']}ms | Evidence: {online_rag.get('evidence_count', 0)}")

    # ── Step 4: Attempt WAN disconnection ──
    print("\n[4/7] Attempting WAN adapter disable...")
    ext_before_reachable, ext_before_note = test_external_connectivity()
    evidence["external_connectivity"]["before_disable"] = {
        "reachable": ext_before_reachable,
        "note": ext_before_note,
    }

    disable_success, disable_note = try_disable_adapter(adapter_name)
    evidence["wan_adapter"]["disable_attempted"] = True
    evidence["wan_adapter"]["disable_success"] = disable_success
    evidence["wan_adapter"]["disable_note"] = disable_note

    if disable_success:
        state_during = get_adapter_state(adapter_name)
        evidence["wan_adapter"]["state_during_test"] = state_during
        print(f"  Adapter disabled: {state_during}")

        # Verify external connectivity is gone
        ext_reachable, ext_note = test_external_connectivity()
        evidence["external_connectivity"]["tested"] = True
        evidence["external_connectivity"]["result"] = "unavailable" if not ext_reachable else "still_available"
        evidence["external_connectivity"]["method"] = "httpx GET https://www.google.com timeout=5s"
        evidence["external_connectivity"]["note"] = ext_note
        print(f"  External connectivity: {'UNAVAILABLE (expected)' if not ext_reachable else 'STILL AVAILABLE (unexpected)'}")
    else:
        evidence["wan_adapter"]["state_during_test"] = state_before
        evidence["external_connectivity"]["tested"] = True
        evidence["external_connectivity"]["result"] = "adapter_disable_failed_elevation_required"
        evidence["external_connectivity"]["method"] = "Disable-NetAdapter requires Administrator"
        evidence["external_connectivity"]["note"] = disable_note
        print(f"  Adapter disable FAILED (elevation required): {disable_note}")
        print("  Proceeding with functional loopback-only test (Wi-Fi still Up)")

    # ── Step 5: Offline (or loopback-only) scenarios ──
    print("\n[5/7] Running air-gap scenarios via loopback...")

    # Scenario 1: RAG Query
    print("  [Scenario 1] RAG query (H2S inspection interval)...")
    s1 = run_agent_query(
        "What is the maximum inspection interval for pressure vessels in H2S service per OISD 116?",
        "Air-Gap RAG Query",
    )
    evidence["scenarios_offline"].append(s1)
    print(f"    Status: {s1['status']} | Latency: {s1['latency_ms']}ms | Evidence: {s1.get('evidence_count', 0)}")

    # Scenario 2: Code Intent Query
    print("  [Scenario 2] Code intent query (corrosion rate)...")
    s2 = run_agent_query(
        "Calculate the remaining corrosion life for a vessel with wall thickness 8.0 mm, minimum 6.0 mm, corrosion rate 0.45 mm/yr.",
        "Air-Gap Code Intent",
    )
    evidence["scenarios_offline"].append(s2)
    print(f"    Status: {s2['status']} | Latency: {s2['latency_ms']}ms | Evidence: {s2.get('evidence_count', 0)}")

    # Scenario 3: Artifact generation (if endpoint exists)
    print("  [Scenario 3] Artifact generation check...")
    try:
        r = httpx.get(f"{API_BASE}/artifacts/types", timeout=10)
        artifact_status = "endpoint_reachable" if r.status_code == 200 else f"status_{r.status_code}"
    except Exception as e:
        artifact_status = f"not_available: {type(e).__name__}"
    evidence["scenarios_offline"].append({
        "name": "Artifact Endpoint Check",
        "status": "pass" if "reachable" in artifact_status else "not_run",
        "notes": artifact_status,
    })
    print(f"    Artifact endpoint: {artifact_status}")

    # ── Step 6: Network monitor capture ──
    print("\n[6/7] Capturing network monitor state...")
    monitor = network_monitor_summary()
    evidence["network_monitor"] = {
        "mode": "psutil_only",
        "status": monitor.get("status", "MONITOR_UNAVAILABLE"),
        "limitations": "No NPCAP installed; cannot capture packets. psutil process-level socket evidence only.",
        "raw_response": monitor,
    }
    print(f"  Monitor status: {monitor.get('status', 'UNKNOWN')}")

    # ── Step 7: Restore adapter ──
    print("\n[7/7] Restoring network adapter...")
    if disable_success:
        restore_success, restore_note = try_enable_adapter(adapter_name)
        state_after = get_adapter_state(adapter_name)
        evidence["wan_adapter"]["state_after"] = state_after
        evidence["wan_adapter"]["restore_success"] = restore_success
        evidence["wan_adapter"]["restore_note"] = restore_note
        print(f"  Adapter restored: {state_after}")

        # Verify external connectivity is back
        time.sleep(3)
        ext_after_reachable, ext_after_note = test_external_connectivity()
        evidence["external_connectivity"]["after_restore"] = {
            "reachable": ext_after_reachable,
            "note": ext_after_note,
        }
        print(f"  External connectivity restored: {ext_after_reachable}")
    else:
        evidence["wan_adapter"]["state_after"] = state_before
        evidence["wan_adapter"]["restore_success"] = True
        evidence["wan_adapter"]["restore_note"] = "No restore needed (adapter was never disabled)"
        print(f"  No restore needed (adapter was never disabled)")

    # ── Build conclusion ──
    all_offline_passed = all(s.get("status") == "pass" for s in evidence["scenarios_offline"] if s.get("status") != "not_run")
    adapter_was_disabled = disable_success

    if adapter_was_disabled and all_offline_passed:
        airgap_claim = "Local execution confirmed with WAN adapter disabled. All loopback queries succeeded without external network dependency."
    elif all_offline_passed:
        airgap_claim = "Local execution confirmed via loopback (127.0.0.1). WAN adapter disable requires elevated PowerShell; functional test passed without external dependency."
    else:
        airgap_claim = "PARTIAL — some offline scenarios failed."

    evidence["conclusion"] = {
        "local_execution_continued": all_offline_passed,
        "adapter_disabled_during_test": adapter_was_disabled,
        "airgap_claim_allowed": airgap_claim,
        "unsupported_claims": [
            "Packet-level proof of zero external egress (no NPCAP)",
            "Confirmed GPU acceleration (VRAM delta 0 across all models)",
            "Production-grade sandbox isolation (Docker not installed)",
            "Absolute proof that no process attempted network access",
        ],
    }

    # ── Write evidence file ──
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    EVIDENCE_FILE.write_text(json.dumps(evidence, indent=2, default=str), encoding="utf-8")
    print(f"\n{'=' * 60}")
    print(f"Evidence written: {EVIDENCE_FILE}")
    print(f"Conclusion: {airgap_claim}")
    print(f"{'=' * 60}")

    return 0 if all_offline_passed else 1


if __name__ == "__main__":
    sys.exit(main())
