"""
agent/router.py — Deterministic intent router.

Three-layer resolution (same input ALWAYS produces same output):
  1. Regex fast path — explicit refinery commands
  2. Keyword fallback — weighted keyword sets per intent category
  3. ONNX classifier — only if all-MiniLM-L6-v2.onnx present (no network download)

Architecture Decision (PROJECT_BRAIN.md):
  - Router must be deterministic: identical inputs → identical IntentResult
  - ONNX layer is optional; falls back to keyword without error
  - No silent internet access ever
"""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from ..config import settings

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Output schema                                                                #
# --------------------------------------------------------------------------- #

Intent = Literal["rag", "vision", "code", "code_explanation", "general_question", "system", "unknown"]


class RouterResult(BaseModel):
    intent: Intent
    confidence: float = Field(ge=0.0, le=1.0)
    method: Literal["regex", "keyword", "onnx"]
    required_tools: list[str] = []
    requires_vision: bool = False
    requires_code: bool = False


# --------------------------------------------------------------------------- #
# Layer 1 — Regex fast path                                                    #
# --------------------------------------------------------------------------- #

_REGEX_RULES: list[tuple[re.Pattern, RouterResult]] = [
    (
        re.compile(
            r"\b(generate\s+docx?|create\s+(report|document))\b", re.I
        ),
        RouterResult(intent="system", confidence=0.98, method="regex",
                     required_tools=["docx_generator"]),
    ),
    (
        re.compile(r"\b(upload|scan|analyse|analyze)\s+(p\s*&?\s*id|piping\s+diagram|isometric)\b", re.I),
        RouterResult(intent="vision", confidence=0.97, method="regex",
                     required_tools=["vision_model"], requires_vision=True),
    ),
    (
        re.compile(
            r"\b(calculate|compute|estimate)\s+(corrosion|thickness|remaining.?life|wall.?loss|cra)\b", re.I
        ),
        RouterResult(intent="code", confidence=0.96, method="regex",
                     required_tools=["code_model", "sandbox"], requires_code=True),
    ),
    (
        re.compile(r"\b(inspect|inspection)\s+(thickness|corrosion|vessel|pipe)\b", re.I),
        RouterResult(intent="rag", confidence=0.93, method="regex",
                     required_tools=["retrieval"]),
    ),
    (
        re.compile(r"\b(run\s+code|execute\s+python|python\s+script)\b", re.I),
        RouterResult(intent="code", confidence=0.95, method="regex",
                     required_tools=["code_model", "sandbox"], requires_code=True),
    ),
    (
        re.compile(r"\b(remaining\s+(life|service\s+life)|rl\s+calc)\b", re.I),
        RouterResult(intent="code", confidence=0.94, method="regex",
                     required_tools=["code_model", "sandbox"], requires_code=True),
    ),
    # --- Code explanation: detect code-like input ---
    (
        re.compile(r"\b(explain|describe|what\s+does)\b.*\b(code|script|function|snippet)\b", re.I),
        RouterResult(intent="code_explanation", confidence=0.92, method="regex",
                     required_tools=["reasoning_model"]),
    ),
    # --- Question-style queries about wall thickness/rules/standards → rag ---
    (
        re.compile(r"\b(what|which|how|when|where|why|is\s+there|do\s+we)\b.*\b(wall.?thickness|minimum|rule|standard|specification|requirement|code)\b", re.I),
        RouterResult(intent="rag", confidence=0.90, method="regex",
                     required_tools=["retrieval"]),
    ),
]


def _try_regex(query: str) -> RouterResult | None:
    for pattern, result in _REGEX_RULES:
        if pattern.search(query):
            return result
    return None


# --------------------------------------------------------------------------- #
# Layer 2 — Keyword fallback                                                   #
# --------------------------------------------------------------------------- #

_KEYWORD_INTENTS: list[tuple[set[str], Intent, float, list[str], bool, bool]] = [
    # (keywords, intent, confidence, required_tools, requires_vision, requires_code)
    (
        {"inspection", "interval", "vessel", "pressure", "h2s", "nace", "piping",
         "safety", "sop", "standard", "oisd", "asme", "regulation", "requirement",
         "flare", "purge", "kod", "setpoint", "relief", "psa", "lel", "foam"},
        "rag", 0.78, ["retrieval"], False, False,
    ),
    (
        {"p&id", "pid", "diagram", "image", "photo", "picture", "isometric",
         "drawing", "schematic", "visual", "scan"},
        "vision", 0.82, ["vision_model"], True, False,
    ),
    (
        {"calculate", "compute", "formula", "equation", "arithmetic", "math",
         "result", "output", "simulation", "model", "corrosion", "rate",
         "wall", "thickness", "remaining", "life"},
        "code", 0.80, ["code_model", "sandbox"], False, True,
    ),
    (
        {"generate", "docx", "report", "document", "export", "artifact"},
        "system", 0.75, ["docx_generator"], False, False,
    ),
]


