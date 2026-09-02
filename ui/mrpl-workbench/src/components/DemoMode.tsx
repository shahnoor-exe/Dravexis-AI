// components/DemoMode.tsx — Full Demonstration Blueprint Panel
// Maps all 14 features from the SIH 2026 PS 117 demo matrix to live queries
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useAgentStore } from "../store/agentStore";
import { useAgentRun } from "../hooks/useAgentRun";

// ─── Phase Definitions ──────────────────────────────────────────────────────
interface DemoStep {
  id: number;
  feature: string;
  category: "rag" | "code" | "vision" | "system" | "airgap";
  icon: string;
  query: string;
  expectedOutput: string;
  architecturePath: string;
  intentOverride?: string;
  seedDoc?: string;
}

const PHASE_1_STEPS: DemoStep[] = [
  {
    id: 1,
    feature: "Hybrid Intent Classification",
    category: "code",
    icon: "🧠",
    query: "Calculate remaining corrosion life for Line 4B-CS-150-N1A",
    expectedOutput: "Intent badge → CODE (100% confidence). DAG: Plan → Retrieve → CodeGen → Sandbox → Reflect → Compile.",
    architecturePath: "Regex pre-filter routes directly; zero LLM tokens wasted on routing.",
    intentOverride: undefined,
  },
  {
    id: 2,
    feature: "Multi-Document Vector RAG",
    category: "rag",
    icon: "📚",
    query: "What is the nitrogen purge rate for the flare tip and KOD trip setpoint?",
    expectedOutput: "Output: 200 Nm³/h purge rate & 70% KOD high-high trip level. Source: mrpl_sop_flare_system.txt (score ~0.795).",
    architecturePath: "FastEmbed (bge-large) dense cosine search → 17 on-disk chunks in embedded Qdrant.",
    seedDoc: "mrpl_sop_flare_system.txt",
    intentOverride: "rag",
  },
  {
    id: 3,
    feature: "Statutory Clause Cross-Referencing",
    category: "rag",
    icon: "📜",
    query: "What is the statutory inspection interval for H2S vessels per OISD-116?",
    expectedOutput: "Natural language citing OISD-116 Clause 4.2: 5-year maximum limit for H2S service vessels.",
    architecturePath: "DeepSeek-R1-Distill-1.5B synthesizes retrieved legal context via ChatML prompt.",
    seedDoc: "oisd_116_pressure_vessel_inspection.txt",
    intentOverride: "rag",
  },
];

const PHASE_2_STEPS: DemoStep[] = [
  {
    id: 4,
    feature: "AST-Shielded Math Sandbox",
    category: "code",
    icon: "🔢",
    query: "Calculate remaining life: initial thickness 8.0mm, minimum required 6.0mm, corrosion rate 0.45 mm/yr",
    expectedOutput: "Remaining Life = (8.0 - 6.0) / 0.45 = 4.44 years. Sandbox exit_code: 0.",
    architecturePath: "Qwen2.5-Coder-1.5B → Python → AST allowlist → DEGRADED_SANDBOX subprocess.",
    intentOverride: "code",
  },
  {
    id: 5,
    feature: "Live Self-Reflection Loop",
    category: "code",
    icon: "🔄",
    query: "Compute wall thickness per ASME B31.3 for 150mm pipe, P=15 MPa, S=138 MPa, E=1.0, W=1.0, Y=0.4",
    expectedOutput: "DAG shows Reflect Node → CodeGen retry cycle (max 2 iterations). Deterministic calculation output.",
    architecturePath: "LangGraph conditional cyclic edge with SQLite state checkpointing.",
    intentOverride: "code",
  },
  {
    id: 6,
    feature: "Optical P&ID Instrument Audit",
    category: "vision",
    icon: "👁️",
    query: "Audit the attached P&ID diagram for the relief loop instrumentation.",
    expectedOutput: "Identifies PRV tag, bypass isolation, and returns natural language safety review.",
    architecturePath: "Qwen2.5-VL-3B + mmproj-Q8_0 via llama-server on CPU fallback (~9-14s).",
    intentOverride: "vision",
  },
];

