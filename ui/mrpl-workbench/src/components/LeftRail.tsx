// components/LeftRail.tsx — Model status cards + agent DAG legend + Avatar
import React, { useEffect, useRef } from "react";
import { useSettingsStore } from "../store/settingsStore";
import { CapabilityBadge } from "./CapabilityBadge";
import { AgentDag } from "./AgentDag";
import { useAgentStore } from "../store/agentStore";
import gsap from "gsap";

function ModelCard({ role, status }: { role: string; status: string }) {
  const isAvailable = status !== "UNAVAILABLE";
  return (
    <div className={`border rounded-lg p-3 transition-colors ${isAvailable ? "bg-zinc-900/80 border-neon-cyan/30" : "bg-zinc-900/40 border-zinc-800"}`}>
      <div className={`text-[10px] uppercase tracking-widest mb-1.5 ${isAvailable ? "text-neon-cyan" : "text-zinc-500"}`}>{role} Model</div>
      <CapabilityBadge label={role} status={status} />
    </div>
  );
}

const AvatarChamber: React.FC = () => {
  const { runStatus } = useAgentStore();
  const ring1Ref = useRef<SVGCircleElement>(null);
  const ring2Ref = useRef<SVGCircleElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Idle breathing
      gsap.to(coreRef.current, { scale: 1.05, opacity: 0.8, duration: 2, yoyo: true, repeat: -1, ease: "sine.inOut" });
      gsap.to(ring1Ref.current, { rotation: 360, duration: 20, repeat: -1, ease: "linear", transformOrigin: "center" });
      gsap.to(ring2Ref.current, { rotation: -360, duration: 25, repeat: -1, ease: "linear", transformOrigin: "center" });

      if (runStatus === "running") {
        // Active thinking state
        gsap.to(coreRef.current, { scale: 1.2, filter: "drop-shadow(0 0 20px #ff0055)", fill: "#ff0055", duration: 0.3, ease: "power2.out" });
        gsap.to(ring1Ref.current, { rotation: "+=360", duration: 2, repeat: -1, ease: "none", stroke: "#00f0ff" });
        gsap.to(ring2Ref.current, { rotation: "-=360", duration: 1.5, repeat: -1, ease: "none", stroke: "#ff0055" });
      } else {
        // Return to idle
        gsap.to(coreRef.current, { scale: 1, filter: "drop-shadow(0 0 10px #00f0ff)", fill: "#00f0ff", duration: 1 });
        gsap.to(ring1Ref.current, { stroke: "#00f0ff", duration: 1 });
        gsap.to(ring2Ref.current, { stroke: "#0066ff", duration: 1 });
      }
    });
    return () => ctx.revert();
  }, [runStatus]);

  return (
    <div className="flex flex-col items-center justify-center p-4 border border-zinc-800 rounded-xl bg-cyber-bg relative overflow-hidden group">
      <div className="absolute inset-0 scanlines opacity-50"></div>
      <div className="relative z-10 w-24 h-24 mb-3">
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          <circle ref={ring1Ref} cx="50" cy="50" r="40" fill="none" stroke="#00f0ff" strokeWidth="1" strokeDasharray="4 8" opacity="0.6" />
          <circle ref={ring2Ref} cx="50" cy="50" r="30" fill="none" stroke="#0066ff" strokeWidth="2" strokeDasharray="10 5 2 5" opacity="0.8" />
          <circle ref={coreRef} cx="50" cy="50" r="15" fill="#00f0ff" style={{ filter: "drop-shadow(0 0 10px #00f0ff)" }} />
        </svg>
      </div>
      <div className="text-[10px] font-mono text-neon-cyan tracking-widest uppercase relative z-10">
        {runStatus === "running" ? "PROCESSING..." : "AWAITING INPUT"}
      </div>
    </div>
  );
};

export const LeftRail: React.FC = () => {
  const { graphInfo } = useSettingsStore();

  const visionProbe = (graphInfo?.vision_probe as Record<string, string> | undefined) ?? {};
  const visionStatus = visionProbe.status ?? "VISION_UNAVAILABLE";
  const checkpointAvail = (graphInfo?.checkpoint as { available?: boolean } | undefined)?.available;

  return (
    <aside className="flex flex-col gap-5 w-72 min-w-[18rem] p-5 bg-cyber-obsidian border-r border-zinc-800/80 overflow-y-auto relative z-0 shadow-[4px_0_24px_rgba(0,0,0,0.3)]">
      <div className="absolute inset-0 scanlines opacity-20 mix-blend-overlay"></div>
      
      <div className="relative z-10">
        <h2 className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-neon-cyan rounded-full animate-pulse"></span>
          Core Matrix
        </h2>
        <AvatarChamber />
      </div>

      <div className="relative z-10 border-t border-zinc-800/80 pt-4">
        <h2 className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-3">Subsystems</h2>
        <div className="flex flex-col gap-2">
          <ModelCard role="Reasoning" status="UNAVAILABLE" />
          <ModelCard role="Vision" status={visionStatus} />
          <ModelCard role="Code" status="UNAVAILABLE" />
        </div>
      </div>

      <div className="relative z-10 border-t border-zinc-800/80 pt-4">
        <h2 className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-3">Security & Auth</h2>
        <div className="flex flex-col gap-2">
          <CapabilityBadge label="Sandbox" status="DEGRADED_SANDBOX" />
          <CapabilityBadge label="Checkpoint" status={checkpointAvail ? "AVAILABLE" : "UNAVAILABLE"} />
        </div>
      </div>

      <div className="relative z-10 border-t border-zinc-800/80 pt-4 flex-1">
        <h2 className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-3 flex justify-between items-center">
          <span>Agent Graph DAG</span>
          <span className="text-[8px] text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded">FSM</span>
        </h2>
        <AgentDag />
      </div>
    </aside>
  );
};
