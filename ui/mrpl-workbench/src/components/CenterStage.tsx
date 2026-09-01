// components/CenterStage.tsx — Query composer, answer, tabs for outputs
import React, { useState } from "react";
import { useAgentStore } from "../store/agentStore";
import { useAgentRun } from "../hooks/useAgentRun";
import { EvidencePanel } from "./EvidencePanel";
import { CapabilityBadge } from "./CapabilityBadge";
import { useQuerySubmitAnimation, usePanelSwitchAnimation } from "../hooks/useGSAPAnimations";

type Tab = "chat" | "evidence" | "code" | "sandbox";

const DEMO_PROMPTS = [
  { icon: "⚡", label: "Demo 1: Boiler Corrosion Calculation & PSU Note", query: "What is the corrosion rate for Boiler B2 and draft a PSU maintenance note." },
  { icon: "👁️", label: "Demo 2: P&ID Relief Loop Instrumentation Vision Audit", query: "Audit the attached P&ID diagram for the relief loop." },
  { icon: "🛡️", label: "Demo 3: Air-Gap Offline Sovereign Execution Rehearsal", query: "Summarize the air-gap isolation protocols and verify local execution." },
];

export const CenterStage: React.FC = () => {
  const [tab, setTab] = useState<Tab>("chat");
  const {
    query, setQuery, runStatus, intent, confidence,
    finalAnswer, error, visionStatus, sandboxMode, codeStatus,
    latencyMs, events,
  } = useAgentStore();
  const { run, isRunning } = useAgentRun();

  // GSAP: pulse composer border on run, fade-in answer on complete
  useQuerySubmitAnimation(runStatus);
  // GSAP: parallax panel switch
  usePanelSwitchAnimation("chat", tab === "chat");
  usePanelSwitchAnimation("evidence", tab === "evidence");
  usePanelSwitchAnimation("code", tab === "code");
  usePanelSwitchAnimation("sandbox", tab === "sandbox");

  const activeNode = events.findLast?.((e) => e.event === "enter")?.node as string | undefined;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !isRunning) run();
  };

  const handleDemoClick = (demoQuery: string) => {
    setQuery(demoQuery);
    // Don't auto-run, let the user hit submit to see the text
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "chat", label: "EXECUTION CONSOLE" },
    { id: "evidence", label: `EVIDENCE BUFFER${useAgentStore.getState().evidence.length > 0 ? ` (${useAgentStore.getState().evidence.length})` : ""}` },
    { id: "code", label: "CODE OUTPUT" },
    { id: "sandbox", label: "SANDBOX STATE" },
  ];

  return (
    <main className="flex flex-col flex-1 min-w-0 bg-cyber-bg overflow-hidden relative">
      <div className="absolute inset-0 scanlines opacity-30 mix-blend-overlay pointer-events-none"></div>
      
      {/* Query Composer */}
      <div className="p-5 border-b border-zinc-800/80 relative z-10 bg-zinc-950/80 backdrop-blur-sm">
        
        {/* Pre-loaded Action Chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {DEMO_PROMPTS.map((demo, idx) => (
            <button
              key={idx}
              onClick={() => handleDemoClick(demo.query)}
              className="px-3 py-1.5 bg-zinc-900/80 border border-zinc-700/80 rounded-md text-[11px] font-mono text-zinc-400 hover:text-neon-cyan hover:border-neon-cyan/50 hover:bg-neon-cyan/10 transition-all duration-300 flex items-center gap-2"
              title={demo.query}
            >
              <span>{demo.icon}</span>
              {demo.label}
            </button>
          ))}
        </div>

        <div className="relative group">
          <textarea
            id="query-composer"
            data-anim="query-composer"
            className="w-full bg-zinc-900/50 border border-zinc-700/80 rounded-xl px-5 pt-4 pb-12 text-zinc-100 text-sm font-mono resize-none focus:outline-none focus:border-neon-cyan/80 focus:ring-1 focus:ring-neon-cyan/50 placeholder:text-zinc-600 transition-all duration-300 backdrop-blur-md"
            rows={3}
            placeholder="[TERMINAL_INPUT] > Enter query or select a demo above..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunning}
          />
          <div className="absolute right-4 bottom-4 flex items-center gap-3">
            {isRunning && (
              <span className="text-neon-magenta text-[10px] font-mono uppercase tracking-widest animate-pulse flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-neon-magenta rounded-full"></span>
                {activeNode ? `EXECUTING: ${activeNode}` : "PROCESSING..."}
              </span>
            )}
            <button
              id="btn-submit-query"
              onClick={run}
              disabled={isRunning || !query.trim()}
              className="px-6 py-2 bg-neon-cyan/20 border border-neon-cyan hover:bg-neon-cyan/30 disabled:bg-zinc-800/50 disabled:border-zinc-700 disabled:text-zinc-500 text-neon-cyan disabled:shadow-none glow-cyan text-xs font-bold tracking-widest uppercase rounded-lg transition-all duration-300"
            >
              {isRunning ? "RUNNING" : "INITIALIZE"}
            </button>
          </div>
          <div className="absolute left-4 bottom-4 text-[10px] text-zinc-500 font-mono">CTRL+ENTER to execute</div>
        </div>

        {/* Capability warnings always visible */}
        <div className="flex flex-wrap gap-3 mt-4 items-center">
          {visionStatus === "VISION_UNAVAILABLE" && (
            <CapabilityBadge label="Vision" status="VISION_UNAVAILABLE" compact />
          )}
          {(sandboxMode === "DEGRADED_SANDBOX" || sandboxMode === "not_run") && (
            <CapabilityBadge label="Sandbox" status="DEGRADED_SANDBOX" compact />
          )}
          {latencyMs !== null && (
            <span className="text-[10px] text-neon-amber font-mono bg-neon-amber/10 border border-neon-amber/30 px-2 py-0.5 rounded">
              T+{latencyMs.toFixed(0)}ms
            </span>
          )}
          {intent && (
            <span className="text-[10px] text-zinc-400 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              INTENT: <span className="text-neon-cyan">{intent}</span>
              {confidence !== null && <span className="text-zinc-500"> ({(confidence * 100).toFixed(0)}%)</span>}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800/80 px-4 bg-zinc-950/80 relative z-10 backdrop-blur-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-[10px] font-mono tracking-widest transition-all duration-300 border-b-2 ${
              tab === t.id
                ? "border-neon-cyan text-neon-cyan bg-neon-cyan/5"
                : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6 relative z-10">
        {tab === "chat" && (
          <div data-panel="chat" className="flex flex-col gap-5 max-w-4xl mx-auto w-full">
            {/* Answer */}
            {runStatus === "idle" && (
              <div className="flex flex-col items-center justify-center text-zinc-600 h-64 border border-zinc-800/50 border-dashed rounded-xl bg-zinc-900/20">
                <svg className="w-8 h-8 mb-3 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <div className="text-xs font-mono uppercase tracking-widest">SYSTEM IDLE</div>
                <div className="text-[10px] mt-1 opacity-60">Awaiting execution command...</div>
              </div>
            )}
            {runStatus === "running" && (
              <div className="flex flex-col items-center justify-center text-neon-cyan h-64 border border-neon-cyan/20 border-dashed rounded-xl bg-neon-cyan/5">
                <div className="w-8 h-8 border-2 border-neon-cyan/30 border-t-neon-cyan rounded-full animate-spin mb-4"></div>
                <div className="text-xs font-mono uppercase tracking-widest animate-pulse">
                  EXECUTING {activeNode ? `[${activeNode}]` : ""}
                </div>
              </div>
            )}
            {error && (
              <div className="bg-red-950/40 border border-red-500/50 rounded-xl p-5 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <div className="flex items-center gap-2 text-red-400 font-mono text-xs tracking-widest mb-2 uppercase">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  System Exception
                </div>
                <div className="text-red-200/80 text-xs font-mono bg-black/40 p-3 rounded">{error}</div>
                <div className="mt-3 text-[10px] text-red-500/80 font-mono uppercase">
                  VERIFY BACKEND CONNECTION AND start_all.ps1 PROCESS
                </div>
              </div>
            )}
            {finalAnswer && (
              <div data-anim="answer-panel" className="bg-zinc-900/60 border border-neon-cyan/30 rounded-xl p-6 shadow-[0_0_20px_rgba(0,240,255,0.05)] backdrop-blur-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-neon-cyan"></div>
                <div className="flex items-center gap-3 mb-5 pb-3 border-b border-zinc-800/80">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-black/50 ${runStatus === "partial" ? "text-neon-amber border border-neon-amber/50" : "text-neon-emerald border border-neon-emerald/50"}`}>
                    {runStatus === "partial" ? "⚠ PARTIAL OUTPUT" : "✓ EXECUTION SUCCESS"}
                  </span>
                  {intent && <span className="text-[10px] font-mono text-neon-cyan">MODE: {intent}</span>}
                </div>
                <div className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap font-sans">{finalAnswer}</div>
              </div>
            )}
            {runStatus === "partial" && !finalAnswer && (
              <div className="bg-amber-950/30 border border-neon-amber/40 rounded-xl p-5 text-center">
                <div className="text-neon-amber font-mono text-xs tracking-widest mb-2 uppercase">⚠ INSUFFICIENT_EVIDENCE</div>
                <div className="text-amber-200/70 text-xs font-mono">
                  No sufficiently grounded answer could be constructed.<br />
                  Do not treat absence of answer as a negative statutory finding.
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "evidence" && <EvidencePanel />}

        {tab === "code" && (
          <div className="font-mono text-[11px] text-neon-cyan bg-black/80 rounded-xl p-5 border border-zinc-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
            <div className="text-zinc-500 mb-3 uppercase tracking-widest border-b border-zinc-800 pb-2">AST Sandbox Output</div>
            {codeStatus === "not_requested"
              ? <span className="text-zinc-600">Code generation was not invoked for this query.</span>
              : <span className="text-zinc-300 whitespace-pre-wrap">{codeStatus}</span>}
          </div>
        )}

        {tab === "sandbox" && (
          <div className="bg-orange-950/20 border border-neon-amber/30 rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-neon-amber"></div>
            <div className="text-neon-amber font-mono text-xs tracking-widest mb-3 uppercase flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Sandbox Mode: DEGRADED_SANDBOX
            </div>
            <div className="text-orange-200/70 text-[11px] mb-4 font-mono max-w-2xl leading-relaxed">
              Docker is not installed on this node. Code runs in-process with strict AST allowlisting.
              This is NOT container isolation. The label DEGRADED_SANDBOX is mathematically intentional and accurate for this rehearsal.
            </div>
            <div className="font-mono text-[10px] text-neon-cyan bg-black/50 p-3 rounded border border-zinc-800">
              {sandboxMode === "not_run"
                ? "Sandbox was not invoked for this query."
                : `Active sandbox mode: ${sandboxMode}`}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
