"""
agent/checkpoint_adapter.py — Wraps LangGraph's SqliteSaver.

Architecture Decision (PROJECT_BRAIN.md Phase 2):
    - SqliteSaver is used for session state persistence.
    - Newer langgraph uses SqliteSaver as a context manager (with SqliteSaver.from_conn_string(...) as cp).
    - This adapter enters the context manager once and keeps the connection open for the process lifetime.
    - Incompatibility is recorded and graph runs without persistence — never raises.
"""
from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_checkpointer = None
_checkpointer_available = False
_incompatibility_note: str = ""
_ctx_manager = None  # Keep context manager reference alive


def get_checkpointer(db_path: str):
    """
    Return a SqliteSaver checkpointer, or None if incompatible.
    Handles both direct-instance and context-manager API variants.
    Incompatibility never raises — graph still runs without persistence.
    """
    global _checkpointer, _checkpointer_available, _incompatibility_note, _ctx_manager

    if _checkpointer is not None:
        return _checkpointer

    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    # Try langgraph >= 0.2 API (may be context manager)
    try:
        from langgraph.checkpoint.sqlite import SqliteSaver
        cm = SqliteSaver.from_conn_string(db_path)
        # Check if it's a context manager (newer langgraph versions)
        if hasattr(cm, "__enter__"):
            _ctx_manager = cm
            _checkpointer = cm.__enter__()
        else:
            _checkpointer = cm
        _checkpointer_available = True
        logger.info("SqliteSaver loaded from %s (type=%s)", db_path, type(_checkpointer).__name__)
        return _checkpointer
    except ImportError:
        _incompatibility_note = "langgraph.checkpoint.sqlite not available"
    except Exception as exc:
        _incompatibility_note = f"SqliteSaver init failed: {exc}"

    # Try alternative path (langgraph 0.1.x)
    try:
        from langgraph.checkpoint import SqliteSaver  # type: ignore
        cm = SqliteSaver.from_conn_string(db_path)
        if hasattr(cm, "__enter__"):
            _ctx_manager = cm
            _checkpointer = cm.__enter__()
        else:
            _checkpointer = cm
        _checkpointer_available = True
        logger.info("SqliteSaver (0.1 path) loaded from %s", db_path)
        return _checkpointer
    except Exception as exc2:
        _incompatibility_note += f" | fallback also failed: {exc2}"

    logger.warning(
        "Checkpoint persistence unavailable: %s. Graph runs without persistence.",
        _incompatibility_note,
    )
    return None


def get_compatibility_status() -> dict:
    return {
        "available": _checkpointer_available,
        "note": _incompatibility_note or "ok",
        "type": type(_checkpointer).__name__ if _checkpointer else "None",
    }
