// components/RightRail.tsx — Audit trace, artifact shelf, network monitor, warnings
import React, { useState, useEffect, useRef } from "react";
import { useAgentStore } from "../store/agentStore";
import { api } from "../lib/api";
import { CapabilityBadge } from "./CapabilityBadge";
import { PreviewPane } from "./PreviewPane";
import gsap from "gsap";
import { useHistoryStore } from "../store/historyStore";

// ─── Audit Trace ────────────────────────────────────────────────────────────
function AuditTrace() {
  const { events } = useAgentStore();
  const traceRef = useRef<HTMLDivElement>(null);

  // Collapse events by node
  const collapsedEvents = React.useMemo(() => {
    const nodes = new Map<string, { name: string; status: string; ts: number }>();
    events.forEach(ev => {
      const nodeName = String(ev.node);
      const existing = nodes.get(nodeName);
      let status = "running";
      if (ev.event === "exit") {
        if (ev.status === "error") status = "error";
        else if (ev.status === "VISION_UNAVAILABLE") status = "unavailable";
        else status = "ok";
      }
      if (!existing || ev.event === "exit") {
        nodes.set(nodeName, { name: nodeName, status, ts: ev.ts as number || Date.now() });
      }
    });
    return Array.from(nodes.values());
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
        <div ref={traceRef} className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-2 bg-slate-glass/50 p-3 rounded-sm border border-zinc-800/80 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
          {collapsedEvents.map((ev, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 text-[10px] font-mono leading-tight ${
                ev.status === "running" ? "text-neon-cyan font-bold tracking-wider" :
                ev.status === "error" ? "text-red-400" :
                ev.status === "unavailable" ? "text-neon-amber" :
                "text-zinc-400"
              }`}
            >
              <span className="text-zinc-600 shrink-0 font-bold">{String(i + 1).padStart(2, "0")}</span>
              <span className="shrink-0">{ev.status === "running" ? "▶" : "■"}</span>
              <span className="flex-1">{ev.name}</span>
              {ev.status !== "running" && <span className="opacity-70 text-[8px] uppercase">{ev.status}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Artifact Shelf ─────────────────────────────────────────────────────────
function ArtifactShelf({ onPreview }: { onPreview: (fileName: string) => void }) {
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
        label: lastResponse.status === "completed" ? "GROUNDED" : "INSUFFICIENT_EVIDENCE",
        vision_status: visionStatus,
        sandbox_mode: sandboxMode,
      });
      setResults((prev) => ({ ...prev, [type]: r }));
      
      if (r.status === "ok") {
        useHistoryStore.getState().saveArtifact({
          id: crypto.randomUUID(),
          sessionId: lastResponse.session_id,
          timestamp: Date.now(),
          type,
          fileName: r.file_name || `Generated_${type.toUpperCase()}`,
          sizeBytes: 0,
          status: r.status
        });
      }
      
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
                className="relative w-full bg-slate-glass/50 border border-zinc-700/80 rounded-sm p-3 text-left transition-all duration-300 hover:border-neon-cyan hover:shadow-[0_0_15px_rgba(32,227,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed group"
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
                    <div className="mt-2 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={`http://127.0.0.1:8000/artifacts/download/${encodeURIComponent(r.file_name ?? "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-neon-emerald hover:underline truncate font-mono inline-block flex-1"
                      >
                        ✓ {r.file_name}
                      </a>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => r.file_name && onPreview(r.file_name)}>
                        <svg className="w-3 h-3 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </Button>
                    </div>
                  ) : (
                    <div className="text-[10px] text-red-400 font-mono mt-1 break-all">✗ {r.error}</div>
                  )
                ) : (
                  <div className="text-[9px] text-zinc-600 font-mono mt-1">Click to Generate locally...</div>
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
import { useSettingsStore } from "../store/settingsStore";

function NetworkMonitorCard() {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const { capabilities } = useSettingsStore();
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
      
      <div className="bg-slate-glass/50 border border-neon-emerald/30 rounded-sm p-4 relative overflow-hidden group">
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
          <span className={`w-2 h-2 rounded-full ${capabilities?.network?.error_code === 'MONITOR_UNAVAILABLE' ? 'bg-amber-500' : 'bg-neon-emerald animate-pulse'}`}></span>
          {capabilities?.network?.error_code === "MONITOR_UNAVAILABLE" ? "EXTERNAL EGRESS: UNKNOWN" : "0 Bps EXTERNAL EGRESS"}
        </div>
        
        <div className={`text-[9px] font-mono border px-2 py-1 rounded inline-block ${capabilities?.network?.error_code === 'MONITOR_UNAVAILABLE' ? 'text-amber-500/70 border-amber-500/20 bg-amber-500/10' : 'text-neon-emerald/70 border-neon-emerald/20 bg-neon-emerald/10'}`}>
          {capabilities?.network?.error_code === "MONITOR_UNAVAILABLE" ? "PACKET CAPTURE UNAVAILABLE" : "AIR-GAPPABLE DESIGN — LOOPBACK ONLY"}
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
import { Button } from "./ui/Button";

export const RightRail: React.FC<{ width?: number }> = ({ width }) => {
  const { lastResponse, runStatus, visionStatus, sandboxMode, error } = useAgentStore();
  const isRunning = ["validating", "routing", "retrieving", "loading_model", "generating", "awaiting_approval"].includes(runStatus);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [showFullError, setShowFullError] = useState(false);

  return (
    <aside 
      style={{ width: width ? `${width}px` : undefined }}
      className="right-rail flex flex-col gap-4 w-80 min-w-[20rem] max-w-[50vw] p-4 bg-cyber-obsidian border-l border-zinc-800/80 overflow-y-auto relative z-0 shadow-[-4px_0_24px_rgba(0,0,0,0.3)] shrink-0 transition-[width] duration-75"
    >
      <div className="absolute inset-0 scanlines opacity-15 mix-blend-overlay pointer-events-none"></div>
      
      {/* Capability warnings */}
      {(visionStatus === "VISION_UNAVAILABLE" || sandboxMode === "DEGRADED_SANDBOX" || error) && (
        <div className="bg-slate-glass/50 border border-neon-amber/30 rounded-sm p-4 relative z-10">
          <h3 className="text-neon-amber text-[10px] font-mono font-bold tracking-widest uppercase mb-3 flex items-center gap-2">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            System Warnings
          </h3>
          <div className="flex flex-col gap-2 font-mono text-[10px]">
            {visionStatus === "VISION_UNAVAILABLE" && (
              <div className="text-amber-200/80 border-l-2 border-neon-amber/50 pl-2 break-words">
                <span className="text-neon-amber font-bold">VISION:</span> UNAVAILABLE<br/>
                VL model not loaded.
              </div>
            )}
            {sandboxMode === "DEGRADED_SANDBOX" && (
              <div className="text-orange-300 border-l-2 border-orange-500/50 pl-2 break-words">
                <span className="text-orange-400 font-bold">SANDBOX:</span> DEGRADED<br/>
                AST allowlist only.
              </div>
            )}
            {error && (
              <div className="text-red-300 border-l-2 border-red-500/50 pl-2" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-red-400 font-bold">ERROR:</span>
                  <button onClick={() => setShowFullError(true)} className="text-[8px] uppercase tracking-widest text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-1 py-0.5 rounded">View Log</button>
                </div>
                <div className="line-clamp-3">
                  {typeof error === "object" && error !== null ? (error as any).message : String(error)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showFullError && error && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-cyber-obsidian border border-red-500/50 rounded-sm p-6 max-w-3xl w-full max-h-[80vh] flex flex-col shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-3">
              <h3 className="text-red-400 font-mono text-sm tracking-widest uppercase flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                System Error Log {typeof error === "object" && error !== null ? `[${(error as any).code}]` : ""}
              </h3>
              <button onClick={() => setShowFullError(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto bg-black/60 border border-zinc-800 p-4 font-mono text-xs text-red-200/80 rounded whitespace-pre-wrap" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
              {typeof error === "object" && error !== null ? JSON.stringify(error, null, 2).replace(/"(path|filepath|cwd|C:\\.*?)"/g, '"[REDACTED]"') : String(error).replace(/C:\\[^'"\s]+/g, "[REDACTED]")}
            </div>
          </div>
        </div>
      )}

      <AuditTrace />
      <div className="border-t border-zinc-800/80 pt-5"><ArtifactShelf onPreview={setPreviewFile} /></div>
      <div className="border-t border-zinc-800/80 pt-5 flex-1"><NetworkMonitorCard /></div>

      <PreviewPane fileName={previewFile} onClose={() => setPreviewFile(null)} />
    </aside>
  );
};
