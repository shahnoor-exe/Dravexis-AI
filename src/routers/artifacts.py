"""
routers/artifacts.py — Phase 3 artifact generation endpoint.

POST /artifacts/generate
    Generates docx, xlsx, or pptx from a structured request.
    Each compiler is independent — one failure does not affect others.
    All outputs restricted to data/artifacts/ directory.
    All inputs validated with Pydantic v2 before any file write.
"""
from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator

from ..config import BASE_DIR

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/artifacts", tags=["artifacts"])

ARTIFACT_DIR = BASE_DIR / "data" / "artifacts"
APPROVED_TYPES = {"docx", "xlsx", "pptx"}


# --------------------------------------------------------------------------- #
# Schemas                                                                      #
# --------------------------------------------------------------------------- #

class EvidenceItem(BaseModel):
    doc_id: str = ""
    score: float = 0.0
    text_preview: str = ""


class ArtifactRequest(BaseModel):
    type: Literal["docx", "xlsx", "pptx"]
    query: str = Field(..., min_length=1, max_length=2000)
    evidence: list[EvidenceItem] = Field(default_factory=list, max_length=20)
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    model_role: str | None = None
    label: str = "SYNTHETIC"
    vision_status: str = "VISION_UNAVAILABLE"
    sandbox_mode: str = "DEGRADED_SANDBOX"

    @field_validator("label")
    @classmethod
    def validate_label(cls, v: str) -> str:
        allowed = {"SYNTHETIC", "GROUNDED", "INSUFFICIENT_EVIDENCE", "ERROR"}
        if v not in allowed:
            raise ValueError(f"label must be one of {allowed}")
        return v


class ArtifactResponse(BaseModel):
    status: str
    type: str
    file_name: str | None = None
    file_path: str | None = None
    provenance: dict | None = None
    error: str | None = None


class GenerateAllResponse(BaseModel):
    docx: ArtifactResponse
    xlsx: ArtifactResponse
    pptx: ArtifactResponse
    any_success: bool


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #

def _evidence_dicts(items: list[EvidenceItem]) -> list[dict]:
    return [i.model_dump() for i in items]


def _run_docx(req: ArtifactRequest) -> ArtifactResponse:
    try:
        from ..artifact_compiler import docx_compiler
        result = docx_compiler.generate(
            query=req.query,
            evidence=_evidence_dicts(req.evidence),
            session_id=req.session_id,
            model_role=req.model_role,
            label=req.label,
        )
        return ArtifactResponse(type="docx", **result)
    except Exception as exc:
        logger.error("docx compiler error: %s", exc)
        return ArtifactResponse(type="docx", status="error", error=str(exc))


def _run_xlsx(req: ArtifactRequest) -> ArtifactResponse:
    try:
        from ..artifact_compiler import xlsx_compiler
        result = xlsx_compiler.generate(
            query=req.query,
            evidence=_evidence_dicts(req.evidence),
            session_id=req.session_id,
            model_role=req.model_role,
            label=req.label,
        )
        return ArtifactResponse(type="xlsx", **result)
    except Exception as exc:
        logger.error("xlsx compiler error: %s", exc)
        return ArtifactResponse(type="xlsx", status="error", error=str(exc))


def _run_pptx(req: ArtifactRequest) -> ArtifactResponse:
    try:
        from ..artifact_compiler import pptx_compiler
        result = pptx_compiler.generate(
            query=req.query,
            evidence=_evidence_dicts(req.evidence),
            session_id=req.session_id,
            model_role=req.model_role,
            label=req.label,
            vision_status=req.vision_status,
            sandbox_mode=req.sandbox_mode,
        )
        return ArtifactResponse(type="pptx", **result)
    except Exception as exc:
        logger.error("pptx compiler error: %s", exc)
        return ArtifactResponse(type="pptx", status="error", error=str(exc))


_RUNNERS = {"docx": _run_docx, "xlsx": _run_xlsx, "pptx": _run_pptx}


# --------------------------------------------------------------------------- #
# Endpoints                                                                    #
# --------------------------------------------------------------------------- #

@router.post("/generate", response_model=ArtifactResponse)
async def generate_artifact(req: ArtifactRequest) -> ArtifactResponse:
    """Generate a single artifact of the requested type."""
    import asyncio, functools
    loop = asyncio.get_event_loop()
    runner = _RUNNERS[req.type]
    result = await loop.run_in_executor(None, functools.partial(runner, req))
    return result


@router.post("/generate-all", response_model=GenerateAllResponse)
async def generate_all(req: ArtifactRequest) -> GenerateAllResponse:
    """Generate all three artifact types independently. One failure does not block others."""
    import asyncio, functools
    loop = asyncio.get_event_loop()
    docx_r, xlsx_r, pptx_r = await asyncio.gather(
        loop.run_in_executor(None, functools.partial(_run_docx, req)),
        loop.run_in_executor(None, functools.partial(_run_xlsx, req)),
        loop.run_in_executor(None, functools.partial(_run_pptx, req)),
    )
    return GenerateAllResponse(
        docx=docx_r,
        xlsx=xlsx_r,
        pptx=pptx_r,
        any_success=any(r.status == "ok" for r in [docx_r, xlsx_r, pptx_r]),
    )


@router.get("/download/{file_name}")
async def download_artifact(file_name: str):
    """
    Download a generated artifact by filename.
    Only serves files from data/artifacts/ — no path traversal possible.
    """
    # Sanitise: strip any path components from the name
    safe_name = Path(file_name).name
    file_path = ARTIFACT_DIR / safe_name

    # Security: resolve and confirm inside approved dir
    try:
        file_path.resolve().relative_to(ARTIFACT_DIR.resolve())
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid file path")

    if not file_path.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Artifact not found: {safe_name}")

    media_types = {
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }
    media_type = media_types.get(file_path.suffix, "application/octet-stream")
    return FileResponse(path=str(file_path), filename=safe_name, media_type=media_type)


@router.get("/list")
async def list_artifacts() -> dict:
    """List all generated artifacts in data/artifacts/."""
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(ARTIFACT_DIR.glob("*.*"), key=lambda p: p.stat().st_mtime, reverse=True)
    return {
        "artifacts": [
            {
                "name": f.name,
                "type": f.suffix.lstrip("."),
                "size_bytes": f.stat().st_size,
                "modified": f.stat().st_mtime,
            }
            for f in files[:50]
        ],
        "total": len(files),
    }
