// components/LeftRail.tsx — Model status cards + agent DAG legend
import React from "react";
import { useSettingsStore } from "../store/settingsStore";
import { CapabilityBadge } from "./CapabilityBadge";
import { AgentDag } from "./AgentDag";

function ModelCard({ role, status }: { role: string; status: string }) {
  return (
    <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3">
      <div className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1.5">{role} Model</div>
      <CapabilityBadge label={role} status={status} />
    </div>
  );
}

export const LeftRail: React.FC = () => {
  const { graphInfo } = useSettingsStore();

  const visionProbe = (graphInfo?.vision_probe as Record<string, string> | undefined) ?? {};
  const visionStatus = visionProbe.status ?? "VISION_UNAVAILABLE";
  const checkpointAvail = (graphInfo?.checkpoint as { available?: boolean } | undefined)?.available;

  return (
    <aside className="flex flex-col gap-4 w-64 min-w-[14rem] p-4 bg-zinc-900 border-r border-zinc-800 overflow-y-auto">
      <div>
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">Model Status</h2>
        <div className="flex flex-col gap-2">
          <ModelCard role="Reasoning" status="UNAVAILABLE" />
          <ModelCard role="Vision" status={visionStatus} />
          <ModelCard role="Code" status="UNAVAILABLE" />
        </div>
        <div className="mt-2 text-[10px] text-zinc-600 leading-relaxed">
          Models load only after <code className="text-zinc-500">download_model.ps1</code> + <code className="text-zinc-500">start_all.ps1</code>.
          Sequential load — never co-resident.
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">Sandbox</h2>
        <CapabilityBadge label="Sandbox" status="DEGRADED_SANDBOX" />
        <div className="mt-1 text-[10px] text-orange-400">
          Docker not installed. In-process exec with AST allowlist only. NOT Docker isolation.
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">Checkpoint</h2>
        <CapabilityBadge
          label="Checkpoint"
          status={checkpointAvail ? "AVAILABLE" : "UNAVAILABLE"}
        />
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">Agent Graph</h2>
        <AgentDag />
        <div className="mt-2 flex flex-col gap-1">
          {[
            { color: "bg-emerald-700", label: "Success" },
            { color: "bg-blue-800", label: "Active" },
            { color: "bg-red-900", label: "Unavailable / Error" },
            { color: "bg-zinc-700", label: "Skipped / Idle" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${color} border border-zinc-600`} />
              <span className="text-zinc-500 text-[10px]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
