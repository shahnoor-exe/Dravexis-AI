// Jury Limitations Summary — MRPL Agentic AI Workbench (PS 26117)
// SIH 2026 | For disclosure during jury Q&A
// Must mirror PROJECT_BRAIN.md Known Risks — do NOT contradict it.

# Capability & Limitations Summary
## MRPL Sovereign Agentic AI Workbench — SIH 2026

---

## What This System IS

| Capability | Status | Detail |
|---|---|---|
| Sovereign on-premise deployment | ✅ Full | 100% air-gapped; zero cloud dependency |
| Document RAG with statutory grounding | ✅ Working | FastEmbed BGE + Qdrant Embedded; 17 vectors |
| Intent routing (regex + keyword) | ✅ Working | 5 intent classes; deterministic fast-path |
| LangGraph FSM with audit trace | ✅ Working | 7 nodes; SqliteSaver checkpoint |
| Code generation + sandboxed exec | ✅ Working | AST allowlist enforcement |
| DOCX / XLSX / PPTX artifact generation | ✅ Working | Provenance and disclaimer embedded |
| psutil network monitor | ✅ Working | Socket-level; bytes delta |
| Tauri v2 desktop app | ✅ Working | React 19 + Rust shell; GSAP animations |

---

## What This System IS NOT (Honest Limitations for Jury)

| Limitation | Label | Why |
|---|---|---|
| Vision model requires ~3 GB VRAM | VISION_UNAVAILABLE | Dev hardware: RTX 3050 Laptop, 4 GB. Sequential load only. |
| Code sandbox is NOT Docker isolation | DEGRADED_SANDBOX | Docker not installed on this hardware. AST allowlist only. |
| Packet-level network capture unavailable | MONITOR_UNAVAILABLE | NPCAP requires admin install. psutil is process-level only. |
| Corpus is 17 vectors (5 documents) | DEMO CORPUS | Production ingest would cover full OISD/ASME document set. |
| Model quality constrained to 3B/1.5B | ACCEPTED TRADEOFF | 4 GB VRAM hard limit. 7B/13B models need 8+ GB VRAM. |
| No authentication or RBAC | PROTOTYPE | Demo only. Production needs identity + role gating. |
| Remaining life calculations are illustrative | PROTOTYPE | Not certified engineering calculation. Disclaimer in every artifact. |
| DEGRADED_SANDBOX: no resource limits | ACCEPTED | No memory/CPU cap on code exec. In production: cgroups + Docker. |

---

## Architecture Claim Boundaries

### Air-Gap Claim
**Proven:** No new sockets to external IPs during inference. All model inference is local (llama-server, FastEmbed, Qdrant). Artifact generation is local (python-docx, openpyxl, python-pptx).  
**Not proven (without NPCAP):** Packet-level zero-egress. psutil monitors sockets and byte counts; it does not capture individual packets.

### RAG Grounding Claim
**Proven:** Top retrieved chunk scores (0.72–0.87) for OISD/ASME clauses. Synthetic MRPL values (N₂ purge rate 200 Nm³/h, KOD 70%) retrievable and injected into prompts.  
**Not proven:** LLM answer faithfulness without a human review step. Retrieval grounds the context; the LLM may still hallucinate details.

### Vision Claim
**Proven (if AVAILABLE):** Qwen2.5-VL-3B can perform instrumentation symbol recognition on 800×600 tiles.  
**Not proven:** Complex overlapping topology, full legend interpretation, cross-reference resolution.

---

## Path to Production

| Gap | Production Solution |
|---|---|
| 4 GB VRAM → limited model size | Upgrade to 24 GB workstation; 7B reasoning + 7B VL models |
| DEGRADED_SANDBOX | Docker with seccomp + resource limits |
| psutil-only monitoring | NPCAP packet capture + firewall policy logs |
| 17-vector corpus | Full OISD/ASME/MRPL document set via batch /ingest |
| No auth/RBAC | Active Directory integration + JWT gating |
| Single PSU | N+1 redundancy for production refinery use |
