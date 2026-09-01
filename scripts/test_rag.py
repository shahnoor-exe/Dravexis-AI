#!/usr/bin/env python3
"""
scripts/test_rag.py — End-to-end RAG verification (Phase 1 deliverable).

Tests the /chat endpoint with a deliberately chosen refinery-domain question
that should ONLY be answerable from the seeded corpus (not from LLM training data).

Usage:
    python scripts/test_rag.py [--api-url http://127.0.0.1:8000]

Returns exit code 0 on success, 1 on failure.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import httpx

# ---------------------------------------------------------------------------
# The "grounding test" question
# ---------------------------------------------------------------------------
# This question is chosen deliberately:
#   - The specific MRPL flare SOP values (KOD 70%, 200 Nm³/h, 60 m exclusion zone,
#     N₂ purge, ext. 2222, and the specific setpoints) are NOT in the model's
#     general training data — they are synthetic values invented for this demo corpus.
#   - If the model answers with these specific numbers, it is retrieving from context.
#   - If it invents different numbers, it is hallucinating from prior knowledge.

GROUNDING_QUESTION = (
    "What is the minimum nitrogen purge flow rate that must be maintained "
    "to the flare tip at all times, and what happens to the knock-out drum "
    "isolation when the KOD level reaches the high-high trip setpoint?"
)

# Expected ground-truth answers from the seed corpus (mrpl_sop_flare_system.txt):
#   - N₂ purge: 200 Nm³/h
#   - KOD high-high trip: 70% → auto-activate KOD pump, isolate secondary headers

EXPECTED_FACTS = [
    "200",          # purge flow rate
    "70",           # KOD HH trip setpoint percentage
    "secondary",    # secondary header isolation
]


def run_test(api_url: str) -> bool:
    """Run the grounding test and return True if passed."""
    chat_url = f"{api_url}/chat"

    payload = {
        "query": GROUNDING_QUESTION,
        "top_k": 5,
        "temperature": 0.1,
        "max_tokens": 512,
    }

    print("=" * 70)
    print("MRPL RAG — End-to-End Grounding Test")
    print("=" * 70)
    print(f"\n📡 API: {chat_url}")
    print(f"\n❓ QUESTION:\n   {GROUNDING_QUESTION}\n")

    t0 = time.time()
    try:
        with httpx.Client(timeout=180.0) as client:
            resp = client.post(chat_url, json=payload)
            resp.raise_for_status()
    except httpx.ConnectError:
        print(f"❌ CONNECTION REFUSED: Is the FastAPI gateway running on {api_url}?")
        print("   Start it with: python -m uvicorn src.main:app --host 127.0.0.1 --port 8000")
        return False
    except httpx.HTTPStatusError as e:
        print(f"❌ HTTP ERROR {e.response.status_code}: {e.response.text}")
        return False
    except httpx.TimeoutException:
        print("❌ TIMEOUT: LLM took too long. Try increasing --timeout.")
        return False

    elapsed = time.time() - t0
    data = resp.json()

    print(f"⏱  Response time: {elapsed:.1f}s")
    print(f"🤖 Model: {data.get('model', 'unknown')}")
    print(f"🔢 Tokens used: {data.get('tokens_used', '?')}")
    print(f"📚 Chunks retrieved: {data.get('retrieval_count', 0)}")
    print(f"🔗 Grounded: {data.get('grounded', False)}")
    print()

    # Print sources
    sources = data.get("sources", [])
    if sources:
        print("📄 RETRIEVED SOURCES:")
        for i, src in enumerate(sources, 1):
            print(f"   [{i}] doc_id={src['doc_id']}  chunk={src['chunk_index']}  score={src['score']:.4f}")
            preview = src["text"][:120].replace("\n", " ")
            print(f"       \"{preview}...\"")
        print()
    else:
        print("⚠  NO SOURCES RETRIEVED — response not grounded in corpus!")

    # Print answer
    answer = data.get("answer", "")
    print("💬 ANSWER:")
    print("-" * 70)
    print(answer)
    print("-" * 70)

    # --- Grounding analysis ---
    print("\n🔍 GROUNDING ANALYSIS:")
    grounded = data.get("grounded", False)
    answer_lower = answer.lower()

    fact_hits = []
    fact_misses = []
    for fact in EXPECTED_FACTS:
        if fact.lower() in answer_lower:
            fact_hits.append(fact)
        else:
            fact_misses.append(fact)

    print(f"   Retrieval flag (grounded={grounded}): {'✅' if grounded else '❌'}")
    print(f"   Expected facts found in answer: {fact_hits}")
    print(f"   Expected facts MISSING from answer: {fact_misses}")

    if grounded and len(fact_hits) >= 2:
        verdict = "GROUNDED"
        print("\n✅ VERDICT: GROUNDED — The answer contains specific values from the seeded")
        print("   corpus (MRPL SOP flare system) that are NOT in the model's training data.")
        print("   RAG loop is confirmed working.")
    elif grounded and len(fact_hits) >= 1:
        verdict = "PARTIALLY_GROUNDED"
        print("\n⚠  VERDICT: PARTIALLY GROUNDED — Some specific values found but retrieval")
        print("   may be incomplete. Check chunk quality and top_k.")
    elif not grounded:
        verdict = "UNGROUNDED"
        print("\n❌ VERDICT: UNGROUNDED — No context was retrieved. The vector store may be")
        print("   empty or the embedding model failed. Run scripts/ingest_seed.py first.")
    else:
        verdict = "UNCLEAR"
        print("\n⚠  VERDICT: UNCLEAR — Retrieval occurred but expected facts not in answer.")
        print("   The LLM may have answered from prior knowledge. Manual review required.")

    # Dump full response as JSON evidence
    evidence_path = Path(__file__).parent.parent / "data" / "test_rag_evidence.json"
    evidence = {
        "question": GROUNDING_QUESTION,
        "verdict": verdict,
        "elapsed_seconds": round(elapsed, 2),
        "expected_facts": EXPECTED_FACTS,
        "facts_found": fact_hits,
        "facts_missing": fact_misses,
        "response": data,
    }
    evidence_path.write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    print(f"\n📁 Full evidence saved to: {evidence_path}")

    return verdict in ("GROUNDED", "PARTIALLY_GROUNDED")


def main():
    parser = argparse.ArgumentParser(description="Phase 1 RAG grounding test")
    parser.add_argument("--api-url", default="http://127.0.0.1:8000", help="FastAPI gateway URL")
    args = parser.parse_args()

    success = run_test(args.api_url)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
