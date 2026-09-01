# Dravexis — On-Prem Agentic Control Layer

> **SIH 2026 | PS 26117 / PS 117 | Sovereign AI Workbench**
> 100% on-premise, air-gappable agentic RAG stack for refinery knowledge retrieval and decision support.

> **Prototype disclaimer:** This is a CPU-functional prototype on 4 GB VRAM dev hardware.
> GPU offload is **not confirmed** (`CPU_FALLBACK_OR_NO_GPU_OFFLOAD`).
> Sandbox is `DEGRADED_SANDBOX` (AST allowlist; Docker not installed).
> Network monitor is `MONITOR_UNAVAILABLE` for packet-level capture (no NPCAP).
> Vision is `VISION_AVAILABLE` (Qwen2.5-VL-3B, CPU-based, ~9–14s cold-start).

---

## Quick Start

```bat
:: Double-click from project root OR run from CMD/PowerShell:
launch_dravexis.bat
```

This single launcher:
- checks prerequisites (Python, npm, binaries, GGUF models);
- detects duplicate services and skips redundant launches;
- starts `llama-server + FastAPI` backend with bounded health polling;
- starts Tauri UI (if npm is available);
- prints a truthful capability summary.

**Manual start (if preferred):**
```powershell
# Terminal 1: Backend (llama-server + FastAPI)
.\scripts\start_all.ps1

# Terminal 2: UI
cd ui\mrpl-workbench
npm run tauri dev
```

---

## Stack

| Component | Technology | Port |
|---|---|---|
| LLM Server | llama-server (llama.cpp) | 127.0.0.1:**8080** |
| API Gateway | FastAPI + Uvicorn | 127.0.0.1:**8000** |
| Embeddings | FastEmbed BGE-M3 (dim=1024) | in-process |
| Vector Store | Qdrant Embedded (on-disk) | in-process |
| Doc Parser | PyMuPDF4LLM | in-process |

---

## Hardware Requirements

| Item | Minimum | This Dev Machine |
|---|---|---|
| GPU VRAM | 3 GB (for 3B Q4_K_M) | RTX 3050 Laptop 4 GB ✅ |
| System RAM | 8 GB | 16 GB ✅ |
| Disk (model) | ~2.5 GB | — |

---

## Setup

### 1. Install Python dependencies

```powershell
pip install -r requirements.txt
```

### 2. Download llama-server binary

```powershell
.\scripts\download_llama_server.ps1
```

> If you're offline, manually download from:
> https://github.com/ggml-org/llama.cpp/releases
> Look for: `llama-*-bin-win-cuda12-*-x64.zip`
> Place `llama-server.exe` in `bin\`

### 3. Download the GGUF model

**Recommended: DeepSeek-R1-Distill-Qwen-3B-Q4_K_M** (~2.1 GB download, ~2.5 GB VRAM)

```powershell
pip install huggingface_hub
huggingface-cli download bartowski/DeepSeek-R1-Distill-Qwen-3B-GGUF `
    DeepSeek-R1-Distill-Qwen-3B-Q4_K_M.gguf `
    --local-dir .\models
```

Or download manually: https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-3B-GGUF

---

## API Endpoints

All endpoints are bound to `127.0.0.1` only. Interactive docs at: http://127.0.0.1:8000/docs

### `POST /chat` — RAG Query

```bash
curl -X POST http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the maximum inspection interval for pressure vessels in H2S wet service per OISD-116?"}'
```

**Response:**
```json
{
  "answer": "Per OISD-116, for vessels in H2S wet service...",
  "sources": [{"doc_id": "oisd_116_pressure_vessel_inspection", "chunk_index": 3, "text": "...", "score": 0.87}],
  "model": "DeepSeek-R1-Distill-Qwen-3B-Q4_K_M",
  "tokens_used": 245,
  "retrieval_count": 5,
  "grounded": true
}
```

### `POST /ingest` — Document Ingestion

```bash
curl -X POST http://127.0.0.1:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{"file_path": "data/seed_docs/oisd_116_pressure_vessel_inspection.txt"}'
```

### `GET /network-status` — Health & Status

```bash
curl http://127.0.0.1:8000/network-status
```

---

## Project Structure

```
├── src/
│   ├── config.py          # All settings (MRPL_ env prefix)
│   ├── schemas.py         # All Pydantic v2 models
│   ├── llm_client.py      # llama-server HTTP client
│   ├── main.py            # FastAPI app
│   ├── ingestion/
│   │   ├── parser.py      # PyMuPDF4LLM / text parser
│   │   ├── chunker.py     # 512-token/64-overlap chunker
│   │   └── embedder.py    # FastEmbed BGE-M3
│   ├── retrieval/
│   │   └── vector_store.py # Qdrant Embedded wrapper
│   └── routers/
│       ├── chat.py         # POST /chat (RAG loop)
│       ├── ingest.py       # POST /ingest
│       └── status.py       # GET /network-status
├── scripts/
│   ├── download_llama_server.ps1
│   ├── start_llama_server.ps1
│   ├── ingest_seed.py
│   └── test_rag.py
├── data/
│   ├── seed_docs/          # 4 OISD/ASME/MRPL excerpt files
│   └── qdrant_storage/     # Qdrant on-disk index (gitignored)
├── models/                 # GGUF model files (gitignored)
├── bin/                    # llama-server.exe (gitignored)
└── PROJECT_BRAIN.md        # Living architecture decision record
```

---

## Chunking Strategy

> Logged in PROJECT_BRAIN.md per Section 0 requirements.

| Parameter | Value | Rationale |
|---|---|---|
| Chunk size | 512 tokens (~2048 chars) | BGE-M3 sweet spot for technical text |
| Overlap | 64 tokens (~256 chars) | Prevents context loss at boundaries |
| Table handling | Whole chunk if ≤800 chars | Preserves structured data |
| Sentence snapping | Yes (within 20% of window end) | Cleaner semantic boundaries |

---

## Architecture Decisions (summary — see PROJECT_BRAIN.md for full log)

| Decision | Choice |
|---|---|
| Reasoning model | DeepSeek-R1-Distill-Qwen-3B Q4_K_M (fits 4 GB VRAM) |
| uvloop | SKIPPED — Windows incompatible |
| llama-server port | 8080 |
| FastAPI port | 8000 |
| Phase 2 model loading | HOT-SWAP required (4 GB VRAM cannot hold multiple models) |
