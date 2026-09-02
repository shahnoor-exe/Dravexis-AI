"""
tests/test_vision_unavailable.py — Tests for vision node VISION_UNAVAILABLE handling.

Verifies that when models are absent (the current state), the vision node returns
a clean structured failure, not an exception or fabricated result.

Fully offline — no GPU, no model required.
"""
import sys
import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest


class TestVisionProbeResult:

    def test_probe_result_file_exists(self):
        from src.config import settings
        p = Path(settings.vision_probe_result)
        assert p.exists(), (
            "data/vision_probe_result.json must exist. "
            "Run scripts/probe_vision.py or it will be created as VISION_UNAVAILABLE."
        )

    def test_probe_result_is_valid_json(self):
        from src.config import settings
        p = Path(settings.vision_probe_result)
        data = json.loads(p.read_text(encoding="utf-8"))
        assert "status" in data

    def test_probe_reports_unavailable_when_models_absent(self):
        from src.config import settings
        model_path = Path(settings.model_vision_path)
        if model_path.exists():
            pytest.skip("Vision model is present — probe may succeed")
        p = Path(settings.vision_probe_result)
        data = json.loads(p.read_text(encoding="utf-8"))
        assert data["status"] == "VISION_UNAVAILABLE"
        assert data.get("reason") is not None


class TestVisionNodeFallback:
    """Test that the vision graph node handles VISION_UNAVAILABLE gracefully."""

    def test_vision_node_returns_unavailable_status(self):
        from src.agent.graph import node_vision, _vision_probe
        from src.agent.state import make_initial_state

        # Force probe to unavailable state for this test
        import src.agent.graph as graph_module
        original = graph_module._vision_probe
        graph_module._vision_probe = {
            "status": "VISION_UNAVAILABLE",
            "reason": "test: model not present",
        }

        try:
            state = make_initial_state(
                query="analyse this P&ID",
                session_id="test-vision-001",
                image_path="data/dummy_test_image.png",
            )
            state["requires_vision"] = True

            result = node_vision(state)
            assert result["vision_status"] == "VISION_UNAVAILABLE"
            assert result["vision_result"] is None
            # Must have an event logged
            assert any(e["node"] == "vision" for e in result.get("events", []))
        finally:
            graph_module._vision_probe = original

    def test_compile_result_vision_unavailable_message(self):
        """compile_result must produce a clear capability error, not a blank response."""
        from src.agent.graph import node_compile_result
        from src.agent.state import make_initial_state

        state = make_initial_state(
            query="analyse this P&ID diagram",
            session_id="test-vision-002",
        )
        state["intent"] = "vision"
        state["vision_status"] = "VISION_UNAVAILABLE"
        state["requires_vision"] = True
        state["retrieved_chunks"] = []
        state["events"] = []

        result = node_compile_result(state)
        answer = result.get("final_answer", "")
        assert "VISION_UNAVAILABLE" in answer
        assert len(answer) > 20  # Must be a real message, not empty


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
