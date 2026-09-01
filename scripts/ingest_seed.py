#!/usr/bin/env python3
"""
scripts/ingest_seed.py — CLI script to ingest all seed documents.

Usage:
    python scripts/ingest_seed.py

Run from the project root. Ingests all .txt and .pdf files in data/seed_docs/.
Prints a summary including total chunks and Qdrant vector count.
"""
import sys
import os
import json
import time
from pathlib import Path

# Force UTF-8 stdout on Windows (avoids cp1252 emoji errors)
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Add project root to sys.path so we can import 'src'
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.ingestion.parser import parse_document
from src.ingestion.chunker import chunk_document
from src.ingestion.embedder import embed_chunks
from src.retrieval.vector_store import upsert_chunks, get_vector_count

SEED_DIR = PROJECT_ROOT / "data" / "seed_docs"
SUPPORTED_EXTS = {".txt", ".md", ".pdf"}


def ingest_file(path: Path) -> dict:
    """Ingest a single file and return stats."""
    doc_id = path.stem.replace(" ", "_").lower()
    print(f"\n[DOC] Ingesting: {path.name}  (doc_id='{doc_id}')")

    t0 = time.time()
    blocks = parse_document(path)
    chunks = chunk_document(doc_id, blocks)

    if not chunks:
        print(f"   [WARN] No chunks produced -- skipping.")
        return {"doc_id": doc_id, "chunks": 0, "elapsed": 0}

    print(f"   -> {len(blocks)} blocks -> {len(chunks)} chunks")

    embeddings = embed_chunks(chunks)
    count = upsert_chunks(chunks, embeddings)
    elapsed = time.time() - t0

    print(f"   [OK] {count} vectors upserted ({elapsed:.1f}s)")
    return {"doc_id": doc_id, "chunks": count, "elapsed": elapsed}


def main():
    print("=" * 60)
    print("MRPL RAG -- Seed Corpus Ingestion")
    print("=" * 60)

    if not SEED_DIR.exists():
        print(f"[ERROR] Seed directory not found: {SEED_DIR}")
        sys.exit(1)

    files = [f for f in sorted(SEED_DIR.iterdir()) if f.suffix.lower() in SUPPORTED_EXTS]
    if not files:
        print(f"[ERROR] No supported files found in {SEED_DIR}")
        sys.exit(1)

    print(f"\nFound {len(files)} seed file(s):\n")
    for f in files:
        print(f"  - {f.name}")

    results = []
    for f in files:
        try:
            result = ingest_file(f)
            results.append(result)
        except Exception as e:
            print(f"   [ERROR]: {e}")
            results.append({"doc_id": f.stem, "chunks": 0, "error": str(e)})

    # Final count check
    total_chunks = sum(r["chunks"] for r in results)
    vector_count = get_vector_count()

    print("\n" + "=" * 60)
    print("INGESTION SUMMARY")
    print("=" * 60)
    print(f"  Documents processed : {len(results)}")
    print(f"  Total chunks written: {total_chunks}")
    print(f"  Qdrant vector count : {vector_count}")
    print("=" * 60)

    if vector_count == 0:
        print("\n[FAIL] No vectors in Qdrant after ingestion. Check errors above.")
        sys.exit(1)
    else:
        print(f"\n[PASS] Qdrant contains {vector_count} vectors. RAG is ready.")
        print(f"\nCollection: mrpl_refinery_kb")
        print(f"Storage   : {PROJECT_ROOT / 'data' / 'qdrant_storage'}")


if __name__ == "__main__":
    main()

