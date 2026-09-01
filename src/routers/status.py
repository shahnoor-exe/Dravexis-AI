"""
routers/status.py — GET /network-status endpoint.

Phase 1: Returns real psutil network info + llama-server + Qdrant health.
Phase 3 will add Scapy-based traffic analysis; the response schema is already
defined in schemas.py so no rework is needed later.
"""
from __future__ import annotations

import logging
import socket
from datetime import datetime, timezone

import psutil

from fastapi import APIRouter

from ..llm_client import get_llama_client
from ..retrieval.vector_store import get_qdrant_client, get_vector_count
from ..schemas import InterfaceInfo, NetworkStatusResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/network-status", tags=["status"])


@router.get(
    "",
    response_model=NetworkStatusResponse,
    summary="System and service health check",
    description=(
        "Returns network interface list, llama-server reachability, "
        "and Qdrant health. Scapy traffic analysis is Phase 3."
    ),
)
async def network_status() -> NetworkStatusResponse:
    """Aggregated health and network status."""
    # --- Network interfaces via psutil ---
    interfaces: list[InterfaceInfo] = []
    try:
        addrs = psutil.net_if_addrs()
        for iface_name, addr_list in addrs.items():
            ip_addrs = [
                a.address
                for a in addr_list
                if a.family in (socket.AF_INET, socket.AF_INET6)
            ]
            is_lo = iface_name.lower().startswith(("lo", "loopback"))
            interfaces.append(InterfaceInfo(
                name=iface_name,
                addresses=ip_addrs,
                is_loopback=is_lo,
            ))
    except Exception as exc:
        logger.warning("psutil interface enumeration failed: %s", exc)

    # --- llama-server health ---
    llm_ok = False
    try:
        llm_ok = await get_llama_client().health()
    except Exception as exc:
        logger.warning("llama-server health check failed: %s", exc)

    # --- Qdrant health ---
    qdrant_ok = False
    try:
        get_vector_count()  # will raise if Qdrant is broken
        qdrant_ok = True
    except Exception as exc:
        logger.warning("Qdrant health check failed: %s", exc)

    overall = "ok" if (llm_ok and qdrant_ok) else "degraded"

    return NetworkStatusResponse(
        status=overall,
        interfaces=interfaces,
        llama_server_reachable=llm_ok,
        qdrant_healthy=qdrant_ok,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
