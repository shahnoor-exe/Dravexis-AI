"""
llm_client.py — Async and sync HTTP client for the llama-server (llama.cpp) completion API.

Thin adapter: takes a prompt string or messages list, returns a completion dict.
All model-level configuration (temperature, max_tokens) is passed in per-request.
"""
from __future__ import annotations

import logging

import httpx

from .config import settings

logger = logging.getLogger(__name__)


class LlamaServerError(RuntimeError):
    """Raised when llama-server returns an error or is unreachable."""


class LlamaClient:
    """
    Async client wrapping the llama-server HTTP API.

    Use as a shared singleton via `get_llama_client()` — one client,
    persistent connection pool, no per-request overhead.
    """

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.llama_server_url,
            timeout=settings.llama_server_timeout,
        )

    async def complete(
        self,
        prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 512,
        stop: list[str] | None = None,
    ) -> tuple[str, int]:
        """
        Send a completion request to llama-server.

        Returns:
            (completion_text, tokens_predicted)

        Raises:
            LlamaServerError on HTTP error or timeout.
        """
        payload: dict = {
            "prompt": prompt,
            "temperature": temperature,
            "n_predict": max_tokens,
            "stop": stop or ["<|im_end|>", "</s>"],
        }
        try:
            resp = await self._client.post("/completion", json=payload)
            resp.raise_for_status()
        except httpx.ConnectError as exc:
            raise LlamaServerError(
                f"Cannot connect to llama-server at {settings.llama_server_url}. "
                "Is start_llama_server.ps1 running?"
            ) from exc
        except httpx.TimeoutException as exc:
            raise LlamaServerError(
                f"llama-server timed out after {settings.llama_server_timeout}s"
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise LlamaServerError(
                f"llama-server HTTP {exc.response.status_code}: {exc.response.text}"
            ) from exc

        data = resp.json()
        text: str = data.get("content", "").strip()
        tokens: int = data.get("tokens_predicted", -1)
        logger.debug("llama-server: %d tokens, preview=%r", tokens, text[:80])
        return text, tokens

    async def health(self) -> bool:
        """Returns True if llama-server /health returns 200."""
        try:
            resp = await self._client.get("/health", timeout=5.0)
            return resp.status_code == 200
        except Exception:
            return False

    async def aclose(self) -> None:
        await self._client.aclose()


# ---------------------------------------------------------------------------
# Async singleton
# ---------------------------------------------------------------------------

_llama_client: LlamaClient | None = None


def get_llama_client() -> LlamaClient:
    """Return the shared LlamaClient singleton, creating it if needed."""
    global _llama_client
    if _llama_client is None:
        _llama_client = LlamaClient()
    return _llama_client


# ---------------------------------------------------------------------------
# Synchronous wrappers (for LangGraph nodes which are sync functions)
# ---------------------------------------------------------------------------

def chat_completion(
    messages: list[dict],
    max_tokens: int = 512,
    temperature: float = 0.1,
) -> dict:
    """
    Synchronous wrapper around llama-server /completion.
    Converts OpenAI-style messages list to ChatML prompt.
    Returns {"content": str, "tokens": int}.
    Raises LlamaServerError if server is unreachable.
    """
    # Convert messages to ChatML (DeepSeek-R1 / Qwen chat format)
    prompt_parts = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        prompt_parts.append(f"<|im_start|>{role}\n{content}\n<|im_end|>")
    prompt_parts.append("<|im_start|>assistant\n")
    prompt = "\n".join(prompt_parts)

    payload = {
        "prompt": prompt,
        "temperature": temperature,
        "n_predict": max_tokens,
        "stop": ["<|im_end|>", "</s>"],
    }
    try:
        resp = httpx.post(
            f"{settings.llama_server_url}/completion",
            json=payload,
            timeout=settings.llama_server_timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "content": data.get("content", "").strip(),
            "tokens": data.get("tokens_predicted", -1),
        }
    except Exception as exc:
        raise LlamaServerError(f"chat_completion failed: {exc}") from exc


def vision_completion(image_path: str, prompt: str, max_tokens: int = 512) -> dict:
    """
    Synchronous multimodal completion via llama-server started with --mmproj.
    Returns {"content": str}.
    Raises LlamaServerError if server unreachable or doesn't support vision.
    """
    import base64
    from pathlib import Path as _Path

    img_data = _Path(image_path).read_bytes()
    b64 = base64.b64encode(img_data).decode()

    payload = {
        "prompt": prompt,
        "n_predict": max_tokens,
        "image_data": [{"data": b64, "id": 1}],
        "stop": ["<|im_end|>"],
    }
    try:
        resp = httpx.post(
            f"{settings.llama_server_url}/completion",
            json=payload,
            timeout=settings.llama_server_timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        return {"content": data.get("content", "").strip()}
    except Exception as exc:
        raise LlamaServerError(f"vision_completion failed: {exc}") from exc
