"""
scripts/probe_vision.py — Standalone vision capability probe.

Must be run BEFORE Phase 2 vision node is used.
Writes result to data/vision_probe_result.json which graph reads at startup.

Usage:
    python scripts/probe_vision.py
    python scripts/probe_vision.py --image data/test_pid.png

If GGUF + mmproj are missing → writes VISION_UNAVAILABLE immediately.
If present → starts llama-server with --mmproj, sends synthetic prompt, records latency.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

# Ensure project root on path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config import settings

PROBE_RESULT_PATH = Path(settings.vision_probe_result)
PROBE_RESULT_PATH.parent.mkdir(parents=True, exist_ok=True)

# Synthetic image: 1x1 white PNG (no external files needed)
SYNTHETIC_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


def write_result(result: dict) -> None:
    result["probe_timestamp"] = time.time()
    PROBE_RESULT_PATH.write_text(json.dumps(result, indent=2), encoding="utf-8")
    status = result.get("status", "unknown")
    print(f"[PROBE] Result: {status}")
    if result.get("reason"):
        print(f"[PROBE] Reason: {result['reason']}")


def probe(image_path: str | None = None) -> dict:
    model_path = Path(settings.model_vision_path)
    mmproj_path = Path(settings.model_vision_mmproj_path)

    # --- Check files exist ---
    if not model_path.exists():
        result = {
            "status": "VISION_UNAVAILABLE",
            "reason": f"Model GGUF not found: {model_path}",
            "model_path": str(model_path),
            "mmproj_path": str(mmproj_path),
            "load_success": False,
            "inference_latency_ms": None,
            "vram_delta_mib": None,
            "result_preview": None,
        }
        write_result(result)
        return result

    if not mmproj_path.exists():
        result = {
            "status": "VISION_UNAVAILABLE",
            "reason": f"mmproj file not found: {mmproj_path}",
            "model_path": str(model_path),
            "mmproj_path": str(mmproj_path),
            "load_success": False,
            "inference_latency_ms": None,
            "vram_delta_mib": None,
            "result_preview": None,
        }
        write_result(result)
        return result

    print(f"[PROBE] Model: {model_path.name}")
    print(f"[PROBE] mmproj: {mmproj_path.name}")

    # --- Read baseline VRAM ---
    def get_vram_mib() -> float | None:
        try:
            out = subprocess.check_output(
                ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
                timeout=5, text=True
            ).strip()
            return float(out.split("\n")[0])
        except Exception:
            return None

    vram_before = get_vram_mib()

    # --- Start llama-server with --mmproj ---
    exe = Path(settings.llama_server_exe)
    if not exe.exists():
        result = {
            "status": "VISION_UNAVAILABLE",
            "reason": f"llama-server.exe not found: {exe}",
            "load_success": False,
        }
        write_result(result)
        return result

    cmd = [
        str(exe),
        "--model", str(model_path),
        "--mmproj", str(mmproj_path),
        "--host", settings.llama_server_host,
        "--port", str(settings.llama_server_port),
        "-ngl", str(settings.llama_n_gpu_layers),
        "--ctx-size", "2048",
        "--log-disable",
    ]

    print(f"[PROBE] Launching: {' '.join(cmd[:6])} ...")
    t_start = time.monotonic()
    proc = None

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=str(exe.parent),
        )

        # Poll /health
        import httpx
        ready = False
        deadline = time.monotonic() + settings.llama_model_switch_timeout
        while time.monotonic() < deadline:
            time.sleep(2)
            try:
                r = httpx.get(f"{settings.llama_server_url}/health", timeout=3.0)
                if r.status_code == 200 and r.json().get("status") == "ok":
                    ready = True
                    break
            except Exception:
                pass
            print(".", end="", flush=True)
        print()

        load_time_ms = (time.monotonic() - t_start) * 1000
        vram_after = get_vram_mib()
        vram_delta = (vram_after - vram_before) if (vram_before and vram_after) else None

        if not ready:
            result = {
                "status": "VISION_UNAVAILABLE",
                "reason": f"llama-server did not become healthy within {settings.llama_model_switch_timeout}s",
                "model_path": str(model_path),
                "mmproj_path": str(mmproj_path),
                "load_success": False,
                "load_time_ms": round(load_time_ms, 1),
                "inference_latency_ms": None,
                "vram_delta_mib": vram_delta,
                "result_preview": None,
            }
            write_result(result)
            return result

        print(f"[PROBE] Server ready in {load_time_ms/1000:.1f}s | VRAM delta: {vram_delta} MiB")

        # --- Run synthetic vision prompt ---
        if image_path and Path(image_path).exists():
            import base64
            img_b64 = base64.b64encode(Path(image_path).read_bytes()).decode()
        else:
            img_b64 = SYNTHETIC_PNG_B64

        t_infer = time.monotonic()
        infer_result = ""
        try:
            r = httpx.post(
                f"{settings.llama_server_url}/completion",
                json={
                    "prompt": "Describe what you see in this image in one sentence.",
                    "n_predict": 60,
                    "image_data": [{"data": img_b64, "id": 1}],
                    "stop": ["<|im_end|>"],
                },
                timeout=60.0,
            )
            r.raise_for_status()
            infer_result = r.json().get("content", "").strip()
        except Exception as exc:
            infer_result = f"inference_error: {exc}"

        infer_ms = (time.monotonic() - t_infer) * 1000

        result = {
            "status": "ok",
            "reason": None,
            "model_path": str(model_path),
            "mmproj_path": str(mmproj_path),
            "load_success": True,
            "load_time_ms": round(load_time_ms, 1),
            "inference_latency_ms": round(infer_ms, 1),
            "vram_delta_mib": vram_delta,
            "result_preview": infer_result[:200],
        }
        write_result(result)
        return result

    except Exception as exc:
        result = {
            "status": "VISION_UNAVAILABLE",
            "reason": f"probe exception: {exc}",
            "load_success": False,
        }
        write_result(result)
        return result
    finally:
        if proc is not None:
            try:
                proc.terminate()
                proc.wait(timeout=10)
            except Exception:
                pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Probe Qwen2.5-VL vision capability")
    parser.add_argument("--image", type=str, default=None, help="Path to a test image file")
    args = parser.parse_args()
    result = probe(image_path=args.image)
    print(json.dumps(result, indent=2))
