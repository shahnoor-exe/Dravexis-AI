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
    <header className="flex items-center justify-between px-6 py-4 bg-cyber-obsidian border-b border-zinc-800/80 shadow-[0_4px_30px_rgba(0,0,0,0.5)] select-none relative overflow-hidden z-10">
      {/* Scanline overlay for header */}
      <div className="absolute inset-0 scanlines opacity-40 mix-blend-overlay"></div>
      
      {/* Left: Branding */}
      <div className="flex items-center gap-4 relative z-10">
        <div className="w-10 h-10 rounded bg-zinc-900 border border-neon-cyan/50 flex items-center justify-center glow-cyan">
          <svg className="w-6 h-6 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <div>
          <div className="text-zinc-100 font-bold text-base tracking-wide uppercase flex items-center gap-2">
            MRPL Sovereign <span className="text-neon-cyan font-light">Workbench</span>
          </div>
          <div className="text-neon-amber text-[10px] font-mono tracking-widest mt-0.5 opacity-80">
            PS 26117 · AIR-GAPPED CONTROL LAYER
          </div>
        </div>
      </div>

      {/* Center: Context selectors */}
      <div className="flex items-center gap-6 relative z-10 bg-zinc-950/50 backdrop-blur-md px-4 py-2 rounded-lg border border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">Unit</span>
          <div className="flex gap-1">
            {REFINERY_CONTEXTS.map((c) => (
              <button
                key={c}
                onClick={() => setRefineryContext(c as typeof refineryContext)}
                className={`px-3 py-1 text-xs font-mono rounded transition-all duration-300 ${
                  refineryContext === c 
                    ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 glow-cyan" 
                    : "bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="w-px h-6 bg-zinc-800"></div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">Role</span>
          <select
            className="bg-transparent text-zinc-300 text-xs font-mono focus:outline-none cursor-pointer appearance-none pr-4"
            value={operatorRole}
            onChange={(e) => setOperatorRole(e.target.value as typeof operatorRole)}
          >
            {OPERATOR_ROLES.map((r) => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
          </select>
        </div>
      </div>

      {/* Right: Connection status */}
      <div className="flex items-center gap-4 relative z-10">
        <div className="flex flex-col items-end">
          <div className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-1">Telemetry Loopback</div>
          <div className="text-zinc-300 text-xs font-mono">127.0.0.1:8000</div>
        </div>
        <CapabilityBadge label="API" status={connectionStatus} compact />
      </div>
    </header>
  );
};
