// components/TopBar.tsx — Project header: session ID, refinery context, operator role, status
import React from "react";
import { useSettingsStore } from "../store/settingsStore";
import { CapabilityBadge } from "./CapabilityBadge";
import { REFINERY_CONTEXTS, OPERATOR_ROLES } from "../lib/constants";

export const TopBar: React.FC = () => {
  const {
    refineryContext, setRefineryContext,
    operatorRole, setOperatorRole,
    connectionStatus,
  } = useSettingsStore();

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800 select-none">
      {/* Left: Branding */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">M</div>
        <div>
          <div className="text-white font-semibold text-sm leading-tight">MRPL Sovereign AI Workbench</div>
          <div className="text-zinc-500 text-[10px] font-mono">PS 26117 / SIH 2026 · Air-Gapped · DEMO</div>
        </div>
      </div>

      {/* Center: Context selectors */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs">Unit:</span>
          <select
            className="bg-zinc-800 text-zinc-200 text-xs px-2 py-1 rounded border border-zinc-700 focus:outline-none focus:border-blue-500"
            value={refineryContext}
            onChange={(e) => setRefineryContext(e.target.value as typeof refineryContext)}
          >
            {REFINERY_CONTEXTS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs">Role:</span>
          <select
            className="bg-zinc-800 text-zinc-200 text-xs px-2 py-1 rounded border border-zinc-700 focus:outline-none focus:border-blue-500"
            value={operatorRole}
            onChange={(e) => setOperatorRole(e.target.value as typeof operatorRole)}
          >
            {OPERATOR_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* Right: Connection status */}
      <div className="flex items-center gap-3">
        <CapabilityBadge label="Backend" status={connectionStatus} compact />
        <div className="text-zinc-600 text-[10px] font-mono">127.0.0.1:8000</div>
      </div>
    </header>
  );
};
