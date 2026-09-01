# PROJECT BRAIN — Sovereign Agentic AI Workbench (PS 26117)

## Identity
- Problem Statement: PS 26117 / PS 117 — MRPL Sovereign On-Premise Agentic AI Workbench
- Deployment target: 100% air-gapped, single PSU workstation, 8–24 GB VRAM
- Hackathon: SIH 2026, 36-hour build window

## Current State
- Current Phase: **2 (Agent FSM, Semantic Router & Tools) — ✅ COMPLETE**
- Phase 2 status: **FUNCTIONALLY COMPLETE** — all 47 tests pass, 8/8 demo matrix cases pass
- Last updated: 2026-09-01T19:57:00+05:30

## Session Log

### Phase 2 started — 2026-09-01T19:04:00+05:30
- Read PROJECT_BRAIN.md before execution.
- Phase 1 status observed: COMPLETE (verify_phase1.py → PASS; Qdrant 9 vectors; H2S score 0.7950).
- Phase 2 scope: semantic router, LangGraph FSM, model hot-swap, vision probe (mmproj), sandbox tool.
- No Phase 3 UI/artifact/security-polish work is authorized in this phase.
- Key finding: llama-server b10734 has native `--mmproj` support (`mtmd.dll` present) — vision probe is viable.
- LangGraph installed, SqliteSaver (langgraph-checkpoint-sqlite) confirmed working.

### Phase 2 COMPLETE — 2026-09-01T19:57:00+05:30
- 47/47 pytest tests PASS (0 failures, 0 warnings)
- 8/8 verification matrix cases PASS
- SqliteSaver checkpoint: AVAILABLE (langgraph-checkpoint-sqlite, data/checkpoints.db)
- Sandbox mode: DEGRADED_SANDBOX (Docker not installed — clearly labelled)
- Vision status: VISION_UNAVAILABLE (GGUF files not downloaded yet — probe will update this)
- Graph latency (no LLM, Qdrant-only): ~1700–2600ms per request
- Model swap latency: UNMEASURED (requires GGUF download — run scripts/measure_model_swap.py)


## Completed Work Log

### Phase 1 — Core Runtime & RAG Ingestion (2026-09-01)

#### Sub-task 1.0 — Architecture + Planning
- Ran full environment diagnostics (GPU, RAM, Python, CUDA, installed packages)
- Identified critical VRAM mismatch (8B model > 4 GB VRAM)
- User decision: DeepSeek-R1-Distill-Qwen-3B Q4_K_M (~2.5 GB VRAM)
- User decision: pre-built llama-server.exe CUDA 12 binary
- Created full implementation plan and received approval

#### Sub-task 1.1 — LLM Server Bring-Up
- Downloaded llama-server b10734 CUDA 12.4 binary (242 MB) → bin\llama-server.exe
- Extracted 30 CUDA DLLs alongside the binary
- Confirmed binary runs: version 0.3.0-dev build 10734
- DEVIATION: Used llama-server.exe binary (not llama-cpp-python wheel) — same CUDA acceleration
- PENDING: GGUF model download (requires HF auth — user doing this manually)
- PENDING: Actual VRAM measurement (cannot be done until model loaded)

#### Sub-task 1.2 — FastAPI Gateway
- Scaffolded 15 Python source files (0 syntax errors)
- All Pydantic v2 schemas defined: ChatRequest, ChatResponse, IngestRequest, IngestResponse, NetworkStatusResponse, SourceChunk, InterfaceInfo, ErrorResponse
- Full RAG loop in /chat (embed → Qdrant → prompt → llama-server → structured response)
- /ingest endpoint with full pipeline wiring
- /network-status with real psutil interface enumeration + service health checks
- TESTED: FastAPI starts and GET / returns 200 OK with correct payload
- TESTED: GET /network-status returns 200 with real interface list and Qdrant health

#### Sub-task 1.3 — Ingestion Pipeline
- parser.py: PyMuPDF4LLM with graceful fitz fallback for PDFs; text file support
- chunker.py: 512-token / 64-overlap sliding window with sentence boundary snapping
- embedder.py: FastEmbed BAAI/bge-large-en-v1.5 (dim=1024, COSINE)
  - DEVIATION: BGE-M3 not in installed fastembed version → used bge-large-en-v1.5 (same dim=1024)
- vector_store.py: Qdrant Embedded on-disk; batch upsert, cosine search, doc deletion, point count
- Bugs fixed: vectors_count → points_count (qdrant-client v1.12+ API change)

#### Sub-task 1.4 — Seed Data + Ingestion
- 4 seed documents created:
  1. oisd_116_pressure_vessel_inspection.txt — 10-year max interval, H2S 5-year rule
  2. oisd_118_fire_protection.txt — water spray rates, foam rates, LEL thresholds, safety distances
  3. asme_b31_3_process_piping.txt — wall thickness formula, Y-coefficients, B16.5 P/T ratings
  4. mrpl_sop_flare_system.txt — pilot setpoints, KOD alarms, purge rate, exclusion zones
- TESTED: Full ingestion pipeline ran successfully
  - 4 docs → 9 chunks → 9 Qdrant vectors
  - Qdrant vector count confirmed: 9 ✅

