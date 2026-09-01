"""
model_manager.py — Single-active-at-a-time model manager for llama-server.

Architecture Decision (PROJECT_BRAIN.md Phase 2):
    - Models are NEVER co-resident. Only one role active at a time.
    - Swap mechanism: process-restart (kill old PID, start new process, wait for /health).
    - b10734 has no /models/load API; process-restart is the only safe approach.
    - Model paths are sourced from config.py only — no arbitrary paths accepted.
    - Every switch event is logged to data/model_switch_log.jsonl.
"""
from __future__ import annotations

import json
import logging
import os
import subprocess
import time
from pathlib import Path
from typing import Literal

import httpx

from .config import settings

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Constants                                                                    #
# --------------------------------------------------------------------------- #

ModelRole = Literal["reasoning", "vision", "code"]

_ROLE_ALLOWLIST: dict[str, dict] = {
    "reasoning": {
        "model_path": settings.model_reasoning_path,
        "extra_flags": [],
    },
    "vision": {
        "model_path": settings.model_vision_path,
        "extra_flags": ["--mmproj", settings.model_vision_mmproj_path],
    },
    "code": {
        "model_path": settings.model_code_path,
        "extra_flags": [],
    },
}

# --------------------------------------------------------------------------- #
# State                                                                        #
# --------------------------------------------------------------------------- #

_current_role: str | None = None
_current_pid: int | None = None
_current_process: subprocess.Popen | None = None


# --------------------------------------------------------------------------- #
# Internal helpers                                                              #
# --------------------------------------------------------------------------- #

def _log_switch_event(event: dict) -> None:
    """Append a JSON line to the model switch log."""
    Path(settings.model_switch_log).parent.mkdir(parents=True, exist_ok=True)
    with open(settings.model_switch_log, "a", encoding="utf-8") as f:
        f.write(json.dumps(event) + "\n")


def _stop_current() -> None:
    """Kill the currently running llama-server process, if any."""
    global _current_process, _current_pid, _current_role

    if _current_process is not None:
        pid = _current_process.pid
        logger.info("Stopping llama-server PID %d (role=%s)", pid, _current_role)
        try:
            _current_process.terminate()
            _current_process.wait(timeout=10)
        except Exception:
            try:
                _current_process.kill()
            except Exception:
                pass
        _log_switch_event({
            "event": "model_stopped",
            "role": _current_role,
            "pid": pid,
            "timestamp": time.time(),
        })
        _current_process = None
        _current_pid = None
        _current_role = None


def _wait_for_health(timeout: int = None) -> bool:
    """Poll llama-server /health until ready or timeout."""
    timeout = timeout or settings.llama_model_switch_timeout
    url = f"{settings.llama_server_url}/health"
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            r = httpx.get(url, timeout=3.0)
            if r.status_code == 200:
                body = r.json()
                if body.get("status") in ("ok", "loading model"):
                    # "loading model" means it started but is still loading — keep waiting
                    if body.get("status") == "ok":
                        return True
        except Exception:
            pass
        time.sleep(2)
    return False


# --------------------------------------------------------------------------- #
# Public API                                                                   #
# --------------------------------------------------------------------------- #

def get_current_role() -> str | None:
    """Return currently active model role, or None if no model is running."""
    return _current_role


def get_current_pid() -> int | None:
    return _current_pid


def switch_model(role: str) -> dict:
    """
    Switch the active model to the given role.

    Returns a dict with:
        success: bool
        role: str
        pid: int | None
        cold_start_ms: float
        error: str | None
    """
    global _current_role, _current_pid, _current_process

    # 1. Validate role against allowlist — never accept arbitrary input
    if role not in _ROLE_ALLOWLIST:
        msg = f"Role '{role}' not in allowlist {list(_ROLE_ALLOWLIST)}."
        logger.error(msg)
        return {"success": False, "role": role, "pid": None, "cold_start_ms": 0.0, "error": msg}

    # 2. If already running the requested role, return immediately
    if _current_role == role and _current_process is not None:
        logger.info("Model role '%s' already active (PID %d).", role, _current_pid)
        return {"success": True, "role": role, "pid": _current_pid, "cold_start_ms": 0.0, "error": None}

    role_cfg = _ROLE_ALLOWLIST[role]
    model_path = role_cfg["model_path"]

    # 3. Validate model file exists
    if not Path(model_path).exists():
        msg = f"Model file not found: {model_path}"
        logger.error(msg)
        _log_switch_event({
            "event": "model_missing",
            "role": role,
            "model_path": model_path,
            "timestamp": time.time(),
            "error": msg,
        })
        return {"success": False, "role": role, "pid": None, "cold_start_ms": 0.0, "error": msg}

    # For vision, also validate mmproj
    if role == "vision":
        mmproj = settings.model_vision_mmproj_path
        if not Path(mmproj).exists():
            msg = f"mmproj file not found: {mmproj}"
            logger.error(msg)
            _log_switch_event({
                "event": "mmproj_missing",
                "role": role,
                "mmproj_path": mmproj,
                "timestamp": time.time(),
                "error": msg,
            })
            return {"success": False, "role": role, "pid": None, "cold_start_ms": 0.0, "error": msg}

    # 4. Stop current model
    _stop_current()

    # 5. Build launch command (paths from config only)
    exe = settings.llama_server_exe
    cmd = [
        exe,
        "--model", model_path,
        "--host", settings.llama_server_host,
        "--port", str(settings.llama_server_port),
        "-ngl", str(settings.llama_n_gpu_layers),
        "--ctx-size", str(settings.llama_ctx_size),
        "--threads", str(settings.llama_threads),
    ] + role_cfg["extra_flags"]

    # 6. Start new process
    start_ts = time.time()
    start_mono = time.monotonic()
    logger.info("Starting llama-server: role=%s model=%s", role, Path(model_path).name)
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=str(Path(exe).parent),
        )
    except Exception as exc:
        msg = f"Failed to start llama-server: {exc}"
        logger.error(msg)
        _log_switch_event({
            "event": "start_failed",
            "role": role,
            "timestamp": start_ts,
            "error": msg,
        })
        return {"success": False, "role": role, "pid": None, "cold_start_ms": 0.0, "error": msg}

    _current_process = proc
    _current_pid = proc.pid
    _current_role = role

    # 7. Wait for /health
    ready = _wait_for_health()
    ready_ts = time.time()
    cold_start_ms = (time.monotonic() - start_mono) * 1000

    event = {
        "event": "model_started" if ready else "health_timeout",
        "role": role,
        "model": Path(model_path).name,
        "pid": proc.pid,
        "start_timestamp": start_ts,
        "ready_timestamp": ready_ts,
        "cold_start_ms": round(cold_start_ms, 1),
        "success": ready,
    }
    _log_switch_event(event)

    if not ready:
        msg = f"llama-server did not become healthy within {settings.llama_model_switch_timeout}s"
        logger.error(msg)
        _stop_current()
        return {"success": False, "role": role, "pid": None, "cold_start_ms": cold_start_ms, "error": msg}

    logger.info(
        "llama-server ready: role=%s PID=%d cold_start=%.0fms",
        role, proc.pid, cold_start_ms,
    )
    return {
        "success": True,
        "role": role,
        "pid": proc.pid,
        "cold_start_ms": round(cold_start_ms, 1),
        "error": None,
    }


def stop_all() -> None:
    """Stop any running model process. Call on application shutdown."""
    _stop_current()
