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
    title="MRPL Sovereign Agentic AI Workbench — Phase 3 API",
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
        "service": "MRPL Agentic AI Workbench",
        "phase": 3,
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
# Entry point (for direct python main.py invocation)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    logger.info(
        "Starting MRPL Agentic AI Workbench on http://%s:%d",
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
