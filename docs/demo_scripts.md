# Demo Scripts — MRPL Agentic AI Workbench (Phase 4)
## SIH 2026 / PS 26117 — Final 3 Scenarios

> **LATENCY NOTES:** All `[T+Xs]` markers are placeholders. Fill in real values from `data/preflight_results.json` after running `.\scripts\run_preflight.ps1`.
> Vision timings are conditional on preflight vision status.

---

## Pre-Demo Checklist (Run Before Any Audience Arrives)

```powershell
# On demo machine — terminal 1
.\scripts\start_all.ps1                     # starts llama-server + FastAPI (wait for READY)

# In browser / Tauri window
cd ui\mrpl-workbench && npm run tauri dev   # wait for desktop window
```

Verify in UI:
- [ ] Top bar: Backend = **CONNECTED** (green badge)
- [ ] Left rail: Sandbox = **DEGRADED_SANDBOX** (orange — expected)
- [ ] Left rail: Vision = **VISION_AVAILABLE** (Qwen2.5-VL-3B + mmproj-Q8_0; CPU-based)
- [ ] Network monitor card: psutil_only or upgraded

Load reasoning model first (Demo 1 uses RAG + CodeGen):
```powershell
# If llama-swap is in use:
Invoke-RestMethod -Uri "http://127.0.0.1:8080/models" -Method POST `
  -Body '{"model": "DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf"}'
