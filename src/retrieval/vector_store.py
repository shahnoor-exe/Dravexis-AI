"""
retrieval/vector_store.py — Qdrant Embedded (in-process) vector store wrapper.

Architecture Decisions (logged in PROJECT_BRAIN.md):
    Storage  : On-disk at data/qdrant_storage/ (persistent across restarts)
    Collection: mrpl_refinery_kb
    Distance : COSINE
    Dim      : 1024 (BGE-M3)
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    PointStruct,
    VectorParams,
    Filter,
    FieldCondition,
    MatchValue,
)

from ..config import settings
from ..schemas import SourceChunk

if TYPE_CHECKING:
    from ..ingestion.chunker import Chunk

logger = logging.getLogger(__name__)

_qdrant_client: QdrantClient | None = None


def get_qdrant_client() -> QdrantClient:
    """Return the shared Qdrant Embedded singleton."""
    global _qdrant_client
    if _qdrant_client is None:
        logger.info("Initialising Qdrant Embedded at: %s", settings.qdrant_path)
        _qdrant_client = QdrantClient(path=settings.qdrant_path)
        _ensure_collection(_qdrant_client)
    return _qdrant_client


def _ensure_collection(client: QdrantClient) -> None:
    """Create the collection if it doesn't already exist."""
    existing = {c.name for c in client.get_collections().collections}
    if settings.qdrant_collection not in existing:
        logger.info(
            "Creating Qdrant collection '%s' (dim=%d, distance=COSINE)",
            settings.qdrant_collection,
            settings.embedding_dim,
        )
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(
                size=settings.embedding_dim,
                distance=Distance.COSINE,
            ),
        )
    else:
        logger.info("Qdrant collection '%s' already exists.", settings.qdrant_collection)


def upsert_chunks(chunks: list["Chunk"], embeddings: list[list[float]]) -> int:
    """
    Upsert chunk embeddings into Qdrant.

    Returns the number of points written.
    """
    if len(chunks) != len(embeddings):
        raise ValueError(f"Chunk count ({len(chunks)}) != embedding count ({len(embeddings)})")

    client = get_qdrant_client()

    # Build a stable integer point ID from doc_id + chunk_index
    points = [
        PointStruct(
            id=_point_id(chunk.doc_id, chunk.chunk_index),
            vector=embedding,
            payload={
                "doc_id": chunk.doc_id,
                "chunk_index": chunk.chunk_index,
                "page": chunk.page,
                "chunk_type": chunk.chunk_type,
                "text": chunk.text,
            },
        )
        for chunk, embedding in zip(chunks, embeddings)
    ]

    # Qdrant recommends batching; 256 is safe for all RAM configurations
    batch_size = 256
    total = 0
    for i in range(0, len(points), batch_size):
        batch = points[i : i + batch_size]
        client.upsert(
            collection_name=settings.qdrant_collection,
            points=batch,
            wait=True,
        )
        total += len(batch)
        logger.debug("Upserted batch %d/%d (%d points)", i // batch_size + 1, -(-len(points) // batch_size), len(batch))

    logger.info("Upserted %d points into '%s'", total, settings.qdrant_collection)
    return total


def search(query_embedding: list[float], top_k: int = 5, doc_id_filter: str | None = None) -> list[SourceChunk]:
    """
    Perform a top-k cosine similarity search.

    Optionally filter to a specific doc_id.
    Returns a list of SourceChunk objects sorted by score descending.
    """
    client = get_qdrant_client()

    query_filter = None
    if doc_id_filter:
        query_filter = Filter(
            must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id_filter))]
        )

    # qdrant-client v1.12+ replaced client.search() with client.query_points()
    response = client.query_points(
        collection_name=settings.qdrant_collection,
        query=query_embedding,
        limit=top_k,
        query_filter=query_filter,
        with_payload=True,
    )
    results = response.points

    source_chunks = [
        SourceChunk(
            doc_id=r.payload["doc_id"],
            chunk_index=r.payload["chunk_index"],
            text=r.payload["text"],
            score=float(r.score),
        )
        for r in results
    ]
    logger.info("Qdrant search returned %d results (top score: %.3f)", len(source_chunks), source_chunks[0].score if source_chunks else 0.0)
    return source_chunks


def delete_doc_vectors(doc_id: str) -> None:
    """Delete all vectors associated with a specific doc_id."""
    client = get_qdrant_client()
    client.delete(
        collection_name=settings.qdrant_collection,
        points_selector=Filter(
            must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]
        ),
        wait=True,
    )
    logger.info("Deleted all vectors for doc_id='%s'", doc_id)


def get_vector_count() -> int:
    """Return total number of points (vectors) in the collection."""
    client = get_qdrant_client()
    info = client.get_collection(settings.qdrant_collection)
    # qdrant-client v1.12+ uses points_count; older used vectors_count
    count = getattr(info, "points_count", None) or getattr(info, "vectors_count", None) or 0
    return count


def _point_id(doc_id: str, chunk_index: int) -> int:
    """
    Generate a stable integer point ID from doc_id + chunk_index.
    Qdrant accepts either UUID strings or unsigned integers.
    We use a hash-based integer to keep IDs deterministic and collision-resistant.
    """
    import hashlib
    raw = f"{doc_id}::{chunk_index}"
    h = int(hashlib.md5(raw.encode()).hexdigest(), 16)
    # Qdrant uses u64; fit into positive int64 range
    return h % (2**63)
