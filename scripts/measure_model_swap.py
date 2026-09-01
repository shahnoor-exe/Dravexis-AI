"""
scripts/measure_model_swap.py — Measure cold-start and hot-switch latency for each model.

Results are written to data/model_swap_latency.json and logged to brain file.

Usage:
    python scripts/measure_model_swap.py

Requirements: GGUF files must exist in models/. Run after download_model.ps1.
Models are started sequentially; VRAM is monitored via nvidia-smi.
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config import settings
import httpx

RESULT_PATH = Path("data") / "model_swap_latency.json"
RESULT_PATH.parent.mkdir(parents=True, exist_ok=True)


def get_vram_mib() -> float | None:
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
            timeout=5, text=True,
        ).strip()
        return float(out.split("\n")[0])
    except Exception:
        return None


def wait_for_health(url: str, timeout: int = 90) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            r = httpx.get(f"{url}/health", timeout=3.0)
            if r.status_code == 200 and r.json().get("status") == "ok":
                return True
        except Exception:
            pass
        time.sleep(2)
        print(".", end="", flush=True)
    print()
    return False


def measure_role(role: str, model_path: str, extra_flags: list[str] = None) -> dict:
    extra_flags = extra_flags or []
    model_p = Path(model_path)

    if not model_p.exists():
        print(f"  [SKIP] {role}: model not found at {model_p}")
        return {"role": role, "skipped": True, "reason": f"model not found: {model_p}"}

    exe = settings.llama_server_exe
    cmd = [
        exe,
        "--model", str(model_p),
        "--host", settings.llama_server_host,
        "--port", str(settings.llama_server_port),
        "-ngl", str(settings.llama_n_gpu_layers),
        "--ctx-size", str(settings.llama_ctx_size),
        "--threads", str(settings.llama_threads),
        "--log-disable",
    ] + extra_flags

    print(f"\n[{role}] Starting: {model_p.name}")
    vram_before = get_vram_mib()
    t_start = time.monotonic()

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        cwd=str(Path(exe).parent),
    )

    ready = wait_for_health(settings.llama_server_url, timeout=settings.llama_model_switch_timeout)
    cold_start_ms = (time.monotonic() - t_start) * 1000
    vram_after = get_vram_mib()

    if ready:
        print(f"  Cold-start: {cold_start_ms/1000:.1f}s | VRAM delta: {(vram_after or 0) - (vram_before or 0):.0f} MiB")
    else:
        print(f"  TIMEOUT after {cold_start_ms/1000:.0f}s")

    proc.terminate()
    try:
        proc.wait(timeout=10)
    except Exception:
        proc.kill()
    time.sleep(3)  # Let GPU free VRAM

    return {
        "role": role,
        "model": model_p.name,
        "skipped": False,
        "cold_start_ms": round(cold_start_ms, 1),
        "health_ready": ready,
        "vram_before_mib": vram_before,
        "vram_after_mib": vram_after,
        "vram_delta_mib": round((vram_after or 0) - (vram_before or 0), 1) if vram_before and vram_after else None,
    }


def main():
    print("=" * 60)
    print("Model Swap Latency Measurement")
    print("=" * 60)

    roles = [
        ("reasoning", settings.model_reasoning_path, []),
        ("code", settings.model_code_path, []),
        ("vision", settings.model_vision_path,
         ["--mmproj", settings.model_vision_mmproj_path]
         if Path(settings.model_vision_mmproj_path).exists() else []),
    ]

    results = []
    for role, path, extra in roles:
        r = measure_role(role, path, extra)
        results.append(r)

    # Hot-switch: reasoning → code (sequential swap)
    r1 = Path(settings.model_reasoning_path)
    r2 = Path(settings.model_code_path)
    if r1.exists() and r2.exists():
        import socket as _socket
        def _port_free(port: int) -> bool:
            with _socket.socket(_socket.AF_INET, _socket.SOCK_STREAM) as s:
                return s.connect_ex(("127.0.0.1", port)) != 0

        if not _port_free(settings.llama_server_port):
            print(f"\n[hot-switch] SKIPPED — port {settings.llama_server_port} already in use; stop llama-server first")
            results.append({
                "role": "hot_switch_reasoning_to_code",
                "skipped": True,
                "reason": f"port {settings.llama_server_port} in use at hot-switch stage",
            })
        else:
            try:
                print("\n[hot-switch] reasoning -> code")
                # Start reasoning
                proc1 = subprocess.Popen(
                    [settings.llama_server_exe, "--model", str(r1),
                     "--host", settings.llama_server_host, "--port", str(settings.llama_server_port),
                     "-ngl", str(settings.llama_n_gpu_layers), "--log-disable"],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    cwd=str(Path(settings.llama_server_exe).parent),
                )
                wait_for_health(settings.llama_server_url)
                # Switch to code
                t_switch = time.monotonic()
                proc1.terminate()
                proc1.wait(timeout=10)
                time.sleep(2)
                proc2 = subprocess.Popen(
                    [settings.llama_server_exe, "--model", str(r2),
                     "--host", settings.llama_server_host, "--port", str(settings.llama_server_port),
                     "-ngl", str(settings.llama_n_gpu_layers), "--log-disable"],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    cwd=str(Path(settings.llama_server_exe).parent),
                )
                ready2 = wait_for_health(settings.llama_server_url)
                switch_ms = (time.monotonic() - t_switch) * 1000
                proc2.terminate()
                proc2.wait(timeout=10)
                results.append({
                    "role": "hot_switch_reasoning_to_code",
                    "switch_ms": round(switch_ms, 1),
                    "ready": ready2,
                })
                print(f"  Hot-switch latency: {switch_ms/1000:.1f}s")
            except Exception as exc:
                print(f"  [WARN] Hot-switch measurement failed: {exc}")
                results.append({
                    "role": "hot_switch_reasoning_to_code",
                    "skipped": True,
                    "reason": f"exception: {exc}",
                })

    output = {
        "measured_at": time.time(),
        "results": results,
    }
    RESULT_PATH.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"\n[DONE] Results saved to {RESULT_PATH}")
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
