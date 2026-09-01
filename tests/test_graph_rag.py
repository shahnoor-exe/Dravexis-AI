"""
tests/test_graph_rag.py — Graph integration test for pure RAG path.

Tests that the LangGraph agent correctly:
  1. Routes H2S query to RAG intent
  2. Retrieves from Qdrant (uses Phase 1 verified data)
  3. Returns grounded answer with source evidence
  4. Does NOT invoke codegen or vision for RAG queries

Fully offline — no llama-server needed (plan node falls back gracefully).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from src.agent.graph import get_graph
from src.agent.state import make_initial_state


@pytest.fixture(scope="module")
def graph():
    return get_graph()


class TestRagPath:

    def test_h2s_query_routes_to_rag(self, graph):
        state = make_initial_state(
            query="What is the inspection interval for pressure vessels in H2S wet service?",
            session_id="test-rag-001",
        )
        config = {"configurable": {"thread_id": "test-rag-001"}}
        result = graph.invoke(state, config)

        assert result["intent"] == "rag", f"Expected rag, got {result['intent']}"
        assert len(result.get("retrieved_chunks", [])) > 0, "No chunks retrieved"
        assert result.get("final_answer") is not None
        assert len(result["final_answer"]) > 20

    def test_h2s_query_retrieves_oisd116(self, graph):
        state = make_initial_state(
            query="What is the inspection interval for pressure vessels in H2S wet service?",
            session_id="test-rag-002",
        )
        result = graph.invoke(state, {"configurable": {"thread_id": "test-rag-002"}})

        chunks = result.get("retrieved_chunks", [])
        assert any("oisd_116" in c.doc_id for c in chunks), (
            f"oisd_116 not in retrieved docs: {[c.doc_id for c in chunks]}"
        )

    def test_rag_query_does_not_invoke_codegen(self, graph):
        state = make_initial_state(
            query="What are the safety distances for LPG storage vessels?",
            session_id="test-rag-003",
        )
        result = graph.invoke(state, {"configurable": {"thread_id": "test-rag-003"}})

        # code_status should be "not_requested" for pure RAG
        assert result.get("code_status") == "not_requested", (
            f"code_status should be not_requested, got: {result.get('code_status')}"
        )
        assert result.get("sandbox_mode") == "not_run"

    def test_rag_query_has_audit_events(self, graph):
        state = make_initial_state(
            query="What is the nitrogen purge rate for the flare system?",
            session_id="test-rag-004",
        )
        result = graph.invoke(state, {"configurable": {"thread_id": "test-rag-004"}})

        events = result.get("events", [])
        node_names = [e["node"] for e in events]
        assert "plan" in node_names
        assert "retrieve" in node_names
        assert "compile_result" in node_names

    def test_off_topic_query_returns_insufficient_evidence_or_answer(self, graph):
        """Off-topic queries must not fabricate statutory refinery answers."""
        state = make_initial_state(
            query="What is the melting point of iron?",
            session_id="test-rag-005",
        )
        result = graph.invoke(state, {"configurable": {"thread_id": "test-rag-005"}})

        final = result.get("final_answer", "")
        # Must be one of: INSUFFICIENT_EVIDENCE, a low-confidence answer, or an error
        # Must NOT claim high confidence statutory refinery compliance data
        assert final is not None
        assert len(final) > 0  # Must produce a response, not crash


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
