import time
import httpx
from pathlib import Path

API = "http://127.0.0.1:8000"

def run_test(name, fn):
    print(f"Running {name}...", end=" ")
    try:
        fn()
        print("[PASS]")
        return True
    except AssertionError as e:
        print(f"[FAIL]: {e}")
        return False
    except Exception as e:
        print(f"[ERROR]: {e}")
        return False

def test_capabilities():
    r = httpx.get(f"{API}/capabilities")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    data = r.json()
    assert "reasoning" in data
    assert "vision" in data
    assert "coder" in data

def test_empty_input():
    r = httpx.post(f"{API}/agent/run", json={"query": ""})
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    assert r.json().get("intent") == "unknown"
    assert r.json().get("status") == "partial"

def test_general_question():
    r = httpx.post(f"{API}/agent/run", json={"query": "What is the capital of France?"}, timeout=120)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    data = r.json()
    assert data.get("intent") == "general_question", f"Expected general_question, got {data.get('intent')}"
    assert "LOCAL_MODEL_NO_CORPUS_EVIDENCE" in data.get("final_answer", "")

def test_code_explanation():
    r = httpx.post(f"{API}/agent/run", json={"query": "Explain this code:\ndef foo():\n    print('bar')"}, timeout=120)
    assert r.status_code == 200
    data = r.json()
    assert data.get("intent") == "code_explanation", f"Expected code_explanation, got {data.get('intent')}"
    assert "LOCAL_MODEL_EXPLANATION" in data.get("final_answer", "")

def test_vision_no_image():
    r = httpx.post(f"{API}/agent/run", json={"query": "Describe this P&ID", "intent_override": "vision"}, timeout=60)
    assert r.status_code == 200
    data = r.json()
    assert data.get("vision_status") == "VISION_NO_IMAGE", f"Expected VISION_NO_IMAGE, got {data.get('vision_status')}"

def test_rag_wall_thickness():
    r = httpx.post(f"{API}/agent/run", json={"query": "What is the wall thickness requirement?"}, timeout=120)
    assert r.status_code == 200
    data = r.json()
    assert data.get("intent") == "rag", f"Expected rag intent, got {data.get('intent')}"

def test_no_think_tags():
    r = httpx.post(f"{API}/agent/run", json={"query": "Write a short poem about a refinery."}, timeout=120)
    assert r.status_code == 200
    ans = r.json().get("final_answer", "")
    assert "<think>" not in ans, "Output leaked <think> tag"
    assert "</think>" not in ans, "Output leaked </think> tag"

def test_dedup_events():
    r = httpx.post(f"{API}/agent/run", json={"query": "hello"}, timeout=120)
    events = r.json().get("events", [])
    # Check that events have event_id
    assert all("event_id" in e for e in events), "Events missing event_id"

def main():
    print("="*50)
    print("PHASE 5 LIVE ACCEPTANCE MATRIX")
    print("="*50)
    
    tests = [
        ("Capabilities Endpoint", test_capabilities),
        ("Empty Input Handling", test_empty_input),
        ("General Question Routing", test_general_question),
        ("Code Explanation Routing", test_code_explanation),
        ("Vision Without Image", test_vision_no_image),
        ("RAG Keyword Priority", test_rag_wall_thickness),
        ("Post-Processing (No Tags)", test_no_think_tags),
        ("Event Trace Deduplication", test_dedup_events),
    ]
    
    passed = 0
    for name, fn in tests:
        if run_test(name, fn):
            passed += 1
            
    print("="*50)
    print(f"SCORE: {passed}/{len(tests)}")
    if passed == len(tests):
        print("[ALL ACCEPTANCE CRITERIA MET]")
        exit(0)
    else:
        print("[ACCEPTANCE FAILED]")
        exit(1)

if __name__ == "__main__":
    main()
