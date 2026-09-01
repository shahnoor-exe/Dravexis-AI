"""
routers/ingest.py — POST /ingest endpoint.

Wires the full ingestion pipeline:
    file_path → parser → chunker → embedder → Qdrant upsert
"""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, status

from ..ingestion.chunker import chunk_document
from ..ingestion.embedder import embed_chunks
from ..ingestion.parser import parse_document
from ..retrieval.vector_store import delete_doc_vectors, upsert_chunks
from ..schemas import IngestRequest, IngestResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post(
    "",
    response_model=IngestResponse,
    summary="Ingest a document into the RAG knowledge base",
    description=(
        "Parses the document at file_path, chunks it (512-token / 64-overlap strategy), "
        "embeds with BGE-M3, and upserts into Qdrant Embedded."
    ),
)
async def ingest(request: IngestRequest) -> IngestResponse:
    """Document ingestion pipeline endpoint."""
    path = Path(request.file_path)

    # Derive doc_id from filename if not provided
    doc_id = request.doc_id or path.stem.replace(" ", "_").lower()

    # Validate file existence
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File not found: {request.file_path}",
        )

    # Optionally purge existing vectors for this doc
    if request.overwrite:
        logger.info("Overwrite=True: deleting existing vectors for doc_id='%s'", doc_id)
        try:
            delete_doc_vectors(doc_id)
        except Exception as exc:
            logger.warning("Could not delete existing vectors: %s", exc)

    # --- Parse ---
    try:
        blocks = parse_document(path)
    except Exception as exc:
        logger.exception("Document parsing failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Parsing failed: {exc}",
        )

    if not blocks:
        return IngestResponse(
            doc_id=doc_id,
            chunks_ingested=0,
            status="ok",
            message="Document parsed but contained no extractable text.",
        )

    # --- Chunk ---
    chunks = chunk_document(doc_id, blocks)
    if not chunks:
        return IngestResponse(
            doc_id=doc_id,
            chunks_ingested=0,
            status="ok",
            message="Chunking produced zero chunks.",
        )

    # --- Embed ---
    try:
        embeddings = embed_chunks(chunks)
    except Exception as exc:
        logger.exception("Embedding failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Embedding error: {exc}",
        )

    # --- Upsert into Qdrant ---
    try:
        count = upsert_chunks(chunks, embeddings)
    except Exception as exc:
        logger.exception("Qdrant upsert failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Vector store upsert failed: {exc}",
        )

    logger.info("Ingestion complete: doc_id='%s', %d chunks", doc_id, count)
    return IngestResponse(
        doc_id=doc_id,
        chunks_ingested=count,
        status="ok",
        message=f"Successfully ingested {count} chunks from '{path.name}'.",
    )