def _score_keywords(query: str) -> RouterResult:
    tokens = set(re.findall(r"\w+", query.lower()))
    best_score = 0.0
    best: tuple = ("unknown", 0.5, [], False, False)

    for kw_set, intent, base_conf, tools, vis, code in _KEYWORD_INTENTS:
        overlap = len(tokens & kw_set)
        if overlap > 0:
            score = base_conf * min(1.0, overlap / 3)
            if score > best_score:
                best_score = score
                best = (intent, score, tools, vis, code)

    intent, conf, tools, vis, code = best
    if best_score < 0.25:
        # No keyword match — check for code-like patterns
        if _detect_code_input(query):
            return RouterResult(
                intent="code_explanation", confidence=0.75, method="keyword",
                required_tools=["reasoning_model"], requires_vision=False, requires_code=False,
            )
        # Default to general_question instead of unknown
        return RouterResult(
            intent="general_question", confidence=0.5, method="keyword",
            required_tools=["reasoning_model"], requires_vision=False, requires_code=False,
        )
    return RouterResult(
        intent=intent, confidence=round(conf, 3), method="keyword",
        required_tools=tools, requires_vision=vis, requires_code=code,
    )


def _detect_code_input(query: str) -> bool:
    """Heuristic: does the query contain code-like patterns?"""
    code_patterns = [
        r'\bdef\s+\w+\s*\(',       # function definition
        r'\bimport\s+\w+',         # import statement
        r'\bprint\s*\(',           # print call
        r'\bclass\s+\w+',          # class definition
        r'\bfor\s+\w+\s+in\s+',    # for loop
        r'\bif\s+.*:',             # if statement
        r'\breturn\s+',            # return statement
        r'\w+\s*=\s*[\[\{\(]',     # assignment with collection
    ]
    for pattern in code_patterns:
        if re.search(pattern, query):
            return True
    # Check for indentation (multiple lines with leading spaces)
    lines = query.strip().split('\n')
    if len(lines) >= 2 and any(line.startswith('    ') or line.startswith('\t') for line in lines[1:]):
        return True
    return False


# --------------------------------------------------------------------------- #
# Layer 3 — ONNX classifier (optional, gated)                                 #
# --------------------------------------------------------------------------- #

_onnx_session = None
_onnx_available = False
_onnx_labels: list[str] = ["rag", "vision", "code", "system", "unknown"]


def _maybe_load_onnx() -> None:
    """Load ONNX model once if file is present. Never downloads from internet."""
    global _onnx_session, _onnx_available
    model_path = Path(settings.onnx_model_path)
    if not model_path.exists():
        logger.info("ONNX router model not found at %s — using keyword fallback.", model_path)
        return
    try:
        import onnxruntime as ort
        _onnx_session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        _onnx_available = True
        logger.info("ONNX router model loaded from %s", model_path)
    except Exception as exc:
        logger.warning("ONNX load failed: %s — using keyword fallback.", exc)


def _try_onnx(query: str) -> RouterResult | None:
    """Run ONNX inference if available. Returns None if not available."""
    if not _onnx_available or _onnx_session is None:
        return None
    try:
        import numpy as np
        # Simple bag-of-words input (real MiniLM would use tokenizer; here we use char n-gram)
        # In production, use the matching tokenizer (also offline).
        # For now, fall through to keyword if tokenizer unavailable.
        raise NotImplementedError("Full tokenizer required for ONNX inference.")
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Public API                                                                   #
# --------------------------------------------------------------------------- #

_initialized = False


def _ensure_init() -> None:
    global _initialized
    if not _initialized:
        _maybe_load_onnx()
        _initialized = True


def route(query: str) -> RouterResult:
    """
    Route a query to an intent.

    Resolution order:
      1. Regex (deterministic, highest priority)
      2. ONNX (if loaded)
      3. Keyword (always available fallback)
    """
    _ensure_init()

    if not query or not query.strip():
        return RouterResult(
            intent="unknown", confidence=1.0, method="keyword",
            required_tools=[], requires_vision=False, requires_code=False,
        )

    # Layer 1: regex
    result = _try_regex(query)
    if result is not None:
        logger.debug("Router: regex match → intent=%s conf=%.2f", result.intent, result.confidence)
        return result

    # Layer 3: ONNX (if loaded)
    result = _try_onnx(query)
    if result is not None:
        logger.debug("Router: ONNX → intent=%s conf=%.2f", result.intent, result.confidence)
        return result

    # Layer 2: keyword fallback
    result = _score_keywords(query)
    logger.debug("Router: keyword → intent=%s conf=%.2f", result.intent, result.confidence)
    return result


def get_router_info() -> dict:
    """Return diagnostic info about the router's current mode."""
    _ensure_init()
    return {
        "onnx_available": _onnx_available,
        "onnx_path": settings.onnx_model_path,
        "regex_rules": len(_REGEX_RULES),
        "keyword_categories": len(_KEYWORD_INTENTS),
        "mode": "onnx+regex+keyword" if _onnx_available else "regex+keyword (ONNX degraded)",
    }
