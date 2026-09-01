// components/RightRail.tsx — Audit trace, artifact shelf, network monitor, warnings
import React, { useState, useEffect } from "react";
import { useAgentStore } from "../store/agentStore";
import { api } from "../lib/api";
import { CapabilityBadge } from "./CapabilityBadge";

// ─── Audit Trace ────────────────────────────────────────────────────────────
function AuditTrace() {
  const { events } = useAgentStore();
  return (
    <div>
      <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">Audit Trace</h3>
      {events.length === 0 ? (
        <div className="text-zinc-700 text-xs">No events yet.</div>
      ) : (
        <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1">
          {events.map((ev, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 text-[10px] font-mono ${
                ev.event === "enter" ? "text-blue-400" :
                ev.status === "error" ? "text-red-400" :
                ev.status === "VISION_UNAVAILABLE" ? "text-red-400" :
                "text-zinc-400"
              }`}
            >
              <span className="text-zinc-700 shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <span className="shrink-0">{ev.event === "enter" ? "▶" : ev.event === "exit" ? "■" : "·"}</span>
              <span>{String(ev.node)}</span>
              {ev.status !== undefined && <span className="text-zinc-600">· {String(ev.status as string)}</span>}
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

  const generate = async (type: "docx" | "xlsx" | "pptx") => {
    if (!lastResponse) return;
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
    } catch (e) {
      setResults((prev) => ({ ...prev, [type]: { status: "error", error: String(e) } }));
    } finally {
      setGenerating(null);
    }
  };

  const types: { id: "docx" | "xlsx" | "pptx"; label: string; icon: string }[] = [
    { id: "docx", label: "Approval Note", icon: "📄" },
    { id: "xlsx", label: "Analysis Sheet", icon: "📊" },
    { id: "pptx", label: "Briefing", icon: "📋" },
  ];

  return (
    <div>
      <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">Artifact Shelf</h3>
      {!lastResponse ? (
        <div className="text-zinc-700 text-xs">Run an agent query first.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {types.map(({ id, label, icon }) => {
            const r = results[id];
            return (
              <div key={id} className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-300">{icon} {label}</span>
                  <button
                    onClick={() => generate(id)}
                    disabled={!!generating}
                    className="text-[10px] px-2 py-0.5 bg-blue-800/60 hover:bg-blue-700/60 disabled:bg-zinc-700 text-blue-300 disabled:text-zinc-600 rounded transition-colors"
                  >
                    {generating === id ? "…" : "Generate"}
                  </button>
                </div>
                {r && (
                  r.status === "ok"
                    ? (
                      <a
                        href={`http://127.0.0.1:8000/artifacts/download/${encodeURIComponent(r.file_name ?? "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-emerald-400 hover:underline break-all"
                      >
                        ✓ {r.file_name}
                      </a>
                    )
                    : <div className="text-[10px] text-red-400">✗ {r.error}</div>
                )}
              </div>
            );
          })}
          <div className="text-[9px] text-zinc-600 italic mt-1">
            Prototype output — not an engineering approval.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Network Monitor ─────────────────────────────────────────────────────────
function NetworkMonitorCard() {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const r = await api.networkSummary();
        setSummary(r as unknown as Record<string, unknown>);
      } catch { setSummary(null); }
    };
    fetch();
    const t = setInterval(fetch, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">Network Monitor</h3>
      {!summary ? (
        <div className="text-zinc-700 text-xs">Polling…</div>
      ) : (
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3 text-[10px] font-mono flex flex-col gap-1.5">
          <CapabilityBadge label="Capture" status={String(summary.packet_capture ?? "UNKNOWN")} compact />
          <CapabilityBadge label="Monitor" status={String(summary.monitor_capability ?? "UNKNOWN")} compact />
          <div className="text-zinc-500 mt-1">Egress:</div>
                  <div className="text-zinc-300 text-[10px] leading-tight break-words">{String(summary.egress_note ?? "UNKNOWN")}</div>
          {(summary.service_health as Record<string, string> | undefined) && (
            <div className="mt-1 flex flex-col gap-0.5">
              {Object.entries(summary.service_health as Record<string,string>).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-zinc-600 w-20 shrink-0">{k}</span>
                  <span className={v === "ok" ? "text-emerald-400" : "text-red-400"}>{v}</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-zinc-700 mt-1">
            psutil only · No packet capture · Admin required for firewall
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Right Rail ──────────────────────────────────────────────────────────────
export const RightRail: React.FC = () => {
  const { visionStatus, sandboxMode, error } = useAgentStore();

  return (
    <aside className="flex flex-col gap-5 w-64 min-w-[14rem] p-4 bg-zinc-900 border-l border-zinc-800 overflow-y-auto">
      {/* Capability warnings */}
      {(visionStatus === "VISION_UNAVAILABLE" || sandboxMode === "DEGRADED_SANDBOX" || error) && (
        <div className="bg-orange-950/30 border border-orange-900/40 rounded-lg p-3">
          <h3 className="text-orange-400 text-xs font-semibold mb-2">⚠ Capability Warnings</h3>
          <div className="flex flex-col gap-1.5">
            {visionStatus === "VISION_UNAVAILABLE" && (
              <div className="text-[10px] text-red-300">
                <strong>Vision:</strong> VISION_UNAVAILABLE<br />
                VL model not loaded. No image analysis.
              </div>
            )}
            {sandboxMode === "DEGRADED_SANDBOX" && (
              <div className="text-[10px] text-orange-300">
                <strong>Sandbox:</strong> DEGRADED_SANDBOX<br />
                Not Docker isolation. AST allowlist only.
              </div>
            )}
            {error && (
              <div className="text-[10px] text-red-300">
                <strong>Error:</strong> {error.slice(0, 100)}
              </div>
            )}
          </div>
        </div>
      )}

      <AuditTrace />
      <div className="border-t border-zinc-800 pt-4"><ArtifactShelf /></div>
      <div className="border-t border-zinc-800 pt-4"><NetworkMonitorCard /></div>
    </aside>
  );
};
