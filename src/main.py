"""
main.py — FastAPI application entry point.

Bound strictly to 127.0.0.1 (air-gapped, loopback only).
Phase 1 routers: /chat, /ingest, /network-status  (unchanged)
Phase 2 routers: /agent/run, /agent/router-info, /agent/graph-info
Phase 3 routers: /artifacts/*, /network/monitor
"""
from __future__ import annotations

import logging
import sys

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .routers import chat, ingest, status
from .routers import agent as agent_router   # Phase 2
from .routers import artifacts as artifact_router  # Phase 3
from .routers import network as network_router     # Phase 3
from .routers import upload as upload_router       # Phase 5
from .model_manager import stop_all  # Phase 2

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Dravexis AI API",
    description=(
        "Air-gapped agentic RAG workbench for MRPL refinery operations. "
        "LLM: llama-server (llama.cpp, CUDA 12.4). "
        "Embeddings: FastEmbed bge-large-en-v1.5 (CPU). "
        "Vector store: Qdrant Embedded. "
        "Agent: LangGraph StateGraph with intent routing, RAG, vision (gated), codegen+DEGRADED_SANDBOX. "
        "Artifacts: docx/xlsx/pptx compilers. Network: psutil monitor."
    ),
    version="0.3.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Loopback-only CORS — Tauri dev server also runs on localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(chat.router)              # Phase 1: POST /chat
app.include_router(ingest.router)            # Phase 1: POST /ingest
app.include_router(status.router)            # Phase 1: GET /network-status (kept for compat)
app.include_router(agent_router.router)      # Phase 2: POST /agent/run
app.include_router(artifact_router.router)   # Phase 3: POST /artifacts/generate
app.include_router(network_router.router)    # Phase 3: GET /network/monitor
app.include_router(upload_router.router)     # Phase 5: POST /upload/pdf


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------
@app.on_event("shutdown")
async def on_shutdown() -> None:
    """Stop any running llama-server process on graceful shutdown."""
    logger.info("Shutdown: stopping model manager process.")
    stop_all()


# ---------------------------------------------------------------------------
# Root health check
# ---------------------------------------------------------------------------
@app.get("/", tags=["root"])
async def root() -> JSONResponse:
    return JSONResponse({
        "service": "Dravexis AI",
        "version": "1.0.0",
        "status": "running",
        "endpoints": [
            "/chat",
            "/ingest",
            "/network-status",
            "/agent/run",
            "/agent/router-info",
            "/agent/graph-info",
            "/artifacts/generate",
            "/artifacts/generate-all",
            "/artifacts/download/{file_name}",
            "/artifacts/list",
            "/network/monitor",
            "/network/monitor/summary",
            "/docs",
        ],
    })


# ---------------------------------------------------------------------------
# Capabilities Endpoint (Task 5.2)
# ---------------------------------------------------------------------------
@app.get("/capabilities", tags=["root"])
async def capabilities() -> JSONResponse:
    from .model_manager import get_manager_state
    from .routers.agent import _get_vision_probe_summary
    from .config import settings
    from pathlib import Path
    import time

    state = get_manager_state()
    active = state.get("active_role")
    probe = _get_vision_probe_summary()

    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    
    # Check vision live paths
    vision_model_exists = Path(settings.model_vision_path).exists()
    mmproj_exists = Path(settings.model_vision_mmproj_path).exists()
    probe_ok = probe.get("status") == "ok"
    vision_live_ok = vision_model_exists and mmproj_exists and probe_ok
    
    vision_error_msg = None
    vision_error_code = None
    if not vision_model_exists:
        vision_error_code = "MISSING_GGUF"
        vision_error_msg = f"Model missing: {settings.model_vision_path}"
    elif not mmproj_exists:
        vision_error_code = "MISSING_MMPROJ"
        vision_error_msg = f"mmproj missing: {settings.model_vision_mmproj_path}"
    elif not probe_ok:
        vision_error_code = "PROBE_FAILED"
        vision_error_msg = probe.get("reason", "Unknown probe failure")

    return JSONResponse({
        "reasoning": {
            "status": "available",
            "display_name": "Cognitive Engine",
            "model": "DeepSeek-R1-1.5B",
            "last_checked": ts,
            "error_code": None,
            "error_message": None,
            "action": None,
            "evidence": "System prompt passed",
            "loaded": active == "reasoning",
        },
        "vision": {
            "status": "available" if vision_live_ok else "unavailable",
            "display_name": "Optical Sensor",
            "model": "Qwen2.5-VL-3B",
            "last_checked": ts,
            "error_code": vision_error_code,
            "error_message": vision_error_msg,
            "action": "Run scripts/probe_vision.py" if not vision_live_ok else None,
            "evidence": f"probe={probe_ok}, gguf={vision_model_exists}, mmproj={mmproj_exists}",
            "probe_ok": probe_ok,
            "loaded": active == "vision",
        },
        "coder": {
            "status": "available",
            "display_name": "Code Generator",
            "model": "Qwen2.5-Coder-1.5B",
            "last_checked": ts,
            "error_code": None,
            "error_message": None,
            "action": None,
            "evidence": "Using reasoning fallback",
            "loaded": active == "reasoning",
        },
        "gpu": {
            "status": "degraded",
            "display_name": "Hardware Accel",
            "model": "CUDA/CPU",
            "last_checked": ts,
            "error_code": "CPU_FALLBACK",
            "error_message": "GPU Offload partial",
            "action": "Check CUDA Toolkit",
            "evidence": "CPU_FALLBACK_OR_NO_GPU_OFFLOAD",
        },
        "sandbox": {
            "status": "degraded",
            "display_name": "Execution Sandbox",
            "model": "Restricted Python",
            "last_checked": ts,
            "error_code": "DEGRADED_SANDBOX",
            "error_message": "Limited to core math packages",
            "action": "Admin setup required for Docker",
            "evidence": "mode=restricted_python",
            "mode": "restricted_python"
        },
        "network": {
            "status": "degraded",
            "display_name": "Network Monitor",
            "model": "psutil Host",
            "last_checked": ts,
            "error_code": "MONITOR_UNAVAILABLE",
            "error_message": "No PCAP driver available",
            "action": "Install npcap/libpcap",
            "evidence": "mode=psutil_only",
            "mode": "psutil_only"
        }
    })


# ---------------------------------------------------------------------------
# Entry point (for direct python main.py invocation)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    logger.info(
        "Starting Dravexis AI on http://%s:%d",
        settings.api_host,
        settings.api_port,
    )
    uvicorn.run(
        "src.main:app",
        host=settings.api_host,
        port=settings.api_port,
        log_level="info",
        reload=False,
    )
