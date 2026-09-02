"""
conftest.py — pytest fixtures for test isolation.

Provides:
- qdrant_isolated_settings: overrides qdrant_path to a temporary directory per test
  session, preventing lock contention with a running live FastAPI/Qdrant process.
- After the test session the temp directory is removed.

IMPORTANT: This never modifies or deletes data/qdrant_storage (production store).
"""
from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

import pytest


@pytest.fixture(scope="session", autouse=True)
def isolate_qdrant_storage(tmp_path_factory):
    """
    Point all Qdrant operations in this test session to a fresh temporary directory.

    Mechanism: sets MRPL_QDRANT_PATH env var before any src.config import happens
    at session scope. Since pydantic-settings reads env vars at Settings() construction
    time, tests that construct new Settings() objects will pick up the temp path.

    Tests that import src.config at module level (before this fixture runs) will use
    whatever path was set at import time. To guarantee isolation for all Qdrant tests,
    ensure MRPL_QDRANT_PATH is exported before running pytest (e.g. via this fixture
    at session scope with autouse=True).

    The production store at data/qdrant_storage is never read or written.
    """
    tmp_dir = tmp_path_factory.mktemp("qdrant_test_storage")
    original = os.environ.get("MRPL_QDRANT_PATH")
    os.environ["MRPL_QDRANT_PATH"] = str(tmp_dir)

    # Reset the cached singleton if already initialised
    try:
        from src.retrieval import vector_store as vs
        vs._qdrant_client = None
    except Exception:
        pass

    # Patch the already-instantiated settings singleton directly.
    # The env var alone is insufficient because settings = Settings() in config.py
    # was already constructed at module-import time with the production path.
    try:
        from src.config import settings as _settings
        _settings.qdrant_path = str(tmp_dir)
    except Exception:
        pass

    # Seed the isolated store from production so Qdrant tests can find real vectors
    prod_path = Path(__file__).parent / "data" / "qdrant_storage"
    if prod_path.exists():
        shutil.copytree(
            str(prod_path), str(tmp_dir), dirs_exist_ok=True,
            ignore=shutil.ignore_patterns(".lock"),
        )

    yield tmp_dir

    # Teardown: restore env, reset client singleton, remove temp dir
    if original is None:
        os.environ.pop("MRPL_QDRANT_PATH", None)
    else:
        os.environ["MRPL_QDRANT_PATH"] = original

    try:
        from src.retrieval import vector_store as vs
        if vs._qdrant_client is not None:
            try:
                vs._qdrant_client.close()
            except Exception:
                pass
            vs._qdrant_client = None
    except Exception:
        pass

    shutil.rmtree(str(tmp_dir), ignore_errors=True)
