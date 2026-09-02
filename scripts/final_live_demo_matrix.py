import asyncio
import httpx
import json
import os
import time

API_URL = "http://127.0.0.1:8000"

async def test_endpoint(client, path, payload=None, files=None, method="POST"):
    try:
        t0 = time.time()
        if method == "POST":
            if files:
                r = await client.post(f"{API_URL}{path}", data=payload, files=files)
            else:
                r = await client.post(f"{API_URL}{path}", json=payload)
        else:
            r = await client.get(f"{API_URL}{path}")
        
        latency = (time.time() - t0) * 1000
        return {"status": r.status_code, "data": r.json(), "latency_ms": latency}
    except Exception as e:
        return {"status": 500, "error": str(e)}

async def run_matrix():
    cases = []
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Case 1: Simple RAG
        res = await test_endpoint(client, "/agent/run", {"query": "What is the corrosion rate of Boiler B2?"})
        cases.append({"case": "1_RAG_CORROSION", "expected_intent": "rag", "result": res})
        
        # Case 2: Multi-turn (Re-using session)
        if "data" in res and "session_id" in res["data"]:
            sid = res["data"]["session_id"]
            res2 = await test_endpoint(client, "/agent/run", {"query": "Write a PSU maintenance note about it.", "session_id": sid})
            cases.append({"case": "2_RAG_MULTITURN", "expected_intent": "rag", "result": res2})
        
        # Case 3: Vision (assuming no image attached gives specific vision_status)
        res_vision = await test_endpoint(client, "/agent/run", {"query": "Analyze this P&ID diagram.", "intent_override": "vision"})
        cases.append({"case": "3_VISION_OVERRIDE", "expected_intent": "vision", "result": res_vision})
        
        # Case 4: Code Generation
        res_code = await test_endpoint(client, "/agent/run", {"query": "Write a python script to parse logs."})
        cases.append({"case": "4_CODE_GEN", "expected_intent": "code", "result": res_code})
        
        # Case 5: Empty query
        res_empty = await test_endpoint(client, "/agent/run", {"query": ""})
        cases.append({"case": "5_EMPTY_QUERY", "expected_status": "partial", "result": res_empty})
        
        # Case 6: Health check
        res_health = await test_endpoint(client, "/health", method="GET")
        cases.append({"case": "6_HEALTH_CHECK", "expected_status": "ok", "result": res_health})
        
        # Case 7: Capabilities
        res_caps = await test_endpoint(client, "/capabilities", method="GET")
        cases.append({"case": "7_CAPABILITIES", "expected_network": "MONITOR_UNAVAILABLE", "result": res_caps})

        # Generate evidence
        output = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "cases_run": len(cases),
            "results": cases
        }
        
        script_dir = os.path.dirname(os.path.abspath(__file__))
        data_dir = os.path.abspath(os.path.join(script_dir, "..", "data"))
        os.makedirs(data_dir, exist_ok=True)
        out_path = os.path.join(data_dir, "final_live_demo_matrix.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2)
        print(f"Generated {out_path} successfully.")

if __name__ == "__main__":
    asyncio.run(run_matrix())
