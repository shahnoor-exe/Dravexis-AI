# Final Demo Runbook — MRPL Sovereign AI Workbench

This document supersedes `demo_scripts.md` for the final presentation, reflecting actual tested behavior as of Phase 6 completion (2026-09-02).

## Hardware Constraints Notice
- **GPU**: The demo runs on a CPU/4GB VRAM fallback mode.
- **Latency**: Vision model cold starts require ~80s. Reasoning model swaps require ~3s.
- **Security**: The demo uses `DEGRADED_SANDBOX` (no Docker) and `MONITOR_UNAVAILABLE` (psutil-only socket monitoring). These limitations are transparently shown in the UI.

---

## Pre-Flight Checklist

1. Close all zombie ports (`taskkill /F /PID 8000`).
2. Run `launch_dravexis.bat`.
3. Wait for the `Dravexis AI Backend Gateway` window to confirm FastAPI is ready.
4. Open the UI at `http://localhost:5173`.
5. Verify capability badges on the left rail match expected constraints.

## Scenario 1: Air-Gapped Code Execution & Artifact Generation

1. **Verify Offline**: Open Right Rail and show the `MONITOR_UNAVAILABLE` badge. Explain that the system is isolated, but full packet-capture is not installed on the dev machine.
2. **Query**: "What is the corrosion rate for Boiler B2 and draft a PSU maintenance note."
3. **Execution**: Watch the Agent DAG light up. Wait ~15s.
4. **Answer**: The final answer will display on the center stage.
5. **Artifacts**: Click "Approval Note" on the Right Rail. 
6. **Download**: Open the downloaded DOCX to show the prototype disclaimer and MRPL branding.

## Scenario 2: Vision Analysis

> **IMPORTANT**: The UI does *not* have a file upload button implemented in Phase 6. Vision API requires a backend API bypass or a quick UI hotfix before the demo. If testing via API:
> `POST /agent/run` with `{"query": "Audit the attached P&ID", "image_path": "data/qa_test.png"}`
1. **Execution**: The Right Rail trace will pause on the `vision` node.
2. **Latency Warning**: Narrate for ~80s while `Qwen2.5-VL-3B` cold-starts and processes the tile.
3. **Recovery**: Follow up immediately with "What is 2+2?" to demonstrate the `reasoning` model cold-swapping back in.

## Scenario 3: General Intent / Code Explanation

1. **Query**: "Explain this code:\ndef foo():\n    print('bar')"
2. **Execution**: The intent router will classify this as `code_explanation`.
3. **Answer**: The agent will explain the AST syntax.

## Known Demo Risks

1. **PDF Question-Answering**: The current PDF ingestion is a one-shot summary and does *not* inject document text into the agent's LangGraph memory. Follow-up questions about the PDF will fail.
2. **Vision Upload**: Lacking a UI button means the vision demo must be run via pre-populated UI chips (if patched) or API simulation.
