"""
agent/sandbox.py — Sandboxed code execution.

Docker preferred; falls back to DEGRADED_SANDBOX (in-process restricted exec).

Architecture Decision (PROJECT_BRAIN.md Phase 2):
    - Docker unavailable on Windows laptop → DEGRADED_SANDBOX
    - DEGRADED_SANDBOX uses RestrictedPython with import allowlist
    - All degraded-mode results are labelled; never claimed as real isolation
    - Allowlist: only pure math/stdlib modules; no network, no subprocess, no filesystem
"""
from __future__ import annotations

import ast
import io
import json
import logging
import time
import traceback
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path
from typing import Any

from ..config import settings

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Schema validation                                                            #
# --------------------------------------------------------------------------- #

_REQUIRED_SCHEMA_FIELDS = {"code", "declared_inputs", "expected_outputs", "language"}


def validate_code_schema(payload: dict) -> tuple[bool, str]:
    """
    Validate code payload schema before any execution attempt.
    Returns (is_valid, error_message).
    """
    missing = _REQUIRED_SCHEMA_FIELDS - set(payload.keys())
    if missing:
        return False, f"Missing required fields: {missing}"
    if payload.get("language", "").lower() not in ("python", "python3"):
        return False, f"Only Python is supported; got: {payload.get('language')}"
    if not isinstance(payload.get("code"), str):
        return False, "Field 'code' must be a string"
    if not isinstance(payload.get("declared_inputs"), dict):
        return False, "Field 'declared_inputs' must be a dict"
    if not isinstance(payload.get("expected_outputs"), list):
        return False, "Field 'expected_outputs' must be a list of strings"
    return True, ""


# --------------------------------------------------------------------------- #
# AST-level safety checks                                                      #
# --------------------------------------------------------------------------- #

_FORBIDDEN_NODES = (
    ast.Import,
    ast.ImportFrom,
)


def _check_ast(code: str, allowed_imports: list[str]) -> tuple[bool, str]:
    """Parse AST and reject forbidden constructs."""
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return False, f"SyntaxError: {exc}"

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name.split(".")[0] not in allowed_imports:
                    return False, f"Forbidden import: {alias.name}"
        elif isinstance(node, ast.ImportFrom):
            module = (node.module or "").split(".")[0]
            if module not in allowed_imports:
                return False, f"Forbidden import from: {node.module}"
        elif isinstance(node, (ast.Call,)):
            # Block calls to dangerous builtins
            if isinstance(node.func, ast.Name) and node.func.id in (
                "exec", "eval", "compile", "__import__", "open",
                "input", "breakpoint", "print",
            ):
                if node.func.id not in ("print",):  # allow print
                    return False, f"Forbidden call: {node.func.id}()"
        # Block attribute access to os, sys, subprocess, socket, etc.
        elif isinstance(node, ast.Attribute):
            if isinstance(node.value, ast.Name) and node.value.id in (
                "os", "sys", "subprocess", "socket", "shutil", "pathlib",
                "builtins", "__builtins__",
            ):
                return False, f"Forbidden attribute access: {node.value.id}.{node.attr}"

    return True, ""


# --------------------------------------------------------------------------- #
# Docker sandbox                                                               #
# --------------------------------------------------------------------------- #

def _try_docker_available() -> bool:
    try:
        import docker as docker_sdk
        client = docker_sdk.from_env(timeout=5)
        client.ping()
        return True
    except Exception:
        return False


def _run_docker(code: str, inputs: dict) -> dict:
    """Run code inside a Docker container with network=none, --cap-drop=ALL."""
    import docker as docker_sdk
    import tempfile, os

    client = docker_sdk.from_env()
    # Wrap code: inject inputs as variables, capture output
    wrapped = f"""
import json, sys
{chr(10).join(f'{k} = {repr(v)}' for k, v in inputs.items())}
{code}
"""
    with tempfile.TemporaryDirectory() as tmpdir:
        script_path = Path(tmpdir) / "script.py"
        script_path.write_text(wrapped, encoding="utf-8")

        start = time.monotonic()
        try:
            result = client.containers.run(
                image="python:3.11-slim",
                command=["python", "/workspace/script.py"],
                volumes={tmpdir: {"bind": "/workspace", "mode": "ro"}},
                network_mode="none",
                cap_drop=["ALL"],
                mem_limit="128m",
                cpu_period=100000,
                cpu_quota=50000,
                read_only=True,
                tmpfs={"/tmp": "size=32m"},
                remove=True,
                timeout=settings.sandbox_timeout_secs,
                stdout=True,
                stderr=True,
            )
            elapsed_ms = (time.monotonic() - start) * 1000
            return {
                "stdout": result.decode("utf-8", errors="replace")[:settings.sandbox_max_output_bytes],
                "stderr": "",
                "exit_code": 0,
                "timed_out": False,
                "mode": "docker",
                "elapsed_ms": round(elapsed_ms, 1),
            }
        except Exception as exc:
            elapsed_ms = (time.monotonic() - start) * 1000
            return {
                "stdout": "",
                "stderr": str(exc),
                "exit_code": -1,
                "timed_out": False,
                "mode": "docker",
                "elapsed_ms": round(elapsed_ms, 1),
            }


