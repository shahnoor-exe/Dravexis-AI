"""
ingestion/embedder.py — Embedding via FastEmbed (BGE-M3, dim=1024).

Architecture Decision (logged in PROJECT_BRAIN.md):
    Model : BAAI/bge-m3  (multilingual, 1024-dim, optimal for technical text)
    Dim   : 1024
    Distance: COSINE
"""
from __future__ import annotations

import logging
import numpy as np
from typing import TYPE_CHECKING

from ..config import settings

if TYPE_CHECKING:
    from .chunker import Chunk

logger = logging.getLogger(__name__)

_embedding_model = None


def _get_model():
    """Lazy-load the FastEmbed model (downloads on first use, cached after)."""
    global _embedding_model
    if _embedding_model is None:
        try:
            from fastembed import TextEmbedding  # type: ignore
        except ImportError:
            raise ImportError(
                "fastembed is not installed. Run: pip install qdrant-client[fastembed]"
            )
        logger.info("Loading FastEmbed model: %s (dim=%d)", settings.embedding_model, settings.embedding_dim)
        _embedding_model = TextEmbedding(model_name=settings.embedding_model)
        logger.info("FastEmbed model loaded.")
    return _embedding_model


def embed_chunks(chunks: list["Chunk"]) -> list[list[float]]:
    """
    Embed a list of Chunk objects using FastEmbed BGE-M3.

    Returns a list of float vectors, one per chunk, in the same order.
    """
    if not chunks:
        return []

    model = _get_model()
    texts = [c.text for c in chunks]
    logger.info("Embedding %d chunks with %s...", len(chunks), settings.embedding_model)

    # FastEmbed returns a generator of numpy arrays
    embeddings = list(model.embed(texts))
    logger.info("Embedding complete. Vector shape: %s", np.array(embeddings[0]).shape)

    return [emb.tolist() for emb in embeddings]


def embed_query(query: str) -> list[float]:
    """
    Embed a single query string for retrieval.
    Uses query_embed if available (some models have separate query/passage encoders).
    """
    model = _get_model()
    try:
        # BGE-M3 has a separate query encoder for better retrieval precision
        embeddings = list(model.query_embed([query]))
    except AttributeError:
        embeddings = list(model.embed([query]))
    return embeddings[0].tolist()
