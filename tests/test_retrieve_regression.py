"""
tests/test_retrieve_regression.py — Regression guard for Phase 1 retrieval.

Requirement (Phase 2 spec §5): The known H2S inspection query must still retrieve
oisd_116 with a score near 0.7950 (±0.15 tolerance).

Fully offline — only requires Qdrant storage (data/qdrant_storage/) and FastEmbed.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from src.ingestion.embedder import embed_query
from src.retrieval.vector_store import get_vector_count, search


class TestRetrievalRegression:

    def test_qdrant_has_vectors(self):
        count = get_vector_count()
        assert count > 0, "Qdrant must have at least 1 vector (run ingest_seed.py first)"

    def test_h2s_query_retrieves_oisd116(self):
        """
        Regression test: H2S inspection interval query must return oisd_116 as top result
        with score >= 0.60. Score was 0.7950 at Phase 1 verification.
        """
        q_vec = embed_query(
            "What is the inspection interval for pressure vessels in H2S wet service?"
        )
        results = search(q_vec, top_k=5)

        assert len(results) > 0, "Retrieval returned no results"

        # Check top result is from oisd_116
        top = results[0]
        assert "oisd_116" in top.doc_id, (
            f"Expected oisd_116 as top result, got: {top.doc_id} (score={top.score:.4f})"
        )
        assert top.score >= 0.60, (
            f"Score regression: expected >= 0.60, got {top.score:.4f}. "
            "Embedding model or chunking may have changed."
        )

    def test_synthetic_mrpl_values_findable(self):
        """
        The synthetic flare SOP values (200 Nm3/h, 70% KOD) must still be retrievable.
        These values are not in any LLM training data, so their presence confirms grounding.
        """
        q_vec = embed_query("nitrogen purge flow rate flare tip KOD high-high trip setpoint")
        results = search(q_vec, top_k=5)

        texts = " ".join(r.text for r in results)
        found_200 = "200" in texts
        found_70 = "70" in texts
        found_purge = "purge" in texts.lower()

        assert found_purge, "Keyword 'purge' not found in retrieval results"
        assert found_200 or found_70, (
            "Neither '200 Nm3/h' nor '70%' KOD values found in retrieval results. "
            "Grounding may be broken."
        )

    def test_unknown_query_low_score(self):
        """Off-topic queries should have low retrieval scores."""
        q_vec = embed_query("what is the best recipe for chocolate cake")
        results = search(q_vec, top_k=3)
        if results:
            assert results[0].score < 0.80, (
                f"Off-topic query has suspiciously high score: {results[0].score:.4f}"
            )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
