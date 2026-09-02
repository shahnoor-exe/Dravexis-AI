import httpx
import sys

def main():
    print("=== Dravexis AI Runtime Truth Matrix Validation ===")
    try:
        caps = httpx.get("http://127.0.0.1:8000/capabilities").json()
        
        vision = caps.get("vision", {})
        print(f"VISION CAPABILITY: {vision.get('status')}")
        print(f"  Live Checks - GGUF/MMPROJ/Probe: {vision.get('evidence')}")
        if vision.get("error_code"):
            print(f"  Error: {vision.get('error_code')} - {vision.get('error_message')}")
            
        gpu = caps.get("gpu", {})
        print(f"GPU CAPABILITY: {gpu.get('status')}")
        print(f"  Error: {gpu.get('error_code')} - {gpu.get('error_message')}")
        
        print("\n=== Agent Run Error Mapping ===")
        # Force a vision request
        resp = httpx.post("http://127.0.0.1:8000/agent/run", json={"query": "Test vision", "intent_override": "vision"}, timeout=10.0)
        
        run_data = resp.json()
        print(f"RUN STATUS: {run_data.get('status')} | SUCCESS: {run_data.get('success')}")
        if run_data.get("error"):
            print(f"STRUCTURED ERROR: {run_data.get('error')}")
            
        if run_data.get("status") not in ["idle", "validating", "routing", "retrieving", "loading_model", "generating", "awaiting_approval", "completed", "partial", "failed", "disconnected", "cancelled"]:
            print(f"FAIL: Invalid status string '{run_data.get('status')}'")
            sys.exit(1)
            
        print("\nPASS: Truth matrix is sound.")
        
    except Exception as e:
        print(f"Matrix Validation Failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
