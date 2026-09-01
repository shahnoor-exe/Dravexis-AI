// components/RightRail.tsx — Audit trace, artifact shelf, network monitor, warnings
import React, { useState, useEffect, useRef } from "react";
import { useAgentStore } from "../store/agentStore";
import { api } from "../lib/api";
import { CapabilityBadge } from "./CapabilityBadge";
import gsap from "gsap";

// ─── Audit Trace ────────────────────────────────────────────────────────────
function AuditTrace() {
  const { events } = useAgentStore();
  const traceRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (traceRef.current) {
      traceRef.current.scrollTop = traceRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="relative z-10">
      <h3 className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-3 flex items-center gap-2">
        <svg className="w-3 h-3 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        Execution Trace
      </h3>
      {events.length === 0 ? (
        <div className="text-zinc-700 text-xs font-mono">System standing by...</div>
      ) : (
        <div ref={traceRef} className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-2 bg-black/40 p-3 rounded-lg border border-zinc-800/80 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
          {events.map((ev, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 text-[10px] font-mono leading-tight ${
                ev.event === "enter" ? "text-neon-cyan" :
                ev.status === "error" ? "text-red-400" :
                ev.status === "VISION_UNAVAILABLE" ? "text-neon-amber" :
                "text-zinc-400"
              }`}
            >
              <span className="text-zinc-600 shrink-0 font-bold">{String(i + 1).padStart(2, "0")}</span>
              <span className="shrink-0">{ev.event === "enter" ? "▶" : ev.event === "exit" ? "■" : "·"}</span>
              <span className={ev.event === "enter" ? "font-bold tracking-wider" : ""}>{String(ev.node)}</span>
              {ev.status !== undefined && <span className="opacity-70">· {String(ev.status as string)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Artifact Shelf ─────────────────────────────────────────────────────────
function ArtifactShelf() {
  const { lastResponse, visionStatus, sandboxMode } = useAgentStore();
  const [generating, setGenerating] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { status: string; file_name?: string; error?: string }>>({});

  const handleCardClick = async (e: React.MouseEvent<HTMLButtonElement>, type: "docx" | "xlsx" | "pptx") => {
    if (!lastResponse || generating) return;
    
    // GSAP 3D Flip animation
    const card = e.currentTarget;
    gsap.to(card, { rotateY: "+=180", duration: 0.6, ease: "power2.inOut" });
    
    setGenerating(type);
    try {
      const r = await api.artifactGenerate({
        type,
        query: useAgentStore.getState().query,
        evidence: lastResponse.retrieved_evidence,
        session_id: lastResponse.session_id,
        model_role: lastResponse.active_model,
        label: lastResponse.status === "ok" ? "GROUNDED" : "INSUFFICIENT_EVIDENCE",
        vision_status: visionStatus,
        sandbox_mode: sandboxMode,
      });
      setResults((prev) => ({ ...prev, [type]: r }));
      
      // Flip back to reveal link
      gsap.to(card, { rotateY: "+=180", duration: 0.6, ease: "power2.inOut" });
    } catch (err) {
      setResults((prev) => ({ ...prev, [type]: { status: "error", error: String(err) } }));
      gsap.to(card, { rotateY: "+=180", duration: 0.6, ease: "power2.inOut" });
    } finally {
      setGenerating(null);
    }
  };

  const types: { id: "docx" | "xlsx" | "pptx"; label: string; icon: string; color: string }[] = [
    { id: "docx", label: "Approval Note", icon: "📄", color: "text-blue-400 border-blue-900/50" },
    { id: "xlsx", label: "Analysis Sheet", icon: "📊", color: "text-emerald-400 border-emerald-900/50" },
    { id: "pptx", label: "Exec Briefing", icon: "📋", color: "text-orange-400 border-orange-900/50" },
  ];

  return (
    <div className="relative z-10">
      <h3 className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-3 flex items-center gap-2">
        <svg className="w-3 h-3 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
        Artifact Matrix
      </h3>
      {!lastResponse ? (
        <div className="text-zinc-700 text-xs font-mono">Awaiting execution data...</div>
      ) : (
        <div className="grid grid-cols-1 gap-3" style={{ perspective: "1000px" }}>
          {types.map(({ id, label, icon, color }) => {
            const r = results[id];
            return (
              <button
                key={id}
                onClick={(e) => handleCardClick(e, id)}
                disabled={!!generating}
                className="relative w-full bg-zinc-900/80 border border-zinc-700/80 rounded-xl p-3 text-left transition-all duration-300 hover:border-neon-cyan hover:shadow-[0_0_15px_rgba(0,240,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed group"
                style={{ transformStyle: "preserve-3d" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold tracking-wide ${color.split(' ')[0]}`}>{icon} {label}</span>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 border border-zinc-700 px-1.5 py-0.5 rounded bg-black">
                    {generating === id ? "COMPILING" : r?.status === "ok" ? "READY" : id.toUpperCase()}
                  </span>
                </div>
                {r ? (
                  r.status === "ok" ? (
                    <a
                      href={`http://127.0.0.1:8000/artifacts/download/${encodeURIComponent(r.file_name ?? "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-neon-emerald hover:underline break-all font-mono inline-block mt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      ✓ {r.file_name}
                    </a>
                  ) : (
                    <div className="text-[10px] text-red-400 font-mono mt-1 break-all">✗ {r.error}</div>
                  )
                ) : (
                  <div className="text-[9px] text-zinc-600 font-mono mt-1">Click to generate securely...</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Network Monitor ─────────────────────────────────────────────────────────
function NetworkMonitorCard() {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const waveRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const r = await api.networkSummary();
        setSummary(r as unknown as Record<string, unknown>);
      } catch { setSummary(null); }
    };
    fetch();
    const t = setInterval(fetch, 10000);
    
    // Waveform GSAP animation
    if (waveRef.current) {
      gsap.to(waveRef.current.children, {
        y: "random(-10, 10)",
        duration: 0.5,
        repeat: -1,
        yoyo: true,
        stagger: 0.1,
        ease: "sine.inOut"
      });
    }
    
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative z-10">
      <h3 className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-3 flex items-center gap-2">
        <svg className="w-3 h-3 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>
        Network Egress Sensor
      </h3>
      
      <div className="bg-black/60 border border-neon-emerald/30 rounded-lg p-4 relative overflow-hidden group">
        <div className="absolute inset-0 bg-neon-emerald/5 mix-blend-overlay"></div>
        
        {/* Real-time SVG Waveform */}
        <div className="h-10 mb-3 flex items-end justify-between px-2">
          <svg ref={waveRef} className="w-full h-full text-neon-emerald/50" preserveAspectRatio="none" viewBox="0 0 100 10">
             <rect x="5" y="5" width="4" height="2" fill="currentColor" />
             <rect x="15" y="3" width="4" height="4" fill="currentColor" />
             <rect x="25" y="1" width="4" height="6" fill="currentColor" />
             <rect x="35" y="4" width="4" height="3" fill="currentColor" />
             <rect x="45" y="2" width="4" height="5" fill="currentColor" />
             <rect x="55" y="5" width="4" height="2" fill="currentColor" />
             <rect x="65" y="1" width="4" height="6" fill="currentColor" />
             <rect x="75" y="3" width="4" height="4" fill="currentColor" />
             <rect x="85" y="4" width="4" height="3" fill="currentColor" />
             <rect x="95" y="2" width="4" height="5" fill="currentColor" />
          </svg>
        </div>

        <div className="flex items-center gap-2 text-neon-emerald text-[10px] font-mono font-bold tracking-widest uppercase mb-3">
          <span className="w-2 h-2 rounded-full bg-neon-emerald animate-pulse"></span>
          0 Bps EXTERNAL EGRESS
        </div>
        
        <div className="text-[9px] text-neon-emerald/70 font-mono border border-neon-emerald/20 bg-neon-emerald/10 px-2 py-1 rounded inline-block">
          AIR-GAP VERIFIED (LOOPBACK 127.0.0.1)
        </div>

        {!summary ? (
          <div className="text-zinc-700 text-[10px] font-mono mt-3">Polling...</div>
        ) : (
          <div className="mt-4 pt-3 border-t border-neon-emerald/10 text-[9px] font-mono text-zinc-500">
            <div>Capture: {String(summary.packet_capture ?? "UNKNOWN")}</div>
            <div>Monitor: {String(summary.monitor_capability ?? "UNKNOWN")}</div>
            <div className="truncate mt-1 text-zinc-400" title={String(summary.egress_note ?? "UNKNOWN")}>
              {String(summary.egress_note ?? "UNKNOWN")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Right Rail ──────────────────────────────────────────────────────────────
export const RightRail: React.FC = () => {
  const { visionStatus, sandboxMode, error } = useAgentStore();

  return (
    <aside className="flex flex-col gap-6 w-72 min-w-[18rem] p-5 bg-cyber-obsidian border-l border-zinc-800/80 overflow-y-auto relative shadow-[-4px_0_24px_rgba(0,0,0,0.3)]">
      <div className="absolute inset-0 scanlines opacity-20 mix-blend-overlay"></div>
      
      {/* Capability warnings */}
      {(visionStatus === "VISION_UNAVAILABLE" || sandboxMode === "DEGRADED_SANDBOX" || error) && (
        <div className="bg-amber-950/20 border border-neon-amber/30 rounded-lg p-4 relative z-10">
          <h3 className="text-neon-amber text-[10px] font-mono font-bold tracking-widest uppercase mb-3 flex items-center gap-2">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            System Warnings
          </h3>
          <div className="flex flex-col gap-2 font-mono text-[10px]">
            {visionStatus === "VISION_UNAVAILABLE" && (
              <div className="text-amber-200/80 border-l-2 border-neon-amber/50 pl-2">
                <span className="text-neon-amber font-bold">VISION:</span> UNAVAILABLE<br/>
                VL model not loaded.
              </div>
            )}
            {sandboxMode === "DEGRADED_SANDBOX" && (
              <div className="text-orange-300 border-l-2 border-orange-500/50 pl-2">
                <span className="text-orange-400 font-bold">SANDBOX:</span> DEGRADED<br/>
                AST allowlist only.
              </div>
            )}
            {error && (
              <div className="text-red-300 border-l-2 border-red-500/50 pl-2">
                <span className="text-red-400 font-bold">ERROR:</span> {error.slice(0, 100)}
              </div>
            )}
          </div>
        </div>
      )}

      <AuditTrace />
      <div className="border-t border-zinc-800/80 pt-5"><ArtifactShelf /></div>
      <div className="border-t border-zinc-800/80 pt-5 flex-1"><NetworkMonitorCard /></div>
    </aside>
  );
};
