"""
ingestion/chunker.py — Text and table chunking strategy.

Architecture Decision (logged in PROJECT_BRAIN.md):
    - Chunk size:    512 tokens (approximated as 512 * 4 = 2048 chars)
    - Chunk overlap: 64 tokens (≈ 256 chars)
    - Tables:        kept whole if ≤ MAX_TABLE_CHARS, otherwise split as plain text
    - Rationale:     BGE-M3 maximum context is 8192 tokens but retrieval quality
                     degrades with very long chunks; 512/64 is the sweet spot for
                     factual refinery text with dense technical numbers.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from ..config import settings

logger = logging.getLogger(__name__)

# Token approximation: average English word ≈ 4 chars, 1 token ≈ 4 chars
CHARS_PER_TOKEN = 4
CHUNK_CHARS = settings.chunk_size * CHARS_PER_TOKEN       # 2048
OVERLAP_CHARS = settings.chunk_overlap * CHARS_PER_TOKEN  # 256


@dataclass
class Chunk:
    """A single text chunk ready for embedding."""
    doc_id: str
    chunk_index: int
    text: str
    page: int
    chunk_type: str  # "text" | "table"
    metadata: dict = field(default_factory=dict)


def chunk_document(doc_id: str, blocks: list[dict]) -> list[Chunk]:
    """
    Convert a list of parsed blocks into a flat list of Chunk objects.

    Tables ≤ MAX_TABLE_CHARS are kept as single chunks.
    Tables > MAX_TABLE_CHARS are split with the same sliding-window strategy as prose.
    Prose blocks are split with CHUNK_CHARS / OVERLAP_CHARS sliding window.
    """
    chunks: list[Chunk] = []
    idx = 0

    for block in blocks:
        page: int = block["page"]
        block_type: str = block["type"]
        content: str = block["content"].strip()

        if not content:
            continue

        if block_type == "table" and len(content) <= settings.max_table_chars:
            # Keep table as a single chunk
            chunks.append(Chunk(
                doc_id=doc_id,
                chunk_index=idx,
                text=content,
                page=page,
                chunk_type="table",
            ))
            idx += 1
        else:
            # Sliding-window split (works for prose AND oversized tables)
            for sub_chunk in _sliding_window(content):
                chunks.append(Chunk(
                    doc_id=doc_id,
                    chunk_index=idx,
                    text=sub_chunk,
                    page=page,
                    chunk_type=block_type,
                ))
                idx += 1

    logger.info("Chunked '%s': %d blocks → %d chunks", doc_id, len(blocks), len(chunks))
    return chunks


def _sliding_window(text: str) -> list[str]:
    """
    Split text into overlapping windows of CHUNK_CHARS with OVERLAP_CHARS overlap.

    Tries to break on sentence boundaries ('. ') within 20% of the target size.
    """
    if len(text) <= CHUNK_CHARS:
        return [text]

    windows: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_CHARS, len(text))

        # Try to snap to a sentence boundary near the end
        if end < len(text):
            snap = text.rfind(". ", start + int(CHUNK_CHARS * 0.8), end)
            if snap != -1:
                end = snap + 2  # include the period and space

        window = text[start:end].strip()
        if window:
            windows.append(window)

        if end >= len(text):
            break
        start = end - OVERLAP_CHARS

    return windows
