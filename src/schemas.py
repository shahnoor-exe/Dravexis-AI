"""
schemas.py — All Pydantic v2 request/response models for the MRPL RAG gateway.

No raw dict passthroughs anywhere in the codebase — every I/O boundary
goes through one of these models.
"""
from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Shared / nested models
# ---------------------------------------------------------------------------


class SourceChunk(BaseModel):
    """A single retrieved context chunk returned alongside a chat answer."""

    doc_id: str = Field(..., description="Unique document identifier")
    chunk_index: int = Field(..., description="Zero-based chunk index within the document")
    text: str = Field(..., description="Raw chunk text that was used as context")
    score: float = Field(..., ge=0.0, le=1.0, description="Cosine similarity score (0–1)")


class InterfaceInfo(BaseModel):
    """Network interface metadata (used in NetworkStatusResponse)."""

    name: str
    addresses: list[str]
    is_loopback: bool


# ---------------------------------------------------------------------------
# /chat
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    """Request body for POST /chat."""

    query: Annotated[str, Field(min_length=1, max_length=4096, description="User question")]
    top_k: int = Field(default=5, ge=1, le=20, description="Number of context chunks to retrieve")
    stream: bool = Field(default=False, description="Reserved for future streaming support")
    temperature: float = Field(default=0.1, ge=0.0, le=2.0, description="LLM sampling temperature")
    max_tokens: int = Field(default=512, ge=64, le=4096, description="Maximum tokens to generate")

    @field_validator("query")
    @classmethod
    def strip_query(cls, v: str) -> str:
        return v.strip()


class ChatResponse(BaseModel):
    """Response body for POST /chat."""

    answer: str = Field(..., description="Generated answer grounded in retrieved context")
    sources: list[SourceChunk] = Field(default_factory=list, description="Retrieved context chunks")
    model: str = Field(..., description="LLM model identifier")
    tokens_used: int = Field(..., description="Number of tokens generated")
    retrieval_count: int = Field(..., description="Number of chunks retrieved from Qdrant")
    grounded: bool = Field(
        ...,
        description="True if at least one source chunk was retrieved; False means the LLM answered without context",
    )


# ---------------------------------------------------------------------------
# /ingest
# ---------------------------------------------------------------------------


class IngestRequest(BaseModel):
    """Request body for POST /ingest."""

    file_path: str = Field(..., description="Absolute or relative path to the document to ingest")
    doc_id: str | None = Field(
        default=None,
        description="Optional explicit doc ID; if omitted, derived from filename",
    )
    overwrite: bool = Field(
        default=False,
        description="If True, delete existing vectors for this doc_id before re-ingesting",
    )

    @field_validator("file_path")
    @classmethod
    def strip_path(cls, v: str) -> str:
        return v.strip()


class IngestResponse(BaseModel):
    """Response body for POST /ingest."""

    doc_id: str = Field(..., description="Document identifier used in Qdrant")
    chunks_ingested: int = Field(..., description="Number of chunks written to the vector store")
    status: str = Field(..., description="'ok' or 'error'")
    message: str = Field(default="", description="Human-readable details or error message")


# ---------------------------------------------------------------------------
# /network-status
# ---------------------------------------------------------------------------


class NetworkStatusResponse(BaseModel):
    """
    Response body for GET /network-status.
    Full psutil/Scapy wiring is Phase 3; schema is defined here to avoid
    rework later (as specified in Section 3 of the Phase 1 prompt).
    """

    status: str = Field(..., description="'ok' or 'degraded'")
    interfaces: list[InterfaceInfo] = Field(
        default_factory=list,
        description="List of network interfaces detected on the host",
    )
    llama_server_reachable: bool = Field(
        ...,
        description="Whether the llama-server endpoint is reachable at /health",
    )
    qdrant_healthy: bool = Field(..., description="Whether the embedded Qdrant instance is responsive")
    timestamp: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat() + "Z",
        description="ISO-8601 UTC timestamp of the status check",
    )


# ---------------------------------------------------------------------------
# Error envelope
# ---------------------------------------------------------------------------


class ErrorResponse(BaseModel):
    """Standardised error envelope returned on HTTP 4xx/5xx."""

    detail: str
    error_code: str = "INTERNAL_ERROR"
    timestamp: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat() + "Z",
    )