```

---

## DEMO 1 — Inspection Report → PSU Approval Note

**Scenario:** A field inspector has completed an ultrasonic thickness survey on CDU-V-101 (H2S wet service). The agent reads the report, retrieves OISD 116 inspection intervals and ASME B31.3 wall thickness formula, calculates remaining life, and compiles a formal approval note DOCX.

**Claim boundary:** The system retrieves statutory clause text from its local vector store. The calculation (remaining life formula) executes in DEGRADED_SANDBOX (AST allowlist, not Docker). The output DOCX is a grounded prototype document — it is NOT a statutory engineering approval and includes that disclaimer.

### Step-by-Step Script

| # | Action | Click/Type | Wait | Narration |
|---|---|---|---|---|
| 1 | Open query composer | Click text area | — | "We have a fresh inspection reading from CDU-V-101 — an H2S wet-service pressure vessel." |
| 2 | Type query | `What is the OISD 116 remaining life for a pressure vessel with 8.2 mm measured wall, 6.0 mm minimum, and 0.30 mm/yr corrosion rate?` | — | "I'm asking the agent to pull the right statutory clause and compute remaining life." |
| 3 | Submit | Ctrl+Enter | — | "Agent starts: Plan → Retrieve → CodeGen → Sandbox." |
| 4 | DAG animates | Watch left rail | `[T+Xs] reasoning` | "You can see the graph trace in real time — each node lights up as it completes." |
| 5 | Evidence tab | Click "Evidence" | — | "OISD 116 and our ASME B31.3 corpus are the grounding sources — score 0.79, 0.71." |
| 6 | Answer tab | Click "Answer" | — | "Remaining life: 7.33 years. Next inspection window: 3.67 years — within the OISD Class A 5-year mandate." |
| 7 | Generate DOCX | Right rail → "Approval Note" → Generate | `[T+2s]` | "Now the agent compiles a formal approval note with provenance, signatures section, and a statutory disclaimer." |
| 8 | Download DOCX | Click download link | — | "This DOCX is ready to share — provenance trail embedded. Disclaimer on page 2: not an engineering approval." |

**Sandbox narration (mandatory if DEGRADED_SANDBOX):**
> "The calculation ran inside our in-process sandboxed executor — Python AST checked against an allowlist. In a production deployment this would be a Docker-isolated container; on this 4 GB dev hardware the label honestly reads DEGRADED_SANDBOX."

**Fallback if agent times out (>60s latency):**
> "We're pre-loading the reasoning model — this is a cold-start on a 4 GB GPU. In production, the model stays warm between queries. Let me show you the expected output from our earlier test run while it completes." *(Show screenshot from preflight run)*

---

## DEMO 2 — P&ID Visual Analysis → Checklist & Calculation Sheet

**Scenario:** Upload a synthetic P&ID image. Agent attempts visual analysis. Outcome depends on preflight.

### Branch A — Vision AVAILABLE (fill if preflight confirmed)

| # | Action | Wait | Narration |
|---|---|---|---|
| 1 | Upload P&ID image | Drag to composer | — | "P&ID for the CDU overhead reflux loop — let's ask the agent to flag any instrumentation gaps." |
| 2 | Type query | `Analyse this P&ID and list any missing safety instrumentation per OISD 118` | — | — |
| 3 | Submit | `[T+Xs vision]` | "Vision node activates — VL-3B model tiles the image and runs inference." |
| 4 | Answer | — | "Agent identified 2 PSV locations, flagged missing low-flow alarm on reflux line." |
| 5 | Generate XLSX | Right rail → Analysis Sheet → Generate | `[T+2s]` | "Calculation sheet with live formulas — flagged items, OISD reference, remediation column." |
| 6 | Download | — | "Team gets an actionable checklist grounded in statutory clauses." |

**Claim boundary for Vision:** VL-3B at 3B parameters on 4 GB VRAM is accurate for instrumentation symbol recognition at 800×600 tile resolution. Complex overlapping symbol detection may miss items. Output is a grounded first-pass review aid, not a certified P&ID audit.

### Branch B — Vision UNAVAILABLE (use if preflight shows VISION_UNAVAILABLE)

| # | Action | Narration |
|---|---|---|
| 1 | Show left rail | "The UI correctly shows VISION_UNAVAILABLE — we're running on 4 GB VRAM dev hardware. The vision model needs ~3 GB; today the reasoning model is loaded." |
| 2 | Explain honestly | "On production hardware with 8–24 GB VRAM, all three models load sequentially. On this machine we demonstrate the text path — which is the majority of real refinery Q&A workflows anyway." |
| 3 | Type text query | `List all safety instrumentation requirements for CDU overhead reflux per OISD 118` | — |
| 4 | Submit and show Evidence | Grounded OISD 118 chunks retrieved (fire/gas detector spacing, alarm setpoints) |
| 5 | Generate XLSX | Checklist generated from retrieved clauses — same format, no fake detection overlay |

**Critical rule:** Do NOT show a simulated detection overlay or fake AVAILABLE badge. The capability label is honest.

---

## DEMO 3 — Live Air-Gap Verification

**Scenario:** Prove the system is truly air-gapped. Disconnect WAN. Run a full agent query. Monitor shows no external connections.

**Claim boundary (MANDATORY NARRATION):** "Our network monitor uses `psutil` — Windows process-level socket enumeration. This gives us socket and byte-count visibility. Packet-level capture would require NPCAP admin privileges which we [have/haven't] installed. What we can prove is: no new sockets to external IPs were opened during this query, and total bytes transmitted to non-loopback addresses [were/were not] zero. This is honest process-level air-gap evidence — not a firewall policy statement."

### Step-by-Step Script

| # | Action | Wait | Narration |
|---|---|---|---|
| 1 | Show network monitor (pre-disconnect) | Right rail — network card | — | "Here's the baseline: psutil_only monitor, egress UNKNOWN on first sample — we're honest about that." |
| 2 | Open Windows Settings → WiFi/Ethernet | Physically or `Disable-NetAdapter` | — | "Disconnecting the WAN interface now — no internet, no VPN." |
| 3 | Confirm OS shows disconnected | taskbar icon | — | "OS confirms no network." |
| 4 | Confirm UI still works | Backend badge still CONNECTED (loopback) | — | "Backend stays green — it's on 127.0.0.1. The system is fully self-contained." |
| 5 | Submit query | `Calculate remaining corrosion life for a vessel at 0.45 mm/yr with 8.0 mm measured wall` | — | "Full agent run: Plan → Retrieve → CodeGen → Sandbox." |
| 6 | Observe DAG | Watch trace complete | `[T+Xs]` | "All computation is local — Qdrant, FastEmbed, llama-server. Nothing left the machine." |
| 7 | Network monitor | Right rail refresh | — | "Socket count: only loopback connections. External socket count: zero. [If NPCAP: packet capture confirms zero external packets / If psutil-only: process-level sockets show no external connections — packet-level evidence requires NPCAP.]" |
| 8 | Generate DOCX while disconnected | — | "Even artifact generation is local — python-docx runs in-process. No cloud call." |
| 9 | Reconnect WAN | `Enable-NetAdapter` / reconnect | — | "Reconnecting — backend continues without restart. Clean resumption." |

**Fallback if any component reaches out (critical bug, not cosmetic):**
Stop the demo. Do not narrate around it. Fix before demo day.

---

## Timing Budget (fill after preflight)

| Stage | Measured Latency | Padded Narration Buffer |
|---|---|---|
| Reasoning model cold load | ~2.8s (measured 2026-09-02) | +30s narration |
| RAG query (reasoning, warm) | ~10.0s end-to-end (preflight /agent/run) | +10s narration |
| CodeGen + Sandbox | ~2.7s cold-start (coder model) | +15s narration |
| Vision model swap | ~7–14s cold-start (7.1s probe / 13.7s full swap) | +45s narration |
| DOCX compile | ~2s | — |
| XLSX compile | ~2s | — |
| Full Demo 1 | est. ~2–3 min (query ~10s + DOCX ~2s + narration) | 6 min target |
| Full Demo 2 (Branch A) | est. ~3–4 min (vision swap ~14s + inference ~5s + XLSX) | 5 min target |
| Full Demo 2 (Branch B) | est. ~2 min (text RAG ~10s + XLSX) | 4 min target |
| Full Demo 3 | est. ~2–3 min (air-gap + query ~10s + DOCX) | 5 min target |
| **Total run-through** | est. **12–15 min** (CPU-based; all models sequential) | **15–18 min target** |

> **CPU note:** All cold-start timings measured CPU_FALLBACK_OR_NO_GPU_OFFLOAD on RTX 3050 Laptop (4 GB VRAM). GPU offload not confirmed; timings reflect CPU inference. Hot-switch latency: reasoning→coder measured 2026-09-02 (see data/model_swap_latency.json).

---

## Jury Q&A Fallback Lines

| Question | Honest Answer |
|---|---|
| "Why DEGRADED_SANDBOX?" | "Docker requires kernel-level isolation, which isn't installed on this dev hardware. The label is intentional — in production, the sandbox would be a Docker container with resource limits and seccomp policy." |
| "Can the vision model do full P&ID analysis?" | "At 3B parameters with 800×600 tiles, it handles instrumentation symbol recognition. Complex overlapping topology needs a larger model or specialised CV pipeline — we've scoped this accurately." |
| "How do you prove air-gap?" | "psutil gives process-level socket evidence. NPCAP adds packet-level capture. We show what we've actually measured, not what we wish we could claim." |
| "Why only 25 vectors?" | "This is a demo corpus — 5 technical documents covering OISD 116/118, ASME B31.3, and MRPL SOPs. Production would ingest the full document set before deployment." |
| "Is this production-ready?" | "This is a working prototype demonstrating sovereign on-premise AI architecture on a constrained 4 GB GPU. The architecture scales to production VRAM — model quality upgrades to 7B/13B, corpus grows via /ingest, sandbox upgrades to Docker. The limitations are labelled, not hidden." |
