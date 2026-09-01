"""
ingestion/parser.py — Document parsing using PyMuPDF4LLM.

Converts PDF / text files to a structured list of page-level text blocks
(tables rendered as markdown, prose as plain text).
"""
from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def parse_document(file_path: str | Path) -> list[dict]:
    """
    Parse a document and return a list of content blocks.

    Each block is a dict:
        {
            "page": int,         # 1-indexed page number
            "type": "text"|"table",
            "content": str,      # raw text or markdown table
        }

    Supports:
        - .pdf  → via pymupdf4llm (markdown extraction)
        - .txt  → read directly, treated as a single block
        - .md   → same as .txt
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Document not found: {file_path}")

    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return _parse_pdf(path)
    elif suffix in (".txt", ".md"):
        return _parse_text(path)
    else:
        raise ValueError(f"Unsupported file type: {suffix}. Supported: .pdf, .txt, .md")


def _parse_pdf(path: Path) -> list[dict]:
    """Use pymupdf4llm to extract markdown from a PDF (preserves tables)."""
    try:
        import pymupdf4llm  # type: ignore
    except ImportError:
        # Fallback: use raw fitz text extraction
        logger.warning("pymupdf4llm not installed; falling back to raw fitz text extraction")
        return _parse_pdf_fitz_fallback(path)

    logger.info("Parsing PDF with pymupdf4llm: %s", path.name)
    md_text: str = pymupdf4llm.to_markdown(str(path))

    # Split on form feeds (page breaks) if present; otherwise treat as single page
    pages = md_text.split("\f") if "\f" in md_text else [md_text]
    blocks: list[dict] = []
    for i, page_text in enumerate(pages, start=1):
        page_text = page_text.strip()
        if not page_text:
            continue
        # Detect markdown tables (lines starting with |)
        segments = _split_tables(page_text)
        for seg in segments:
            blocks.append({
                "page": i,
                "type": "table" if seg.startswith("|") else "text",
                "content": seg,
            })
    logger.info("PDF parsed: %d blocks from %d pages", len(blocks), len(pages))
    return blocks


def _parse_pdf_fitz_fallback(path: Path) -> list[dict]:
    """Minimal fitz fallback when pymupdf4llm is unavailable."""
    import fitz  # type: ignore  # PyMuPDF

    blocks: list[dict] = []
    with fitz.open(str(path)) as doc:
        for page_num, page in enumerate(doc, start=1):
            text = page.get_text("text").strip()
            if text:
                blocks.append({"page": page_num, "type": "text", "content": text})
    return blocks


def _parse_text(path: Path) -> list[dict]:
    """Read a plain-text or markdown file as a single block."""
    logger.info("Parsing text file: %s", path.name)
    content = path.read_text(encoding="utf-8", errors="replace").strip()
    return [{"page": 1, "type": "text", "content": content}]


def _split_tables(text: str) -> list[str]:
    """
    Split a markdown page into alternating table / prose segments.
    Table lines start with '|'.
    """
    segments: list[str] = []
    current_lines: list[str] = []
    current_type: str | None = None

    for line in text.splitlines():
        line_type = "table" if line.startswith("|") else "text"
        if current_type is None:
            current_type = line_type
        if line_type != current_type:
            seg = "\n".join(current_lines).strip()
            if seg:
                segments.append(seg)
            current_lines = []
            current_type = line_type
        current_lines.append(line)

    if current_lines:
        seg = "\n".join(current_lines).strip()
        if seg:
            segments.append(seg)

    return segments
