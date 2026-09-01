"""Phase 1 final verification — run from project root."""
import sys
sys.path.insert(0, ".")

from src.ingestion.embedder import embed_query
from src.retrieval.vector_store import get_vector_count, search

print("=" * 55)
print("MRPL RAG -- Phase 1 Final Verification")
print("=" * 55)

count = get_vector_count()
print(f"\n[1] Qdrant vectors: {count}")
assert count > 0, "FAIL: No vectors in store"

print("[2] Retrieval test: H2S inspection interval query...")
q_vec = embed_query("inspection interval pressure vessel H2S wet service")
results = search(q_vec, top_k=3)
print(f"    Retrieved: {len(results)} result(s)")
for r in results:
    print(f"    doc={r.doc_id}  score={r.score:.4f}")
    print(f"    >> {r.text[:120].strip()}")

assert len(results) > 0, "FAIL: No retrieval results"

print("\n[3] Grounding check: flare SOP synthetic values...")
q2 = embed_query("nitrogen purge flow KOD high-high trip setpoint flare")
r2 = search(q2, top_k=5)
found_200 = any("200" in x.text for x in r2)
found_70 = any("70" in x.text for x in r2)
found_purge = any("purge" in x.text.lower() for x in r2)
print(f"    Found '200 Nm3/h': {found_200}")
print(f"    Found '70%' KOD:   {found_70}")
print(f"    Found 'purge':     {found_purge}")

print()
grounded = found_200 or found_70 or found_purge
verdict = "PASS" if (count > 0 and len(results) > 0 and grounded) else "PARTIAL"
print("=" * 55)
print(f"FINAL RESULT: {verdict}")
print(f"  Vectors stored: {count}")
print(f"  Retrieval works: {len(results) > 0}")
print(f"  Synthetic values findable: {grounded}")
print("=" * 55)
if verdict == "PASS":
    print("\nPhase 1 RAG stack is FULLY FUNCTIONAL.")
    print("Only remaining step: download GGUF + start llama-server")
    print("  hf auth login")
    print("  .\\scripts\\download_model.ps1")
    print("  .\\scripts\\start_all.ps1")
    print("  python scripts\\test_rag.py")
