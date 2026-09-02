"""
routers/upload.py — Handle file uploads (PDFs)
"""
import logging
import uuid
import time
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel

from ..config import settings, BASE_DIR
from ..llm_client import chat_completion
from ..model_manager import switch_model
from ..agent.graph import get_graph

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])

class UploadResponse(BaseModel):
    session_id: str
    status: str
    intent: str
    final_answer: str
    total_latency_ms: float

@router.post("/pdf", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)) -> UploadResponse:
    t_start = time.monotonic()
    session_id = str(uuid.uuid4())
    logger.info("PDF upload starting for session=%s", session_id)

    try:
        import pypdf
        
        pdf = pypdf.PdfReader(file.file)
        text_parts = []
        for page in pdf.pages:
            text_parts.append(page.extract_text() or "")
        
        text = "\n".join(text_parts).strip()
        
        if not text:
            raise ValueError("No text could be extracted from this PDF.")
        
        # Limit extracted text to avoid overflowing context window
        text = text[:15000]

        switch_model("reasoning")
        prompt = (
            "Summarize the following document accurately and concisely. "
            "Do NOT repeat the prompt or instructions.\n\n"
            f"Document Content:\n{text}"
        )
        
        resp = chat_completion(messages=[{"role": "user", "content": prompt}], max_tokens=600)
        final_answer = resp.get("content", "Error generating summary.")
        
        # Clean output
        import re
        final_answer = re.sub(r"<think>[\s\S]*?</think>", "", final_answer)
        final_answer = re.sub(r"</?think>", "", final_answer)
        final_answer = re.sub(r"<\|im_start\|>[\s\S]*?<\|im_end\|>", "", final_answer)
        final_answer = re.sub(r"<\|im_start\|>.*", "", final_answer).strip()

        # Inject into LangGraph state for follow-up questions
        try:
            graph = get_graph()
            config = {"configurable": {"thread_id": session_id}}
            graph.update_state(config, {"uploaded_pdf_text": text})
            logger.info("Saved PDF text to LangGraph state for session %s", session_id)
        except Exception as e:
            logger.error("Failed to save PDF to graph state: %s", e)

        return UploadResponse(
            session_id=session_id,
            status="ok",
            intent="system",
            final_answer=final_answer,
            total_latency_ms=round((time.monotonic() - t_start) * 1000, 1)
        )
        
    except Exception as exc:
        logger.error("PDF upload failed: %s", exc)
        return UploadResponse(
            session_id=session_id,
            status="error",
            intent="system",
            final_answer=f"Failed to process PDF: {exc}",
            total_latency_ms=round((time.monotonic() - t_start) * 1000, 1)
        )

class ImageUploadResponse(BaseModel):
    image_path: str
    status: str
    error: str | None = None

@router.post("/image", response_model=ImageUploadResponse)
async def upload_image(file: UploadFile = File(...)) -> ImageUploadResponse:
    import shutil
    import os
    from pathlib import Path
    
    upload_dir = BASE_DIR / "data" / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Save with unique name to prevent collisions
    ext = os.path.splitext(file.filename)[1]
    safe_name = f"img_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = upload_dir / safe_name
    
    try:
        with dest_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Convert path to posix string for JSON payload
        image_path = dest_path.resolve().as_posix()
        return ImageUploadResponse(
            image_path=image_path,
            status="ok"
        )
    except Exception as exc:
        logger.error("Image upload failed: %s", exc)
        return ImageUploadResponse(
            image_path="",
            status="error",
            error=str(exc)
        )
