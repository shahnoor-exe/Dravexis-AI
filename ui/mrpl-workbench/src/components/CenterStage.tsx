// components/CenterStage.tsx — Query composer, answer, tabs for outputs
import React, { useState } from "react";
import { useAgentStore } from "../store/agentStore";
import { useAgentRun } from "../hooks/useAgentRun";
import { EvidencePanel } from "./EvidencePanel";
import { CapabilityBadge } from "./CapabilityBadge";
import { useQuerySubmitAnimation, usePanelSwitchAnimation } from "../hooks/useGSAPAnimations";

type Tab = "chat" | "evidence" | "code" | "sandbox";

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

  const TABS: { id: Tab; label: string }[] = [
    { id: "chat", label: "Answer" },
    { id: "evidence", label: `Evidence${useAgentStore.getState().evidence.length > 0 ? ` (${useAgentStore.getState().evidence.length})` : ""}` },
    { id: "code", label: "Code Output" },
    { id: "sandbox", label: "Sandbox" },
  ];

  return (
    <main className="flex flex-col flex-1 min-w-0 bg-zinc-950 overflow-hidden">
      {/* Query Composer */}
      <div className="p-4 border-b border-zinc-800">
        <div className="relative">
          <textarea
            id="query-composer"
            data-anim="query-composer"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 pt-3 pb-10 text-zinc-100 text-sm resize-none focus:outline-none focus:border-blue-500 placeholder:text-zinc-600 transition-colors"
            rows={3}
            placeholder="Enter query… e.g. What is the inspection interval for H2S pressure vessels?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunning}
          />
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            {isRunning && (
              <span className="text-blue-400 text-xs font-mono animate-pulse">
                {activeNode ? `▶ ${activeNode}` : "running…"}
              </span>
            )}
            <button
              id="btn-submit-query"
              onClick={run}
              disabled={isRunning || !query.trim()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {isRunning ? "Running…" : "Submit"}
            </button>
          </div>
          <div className="absolute left-3 bottom-3 text-[10px] text-zinc-700">Ctrl+Enter to submit</div>
        </div>

        {/* Capability warnings always visible */}
        <div className="flex flex-wrap gap-2 mt-2">
          {visionStatus === "VISION_UNAVAILABLE" && (
            <CapabilityBadge label="Vision" status="VISION_UNAVAILABLE" compact />
          )}
          {(sandboxMode === "DEGRADED_SANDBOX" || sandboxMode === "not_run") && (
            <CapabilityBadge label="Sandbox" status="DEGRADED_SANDBOX" compact />
          )}
          {latencyMs !== null && (
            <span className="text-[10px] text-zinc-600 font-mono self-center">{latencyMs.toFixed(0)}ms</span>
          )}
          {intent && (
            <span className="text-[10px] text-zinc-500 self-center">
              intent: <span className="text-zinc-300">{intent}</span>
              {confidence !== null && <span className="text-zinc-600"> ({(confidence * 100).toFixed(0)}%)</span>}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "chat" && (
          <div data-panel="chat" className="flex flex-col gap-4">
            {/* Answer */}
            {runStatus === "idle" && (
              <div className="text-zinc-600 text-sm text-center py-12">
                Submit a query to run the agent pipeline.
              </div>
            )}
            {runStatus === "running" && (
              <div className="text-blue-400 text-sm text-center py-12 animate-pulse">
                Agent pipeline running… {activeNode && <span className="font-mono">({activeNode})</span>}
              </div>
            )}
            {error && (
              <div className="bg-red-950/50 border border-red-800 rounded-xl p-4">
                <div className="text-red-400 font-semibold text-sm mb-1">⚠ Error</div>
                <div className="text-red-200/80 text-xs font-mono">{error}</div>
                <div className="mt-2 text-[10px] text-red-500">
                  Check backend connection and that start_all.ps1 is running.
                </div>
              </div>
            )}
            {finalAnswer && (
              <div data-anim="answer-panel" className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] text-emerald-500 font-semibold uppercase tracking-widest">
                    {runStatus === "partial" ? "⚠ PARTIAL ANSWER" : "✓ Answer"}
                  </span>
                  {intent && <span className="text-[10px] text-zinc-600">· {intent}</span>}
                </div>
                <div className="text-zinc-100 text-sm leading-relaxed whitespace-pre-wrap">{finalAnswer}</div>
              </div>
            )}
            {runStatus === "partial" && !finalAnswer && (
              <div className="bg-amber-950/40 border border-amber-800/50 rounded-xl p-4 text-center">
                <div className="text-amber-400 font-semibold text-sm mb-1">⚠ INSUFFICIENT_EVIDENCE</div>
                <div className="text-amber-200/70 text-xs">
                  No sufficiently grounded answer could be constructed.<br />
                  Do not treat absence of answer as a negative statutory finding.
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "evidence" && <EvidencePanel />}

        {tab === "code" && (
          <div className="font-mono text-xs text-zinc-300 bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            {codeStatus === "not_requested"
              ? <span className="text-zinc-600">Code generation was not invoked for this query.</span>
              : <span className="text-zinc-400">{codeStatus}</span>}
          </div>
        )}

        {tab === "sandbox" && (
          <div className="bg-orange-950/30 border border-orange-900/50 rounded-xl p-4">
            <div className="text-orange-400 font-semibold text-sm mb-2">Sandbox Mode: DEGRADED_SANDBOX</div>
            <div className="text-orange-200/70 text-xs mb-2">
              Docker is not installed. Code runs in-process with AST allowlist.
              This is NOT Docker container isolation. The label DEGRADED_SANDBOX is intentional and accurate.
            </div>
            <div className="font-mono text-[11px] text-zinc-400">
              {sandboxMode === "not_run"
                ? "Sandbox was not invoked for this query."
                : `Sandbox mode: ${sandboxMode}`}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