#### Sub-task 1.5 — End-to-End RAG (PARTIALLY COMPLETE)
- /chat endpoint wired with full RAG loop (embed → Qdrant → prompt → llama-server)
- Grounding test script written (scripts/test_rag.py) with grounding verification logic
- Grounding question: N2 purge rate + KOD trip setpoints (synthetic MRPL values, not in model training)
- **VERIFIED 2026-09-01**: `python scripts/verify_phase1.py` → PASS
  - Qdrant vectors: 9
  - H2S inspection query → top score 0.7950 (oisd_116_pressure_vessel_inspection) ✅
  - Found '200 Nm3/h', '70%' KOD, 'purge' in retrieval results ✅
  - Grounding confirmed: synthetic MRPL values are retrievable from Qdrant

## Architecture Decisions Made

### Phase 1 (Confirmed)

| Decision | Choice | Rationale |
|---|---|---|
| Reasoning model | DeepSeek-R1-Distill-Qwen-3B Q4_K_M (~2.5 GB VRAM) | Only model fitting 4 GB VRAM with headroom; user-selected 2026-09-01 |
| LLM binary | llama-server.exe b10734 CUDA 12.4 (pre-built) | No CUDA toolkit on machine; pre-built is equivalent |
| llama-server port | 8080 (localhost only) | Standard llama.cpp default |
| FastAPI gateway port | 8000 (localhost only) | Standard FastAPI default |
| uvloop | SKIPPED — Windows incompatible | uvloop is Linux-only; standard asyncio used |
| Embedding model | BAAI/bge-large-en-v1.5 (dim=1024, COSINE) **CPU-side** | BGE-M3 not in installed fastembed; same dim=1024; CPU to preserve full VRAM for LLMs |
| Chunking strategy | 512 tokens / 64 overlap; tables ≤800 chars whole | bge-large optimal window; sentence snapping |
| Qdrant storage | On-disk at data/qdrant_storage/ | Persistent across restarts |
| Qdrant collection | mrpl_refinery_kb | Project-specific |
| Document parser | PyMuPDF4LLM + fitz fallback | Already installed; Docling deferred |
| Prompt template | ChatML (`<\|im_start\|>`) | DeepSeek-R1-Distill uses ChatML format |
| Qdrant client.search() | Migrated to client.query_points() | API removed in qdrant-client v1.12+ |

### Phase 2 (Locked — confirmed 2026-09-01)

> All models swapped sequentially — **NOT co-resident**. GPU holds only one model at a time.
> Embedding (FastEmbed bge-large-en-v1.5) + reranker run **CPU-side** to preserve full VRAM for LLMs.

| Role | Model | VRAM est. | Notes |
|---|---|---|---|
| Reasoning | DeepSeek-R1-Distill-Qwen-3B Q4_K_M | ~2.5 GB | Already confirmed Phase 1 |
| Vision | Qwen2.5-VL-3B-Instruct Q4_K_M + mmproj-f16 | ~3–3.5 GB | **RISK: llama.cpp mmproj support for Qwen2.5-VL UNVERIFIED — test in isolation before Phase 2** |
| Code | Qwen2.5-Coder-1.5B-Instruct Q4_K_M | ~0.9 GB | Should fit with 3 GB headroom |
| Embedding | BAAI/bge-large-en-v1.5 (FastEmbed) | 0 GB (CPU) | CPU-side, no VRAM consumed |
| Reranker | TBD (CPU-side cross-encoder) | 0 GB (CPU) | Evaluated in Phase 2 |

**Model swap mechanism**: llama-swap or process-restart (to be determined — measure swap latency before committing to demo script timing)

## Hardware / Environment

| Item | Value |
|---|---|
| GPU | NVIDIA GeForce RTX 3050 Laptop GPU |
| VRAM | **4 GB** (437 MiB used at rest) |
| System RAM | 16 GB |
| OS | Windows 11 (PowerShell) |
| Python | 3.13.14 (Microsoft Store) |
| CUDA Toolkit | NOT INSTALLED (nvcc not found) |
| CUDA Display Driver | 610.78, CUDA UMD 13.3 |
| llama-server | b10734 CUDA 12.4 binary (in bin\) |

## VRAM / Resource Budget Tracker
- Target GPU: NVIDIA GeForce RTX 3050 Laptop — **4 GB VRAM**
- Idle VRAM (at rest): 437 MiB
- DeepSeek-R1-Distill-Qwen-3B Q4_K_M: ~2.5 GB (estimated, measure after first load)
- Qwen2.5-VL-3B Q4_K_M + mmproj-f16: ~3–3.5 GB (estimated)
- Qwen2.5-Coder-1.5B Q4_K_M: ~0.9 GB (estimated)
- Embedding (FastEmbed): **CPU-side, 0 GB GPU**
- Reranker: **CPU-side, 0 GB GPU**
- Models are loaded one at a time; maximum single-model peak: ~3.5 GB → fits in 4 GB ✅
- Actual VRAM at first model load: **TBD** — run `nvidia-smi` immediately after llama-server loads model

### Model Swap Strategy (Decided — Phase 2)
- Models swapped sequentially, **NOT co-resident**
- Swap options: llama-server `/models` API (if supported in b10734) OR process restart
- **Model swap latency: UNMEASURED** — must time and budget into demo script before committing
- Accepted tradeoff: weaker reasoning/vision/code quality vs. working live demo on actual hardware

## Known Risks / Open Issues

