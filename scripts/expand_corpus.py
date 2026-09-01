"""
scripts/expand_corpus.py — Ingest the 5 new Phase 4 seed documents.
Run from project root: python scripts/expand_corpus.py

Correct API:
  parse_document(path) -> list[dict]   (blocks with page/type/content)
  chunk_document(doc_id, blocks) -> list[Chunk]
  embed_chunks(chunks) -> list[list[float]]
  upsert_chunks(chunks, embeddings)
  get_vector_count() -> int
"""
import sys
import pathlib

ROOT = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from src.ingestion.parser import parse_document
from src.ingestion.chunker import chunk_document
from src.ingestion.embedder import embed_chunks
from src.retrieval.vector_store import upsert_chunks, get_vector_count

NEW_DOCS = [
    "data/seed_docs/oisd_118_appendix_fire_detectors.txt",
    "data/seed_docs/asme_pcc2_repair_methods.txt",
    "data/seed_docs/mrpl_corrosion_inspection_procedure.txt",
    "data/seed_docs/mrpl_h2s_safe_work_permit.txt",
    "data/seed_docs/oisd_116_annex_inspection_checklist.txt",
]

total_before = get_vector_count()
print(f"Vectors before: {total_before}")

for doc_path in NEW_DOCS:
    p = ROOT / doc_path
    if not p.exists():
        print(f"SKIP (not found): {p}")
        continue
    blocks = parse_document(p)
    doc_id = p.stem
    chunks = chunk_document(doc_id, blocks)
    embeddings = embed_chunks(chunks)
    upsert_chunks(chunks, embeddings)
    print(f"Ingested {doc_id}: {len(chunks)} chunks, {len(embeddings)} embeddings")

total_after = get_vector_count()
print(f"Vectors after: {total_after} (+{total_after - total_before})")
print("Corpus expansion complete.")