const PHASE_3_STEPS: DemoStep[] = [
  {
    id: 7,
    feature: "Interactive 3D Artifact Shelf",
    category: "system",
    icon: "📦",
    query: "What is the corrosion rate for Boiler B2 and draft a PSU maintenance note.",
    expectedOutput: "Three cards appear (DOCX, XLSX, PPTX) with 3D tilt-flip animation. Click any to download.",
    architecturePath: "Compile Node → Pydantic v2 → openpyxl / python-docx / python-pptx.",
    intentOverride: undefined,
  },
  {
    id: 8,
    feature: "Live Formula Excel Workbook",
    category: "system",
    icon: "📊",
    query: "Generate analysis sheet for remaining life calculation: thickness 8.0mm, min 6.0mm, rate 0.45 mm/yr",
    expectedOutput: "Downloads .xlsx. Opening in Excel shows dynamic formula =(B5-B6)/B7.",
    architecturePath: "Server-side openpyxl formula injection compiler.",
    intentOverride: "code",
  },
  {
    id: 9,
    feature: "ASME Piping Thickness Query",
    category: "rag",
    icon: "🔧",
    query: "What is the minimum wall thickness formula per ASME B31.3 and what are the Y-coefficients for creep?",
    expectedOutput: "Cites ASME B31.3 formula: t = PD / 2(SE + PY). Y-values from seed doc.",
    architecturePath: "RAG retrieval from asme_b31_3_process_piping.txt, synthesized by DeepSeek-R1.",
    seedDoc: "asme_b31_3_process_piping.txt",
    intentOverride: "rag",
  },
  {
    id: 10,
    feature: "Fire Protection Standards",
    category: "rag",
    icon: "🔥",
    query: "What are the water spray rates and foam application rates per OISD-118 fire protection standard?",
    expectedOutput: "Spray rates, foam rates, LEL thresholds, safety distances from OISD-118 seed data.",
    architecturePath: "RAG retrieval from oisd_118_fire_protection.txt.",
    seedDoc: "oisd_118_fire_protection.txt",
    intentOverride: "rag",
  },
  {
    id: 11,
    feature: "H2S Safe Work Permit Procedure",
    category: "rag",
    icon: "☢️",
    query: "What are the H2S safety permit requirements and PPE specifications for MRPL wet gas units?",
    expectedOutput: "H2S PPE requirements, detector placement, evacuation procedures from MRPL H2S SOP.",
    architecturePath: "RAG retrieval from mrpl_h2s_safe_work_permit.txt.",
    seedDoc: "mrpl_h2s_safe_work_permit.txt",
    intentOverride: "rag",
  },
  {
    id: 12,
    feature: "Composite Repair Methods (PCC-2)",
    category: "rag",
    icon: "🛠️",
    query: "What are the composite wrap repair methods per ASME PCC-2 Article 2.1 for corroded piping?",
    expectedOutput: "Composite reinforcement scope, applicability, design life criteria from PCC-2 seed.",
    architecturePath: "RAG retrieval from asme_pcc2_repair_methods.txt.",
    seedDoc: "asme_pcc2_repair_methods.txt",
    intentOverride: "rag",
  },
];

const PHASE_4_STEPS: DemoStep[] = [
  {
    id: 13,
    feature: "Hardware-Aware Hot-Swapping",
    category: "system",
    icon: "⚡",
    query: "What is the nitrogen purge rate for the flare tip?",
    expectedOutput: "System unloads current model and loads appropriate model in ~5s without crashing 4GB VRAM.",
    architecturePath: "model_manager.py sequential process management with health polling.",
    intentOverride: "rag",
  },
  {
    id: 14,
    feature: "Air-Gap Verification Telemetry",
    category: "airgap",
    icon: "🛡️",
    query: "Summarize the air-gap isolation protocols and verify local execution.",
    expectedOutput: "Bottom-right sensor: 0 Bps external egress. Query completes 100% locally in ~14.9s.",
    architecturePath: "psutil socket enumeration confirming strict 127.0.0.1 loopback traffic.",
    intentOverride: "rag",
  },
];

