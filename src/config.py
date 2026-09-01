"""
config.py — Central configuration for the Sovereign Agentic AI Workbench.
All settings are sourced from environment variables or fall back to safe defaults.
"""
from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from pathlib import Path


BASE_DIR = Path(__file__).parent.parent  # project root


class Settings(BaseSettings):
    # --- llama-server ---
    llama_server_host: str = "127.0.0.1"
    llama_server_port: int = 8080
    llama_server_timeout: float = 120.0
    llama_server_exe: str = str(BASE_DIR / "bin" / "llama-server.exe")

    @property
    def llama_server_url(self) -> str:
        return f"http://{self.llama_server_host}:{self.llama_server_port}"

    # --- FastAPI gateway ---
    api_host: str = "127.0.0.1"
    api_port: int = 8000

    # --- Phase 2: Model paths (all under models/) ---
    model_reasoning_path: str = str(
        BASE_DIR / "models" / "DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf"
    )
    model_vision_path: str = str(
        BASE_DIR / "models" / "Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf"
    )
    model_vision_mmproj_path: str = str(
        BASE_DIR / "models" / "mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf"
    )
    model_code_path: str = str(
        BASE_DIR / "models" / "Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf"
    )

    # --- Phase 2: llama-server launch flags ---
    llama_n_gpu_layers: int = 99
    llama_ctx_size: int = 4096
    llama_threads: int = 8
    llama_model_switch_timeout: int = 90

    # --- Phase 2: Agent graph ---
    agent_max_iterations: int = 2
    agent_retrieval_threshold: float = 0.45
    agent_top_k: int = 5
    agent_checkpoint_db: str = str(BASE_DIR / "data" / "checkpoints.db")
    vision_probe_result: str = str(BASE_DIR / "data" / "vision_probe_result.json")
    model_switch_log: str = str(BASE_DIR / "data" / "model_switch_log.jsonl")

    # --- Phase 2: Sandbox ---
    sandbox_workspace: str = str(BASE_DIR / "data" / "sandbox_tmp")
    sandbox_timeout_secs: int = 30
    sandbox_max_output_bytes: int = 65536
    sandbox_allowed_imports: list[str] = [
        "math", "cmath", "decimal", "fractions", "statistics",
        "json", "re", "datetime", "time", "collections", "itertools",
        "functools", "typing", "dataclasses",
    ]

    # --- Phase 2: ONNX router ---
    onnx_model_path: str = str(BASE_DIR / "models" / "onnx" / "all-MiniLM-L6-v2.onnx")

    # --- RAG (Phase 1, unchanged) ---
    model_name: str = "DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M"
    qdrant_path: str = str(BASE_DIR / "data" / "qdrant_storage")
    qdrant_collection: str = "mrpl_refinery_kb"
    chunk_size: int = 512
    chunk_overlap: int = 64
    max_table_chars: int = 800
    # Architecture Decision: BGE-M3 unavailable in installed fastembed -> bge-large-en-v1.5 (same 1024-dim)
    embedding_model: str = "BAAI/bge-large-en-v1.5"
    embedding_dim: int = 1024
    default_top_k: int = 5
    rag_prompt_template: str = (
        "<|im_start|>system\n"
        "You are a refinery safety and operations expert. "
        "Answer questions ONLY using the provided context. "
        "If the context does not contain enough information, say so explicitly.\n"
        "<|im_end|>\n"
        "<|im_start|>user\n"
        "Context:\n{context}\n\n"
        "Question: {query}\n"
        "<|im_end|>\n"
        "<|im_start|>assistant\n"
    )

    model_config = ConfigDict(env_prefix="MRPL_", env_file=".env", env_file_encoding="utf-8")


settings = Settings()
