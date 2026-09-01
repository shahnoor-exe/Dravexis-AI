"""
tests/test_router.py — Unit tests for the intent router.

Tests 6 intents (5 meaningful + 1 unknown) as required by Phase 2 spec.
All tests are fully offline — no model, no network required.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from src.agent.router import route, RouterResult


class TestRegexFastPath:
    """Regex layer: deterministic, highest confidence."""

    def test_calculate_corrosion_regex(self):
        result = route("calculate corrosion rate for carbon steel")
        assert result.intent == "code"
        assert result.method == "regex"
        assert result.confidence >= 0.90
        assert result.requires_code is True
        assert "code_model" in result.required_tools

    def test_upload_pid_regex(self):
        result = route("upload P&ID for unit 3 distillation column")
        assert result.intent == "vision"
        assert result.method == "regex"
        assert result.requires_vision is True

    def test_generate_docx_regex(self):
        result = route("generate docx report for last inspection")
        assert result.intent == "system"
        assert result.method == "regex"
        assert "docx_generator" in result.required_tools

    def test_inspect_thickness_regex(self):
        result = route("inspect thickness of outlet nozzle vessel V-101")
        assert result.intent == "rag"
        assert result.method == "regex"

    def test_remaining_life_regex(self):
        result = route("calculate remaining life for pressure vessel V-201")
        assert result.intent == "code"
        assert result.method == "regex"
        assert result.requires_code is True


class TestKeywordFallback:
    """Keyword layer: activated when regex doesn't match."""

    def test_h2s_inspection_keyword(self):
        result = route("what is the inspection interval for pressure vessels in H2S wet service?")
        assert result.intent == "rag"
        assert result.confidence > 0.3

    def test_flare_sop_keyword(self):
        result = route("what is the nitrogen purge flow rate for the flare system?")
        assert result.intent == "rag"

    def test_unknown_query(self):
        result = route("tell me a joke about a refinery engineer")
        # Should be unknown or rag with low confidence — must NOT fabricate statutory answer
        assert result.intent in ("unknown", "rag")

    def test_empty_query(self):
        result = route("")
        assert result.intent == "unknown"
        assert result.confidence == 1.0  # deterministic

    def test_diagram_keyword(self):
        result = route("can you analyse this piping diagram for valve positions?")
        assert result.intent == "vision"
        assert result.requires_vision is True


class TestDeterminism:
    """Same input ALWAYS produces same output."""

    def test_repeated_calls_consistent(self):
        q = "calculate corrosion rate for P91 steel at 550 degrees"
        r1 = route(q)
        r2 = route(q)
        r3 = route(q)
        assert r1.intent == r2.intent == r3.intent
        assert r1.confidence == r2.confidence == r3.confidence
        assert r1.method == r2.method == r3.method

    def test_result_is_pydantic(self):
        result = route("inspect pressure vessel H2S service")
        assert isinstance(result, RouterResult)
        assert 0.0 <= result.confidence <= 1.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