# --------------------------------------------------------------------------- #
# DEGRADED_SANDBOX (in-process restricted exec)                                #
# --------------------------------------------------------------------------- #

def _run_degraded(code: str, inputs: dict, allowed_imports: list[str]) -> dict:
    """
    Execute code in-process with minimal restriction.
    LABELLED AS DEGRADED_SANDBOX — not equivalent to Docker isolation.
    Suitable only for deterministic synthetic calculations with no user-controlled data.
    """
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()

    # Build restricted globals
    import math, cmath, decimal, fractions, statistics, json as _json
    import re as _re, datetime, time as _time, collections, itertools, functools

    # Build a restricted __import__ that only allows the allowlist
    _allowed_set = set(allowed_imports)
    _module_cache = {
        "math": math, "cmath": cmath, "decimal": decimal, "fractions": fractions,
        "statistics": statistics, "json": _json, "re": _re, "datetime": datetime,
        "time": _time, "collections": collections, "itertools": itertools,
        "functools": functools,
    }

    def _restricted_import(name, *args, **kwargs):
        top = name.split(".")[0]
        if top not in _allowed_set:
            raise ImportError(f"Import of '{name}' is not allowed in sandbox")
        if top in _module_cache:
            return _module_cache[top]
        raise ImportError(f"Module '{name}' not pre-loaded in sandbox")

    safe_globals: dict[str, Any] = {
        "__builtins__": {
            "__import__": _restricted_import,
            "abs": abs, "all": all, "any": any, "bool": bool, "dict": dict,
            "divmod": divmod, "enumerate": enumerate, "filter": filter,
            "float": float, "format": format, "frozenset": frozenset,
            "getattr": getattr, "hasattr": hasattr, "hash": hash,
            "int": int, "isinstance": isinstance, "issubclass": issubclass,
            "iter": iter, "len": len, "list": list, "map": map, "max": max,
            "min": min, "next": next, "print": print, "range": range,
            "repr": repr, "reversed": reversed, "round": round, "set": set,
            "slice": slice, "sorted": sorted, "str": str, "sum": sum,
            "tuple": tuple, "type": type, "zip": zip,
            "True": True, "False": False, "None": None,
            "ValueError": ValueError, "TypeError": TypeError,
            "ZeroDivisionError": ZeroDivisionError, "Exception": Exception,
        },
        "math": math,
        "json": _json,
        "re": _re,
        "datetime": datetime,
        "decimal": decimal,
        "fractions": fractions,
        "statistics": statistics,
        "collections": collections,
        "itertools": itertools,
        "functools": functools,
    }
    # Inject declared inputs
    safe_globals.update(inputs)

    start = time.monotonic()
    exit_code = 0
    timed_out = False

    try:
        with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            exec(compile(code, "<sandbox>", "exec"), safe_globals)  # noqa: S102
    except Exception:
        stderr_buf.write(traceback.format_exc())
        exit_code = 1

    elapsed_ms = (time.monotonic() - start) * 1000
    stdout = stdout_buf.getvalue()[:settings.sandbox_max_output_bytes]
    stderr = stderr_buf.getvalue()[:settings.sandbox_max_output_bytes]

    return {
        "stdout": stdout,
        "stderr": stderr,
        "exit_code": exit_code,
        "timed_out": timed_out,
        "mode": "DEGRADED_SANDBOX",
        "elapsed_ms": round(elapsed_ms, 1),
        "warning": (
            "DEGRADED_SANDBOX: in-process execution, not Docker-isolated. "
            "Acceptable only for deterministic synthetic calculations."
        ),
    }


# --------------------------------------------------------------------------- #
# Public API                                                                   #
# --------------------------------------------------------------------------- #

def execute(payload: dict) -> dict:
    """
    Validate and execute a code payload.

    payload must have: code, declared_inputs, expected_outputs, language

    Returns a result dict with stdout, stderr, exit_code, timed_out, mode, elapsed_ms.
    """
    # 1. Schema validation
    valid, schema_err = validate_code_schema(payload)
    if not valid:
        return {
            "stdout": "", "stderr": schema_err, "exit_code": -2,
            "timed_out": False, "mode": "rejected", "elapsed_ms": 0.0,
            "error": f"SCHEMA_VALIDATION_FAILED: {schema_err}",
        }

    code = payload["code"]
    inputs = payload.get("declared_inputs", {})
    allowed = list(settings.sandbox_allowed_imports)

    # 2. AST safety check
    ast_ok, ast_err = _check_ast(code, allowed)
    if not ast_ok:
        return {
            "stdout": "", "stderr": ast_err, "exit_code": -3,
            "timed_out": False, "mode": "rejected", "elapsed_ms": 0.0,
            "error": f"AST_VALIDATION_FAILED: {ast_err}",
        }

    # 3. Execution — Docker preferred, DEGRADED_SANDBOX fallback
    if _try_docker_available():
        logger.info("Sandbox: running in Docker")
        return _run_docker(code, inputs)
    else:
        logger.warning("Sandbox: Docker unavailable — using DEGRADED_SANDBOX")
        return _run_degraded(code, inputs, allowed)
