"""
routers/network.py — Enhanced network monitor endpoint (Phase 3).

Replaces the Phase 1 placeholder with real psutil socket/process observation.
Scapy/tcpdump are NOT attempted on Windows without admin + NPCAP.
monitor_capability field explicitly records what is measured vs UNKNOWN.

IMPORTANT: Never reports "0 Bps Egress" as security proof when measurement
is unavailable. Uses UNKNOWN instead.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import psutil
from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/network", tags=["network"])

# Track previous counters for delta calculation
_prev_counters: dict | None = None
_prev_ts: float | None = None


class SocketInfo(BaseModel):
    pid: int | None
    process_name: str | None
    local_addr: str
    remote_addr: str
    status: str
    is_external: bool


class InterfaceInfo(BaseModel):
    name: str
    addresses: list[str]
    is_loopback: bool
    is_up: bool


class NetworkMonitorResponse(BaseModel):
    timestamp_utc: float
    sampling_interval_s: float | None
    monitor_capability: str          # "psutil_only" | "MONITOR_UNAVAILABLE"
    monitor_notes: list[str]
    loopback_up: bool
    interfaces: list[InterfaceInfo]
    active_sockets: list[SocketInfo]
    external_connections_count: int
    bytes_sent_delta: int | None     # None = UNKNOWN (measurement unavailable)
    bytes_recv_delta: int | None
    egress_note: str                 # explicit label for egress measurement state
    service_health: dict[str, str]


def _get_interfaces() -> list[InterfaceInfo]:
    result = []
    addrs = psutil.net_if_addrs()
    stats = psutil.net_if_stats()
    for name, addr_list in addrs.items():
        ips = [a.address for a in addr_list if a.address]
        is_lo = name.lower().startswith(("lo", "loopback"))
        is_up = stats.get(name, None)
        result.append(InterfaceInfo(
            name=name,
            addresses=ips,
            is_loopback=is_lo,
            is_up=is_up.isup if is_up else False,
        ))
    return result


def _get_sockets() -> list[SocketInfo]:
    result = []
    try:
        conns = psutil.net_connections(kind="inet")
    except psutil.AccessDenied:
        return []  # On Windows may need admin for full listing

    # Build pid → name map
    pid_names: dict[int, str] = {}
    for proc in psutil.process_iter(["pid", "name"]):
        try:
            pid_names[proc.info["pid"]] = proc.info["name"] or ""
        except Exception:
            pass

    for conn in conns:
        laddr = f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else ""
        raddr = f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else ""
        rip = conn.raddr.ip if conn.raddr else ""
        is_external = bool(rip) and not (
            rip.startswith("127.") or rip == "::1" or rip.startswith("0.")
        )
        pid = conn.pid
        result.append(SocketInfo(
            pid=pid,
            process_name=pid_names.get(pid) if pid else None,
            local_addr=laddr,
            remote_addr=raddr,
            status=conn.status or "",
            is_external=is_external,
        ))
    return result


def _get_byte_deltas() -> tuple[int | None, int | None, float | None]:
    """Returns (bytes_sent_delta, bytes_recv_delta, interval_s)."""
    global _prev_counters, _prev_ts
    now = time.time()
    try:
        cur = psutil.net_io_counters()
    except Exception:
        return None, None, None

    if _prev_counters is None:
        _prev_counters = cur
        _prev_ts = now
        return None, None, None  # No delta on first call

    interval = now - _prev_ts if _prev_ts else None
    sent_delta = cur.bytes_sent - _prev_counters.bytes_sent
    recv_delta = cur.bytes_recv - _prev_counters.bytes_recv
    _prev_counters = cur
    _prev_ts = now
    return sent_delta, recv_delta, interval


def _service_health() -> dict[str, str]:
    """Probe local services with tight 0.8s per-service timeout to stay non-blocking."""
    health = {}
    import httpx
    for name, url in [
        ("llama_server", "http://127.0.0.1:8080/health"),
        ("fastapi", "http://127.0.0.1:8000/"),
        ("qdrant", "http://127.0.0.1:6333/healthz"),
    ]:
        try:
            r = httpx.get(url, timeout=0.8)  # tight timeout to avoid blocking summary
            health[name] = "ok" if r.status_code < 400 else f"http_{r.status_code}"
        except Exception as e:
            health[name] = f"unreachable: {type(e).__name__}"
    return health


@router.get("/monitor", response_model=NetworkMonitorResponse)
async def network_monitor() -> NetworkMonitorResponse:
    """
    Real psutil-based network monitor.

    monitor_capability = "psutil_only":
      - Socket connections, bytes delta, interface state all available.
      - Scapy/packet capture NOT available on Windows without admin + NPCAP.
      - egress_note states measurement status explicitly — never claims 0 as proof.
    """
    import asyncio, functools

    loop = asyncio.get_event_loop()

    # Run blocking psutil calls in executor
    interfaces, sockets, (sent_delta, recv_delta, interval) = await asyncio.gather(
        loop.run_in_executor(None, _get_interfaces),
        loop.run_in_executor(None, _get_sockets),
        loop.run_in_executor(None, _get_byte_deltas),
    )

    service_health = await loop.run_in_executor(None, _service_health)

    loopback_up = any(i.is_loopback and i.is_up for i in interfaces)
    external_count = sum(1 for s in sockets if s.is_external)

    # Egress note: explicit about what is and isn't measured
    if sent_delta is None:
        egress_note = "UNKNOWN — first sample or measurement unavailable; not proof of zero egress"
    else:
        egress_note = f"MEASURED — {sent_delta} bytes sent since last poll ({interval:.1f}s interval)"

    monitor_notes = [
        "psutil socket enumeration active",
        "Scapy/tcpdump NOT available (Windows; no admin/NPCAP — requires elevated privileges)",
        "Packet-level capture: MONITOR_UNAVAILABLE",
        "Firewall state: not inspected (would require netsh/admin)",
        "egress_note field is authoritative — never interpret absent traffic as proven zero egress",
    ]

    return NetworkMonitorResponse(
        timestamp_utc=time.time(),
        sampling_interval_s=interval,
        monitor_capability="psutil_only",
        monitor_notes=monitor_notes,
        loopback_up=loopback_up,
        interfaces=interfaces,
        active_sockets=sockets[:50],  # cap to 50 for response size
        external_connections_count=external_count,
        bytes_sent_delta=sent_delta,
        bytes_recv_delta=recv_delta,
        egress_note=egress_note,
        service_health=service_health,
    )


@router.get("/monitor/summary")
async def network_monitor_summary() -> dict[str, Any]:
    """
    Lightweight summary for the UI status bar.

    Always returns within ~3 s. If service probes time out, returns
    structured MONITOR_UNAVAILABLE rather than hanging.
    """
    import asyncio
    loop = asyncio.get_event_loop()

    try:
        sent_delta, recv_delta, interval = await asyncio.wait_for(
            loop.run_in_executor(None, _get_byte_deltas), timeout=2.0
        )
    except asyncio.TimeoutError:
        sent_delta, recv_delta, interval = None, None, None

    try:
        service_health = await asyncio.wait_for(
            loop.run_in_executor(None, _service_health), timeout=3.0
        )
    except asyncio.TimeoutError:
        service_health = {"error": "service_health_probe_timed_out"}

    return {
        "status": "MONITOR_UNAVAILABLE" if sent_delta is None else "psutil_only",
        "monitor_capability": "psutil_only",
        "reason": "npcap_not_installed" if sent_delta is None else None,
        "bytes_sent_delta": sent_delta,
        "bytes_recv_delta": recv_delta,
        "egress_note": (
            "UNKNOWN — first sample or measurement unavailable; not proof of zero egress"
            if sent_delta is None
            else f"MEASURED — {sent_delta}B sent"
        ),
        "service_health": service_health,
        "packet_capture": "MONITOR_UNAVAILABLE",
        "timestamp_utc": time.time(),
    }