const PHASES = [
  { name: "UI & Sovereignty", subtitle: "Minute 1", steps: PHASE_1_STEPS, color: "neon-cyan" },
  { name: "Multimodal & Sandbox", subtitle: "Minute 2-3", steps: PHASE_2_STEPS, color: "neon-magenta" },
  { name: "Knowledge & Artifacts", subtitle: "Minute 3-4", steps: PHASE_3_STEPS, color: "neon-emerald" },
  { name: "Air-Gap & Grand Finale", subtitle: "Minute 5", steps: PHASE_4_STEPS, color: "neon-amber" },
];

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  rag: { bg: "bg-cyan-500/10 border-cyan-500/30", text: "text-cyan-400", label: "RAG" },
  code: { bg: "bg-fuchsia-500/10 border-fuchsia-500/30", text: "text-fuchsia-400", label: "CODE" },
  vision: { bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400", label: "VISION" },
  system: { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400", label: "SYSTEM" },
  airgap: { bg: "bg-red-500/10 border-red-500/30", text: "text-red-400", label: "AIRGAP" },
};

// ─── Component ──────────────────────────────────────────────────────────────
export const DemoMode: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { setQuery, setIntentOverride } = useAgentStore();
  const { run } = useAgentRun();
  const [activePhase, setActivePhase] = useState(0);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const handleLoadQuery = (step: DemoStep) => {
    setQuery(step.query);
    if (step.intentOverride) {
      setIntentOverride(step.intentOverride);
    } else {
      setIntentOverride(null);
    }
    onClose();
  };

  const handleRunQuery = (step: DemoStep) => {
    setQuery(step.query);
    if (step.intentOverride) {
      setIntentOverride(step.intentOverride);
    } else {
      setIntentOverride(null);
    }
    setCompletedSteps(prev => new Set([...prev, step.id]));
    setTimeout(() => {
      run();
      onClose();
    }, 100);
  };

  const toggleExpand = (id: number) => {
    setExpandedStep(expandedStep === id ? null : id);
  };

  const totalSteps = PHASE_1_STEPS.length + PHASE_2_STEPS.length + PHASE_3_STEPS.length + PHASE_4_STEPS.length;

  const phaseColors = ["text-[#20e3ff]", "text-[#ff20e3]", "text-[#20ff88]", "text-[#ffb320]"];
  const phaseBorders = ["border-[#20e3ff]", "border-[#ff20e3]", "border-[#20ff88]", "border-[#ffb320]"];
  const phaseBgs = ["bg-[#20e3ff]/5", "bg-[#ff20e3]/5", "bg-[#20ff88]/5", "bg-[#ffb320]/5"];

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-stretch justify-center bg-black/85 backdrop-blur-md">
      <div className="flex flex-col w-full max-w-5xl m-4 bg-[#0a0e17] border border-zinc-700/60 rounded-sm shadow-[0_0_60px_rgba(32,227,255,0.1)] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-800/80 bg-[#0d1220]/80 backdrop-blur-md flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-[#20e3ff] font-mono text-sm tracking-[0.2em] uppercase flex items-center gap-3">
              <span className="w-2 h-2 bg-[#20e3ff] rounded-full animate-pulse"></span>
              Demonstration Blueprint — PS 26117
            </h2>
            <p className="text-zinc-500 text-[10px] font-mono mt-1 tracking-wider">
              14-FEATURE MATRIX • 9 SEED DOCUMENTS • 17 QDRANT VECTORS • 5-MINUTE EVALUATOR FLOW
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
              {completedSteps.size} / {totalSteps} COMPLETED
            </span>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors text-lg px-2"
              title="Close Demo Mode"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Phase Tabs */}
        <div className="flex border-b border-zinc-800/80 bg-zinc-950/80 shrink-0">
          {PHASES.map((phase, idx) => (
            <button
              key={idx}
              onClick={() => setActivePhase(idx)}
              className={`flex-1 px-4 py-3 text-[10px] font-mono uppercase tracking-widest transition-all duration-300 border-b-2 ${
                activePhase === idx
                  ? `${phaseBorders[idx]} ${phaseColors[idx]} ${phaseBgs[idx]}`
                  : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
              }`}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-zinc-600">{phase.subtitle}</span>
                <span>{phase.name}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-2.5">
            {PHASES[activePhase].steps.map((step) => {
              const cat = CATEGORY_STYLES[step.category];
              const isExpanded = expandedStep === step.id;
              const isCompleted = completedSteps.has(step.id);

              return (
                <div
                  key={step.id}
                  className={`border rounded-sm transition-all duration-300 ${
                    isCompleted 
                      ? "border-[#20ff88]/40 bg-[#20ff88]/5" 
                      : "border-zinc-800/80 bg-[#0d1220]/50 hover:border-zinc-700"
                  }`}
                >
                  {/* Step Header */}
                  <button
                    onClick={() => toggleExpand(step.id)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    <span className="text-lg shrink-0">{step.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-zinc-200 text-xs font-mono font-bold">#{step.id}</span>
                        <span className="text-zinc-200 text-xs font-mono">{step.feature}</span>
                        <span className={`text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ${cat.bg} ${cat.text}`}>
                          {cat.label}
                        </span>
                        {isCompleted && (
                          <span className="text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#20ff88]/20 text-[#20ff88] border border-[#20ff88]/30">
                            ✓ DONE
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-500 text-[10px] font-mono mt-0.5 truncate">{step.query}</p>
                    </div>
                    <svg
                      className={`w-4 h-4 text-zinc-500 transition-transform duration-200 shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-zinc-800/60 pt-3">
                      <div className="mb-3">
                        <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mb-1">Exact Query</div>
                        <div className="bg-black/50 border border-zinc-800 rounded px-3 py-2 text-[#20e3ff] text-[11px] font-mono">
                          {step.query}
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mb-1">Expected Output</div>
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded px-3 py-2 text-zinc-300 text-[11px] font-mono">
                          {step.expectedOutput}
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mb-1">Architecture Path</div>
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded px-3 py-2 text-zinc-400 text-[10px] font-mono italic">
                          {step.architecturePath}
                        </div>
                      </div>

                      {step.seedDoc && (
                        <div className="mb-3">
                          <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mb-1">Seed Document</div>
                          <div className="bg-zinc-900/60 border border-zinc-800 rounded px-3 py-2 text-[#ffb320] text-[10px] font-mono">
                            data/seed_docs/{step.seedDoc}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleLoadQuery(step)}
                          className="px-4 py-1.5 bg-zinc-800 border border-zinc-700 rounded-sm text-zinc-300 text-[10px] font-mono uppercase tracking-widest hover:bg-zinc-700 hover:text-white transition-all"
                        >
                          Load Query
                        </button>
                        <button
                          onClick={() => handleRunQuery(step)}
                          className="px-4 py-1.5 bg-[#20e3ff]/10 border border-[#20e3ff]/40 rounded-sm text-[#20e3ff] text-[10px] font-mono uppercase tracking-widest hover:bg-[#20e3ff]/20 transition-all"
                        >
                          ▶ Run Immediately
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/80 shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">
              Prototype Boundaries: 4GB VRAM • Sequential Hot-Swap • AST Sandbox • psutil Monitor • 17 Curated Vectors
            </div>
            <div className="text-[9px] text-zinc-500 font-mono">
              SIH 2026 • Dravexis AI
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