| # | Status | Risk |
|---|---|---|
| 1 | ✅ RESOLVED | Model size: 8B Q4_K_M > 4 GB VRAM → downgraded to 3B Q4_K_M |
| 2 | ✅ RESOLVED | CUDA Toolkit not installed → pre-built llama-server binary |
| 3 | ✅ RESOLVED | uvloop Windows incompatible → standard asyncio |
| 4 | ✅ RESOLVED | BGE-M3 not in fastembed → bge-large-en-v1.5 (same dim=1024) |
| 5 | ✅ RESOLVED | qdrant `vectors_count` removed → `points_count` |
| 6 | ✅ RESOLVED | qdrant `client.search()` removed → `client.query_points()` |
| 7 | ✅ RESOLVED | Phase 1 grounding: verified 2026-09-01 (score 0.7950, all synthetic values found) |
| 8 | ⏳ PENDING | GGUF model download (HF auth token required — HF CLI login completed 2026-09-01; token is read-only; confirm auth persists across sessions or re-login before each Phase download) |
| 9 | ✅ RESOLVED | Qwen2.5-VL-3B mmproj in llama-server b10734: **CONFIRMED SUPPORTED** — `--mmproj` flag + `mtmd.dll` present. Vision node ready to activate once GGUF downloaded. |
| 10 | ⚠️ PENDING | Model swap latency: **UNMEASURED** — run `scripts/measure_model_swap.py` after GGUF download |
| 11 | ✅ KNOWN | QdrantClient.__del__ ImportError at Python shutdown — harmless Windows portalocker bug; no runtime impact |
| 12 | ℹ️ NOTE | Qdrant Embedded uses an exclusive file lock (portalocker) — only one Python process at a time |
| 13 | ℹ️ NOTE | 9 vectors is minimal corpus — acceptable for demo |
| 14 | ℹ️ NOTE | Vision/code model quality deliberately weaker (3B/1.5B) to fit 4 GB VRAM — accepted tradeoff |
| 15 | ✅ RESOLVED | SqliteSaver checkpoint unavailable — fixed by installing `langgraph-checkpoint-sqlite`; now AVAILABLE |
| 16 | ℹ️ NOTE | Sandbox is DEGRADED_SANDBOX (Docker not installed on Windows); clearly labelled; not claimed as Docker isolation |

## Phase 1 Status: ✅ COMPLETE (as of 2026-09-01)

All code and tests pass. One remaining user-action:
```
hf auth login                      # if token expired
.\scripts\download_model.ps1       # ~2.1 GB
.\scripts\start_all.ps1            # starts llama-server + FastAPI
python scripts\test_rag.py         # full /chat end-to-end grounding test
```


### Phase 3 started — 2026-09-01T20:05:30+05:30
- Read PROJECT_BRAIN.md before execution.
- Phase 2 status observed: COMPLETE (47/47 tests pass, 8/8 demo matrix pass).
- Phase 3 scope: Tauri v2/React shell, live agent trace, artifact compilers (docx/xlsx/pptx), network monitor.
- Production security claims NOT authorized; all limitations must remain visible in UI.
- Toolchain confirmed: Node 24.13, Rust 1.94, Cargo 1.94, Tauri CLI 2.11.4, npm 11.5.2.
- Artifact packages: python-docx 1.2.0 OK, openpyxl 3.1.5 OK, python-pptx 1.0.2 OK, docxtpl MISSING.
- No GGUF files; vision UNAVAILABLE - will surface in UI without hiding.
- DEGRADED_SANDBOX (no Docker) clearly labelled in UI.

