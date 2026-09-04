// components/CenterStage.tsx — Query composer, answer, tabs for outputs
import React, { useState } from "react";
import { useAgentStore } from "../store/agentStore";
import { useAgentRun } from "../hooks/useAgentRun";
import { EvidencePanel } from "./EvidencePanel";
import { CapabilityBadge } from "./CapabilityBadge";
import { useQuerySubmitAnimation, usePanelSwitchAnimation } from "../hooks/useGSAPAnimations";
import { Button } from "./ui/Button";
import { useHistoryStore } from "../store/historyStore";
import { MediaTray } from "./MediaTray";

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
    latencyMs, events, uploadedImagePath, setUploadedImagePath, setSessionId,
    intentOverride, setIntentOverride,
    hitlEnabled, setHitlEnabled, hitlState, setHitlState, hitlCode, setHitlCode, triggerHitlMock
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

  const handleRunSubmit = () => {
    if (hitlEnabled && hitlState === "none") {
      triggerHitlMock();
    } else {
      run();
    }
  };

  const [isUploading, setIsUploading] = useState(false);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setAttachedFileName(file.name);
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setAttachedFileName(`Error: File too large (>10MB)`);
      setIsUploading(false);
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append("file", file);

      if (file.type === "application/pdf") {
        const res = await fetch("http://127.0.0.1:8080/upload/pdf", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.status === "ok") {
          setSessionId(data.session_id);
          setQuery("What is this PDF about?");
          
          useHistoryStore.getState().saveMedia({
            id: crypto.randomUUID(),
            sessionId: data.session_id,
            timestamp: Date.now(),
            type: "pdf",
            originalName: file.name,
            sizeBytes: file.size,
            status: "ok"
          });
        } else {
          setAttachedFileName(`Error: ${data.final_answer}`);
        }
      } else if (file.type.startsWith("image/")) {
        const res = await fetch("http://127.0.0.1:8080/upload/image", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.status === "ok") {
          setUploadedImagePath(data.image_path);
          setQuery("Describe this image.");
          
          useHistoryStore.getState().saveMedia({
            id: crypto.randomUUID(),
            sessionId: "local-vision",
            timestamp: Date.now(),
            type: "image",
            originalName: file.name,
            sizeBytes: file.size,
            status: "ok"
          });
        } else {
          setAttachedFileName(`Error: ${data.error}`);
        }
      } else {
        setAttachedFileName("Unsupported file type");
      }
    } catch (err) {
      setAttachedFileName("Upload failed");
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "chat", label: "EXECUTION CONSOLE" },
    { id: "evidence", label: `EVIDENCE BUFFER${useAgentStore.getState().evidence.length > 0 ? ` (${useAgentStore.getState().evidence.length})` : ""}` },
    { id: "code", label: "CODE OUTPUT" },
    { id: "sandbox", label: "SANDBOX STATE" },
  ];

  return (
    <main className="flex flex-col flex-1 min-w-0 bg-cyber-bg overflow-hidden relative transition-colors duration-400">
      <div className="absolute inset-0 scanlines opacity-5 dark:opacity-20 mix-blend-overlay pointer-events-none transition-opacity duration-400"></div>
      <div className="absolute inset-0 grid-overlay opacity-20 dark:opacity-100 pointer-events-none"></div>
      
      {/* Query Composer */}
      <div className="p-5 border-b border-slate-200 dark:border-zinc-800/80 relative z-10 bg-white/40 dark:bg-slate-glass/30 backdrop-blur-md transition-colors duration-400">
        
        {/* Top bar of composer: Action Chips & Mode Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap gap-2">
            {DEMO_PROMPTS.map((demo, idx) => (
              <Button
                key={idx}
                variant="ghost"
                size="sm"
                onClick={() => handleDemoClick(demo.query)}
                tooltip={demo.query}
                leftIcon={<span>{demo.icon}</span>}
              >
                {demo.label}
              </Button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 uppercase tracking-widest transition-colors duration-400">Force Mode:</span>
            <select
              className="bg-slate-100 dark:bg-black/50 border border-slate-300 dark:border-zinc-700/80 text-neon-cyan text-[10px] font-mono p-1 rounded-sm focus:outline-none focus:border-neon-cyan/50 transition-colors duration-400"
              value={intentOverride || ""}
              onChange={(e) => setIntentOverride(e.target.value === "" ? null : e.target.value)}
              disabled={isRunning}
            >
              <option value="">AUTO (Router)</option>
              <option value="rag">RAG (Refinery Knowledge)</option>
              <option value="code">CODE (AST Sandbox)</option>
              <option value="vision">VISION (Optical Sensor)</option>
              <option value="code_explanation">EXPLAIN (No Sandbox)</option>
              <option value="system">SYSTEM (Artifacts)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer ml-4">
            <input 
              type="checkbox" 
              className="form-checkbox h-3 w-3 text-neon-amber bg-white dark:bg-black border-slate-300 dark:border-zinc-700 focus:ring-0 focus:ring-offset-0 rounded-sm transition-colors duration-400" 
              checked={hitlEnabled} 
              onChange={(e) => setHitlEnabled(e.target.checked)}
              disabled={isRunning || runStatus === "hitl_awaiting"}
            />
            <span className="text-[10px] font-mono text-neon-amber uppercase tracking-widest mt-0.5">Force HITL Gate</span>
          </label>
        </div>

        <MediaTray />

        <div className="relative group">
          <textarea
            id="query-composer"
            data-anim="query-composer"
            className="w-full bg-white/80 dark:bg-black/40 border border-slate-300 dark:border-zinc-700/80 rounded-sm px-5 pt-4 pb-16 text-slate-900 dark:text-zinc-100 text-sm font-mono resize-none focus:outline-none focus:border-neon-cyan/80 focus:ring-1 focus:ring-neon-cyan/50 placeholder:text-slate-400 dark:placeholder:text-zinc-600 transition-all duration-300 backdrop-blur-sm"
            rows={3}
            placeholder="[TERMINAL_INPUT] > Enter query or select a demo above..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunning || isUploading}
          />
          
          {/* Upload Button & Status */}
          <div className="absolute left-4 bottom-4 flex items-center gap-3">
            <label className="cursor-pointer text-slate-400 dark:text-zinc-400 hover:text-neon-cyan transition-colors" title="Attach Document/Image">
              <input type="file" className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} disabled={isRunning || isUploading} />
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </label>
            {isUploading && <span className="text-[10px] text-neon-cyan animate-pulse font-mono">UPLOADING...</span>}
          </div>
          <div className="absolute right-4 bottom-4 flex items-center gap-3">
            {isRunning && (
              <span className="text-neon-magenta text-[10px] font-mono uppercase tracking-widest animate-pulse flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-neon-magenta rounded-full"></span>
                {activeNode ? `EXECUTING: ${activeNode}` : "PROCESSING..."}
              </span>
            )}
            <Button
              id="btn-submit-query"
              variant="primary"
              size="lg"
              onClick={handleRunSubmit}
              disabled={isRunning || isUploading || (!query.trim() && !uploadedImagePath) || runStatus === "hitl_awaiting"}
            >
              {isRunning ? "RUNNING" : "INITIALIZE"}
            </Button>
          </div>
        </div>

        {/* Telemetry Readout Strip */}
        {(latencyMs !== null || intent) && (
          <div className="flex flex-wrap gap-3 mt-3 items-center animate-fade-in">
            {visionStatus === "VISION_UNAVAILABLE" && (
              <CapabilityBadge label="Vision" status="VISION_UNAVAILABLE" compact />
            )}
            {(sandboxMode === "DEGRADED_SANDBOX" || sandboxMode === "not_run") && (
              <CapabilityBadge label="Sandbox" status="DEGRADED_SANDBOX" compact />
            )}
            {latencyMs !== null && (
              <span className="latency-badge" title="End-to-End Latency">
                ⏱ {(latencyMs / 1000).toFixed(1)}s
              </span>
            )}
            {useAgentStore.getState().lastResponse?.model_switch_latency_ms != null && (
              <span className="text-[9px] text-slate-500 dark:text-zinc-400 font-mono bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-300 dark:border-zinc-800 transition-colors duration-400" title="Model Load Time">
                LD: <span className="text-neon-cyan">{(useAgentStore.getState().lastResponse!.model_switch_latency_ms! / 1000).toFixed(1)}s</span>
              </span>
            )}
            {useAgentStore.getState().evidence.length > 0 && (
              <span className="text-[9px] text-slate-500 dark:text-zinc-400 font-mono bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-300 dark:border-zinc-800 transition-colors duration-400" title="Qdrant Retrieval Count">
                VDB: <span className="text-neon-cyan">{useAgentStore.getState().evidence.length}</span>
              </span>
            )}
            {intent && (
              <span className="text-[9px] text-slate-500 dark:text-zinc-400 font-mono bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-300 dark:border-zinc-800 transition-colors duration-400">
                INTENT: <span className="text-neon-cyan">{intent}</span>
                {confidence !== null && <span className="text-slate-500 dark:text-zinc-500"> ({(confidence * 100).toFixed(0)}%)</span>}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800/80 px-4 bg-slate-100 dark:bg-zinc-950/80 relative z-10 backdrop-blur-sm transition-colors duration-400">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-[10px] font-mono tracking-widest transition-all duration-300 border-b-2 ${
              tab === t.id
                ? "border-neon-cyan text-neon-cyan bg-neon-cyan/5"
                : "border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-900/50"
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
              <div className="flex flex-col items-center justify-center text-slate-500 dark:text-zinc-600 h-64 border border-slate-300 dark:border-zinc-800/50 border-dashed rounded-xl bg-slate-100 dark:bg-zinc-900/20 transition-colors duration-400">
                <svg className="w-8 h-8 mb-3 text-slate-400 dark:text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <div className="text-xs font-mono uppercase tracking-widest">SYSTEM IDLE</div>
                <div className="text-[10px] mt-1 opacity-60">Awaiting execution command...</div>
              </div>
            )}
            {isRunning && (
              <div className="flex flex-col items-center justify-center text-neon-cyan h-64 border border-neon-cyan/20 border-dashed rounded-xl bg-neon-cyan/5">
                <div className="w-8 h-8 border-2 border-neon-cyan/30 border-t-neon-cyan rounded-full animate-spin mb-4"></div>
                <div className="text-xs font-mono uppercase tracking-widest animate-pulse">
                  EXECUTING {activeNode ? `[${activeNode}]` : ""}
                </div>
              </div>
            )}
            {runStatus === "hitl_awaiting" && (
              <div className="bg-white dark:bg-cyber-obsidian border border-amber-300 dark:border-neon-amber/50 rounded-sm p-6 shadow-md dark:shadow-2xl relative animate-fade-in transition-colors duration-400">
                <div className="absolute top-0 left-0 w-1 h-full bg-neon-amber glow-amber"></div>
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
                  <h3 className="text-neon-amber font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Sandbox Execution Paused (DEMO_APPROVAL)
                  </h3>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase ${hitlState === 'awaiting_approval' ? 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400' : 'bg-neon-cyan/10 dark:bg-neon-cyan/20 text-neon-cyan'}`}>
                    {hitlState === 'awaiting_approval' ? 'AWAITING APPROVAL' : hitlState}
                  </span>
                </div>
                <div className="mb-4">
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono mb-2 transition-colors duration-400">The reasoning engine requested to execute the following AST code. Please review.</p>
                  <textarea 
                    className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-300 dark:border-zinc-700/80 rounded p-3 text-neon-cyan text-[11px] font-mono h-40 focus:outline-none focus:border-neon-amber transition-colors duration-400"
                    value={hitlCode || ""}
                    onChange={(e) => setHitlCode(e.target.value)}
                  />
                </div>
                <div className="flex gap-3 justify-end mt-4">
                  <Button variant="ghost" size="sm" onClick={() => { setHitlState('none'); useAgentStore.getState().reset(); }}>Reject & Cancel</Button>
                  <Button variant="primary" size="sm" className="bg-neon-amber hover:bg-neon-amber/80 text-black border-none" onClick={() => { setHitlState('approved'); run(); }}>
                    Approve & Execute
                  </Button>
                </div>
              </div>
            )}
            {error && (
              <div className="bg-red-950/40 border border-red-500/50 rounded-sm p-5 shadow-[0_0_15px_rgba(239,68,68,0.2)] relative overflow-hidden animate-fade-in">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500 glow-red"></div>
                <div className="flex items-center gap-2 text-red-400 font-mono text-xs tracking-widest mb-2 uppercase">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  System Exception {typeof error === "object" && error !== null ? `[${(error as any).code}]` : ""}
                </div>
                <div className="text-red-200/80 text-xs font-mono bg-black/40 p-3 rounded mb-4 border border-red-900/50">
                  {typeof error === "object" && error !== null ? (error as any).message : String(error)}
                </div>
                <div className="flex gap-3 items-center">
                  <Button variant="ghost" size="sm" onClick={() => useAgentStore.getState().reset()} className="text-zinc-400 border-zinc-700 hover:text-white">Dismiss</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleRunSubmit()} className="text-neon-cyan border-neon-cyan/50 hover:bg-neon-cyan/10">Retry Request</Button>
                  {typeof error === "object" && error !== null && ((error as any).code === "MODEL_SWITCH_FAILED" || (error as any).code === "VISION_UNAVAILABLE") && (
                    <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="text-neon-amber border-neon-amber/50 hover:bg-neon-amber/10">Recheck Capabilities</Button>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-red-900/30 text-[9px] text-red-500/60 font-mono uppercase tracking-widest flex items-center justify-between">
                  <span>VERIFY BACKEND CONNECTION AND start_all.ps1 PROCESS</span>
                  {typeof error === "object" && error !== null && (error as any).code === "LLAMA_SERVER_UNREACHABLE" && (
                    <span className="text-red-400">STATUS: DISCONNECTED</span>
                  )}
                </div>
              </div>
            )}
            {finalAnswer && (runStatus === "completed" || runStatus === "partial") && (
              <div data-anim="answer-panel" className="bg-white/90 dark:bg-slate-glass/60 border border-slate-300 dark:border-neon-cyan/30 rounded-sm p-6 shadow-sm dark:shadow-[0_0_20px_rgba(32,227,255,0.1)] backdrop-blur-md relative overflow-hidden animate-fade-in transition-colors duration-400">
                <div className="absolute top-0 left-0 w-1 h-full bg-neon-cyan glow-cyan"></div>
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200 dark:border-zinc-800/80">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm bg-slate-100 dark:bg-black/50 ${runStatus === "partial" ? "text-neon-amber border border-neon-amber/50 glow-amber" : "text-neon-emerald border border-neon-emerald/50 glow-emerald"}`}>
                      {runStatus === "partial" ? "⚠ PARTIAL OUTPUT" : "✓ EXECUTION SUCCESS"}
                    </span>
                    {intent && <span className="text-[10px] font-mono text-neon-cyan">MODE: {intent}</span>}
                  </div>
                  {/* Grounding Label */}
                  {intent === "rag" || intent === "vision" ? (
                    <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-sm border ${
                      useAgentStore.getState().evidence.length > 0 ? "bg-neon-emerald/10 text-neon-emerald border-neon-emerald/30" : "bg-neon-amber/10 text-neon-amber border-neon-amber/30"
                    }`}>
                      {useAgentStore.getState().evidence.length > 0 ? "GROUNDED IN LOCAL CORPUS" : "NO CORPUS EVIDENCE"}
                    </span>
                  ) : null}
                </div>
                
                {/* PDF Truncation Warning */}
                {events.some(e => e.truncated === true) && (
                  <div className="mb-4 bg-amber-950/40 border-l-2 border-neon-amber p-2 text-[10px] font-mono text-amber-200/80 flex items-center gap-2">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    PDF context exceeded max tokens (10000 chars) and was safely truncated to prevent buffer overflow.
                  </div>
                )}

                <div className="text-slate-800 dark:text-neon-cyan/90 text-sm leading-relaxed whitespace-pre-wrap font-mono relative transition-colors duration-400">
                  <div className="absolute -left-3 top-0 bottom-0 border-l border-slate-300 dark:border-neon-cyan/20"></div>
                  {finalAnswer}
                  <span className="inline-block w-2 h-4 bg-neon-cyan ml-1 animate-pulse align-middle"></span>
                </div>
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
          <div className="font-mono text-[11px] text-neon-cyan bg-slate-100 dark:bg-black/80 rounded-xl p-5 border border-slate-300 dark:border-zinc-800 shadow-inner dark:shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] transition-colors duration-400">
            <div className="text-slate-500 dark:text-zinc-500 mb-3 uppercase tracking-widest border-b border-slate-300 dark:border-zinc-800 pb-2">AST Sandbox Output</div>
            {codeStatus === "not_requested"
              ? <span className="text-slate-500 dark:text-zinc-600">Code generation was not invoked for this query.</span>
              : <span className="text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">{codeStatus}</span>}
          </div>
        )}

        {tab === "sandbox" && (
          <div className="bg-amber-50 dark:bg-orange-950/20 border border-amber-300 dark:border-neon-amber/30 rounded-sm p-5 relative overflow-hidden transition-colors duration-400">
            <div className="absolute top-0 left-0 w-1 h-full bg-neon-amber"></div>
            <div className="text-amber-700 dark:text-neon-amber font-mono text-xs tracking-widest mb-3 uppercase flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Sandbox Mode: DEGRADED_SANDBOX
            </div>
            <div className="text-amber-600 dark:text-amber-200/70 text-[11px] mb-4 font-mono max-w-2xl leading-relaxed">
              Docker is not installed on this node. Code runs in-process with strict AST allowlisting.
              This is NOT container isolation. The label DEGRADED_SANDBOX is mathematically intentional and accurate for this rehearsal.
            </div>
            <div className="font-mono text-[10px] text-neon-cyan bg-white dark:bg-black/50 p-3 rounded-sm border border-amber-200 dark:border-zinc-800 transition-colors duration-400">
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
