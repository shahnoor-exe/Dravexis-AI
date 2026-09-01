"""
routers/chat.py — POST /chat endpoint.

Phase 1: Full RAG loop (Sub-task 1.5)
    1. Embed user query with FastEmbed BGE-M3
    2. Retrieve top-k chunks from Qdrant
    3. Build context-augmented prompt
    4. Forward to llama-server /completion
    5. Return structured ChatResponse with sources and grounding flag
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from ..config import settings
from ..ingestion.embedder import embed_query
from ..llm_client import LlamaServerError, get_llama_client
from ..retrieval.vector_store import search
from ..schemas import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


@router.post(
    "",
    response_model=ChatResponse,
    summary="Ask a refinery domain question (RAG)",
    description=(
        "Embeds the query, retrieves relevant context from Qdrant, "
        "builds an augmented prompt, and returns a grounded answer from the local LLM."
    ),
)
async def chat(request: ChatRequest) -> ChatResponse:
    """RAG-augmented chat endpoint."""
    llm = get_llama_client()

    # --- Step 1: Embed the query ---
    try:
        query_vec = embed_query(request.query)
    except Exception as exc:
        logger.exception("Embedding failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Embedding service error: {exc}",
        )

    # --- Step 2: Retrieve from Qdrant ---
    try:
        sources = search(query_vec, top_k=request.top_k)
    except Exception as exc:
        logger.exception("Qdrant search failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Vector store error: {exc}",
        )

    grounded = len(sources) > 0

    # --- Step 3: Build prompt ---
    if grounded:
        context_parts = []
        for i, src in enumerate(sources, start=1):
            context_parts.append(f"[Chunk {i} | doc={src.doc_id} | score={src.score:.3f}]\n{src.text}")
        context = "\n\n---\n\n".join(context_parts)
    else:
        context = "No relevant documents found in the knowledge base."

    prompt = settings.rag_prompt_template.format(
        context=context,
        query=request.query,
    )

    # --- Step 4: Call llama-server ---
    try:
        answer, tokens_used = await llm.complete(
            prompt=prompt,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
    except LlamaServerError as exc:
        logger.error("LLM error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )

    # --- Step 5: Return structured response ---
    return ChatResponse(
        answer=answer,
        sources=sources,
        model=settings.model_name,
        tokens_used=tokens_used,
        retrieval_count=len(sources),
        grounded=grounded,
    )