## Phase 3 — UI, Artifacts & Security (2026-09-01T23:27:00+05:30)
- Status: COMPLETE
- Python tests: 77/77 PASS (30 new Phase 3 + 47 Phase 1+2 regression — all pass)
- Frontend build: Vite 7, 235 modules, 0 TS errors, bundle 363 kB JS + 26 kB CSS
- Frontend launch: cd ui\mrpl-workbench && npm run tauri dev
- Backend: v0.3.0 — /artifacts/* + /network/monitor added to main.py
- React Flow: 7-node DAG, states driven by events[] from backend only
- Artifact compilers: docx OK / xlsx OK (=formula) / pptx OK (limitations slide always present)
- Network monitor: psutil_only - packet capture MONITOR_UNAVAILABLE - never claims 0 egress as proof
- All limitations visible: VISION_UNAVAILABLE / DEGRADED_SANDBOX / INSUFFICIENT_EVIDENCE / DISCONNECTED
- Evidence: data/phase3_verification_evidence.json

### Next steps for Phase 4
1. GSAP cinematic timelines and ScrollTrigger polish for demo
2. Scripted 8-case demo scenario with reproducible state
3. Air-gap rehearsal: download models, run offline, verify no egress
4. Model swap latency measurement (after GGUF download)
5. Pitch preparation and slide deck from pptx compiler output

### Phase 4 started — 2026-09-01T23:31:30+05:30
- Read PROJECT_BRAIN.md before execution.
- Phase 3 status observed: COMPLETE (77/77 tests, Vite build clean, all endpoints live).
- Live-model preflight status BEFORE this session: GGUFs NOT downloaded / latency UNMEASURED.
- Sub-task 4.0 (live preflight) is BLOCKING — cannot start GSAP or scenario work until models are on disk.
- Phase 4 scope: live-model preflight, GSAP polish, scripted scenarios, air-gap rehearsal, final tuning.
- No new backend architecture changes are authorized in this phase.
- Download scripts needed: VL-3B + mmproj and Coder-1.5B scripts do not yet exist — create them first.

### Phase 4 (partial) — 2026-09-02T00:00:30+05:30
- Status: PARTIAL — BLOCKED on GGUF download (user action required)
- All agent-executable work complete. Blocked items require GGUFs on disk.
- Corpus expanded: 9 → 17 vectors (5 new seed docs ingested)
- GSAP animations added: app-load, query pulse, panel switch, node glow, egress counter (UNKNOWN-safe)
- TS: 0 errors. Vite build: 242 modules, 2.14s. Full regression: 77/77 PASS.
- New scripts:
    scripts/download_vision_model.ps1   — Qwen2.5-VL-3B + mmproj download
    scripts/download_coder_model.ps1    — Qwen2.5-Coder-1.5B download
    scripts/run_preflight.ps1           — automated checks: GGUFs, HF auth, vision probe, agent round-trip
    scripts/expand_corpus.py            — 5-doc corpus expansion (already run)
- New docs:
    docs/demo_scripts.md               — 3 demo scenarios with timing [MEASURE] placeholders
    docs/jury_limitations.md           — honest capability table for jury Q&A

### REMAINING (pending user action):
1. USER: hf auth login + run all 3 download scripts (~5 GB total)
2. USER: run .\scripts\run_preflight.ps1 → read data/preflight_results.json
3. AGENT: fill [MEASURE] latencies into docs/demo_scripts.md from preflight results
4. USER: run Demo 3 air-gap rehearsal (disconnect WAN, run query, observe monitor)
5. AGENT: set Phase 4 status COMPLETE after all above confirmed

### Known limitations for jury (from docs/jury_limitations.md)
- Vision: VISION_UNAVAILABLE (4GB VRAM, VL-3B not yet loaded; may clear after download)
- Sandbox: DEGRADED_SANDBOX (Docker not installed; AST allowlist only)
- Network: psutil_only (no NPCAP; process-level socket evidence only)
- Corpus: 17 vectors demo corpus (not full OISD/ASME library)
- Model quality: 3B/1.5B (constrained by 4GB VRAM)

### Architecture Decision: Reasoning Model Fallback — 2026-09-02T00:51:46+05:30
- **Why 3B path was rejected**: The previously configured model repository artowski/DeepSeek-R1-Distill-Qwen-3B-GGUF returned HTTP 404 (Not Found) during the download phase.
- **Active 1.5B repository and filename**:
  - Repo: artowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF
  - Filename: DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf
- **Hardware constraint**: We remain strictly limited to the RTX 3050 Laptop with 4 GB VRAM. The 1.5B model (~1.1 GB VRAM) provides even more headroom, making hot-swapping or co-residency more viable if needed later.
- **Accepted Tradeoff**: Falling back from 3B to 1.5B means accepting a reduction in reasoning capability and code generation quality. This is deemed an acceptable tradeoff to ensure the local inference engine functions smoothly within the memory constraints and without breaking the automated pipelines.

### Session Log
### Reasoning-Model Live Verification started — 2026-09-02T00:56:44+05:30
- Live reasoning-model verification has begun.
- Model confirmed downloaded: DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf

### Session Log
### Phase 4 real-model preflight started — 2026-09-02T01:03:06+05:30
- Phase 4 real-model preflight has begun.

### Preflight blocked — 2026-09-02
- Qwen2.5-VL-3B-Instruct vision model download failed with HTTP 404 Not Found.
- Repo/file: bartowski/Qwen2.5-VL-3B-Instruct-GGUF / Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf (and mmproj).
- Awaiting user direction on model substitution.

### Vision downloader repair started — 2026-09-02T01:20:05+05:30
- Old invalid repo: bartowski/Qwen2.5-VL-3B-Instruct-GGUF — HTTP 404 confirmed.
- Corrected repo: ggml-org/Qwen2.5-VL-3B-Instruct-GGUF
- Available files verified:
  - Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf (1.93 GB) — SELECTED (main model)
  - mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf (0.84 GB) — SELECTED (combined = 2.77 GB, fits 4 GB VRAM)
  - mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf (1.34 GB) — FALLBACK if Q8_0 has issues
  - Qwen2.5-VL-3B-Instruct-Q8_0.gguf (3.29 GB) — REJECTED, too large
- src\config.py updated: model_vision_mmproj_path changed from Qwen2.5-VL-3B-Instruct-mmproj-f16.gguf -> mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf
- Downloader rewritten and executing.

### Vision downloader repair COMPLETE — 2026-09-02T01:32:05+05:30
**Result: VISION_AVAILABLE**

#### Repository Fix
- Old invalid repo: bartowski/Qwen2.5-VL-3B-Instruct-GGUF — HTTP 404 confirmed.
- Corrected repo: ggml-org/Qwen2.5-VL-3B-Instruct-GGUF — verified and working.

#### Downloaded Files (verified non-zero on disk)
- Main GGUF : models\Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf
  - Bytes: 1,929,901,056 | 1.797 GB
- mmproj    : models\mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf
  - Bytes: 844,757,728 | 0.787 GB
- Combined VRAM estimate: ~2.58 GB — fits RTX 3050 4 GB with ~1.4 GB headroom.
- Fallback mmproj-f16 (1.34 GB) available in repo if Q8_0 has compat issues.

#### Quantization Selection Rationale
- Q4_K_M chosen for main model: smallest usable quantization at 1.80 GB.
- Q8_0 chosen for mmproj: smaller than f16 (0.79 GB vs 1.34 GB); combined 2.58 GB fits VRAM.
- Q8_0 model (3.29 GB) rejected: too large for 4 GB VRAM with mmproj co-resident.

#### Active Configuration Changes
- src\config.py: model_vision_mmproj_path changed from
  Qwen2.5-VL-3B-Instruct-mmproj-f16.gguf -> mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf
- scripts\download_vision_model.ps1: repo corrected from bartowski -> ggml-org,
  filenames updated to verified existing assets.

#### Vision Probe Results (data\vision_probe_result.json)
- status: ok
- load_success: true
- load_time_ms: 2624.7 ms (cold start)
- inference_latency_ms: 2761.6 ms
- result_preview: "Assume that the image is a natural scene. I think you'll be good at this..."

#### GPU / VRAM Observation
- nvidia-smi captured POST-probe (llama-server already terminated by probe script).
- VRAM at rest: 0 MiB / 4096 MiB (probe server cleaned up correctly).
- VRAM delta during probe: null (probe script measured delta but nvidia-smi not sampled in-flight).
- GPU status: CPU_FALLBACK_OR_NO_GPU_OFFLOAD (no llama-server process visible in nvidia-smi during/after probe; VRAM delta null — cannot confirm CUDA offload in this run).

#### gitignore
- models/ and *.gguf already covered on lines 4-5 of .gitignore — no model committed.

#### Final Capability States
- VISION_AVAILABLE (probe returned status: ok, inference confirmed, load_success: true)
- DEGRADED_SANDBOX (Docker not installed — unchanged)
- MONITOR_UNAVAILABLE (no NPCAP — unchanged)
- Phase 4 status: PARTIAL — BLOCKED (awaiting manual air-gap rehearsal)

#### Next Action
Run scripts\run_preflight.ps1 to execute full automated preflight across all three models.

### Phase 4 full automated preflight started — 2026-09-02T01:36:00+05:30
- Brain file read before execution.
- All 4 GGUF files confirmed present and non-zero:
  - DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf (1.041 GB)
  - Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf (1.797 GB)
  - mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf (0.787 GB)
  - Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf (0.918 GB)
- Ports 8080 and 8000 confirmed free before start.
- One stale filename fixed in scripts\run_preflight.ps1 (mmproj-f16 -> mmproj-Q8_0).
- Starting full stack and executing run_preflight.ps1.

### Phase 4 full automated preflight COMPLETE — 2026-09-02T01:39:23+05:30
**Preflight result: PASS**

#### Model Files Verified (Step 1)
| File | Path | Size | Status |
|---|---|---|---|
| Reasoning | models\DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf | 1.04 GB | PASS |
| Vision main | models\Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf | 1.80 GB | PASS |
| Vision mmproj | models\mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf | 0.79 GB | PASS |
| Coder | models\Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf | 0.92 GB | PASS |

#### HF Auth (Step 2): PASS - user=shahnoor-exe

#### Vision Probe (Step 3): PASS
- load_success: true
- cold_start: 7088.7 ms
- inference_latency: 4763.7 ms
- vram_delta: 0.0 MiB (CPU_FALLBACK_OR_NO_GPU_OFFLOAD confirmed)
- result: real coherent inference output produced

#### Model Swap Latency (Step 4): PARTIAL
- Reasoning cold-start: 2.8s | VRAM delta: 0 MiB
- Coder cold-start: 2.6s | VRAM delta: 0 MiB
- Vision cold-start: 7.2s | VRAM delta: 0 MiB
- measure_model_swap.py raised an exception after timing; timing data captured before failure.

#### Stack Startup
- llama-server: http://127.0.0.1:8080 (PID 14148, reasoning model)
- FastAPI gateway: http://127.0.0.1:8000 (PID 7024, phase=3)

#### FastAPI Health (Step 5): PASS - phase=3

#### Agent /agent/run Round-Trip (Step 6): PASS
- status: ok
- intent: rag
- latency: 10043 ms
- evidence_count: 5 chunks retrieved from Qdrant
- vision_status: not_requested (correct — RAG intent, not vision)
- sandbox_mode: not_run (correct — no code execution requested)

#### GPU Evidence
- Baseline (pre-preflight): 0 MiB / 4096 MiB, no LLM process visible
- During vision probe: vram_delta = 0.0 MiB (directly measured by probe script)
- Post-preflight: 58 MiB (browser only, no llama-server process listed)
- GPU STATUS: CPU_FALLBACK_OR_NO_GPU_OFFLOAD
  Inference succeeds on all three model roles but no GPU allocation confirmed.
  llama-server launched with --n-gpu-layers 99 but VRAM delta = 0 across all runs.
  Possible causes: WDDM driver reporting limitation or model running CPU-side.

#### Evidence Files
- data\preflight_results.json (written by run_preflight.ps1)
- data\vision_probe_result.json (written by probe_vision.py)

#### Active Configuration Changes Made During Preflight
- scripts\run_preflight.ps1: stale mmproj-f16.gguf -> mmproj-Q8_0.gguf (one line, backed up)
- scripts\run_preflight.ps1: hf auth status -> hf auth whoami (encoding fixed)
- All other scripts and source files unchanged.

#### Final Capability Truth Table
| Capability | State | Evidence |
|---|---|---|
| Reasoning | AVAILABLE | cold-start 2.8s, /agent/run RAG round-trip PASS |
| Vision | VISION_AVAILABLE | load_success=true, inference=4.76s, real output |
| Coder | AVAILABLE (file verified) | cold-start 2.6s, model file confirmed |
| Sandbox | DEGRADED_SANDBOX | Docker not installed; AST allowlist only |
| Network monitor | MONITOR_UNAVAILABLE | No NPCAP; process-level only |
| GPU | CPU_FALLBACK_OR_NO_GPU_OFFLOAD | vram_delta=0 across all three models |

#### Phase 4 Status
PARTIAL — PRE-FLIGHT COMPLETE; MANUAL AIR-GAP REHEARSAL PENDING

#### One Next Action
Perform the manual air-gap rehearsal as a separate controlled step:
disconnect WAN adapter, run a full query end-to-end, observe network monitor
output, then reconnect. Do NOT begin this step in the current session.

### Final Release Rehearsal started — 2026-09-02T01:45:51+05:30
- Phase 4 preflight baseline: PASS (from preflight_results.json, verified just before this session)
- Services confirmed alive: FastAPI 127.0.0.1:8000 (PID 7024, phase=3 RUNNING)
- llama-server PID 14148 no longer listening on 8080 (exited post-preflight, expected)
- Network adapters discovered: Wi-Fi (Intel AX211, Up), Ethernet (Disconnected), vEthernet (Hyper-V, Up)
- Air-gap adapter to disable for rehearsal: Wi-Fi only (Ethernet already disconnected)
- Scope of this session: swap exception fix, demo script timing update, air-gap rehearsal, release check

### Final Release Rehearsal COMPLETE — 2026-09-02T01:51:52+05:30

#### TASK 2: Model Swap Gate — RESOLVED
- Exception root cause: Unicode arrow char (->?) in print statement hit Windows charmap codec.
- Fix applied: ASCII arrow '-> substituted in one print line (backed up before edit).
- Rerun result (exit 0):
  - Reasoning cold-start: 2702.6 ms (2.7s)
  - Coder cold-start: 2676.2 ms (2.7s)
  - Vision cold-start: 9517.4 ms (9.5s)
  - Hot-switch reasoning->coder: 5277.7 ms (5.3s)
- All VRAM deltas: 0 MiB — GPU_STATUS: CPU_FALLBACK_OR_NO_GPU_OFFLOAD
- Swap gate: PARTIAL->TIMINGS CAPTURED; all cold-starts measured, hot-switch measured.

#### TASK 3: Demo Script Calibration
- docs\demo_scripts.md: all [MEASURE] placeholders replaced with measured values.
- Vision status updated from placeholder to VISION_AVAILABLE.
- CPU note added to timing table.

#### TASK 4/5: Air-Gap Safety Check and Rehearsal
- Safety check: COMPLETED. All model files local, no downloads active.
- Adapters Up before attempt: Wi-Fi (Intel AX211), vEthernet (Hyper-V)
- Ethernet: already Disconnected, not touched.
- Disable-NetAdapter FAILED: Access denied - shell lacks elevation (non-admin PowerShell).
- DECISION: Skipped physical adapter disable; proceeded with functional connectivity test.
- Air-gap query (with Wi-Fi still Up): /agent/run query sent to loopback 127.0.0.1:8000.
  - Query: corrosion life calculation (0.45 mm/yr, 8.0 mm measured, 6.0 mm min)
  - Status: ok | Intent: code | Evidence: 5 chunks | Latency: 10170 ms
  - All computation served from loopback: Qdrant, FastAPI, llama-server on 127.0.0.1
- Network monitor summary endpoint timed out (MONITOR_UNAVAILABLE state confirmed).
- Loopback query proved functional without external dependency, even though Wi-Fi was still enabled.
- Air-gap rehearsal: PARTIAL - adapter disable requires elevated PowerShell session.

#### TASK 6: Tests and Build
- Backend tests (live Qdrant lock): 6 FAILED (Qdrant storage lock contention with live FastAPI) + 70 passed + 1 skipped
- Backend tests (Qdrant excluded): 67 passed, 1 skipped - PASS
- Qdrant tests must be run with FastAPI stack stopped; this is expected and documented.
- TypeScript check: 0 errors - PASS
- Frontend build: not run (TypeScript clean; Vite build is a separate production step)
- Evidence file: data\final_rehearsal_evidence.json - WRITTEN

#### FINAL CAPABILITY TRUTH TABLE
| Capability | State | Evidence |
|---|---|---|
| Reasoning | AVAILABLE | Cold-start 2.7s, /agent/run RAG PASS 10s |
| Vision | VISION_AVAILABLE | load_success=true, cold-start 9.5s, inference 4.8s |
| Coder | AVAILABLE | Cold-start 2.7s, hot-switch 5.3s, agent code intent PASS |
| Sandbox | DEGRADED_SANDBOX | AST allowlist only; Docker not installed |
| Network monitor | MONITOR_UNAVAILABLE | /network/monitor/summary timed out; psutil process-level only |
| GPU | CPU_FALLBACK_OR_NO_GPU_OFFLOAD | All VRAM deltas 0 MiB across all models |

#### PHASE 4 STATUS
PARTIAL - PRE-FLIGHT COMPLETE; MANUAL AIR-GAP REHEARSAL PENDING
Blocker: Disable-NetAdapter requires elevated Administrator shell.
Manual action: Open elevated PowerShell, run Disable-NetAdapter -Name 'Wi-Fi' -Confirm:False,
then run Demo 3 query end-to-end, then Enable-NetAdapter -Name 'Wi-Fi'.

### Addendum Tasks Complete — 2026-09-02T02:24:39+05:30

#### TASK A: Air-Gap Rehearsal — PARTIAL (elevation required)
- Session elevation: FALSE (non-admin PowerShell)
- Adapter to disable: Wi-Fi (Intel AX211 160MHz)
- Disable attempt: Access Denied — requires elevated Admin PS session
- Loopback functional test: /agent/run corrosion query PASSED (ok, code intent, 5 chunks, 10170ms)
- Network monitor: MONITOR_UNAVAILABLE (confirmed by /network/monitor/summary)
- Adapter status: Wi-Fi remains Up (disable not attempted due to elevation)
- STATUS: PARTIAL — PRE-FLIGHT COMPLETE; MANUAL AIR-GAP REHEARSAL PENDING ADMINISTRATOR ELEVATION
- HUMAN ACTION: Open elevated PowerShell, run:
    Get-NetAdapter | Format-Table Name, Status -AutoSize
    Disable-NetAdapter -Name 'Wi-Fi' -Confirm:False
    [run Demo 3 query]
    Enable-NetAdapter -Name 'Wi-Fi' -Confirm:False

#### TASK B: Qdrant Test Isolation — RESOLVED
- Root cause: All test classes imported src.retrieval.vector_store which opened data/qdrant_storage
  while live FastAPI held exclusive lock on the same embedded Qdrant path.
- Fix: conftest.py (session-scoped autouse fixture) at project root
  - copies prod store to tmp_path_factory temp dir
  - sets MRPL_QDRANT_PATH env var before any src.config import
  - resets _qdrant_client singleton
  - cleans up temp dir after session
  - NEVER touches data/qdrant_storage (production store)
- Test result WITH live FastAPI running: 76 passed, 1 skipped — ALL PASS
- 6 Qdrant failures (previously observed with live stack): RESOLVED

#### TASK C: Network Monitor Timeout — RESOLVED
- Root cause: _service_health() called httpx.get(timeout=2.0) x3 services serially; llama_server
  and qdrant are unreachable when not running, each taking 2s timeout = 6s blocking summary endpoint.
- Fix applied to src/routers/network.py:
  - httpx per-service timeout reduced from 2.0s to 0.8s
  - summary endpoint wrapped with asyncio.wait_for(timeout=2.0) for byte delta
  - service_health probe wrapped with asyncio.wait_for(timeout=3.0)
  - Summary response always returns status: MONITOR_UNAVAILABLE and reason: npcap_not_installed
    when bytes_sent_delta is None (first sample)
  - Endpoint now responds in ~3.2s (was timing out at >5s)
- Test: Invoke-RestMethod /network/monitor/summary returned 3165ms, status=MONITOR_UNAVAILABLE PASS

#### TASK D: CPU Fallback Truthfulness — DOCUMENTED
- llama-server launched with --n-gpu-layers 99 but VRAM delta = 0 MiB across all models
- Label preserved: CPU_FALLBACK_OR_NO_GPU_OFFLOAD
- README updated with prototype disclaimer section
- demo_scripts.md timing table has CPU note
- No false GPU badge in UI/docs

#### TASK E: DEGRADED_SANDBOX Label — VERIFIED
- docs/demo_scripts.md: DEGRADED_SANDBOX narration line retained in all demo branches
- docs/jury_limitations.md: DEGRADED_SANDBOX listed under limitations with honest reason
- No UI, README, or artifact file claims Docker isolation

#### TASK F: Launcher — COMPLETE
- launch_dravexis.bat created at project root
- Features: %~dp0 root resolution, Python/npm/binary/GGUF checks, duplicate-service protection,
  bounded 60s health polling, titled terminals for backend and UI, capability truth summary on start
- First launch test: duplicate-check path verified (FastAPI already running = skips backend start)
- Evidence: data/final_rehearsal_evidence.json exists

#### TASK G: GitHub Readiness — LOCAL COMMIT CREATED (PUSH PENDING CONFIRMATION)
- Git initialized: fresh repo (was not a git repo before this session)
- Remote: https://github.com/shahnoor-exe/Dravexis-On-Prem-Agentic-Control-Layer.git
- Branch: main
- Commit SHA: cd7a249e777039d50d281c08222ff195c48ccee6
- Commit message: chore(release): finalize local launcher, test isolation, monitor fix, and demo readiness
- Files committed: 122 (source, docs, scripts, UI source, conftest, README, launch_dravexis.bat)
- Excluded from commit: models/, *.gguf, bin/, data/qdrant_storage/, data/artifacts/,
  data/*.log, data/preflight_results.json, data/model_swap_latency.json,
  data/vision_probe_result.json, data/checkpoints.db, .venv/, __pycache__/, *.bak*,
  Gemini_Terminal_Prompt_*.md, Addendum_*.md, *.env, data/qdrant_storage_test/
- Audit: No credentials, no GGUF binaries, no user-specific hardcoded paths in committed files
- PUSH: NOT YET EXECUTED — awaiting explicit human confirmation

#### FINAL PHASE STATUS
PARTIAL — BLOCKED: MANUAL AIR-GAP REHEARSAL PENDING ADMINISTRATOR ELEVATION; GITHUB PUSH PENDING CONFIRMATION

#### Evidence Files
- data/final_rehearsal_evidence.json
- data/preflight_results.json
- data/model_swap_latency.json
- data/vision_probe_result.json

### Final Air-Gap Verification and Release — 2026-09-02T02:33:13+05:30

#### Air-Gap Rehearsal COMPLETE
- The manual air-gap rehearsal was successfully executed by the human operator via the elevated `airgap_rehearsal.ps1` script.
- Wi-Fi adapter was confirmed Disabled.
- The offline query (Demo 3 - Code Intent) was served entirely from loopback (127.0.0.1).
- Latency: 14.98 seconds.
- Result: 5 evidence chunks retrieved, intent classified correctly as code, and successful offline completion (status: ok).
- Wi-Fi adapter was successfully re-enabled post-test.
- Evidence saved to: data/airgap_rehearsal_result.json

#### GitHub Push COMPLETE
- A professional README.md featuring Mermaid architecture diagrams and honest capability matrices was committed.
- The main branch was pushed to https://github.com/shahnoor-exe/Dravexis-On-Prem-Agentic-Control-Layer.git.
- Commit SHA: 94c93e0.

#### FINAL STATUS
COMPLETE — REHEARSED WITH LIMITATIONS; LOCAL RELEASE READY; GITHUB PUSH COMPLETED.
All blockers (test isolation, network monitor timeouts, and adapter elevation) are fully resolved.

### Launcher Bugfix — 2026-09-02T02:42:31+05:30

#### launch_dravexis.bat Robustness Update
- **Root Cause**: The previous launcher failed silently when double-clicked because paths containing spaces (like SIH 2026 PS 117) were unquoted in subshells, and errors triggered exit /b without a pause, causing the cmd window to instantly vanish.
- **Fix Applied**: 
  - All occurrences of %~dp0 and %ROOT% are strictly quoted.
  - Subshell spawning for backend and UI now uses nested quoting logic cmd /c "cd /d ""%ROOT%"" && ..."
  - Replaced silent exits with a :FAIL label that runs pause, ensuring errors stay on-screen.
  - Added an explicit pause at the successful :DONE label so the truthful capability summary remains visible to the user.
- **Typo Fix**: Corrected the irgap_rehearsal.ps1 typo in the brain file.

### Launcher Browser Auto-Start Fix — 2026-09-02T02:48:15+05:30

#### Frontend Dev Server Switch
- **Root Cause**: The launcher previously called 
pm run tauri dev which invokes the Rust compiler. This took 5-10 minutes on cold start, providing no web UI feedback and hanging the terminal.
- **Fix Applied**: 
  - The launcher now starts the Vite frontend server independently via 
pm run dev.
  - Added Windows start http://localhost:1420/ to automatically launch the default system browser for instant frontend access.
  - Placed the Tauri desktop shell command in the console banner as an optional manual action.
- **Impact**: Provides instant access to the prototype via the browser while allowing the backend to run uninterrupted.

### Launcher Deadlock Root-Cause Fix — 2026-09-02T02:54:31+05:30

#### Root Cause
scripts\start_all.ps1 synchronously polled llama-server /health for up to 120s before ever
starting FastAPI (python -m uvicorn). Because llama-server takes 2-15s to load the GGUF
model before serving /health, FastAPI was never started during that window.
launch_dravexis.bat then called start_all.ps1 and polled http://127.0.0.1:8000/ — which
returned nothing because FastAPI never launched. This caused the 60-dot timeout deadlock.

This was a fundamental conflict with the Phase 2 architecture decision: llama-server is
managed ON-DEMAND by src/model_manager.py. Starting a persistent llama-server at launch
is wrong by design and causes VRAM waste and process-restart conflicts.

#### Fix Applied

scripts\start_all.ps1:
- REMOVED: synchronous llama-server Start-Process + /health polling loop (lines 46-75).
- CHANGED: FastAPI is now started IMMEDIATELY in the foreground via:
    python -m uvicorn src.main:app --host 127.0.0.1 --port 8000
- ADDED: Architecture note in script header explaining that llama-server is managed
  on-demand by model_manager.py, not at startup.

launch_dravexis.bat:
- CHANGED: Now spawns FastAPI directly (cmd /k python -m uvicorn ...) instead of
  calling start_all.ps1, which has different terminal semantics.
- REDUCED: Health poll timeout from 60s to 15s. FastAPI alone starts in ~5s without
  waiting for model load.
- NO CHANGE to Vite launch or browser auto-open logic (working correctly).

#### Verification
- FastAPI started in 5242ms with no llama-server involvement.
- Status: running | Phase: 3
- First agent query will trigger on-demand model_manager load (~2-3s additional).

#### Phase 4 Final Status
COMPLETE — REHEARSED WITH LIMITATIONS; LOCAL RELEASE READY; GITHUB PUSH COMPLETED.
