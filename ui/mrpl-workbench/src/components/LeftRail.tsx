// components/LeftRail.tsx — Core Matrix + Subsystem Status + Agent DAG
import React, { useEffect, useRef } from "react";
import { useSettingsStore } from "../store/settingsStore";
import { CapabilityBadge } from "./CapabilityBadge";
import { AgentDag } from "./AgentDag";
import { useAgentStore } from "../store/agentStore";
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

  useEffect(() => {
    const ctx = gsap.context(() => {
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

      if (runStatus === "running") {
        // Active: accelerate rings, change core color, add glow
        gsap.to(coreRef.current, {
          scale: 1.25,
          fill: "#ff0055",
          duration: 0.3,
          ease: "power2.out",
        });
        gsap.to(ring1Ref.current, { duration: 3, repeat: -1, ease: "none", overwrite: true, rotation: "+=360", stroke: "#00f0ff", strokeWidth: 1.5 });
        gsap.to(ring2Ref.current, { duration: 2, repeat: -1, ease: "none", overwrite: true, rotation: "-=360", stroke: "#ff0055", strokeWidth: 2.5 });
        gsap.to(ring3Ref.current, { duration: 4, repeat: -1, ease: "none", overwrite: true, rotation: "+=360", stroke: "#00ff66", strokeWidth: 1 });
      } else {
        // Idle: reset colors
        gsap.to(coreRef.current, { scale: 1, fill: "#00f0ff", duration: 1, ease: "power1.inOut" });
        gsap.to(ring1Ref.current, { stroke: "#00f0ff", strokeWidth: 1, duration: 1 });
        gsap.to(ring2Ref.current, { stroke: "#0044aa", strokeWidth: 2, duration: 1 });
        gsap.to(ring3Ref.current, { stroke: "#00f0ff", strokeWidth: 0.5, duration: 1 });
      }
    });
    return () => ctx.revert();
  }, [runStatus]);

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center p-4 rounded-xl glass-panel relative overflow-hidden group">
      <div className="absolute inset-0 grid-overlay"></div>
      <div className="relative z-10 w-28 h-28 mb-3">
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          {/* Outer ring - dashed */}
          <circle ref={ring1Ref} cx="50" cy="50" r="44" fill="none" stroke="#00f0ff" strokeWidth="1" strokeDasharray="3 7 1 7" opacity="0.5" />
          {/* Middle ring - heavier */}
          <circle ref={ring2Ref} cx="50" cy="50" r="34" fill="none" stroke="#0044aa" strokeWidth="2" strokeDasharray="12 4 2 4" opacity="0.7" />
          {/* Inner ring - dotted */}
          <circle ref={ring3Ref} cx="50" cy="50" r="24" fill="none" stroke="#00f0ff" strokeWidth="0.5" strokeDasharray="1 5" opacity="0.4" />
          {/* Orbiting particles */}
          {[0, 1, 2, 3, 4, 5].map(i => (
            <circle
              key={i}
              ref={el => { particlesRef.current[i] = el; }}
              cx={50 + 34}
              cy={50}
              r={1.5 - i * 0.1}
              fill={i % 2 === 0 ? "#00f0ff" : "#00ff66"}
              opacity={0.6 + i * 0.05}
            />
          ))}
          {/* Radial gradient glow behind core */}
          <defs>
            <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="20" fill="url(#coreGlow)" />
          {/* Central core */}
          <circle ref={coreRef} cx="50" cy="50" r="12" fill="#00f0ff" style={{ filter: "drop-shadow(0 0 12px rgba(0,240,255,0.7))" }} />
        </svg>
      </div>
      <div className="text-[9px] font-mono text-neon-cyan tracking-[0.2em] uppercase relative z-10">
        {runStatus === "running" ? "⟨ PROCESSING ⟩" : "⟨ AWAITING INPUT ⟩"}
      </div>
      {latencyMs != null && latencyMs > 0 && runStatus !== "running" && (
        <div className="latency-badge mt-2 relative z-10">
          {(latencyMs / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  );
};

/* ─── Subsystem Status Card ─── */
function SubsystemCard({ icon, label, status, statusColor = "neon-cyan", glowClass = "" }: {
  icon: string; label: string; status: string; statusColor?: string; glowClass?: string;
}) {
  return (
    <div className={`glass-panel rounded-lg p-2.5 flex items-center justify-between transition-all duration-300 hover:border-${statusColor}/40 ${glowClass}`}>
      <div className={`flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.15em] text-${statusColor}`}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`text-[8px] font-mono font-bold text-${statusColor} bg-${statusColor}/10 px-2 py-0.5 rounded border border-${statusColor}/20`}>
        {status}
      </div>
    </div>
  );
}

/* ─── Main LeftRail ─── */
export const LeftRail: React.FC = () => {
  const { graphInfo } = useSettingsStore();

  const visionProbe = (graphInfo?.vision_probe as Record<string, string> | undefined) ?? {};
  const visionStatus = visionProbe.status ?? "VISION_UNAVAILABLE";

  return (
    <aside className="left-rail flex flex-col gap-4 w-72 min-w-[18rem] p-4 bg-cyber-obsidian border-r border-zinc-800/80 overflow-y-auto relative z-0 shadow-[4px_0_24px_rgba(0,0,0,0.3)]">
      <div className="absolute inset-0 scanlines opacity-15 mix-blend-overlay"></div>

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
          <SubsystemCard icon="🧠" label="COGNITIVE ENGINE" status="ACTIVE [DeepSeek-R1 1.5B]" statusColor="neon-cyan" />
          <SubsystemCard icon="👁️" label="OPTICAL SENSOR" status="READY [Qwen2.5-VL 3B]" statusColor="neon-emerald" />
          <SubsystemCard icon="⚡" label="EXEC SANDBOX" status="DEGRADED [AST Only]" statusColor="neon-amber" glowClass="glow-amber" />
          <SubsystemCard icon="🛡️" label="AIR-GAP STATUS" status="SOVEREIGN [Loopback Only]" statusColor="neon-emerald" glowClass="glow-emerald" />
          <SubsystemCard icon="📊" label="NET MONITOR" status="PSUTIL ONLY" statusColor="neon-amber" />
          <SubsystemCard icon="🔧" label="GPU" status="CPU FALLBACK" statusColor="neon-amber" />
        </div>
      </div>

      {/* Agent Graph DAG */}
      <div className="relative z-10 border-t border-zinc-800/60 pt-3 flex-1">
        <h2 className="text-zinc-500 text-[9px] font-mono uppercase tracking-[0.2em] mb-2 flex justify-between items-center">
          <span>Agent Graph DAG</span>
          <span className="text-[7px] text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded">LangGraph FSM</span>
        </h2>
        <AgentDag />
      </div>
    </aside>
  );
};
