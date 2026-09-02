// components/LeftRail.tsx — Core Matrix + Subsystem Status + Agent DAG
import React, { useEffect, useRef } from "react";
import { useSettingsStore } from "../store/settingsStore";
import { CapabilityBadge } from "./CapabilityBadge";
import { AgentDag } from "./AgentDag";
import { NodeDrilldownDrawer } from "./NodeDrilldownDrawer";
import { useAgentStore } from "../store/agentStore";
import { api } from "../lib/api";
import gsap from "gsap";

/* ─── Sentient AI Core ─── */
const AvatarChamber: React.FC = () => {
  const { runStatus, latencyMs } = useAgentStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const ring1Ref = useRef<SVGCircleElement>(null);
  const ring2Ref = useRef<SVGCircleElement>(null);
  const ring3Ref = useRef<SVGCircleElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  const particlesRef = useRef<(SVGCircleElement | null)[]>([]);

  const isProcessing = ["validating", "routing", "retrieving", "loading_model", "generating", "awaiting_approval"].includes(runStatus);

  useEffect(() => {
    const mm = gsap.matchMedia();
    
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Idle breathing for core
      gsap.to(coreRef.current, {
        scale: 1.08,
        opacity: 0.75,
        duration: 2.5,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });

      // Ring rotations (idle speed)
      gsap.to(ring1Ref.current, { rotation: 360, duration: 25, repeat: -1, ease: "linear", transformOrigin: "center" });
      gsap.to(ring2Ref.current, { rotation: -360, duration: 30, repeat: -1, ease: "linear", transformOrigin: "center" });
      gsap.to(ring3Ref.current, { rotation: 360, duration: 18, repeat: -1, ease: "linear", transformOrigin: "center" });

      // Orbiting particles
      particlesRef.current.forEach((p, i) => {
        if (!p) return;
        const radius = 32 + i * 4;
        const speed = 8 + i * 3;
        const offset = i * (360 / 6);
        gsap.to(p, {
          motionPath: {
            path: `M${50 + radius},50 A${radius},${radius} 0 1,1 ${50 + radius - 0.01},50`,
            align: "self",
          },
          duration: speed,
          repeat: -1,
          ease: "linear",
          delay: (offset / 360) * speed,
        });
      });

      if (isProcessing) {
        // Active: accelerate rings, change core color, add glow
        gsap.to(coreRef.current, {
          scale: 1.25,
          fill: "#FF3EA5", // neon-magenta
          duration: 0.3,
          ease: "power2.out",
        });
        gsap.to(ring1Ref.current, { duration: 3, repeat: -1, ease: "none", overwrite: true, rotation: "+=360", stroke: "#20E3FF", strokeWidth: 1.5 });
        gsap.to(ring2Ref.current, { duration: 2, repeat: -1, ease: "none", overwrite: true, rotation: "-=360", stroke: "#FF3EA5", strokeWidth: 2.5 });
        gsap.to(ring3Ref.current, { duration: 4, repeat: -1, ease: "none", overwrite: true, rotation: "+=360", stroke: "#38E6A5", strokeWidth: 1 });
      } else {
        // Idle: reset colors
        gsap.to(coreRef.current, { scale: 1, fill: "#20E3FF", duration: 1, ease: "power1.inOut" });
        gsap.to(ring1Ref.current, { stroke: "#20E3FF", strokeWidth: 1, duration: 1 });
        gsap.to(ring2Ref.current, { stroke: "#718096", strokeWidth: 2, duration: 1 });
        gsap.to(ring3Ref.current, { stroke: "#20E3FF", strokeWidth: 0.5, duration: 1 });
      }
    });

    mm.add("(prefers-reduced-motion: reduce)", () => {
      // Reduced motion fallback (just color change)
      if (isProcessing) {
        gsap.to(coreRef.current, { fill: "#FF3EA5", duration: 0.5 });
        gsap.to(ring2Ref.current, { stroke: "#FF3EA5", duration: 0.5 });
      } else {
        gsap.to(coreRef.current, { fill: "#20E3FF", duration: 0.5 });
        gsap.to(ring2Ref.current, { stroke: "#718096", duration: 0.5 });
      }
    });

    return () => mm.revert();
  }, [runStatus]);

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center p-4 rounded-xl glass-panel relative overflow-hidden group">
      <div className="absolute inset-0 grid-overlay"></div>
      <div className="relative z-10 w-28 h-28 mb-3">
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          {/* Outer ring - dashed */}
          <circle ref={ring1Ref} cx="50" cy="50" r="44" fill="none" stroke="#20E3FF" strokeWidth="1" strokeDasharray="3 7 1 7" opacity="0.5" />
          {/* Middle ring - heavier */}
          <circle ref={ring2Ref} cx="50" cy="50" r="34" fill="none" stroke="#718096" strokeWidth="2" strokeDasharray="12 4 2 4" opacity="0.7" />
          {/* Inner ring - dotted */}
          <circle ref={ring3Ref} cx="50" cy="50" r="24" fill="none" stroke="#20E3FF" strokeWidth="0.5" strokeDasharray="1 5" opacity="0.4" />
          {/* Orbiting particles */}
          {[0, 1, 2, 3, 4, 5].map(i => (
            <circle
              key={i}
              ref={el => { particlesRef.current[i] = el; }}
              cx={50 + 34}
              cy={50}
              r={1.5 - i * 0.1}
              fill={i % 2 === 0 ? "#20E3FF" : "#38E6A5"}
              opacity={0.6 + i * 0.05}
            />
          ))}
          {/* Radial gradient glow behind core */}
          <defs>
            <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#20E3FF" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#20E3FF" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="20" fill="url(#coreGlow)" />
          {/* Central core */}
          <circle ref={coreRef} cx="50" cy="50" r="12" fill="#20E3FF" style={{ filter: "drop-shadow(0 0 12px rgba(32,227,255,0.7))" }} />
        </svg>
      </div>
      <div className="text-[9px] font-mono text-neon-cyan tracking-[0.2em] uppercase relative z-10">
        {isProcessing ? "⟨ PROCESSING ⟩" : "⟨ AWAITING INPUT ⟩"}
      </div>
      {latencyMs != null && latencyMs > 0 && !isProcessing && (
        <div className="latency-badge mt-2 relative z-10">
          {(latencyMs / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  );
};

function SubsystemCard({ icon, label, status, statusColor = "neon-cyan", glowClass = "", detail }: {
  icon: string; label: string; status: string; statusColor?: string; glowClass?: string; detail?: { message: string; action: string | null; evidence: string | null }
}) {
  return (
    <div className={`relative group bg-slate-glass/50 border border-zinc-800/80 rounded-sm p-2.5 flex items-center justify-between transition-all duration-300 hover:border-${statusColor}/40 ${glowClass}`}>
      <div className={`flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.15em] text-${statusColor}`}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`text-[8px] font-mono font-bold text-${statusColor} bg-${statusColor}/10 px-2 py-0.5 rounded-sm border border-${statusColor}/20`}>
        {status}
      </div>
      {detail && (
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 w-64 bg-cyber-obsidian border border-zinc-700 p-3 rounded-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-2xl">
          <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-cyber-obsidian border-l border-b border-zinc-700 transform rotate-45"></div>
          <div className="relative z-10 text-[10px] font-mono">
            <div className={`text-${statusColor} font-bold mb-1 uppercase tracking-wider`}>{label} STATUS</div>
            <div className="text-zinc-300 mb-2">{detail.message}</div>
            {detail.evidence && <div className="text-zinc-500 text-[9px] mb-2 border-l border-zinc-700 pl-2">{detail.evidence}</div>}
            {detail.action && <div className="text-neon-cyan/80 bg-neon-cyan/5 border border-neon-cyan/20 p-1 rounded-sm text-center">Required Action: {detail.action}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main LeftRail ─── */
export const LeftRail: React.FC<{ width?: number }> = ({ width }) => {
  const { capabilities, setCapabilities } = useSettingsStore();
  const [selectedNode, setSelectedNode] = React.useState<string | null>(null);

  useEffect(() => {
    const fetchCaps = async () => {
      try {
        const c = await api.capabilities();
        setCapabilities(c);
      } catch (e) {
        console.error("Failed to fetch capabilities", e);
      }
    };
    fetchCaps();
    const t = setInterval(fetchCaps, 5000);
    return () => clearInterval(t);
  }, [setCapabilities]);

  return (
    <aside 
      style={{ width: width ? `${width}px` : undefined }}
      className="left-rail flex flex-col gap-4 w-72 min-w-[18rem] max-w-[50vw] p-4 bg-cyber-obsidian border-r border-zinc-800/80 overflow-y-auto relative z-0 shadow-[4px_0_24px_rgba(0,0,0,0.3)] shrink-0 transition-[width] duration-75"
    >
      <div className="absolute inset-0 scanlines opacity-15 mix-blend-overlay pointer-events-none"></div>

      {/* Core Matrix */}
      <div className="relative z-10">
        <h2 className="text-zinc-500 text-[9px] font-mono uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-neon-cyan rounded-full animate-pulse"></span>
          Cognitive Core
        </h2>
        <AvatarChamber />
      </div>

      {/* Subsystem Matrix */}
      <div className="relative z-10 border-t border-zinc-800/60 pt-3">
        <h2 className="text-zinc-500 text-[9px] font-mono uppercase tracking-[0.2em] mb-2">Subsystem Status</h2>
        <div className="flex flex-col gap-1.5">
          <SubsystemCard 
            icon="🧠" label="COGNITIVE ENGINE" 
            status={capabilities ? `${capabilities.reasoning.status === 'available' ? 'ACTIVE' : 'UNAVAILABLE'} [${capabilities.reasoning.model}]` : "POLLING..."} 
            statusColor={capabilities?.reasoning.status === 'available' ? "neon-cyan" : "red-400"} 
            detail={capabilities?.reasoning ? { message: capabilities.reasoning.error_message || "Engine functioning normally.", action: capabilities.reasoning.action, evidence: capabilities.reasoning.evidence } : undefined}
          />
          <SubsystemCard 
            icon="👁️" label="OPTICAL SENSOR" 
            status={capabilities ? `${capabilities.vision.status === 'available' ? 'READY' : 'UNAVAILABLE'} [${capabilities.vision.model}]` : "POLLING..."} 
            statusColor={capabilities?.vision.status === 'available' ? "neon-emerald" : "neon-amber"} 
            detail={capabilities?.vision ? { message: capabilities.vision.error_message || "Vision model loaded and probe passed.", action: capabilities.vision.action, evidence: capabilities.vision.evidence } : undefined}
          />
          <SubsystemCard 
            icon="⚡" label="EXEC SANDBOX" 
            status={capabilities ? `${capabilities.sandbox.status} [${capabilities.sandbox.mode}]` : "POLLING..."} 
            statusColor="neon-amber" glowClass="glow-amber" 
            detail={capabilities?.sandbox ? { message: capabilities.sandbox.error_message || "Sandbox active.", action: capabilities.sandbox.action, evidence: capabilities.sandbox.evidence } : undefined}
          />
          <SubsystemCard 
            icon="🛡️" label="AIR-GAP STATUS" 
            status={capabilities ? (capabilities.network.status === "degraded" ? "UNVERIFIED [No PCAP]" : "SOVEREIGN [Loopback Only]") : "POLLING..."} 
            statusColor={capabilities?.network.status === 'degraded' ? "neon-amber" : "neon-emerald"} glowClass={capabilities?.network.status === 'degraded' ? "glow-amber" : "glow-emerald"} 
            detail={capabilities?.network ? { message: capabilities.network.error_message || "Air-gap verification active.", action: capabilities.network.action, evidence: capabilities.network.evidence } : undefined}
          />
          <SubsystemCard 
            icon="📊" label="NET MONITOR" 
            status={capabilities ? (capabilities.network.mode || "psutil_only") : "POLLING..."} 
            statusColor="neon-amber" 
          />
          <SubsystemCard 
            icon="🔧" label="GPU" 
            status={capabilities ? capabilities.gpu.status : "POLLING..."} 
            statusColor={capabilities?.gpu.status === 'available' ? 'neon-emerald' : 'neon-amber'} 
            detail={capabilities?.gpu ? { message: capabilities.gpu.error_message || "GPU acceleration active.", action: capabilities.gpu.action, evidence: capabilities.gpu.evidence } : undefined}
          />
        </div>
      </div>

      {/* Agent Graph DAG */}
      <div className="relative z-10 border-t border-zinc-800/60 pt-3 flex-1">
        <h2 className="text-zinc-500 text-[9px] font-mono uppercase tracking-[0.2em] mb-2 flex justify-between items-center">
          <span>Agent Graph DAG</span>
          <span className="text-[7px] text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded">LangGraph FSM</span>
        </h2>
        <AgentDag onNodeSelect={setSelectedNode} />
      </div>

      {/* Slide-over Drilldown Drawer */}
      <div 
        className={`absolute inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${selectedNode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setSelectedNode(null)}
      />
      <div className={`absolute inset-y-0 left-0 w-full z-50 transform transition-transform duration-300 ${selectedNode ? 'translate-x-0' : '-translate-x-full'}`}>
        <NodeDrilldownDrawer nodeId={selectedNode} onClose={() => setSelectedNode(null)} />
      </div>
    </aside>
  );
};
