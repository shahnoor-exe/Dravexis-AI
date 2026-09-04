// components/TopBar.tsx — Project header: session ID, refinery context, operator role, status
import React, { useState } from "react";
import { useSettingsStore } from "../store/settingsStore";
import { CapabilityBadge } from "./CapabilityBadge";
import { REFINERY_CONTEXTS, OPERATOR_ROLES } from "../lib/constants";
import { Button } from "./ui/Button";
import { HistoryWorkspace } from "./HistoryWorkspace";
import { ApiInspectorModal } from "./ApiInspectorModal";
import { DemoMode } from "./DemoMode";
import { ThemeToggle } from "./ThemeToggle";

interface TopBarProps {
  onToggleHistory?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleHistory }) => {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [apiInspectorOpen, setApiInspectorOpen] = useState(false);
  const [demoModeOpen, setDemoModeOpen] = useState(false);
  const {
    refineryContext, setRefineryContext,
    operatorRole, setOperatorRole,
    connectionStatus,
  } = useSettingsStore();

  return (
    <>
    <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-cyber-obsidian border-b border-slate-200 dark:border-zinc-800/80 shadow-[0_4px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.5)] select-none relative overflow-hidden z-10 transition-colors duration-400">
      {/* Scanline overlay for header */}
      <div className="absolute inset-0 scanlines opacity-10 dark:opacity-40 mix-blend-overlay"></div>
      
      {/* Left: Branding */}
      <div className="flex items-center gap-4 relative z-10">
        <div className="w-10 h-10 rounded bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-neon-cyan/50 flex items-center justify-center dark:glow-cyan shadow-sm dark:shadow-none">
          <svg className="w-6 h-6 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <div>
          <div className="text-slate-900 dark:text-zinc-100 font-bold text-base tracking-wide uppercase flex items-center gap-2">
            Dravexis <span className="text-neon-cyan font-light">AI</span>
          </div>
          <div className="text-neon-amber text-[10px] font-mono tracking-widest mt-0.5 opacity-80">
            PS 26117 · AIR-GAPPED CONTROL LAYER
          </div>
        </div>
      </div>

      {/* Center: Context selectors */}
      <div className="flex items-center gap-6 relative z-10 bg-slate-100 dark:bg-zinc-950/50 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 transition-colors duration-400">
        <div className="flex items-center gap-3">
          <span className="text-slate-500 dark:text-zinc-500 text-[10px] font-mono uppercase tracking-widest">Unit</span>
          <div className="flex gap-1">
            {REFINERY_CONTEXTS.map((c) => (
              <button
                key={c}
                onClick={() => setRefineryContext(c as typeof refineryContext)}
                className={`px-3 py-1 text-xs font-mono rounded transition-all duration-300 ${
                  refineryContext === c 
                    ? "bg-blue-50 dark:bg-neon-cyan/20 text-neon-cyan border border-blue-200 dark:border-neon-cyan/50 dark:glow-cyan shadow-sm dark:shadow-none" 
                    : "bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-500 border border-slate-200 dark:border-zinc-800 hover:text-slate-700 dark:hover:text-zinc-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="w-px h-6 bg-slate-300 dark:bg-zinc-800"></div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 dark:text-zinc-500 text-[10px] font-mono uppercase tracking-widest">Role</span>
          <select
            className="bg-transparent text-slate-700 dark:text-zinc-300 text-xs font-mono focus:outline-none cursor-pointer appearance-none pr-4"
            value={operatorRole}
            onChange={(e) => setOperatorRole(e.target.value as typeof operatorRole)}
          >
            {OPERATOR_ROLES.map((r) => <option key={r} value={r} className="bg-white dark:bg-zinc-900">{r}</option>)}
          </select>
        </div>
      </div>

      {/* Right: Connection status */}
      <div className="flex items-center gap-4 relative z-10">
        <div className="hidden 2xl:flex items-center gap-2 border border-blue-200 dark:border-neon-cyan/20 bg-blue-50 dark:bg-neon-cyan/5 px-2 py-1 rounded">
          <span className="text-neon-cyan text-[8px] font-mono font-bold tracking-widest uppercase">UI:5173</span>
          <span className="w-1 h-1 rounded-full bg-blue-300 dark:bg-neon-cyan/30"></span>
          <span className="text-slate-400 dark:text-zinc-400 text-[8px] font-mono tracking-widest uppercase">API:8080</span>
          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-zinc-700"></span>
          <span className="text-slate-500 dark:text-zinc-500 text-[8px] font-mono tracking-widest uppercase">{import.meta.env.MODE === 'development' ? 'DEV' : 'PROD'}</span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <ThemeToggle />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDemoModeOpen(true)}
            className="text-slate-500 dark:text-zinc-500 hover:text-neon-emerald hidden md:flex"
            tooltip="Open Demo Blueprint"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            DEMO
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setApiInspectorOpen(true)}
            className="text-slate-500 dark:text-zinc-500 hover:text-neon-cyan hidden md:flex"
            tooltip="Inspect API Payloads"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            DEV_INSPECT
          </Button>
          
          <div className="flex flex-col items-end border-l border-slate-200 dark:border-zinc-800/80 pl-4 ml-2">
            <div className="text-slate-500 dark:text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-1">Telemetry Loopback</div>
            <div className="text-slate-700 dark:text-zinc-300 text-xs font-mono">127.0.0.1:8080</div>
          </div>
          <CapabilityBadge label="API" status={connectionStatus} compact />
          
          <div className="pl-4 ml-2 border-l border-slate-200 dark:border-zinc-800">
            <Button variant="ghost" size="icon" onClick={() => setHistoryOpen(true)} className="text-slate-500 dark:text-zinc-300" tooltip="Toggle History Workspace">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </Button>
          </div>
        </div>
      </div>
    </header>

    <HistoryWorkspace isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
    <ApiInspectorModal isOpen={apiInspectorOpen} onClose={() => setApiInspectorOpen(false)} />
    {demoModeOpen && <DemoMode onClose={() => setDemoModeOpen(false)} />}
    </>
  );
};
