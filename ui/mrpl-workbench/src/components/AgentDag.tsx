// components/AgentDag.tsx — React Flow agent DAG driven strictly by events[] from backend
import React, { useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
} from "reactflow";
import "reactflow/dist/style.css";
import { useAgentStore } from "../store/agentStore";
import type { NodeState } from "../lib/constants";

// Node state → visual style with Cyberpunk aesthetic (Tailwind)
const NODE_CLASSES: Record<NodeState, string> = {
  idle: "bg-slate-50/90 dark:bg-[#121926]/80 border border-slate-300 dark:border-slate-500/50 text-slate-500 dark:text-slate-400 backdrop-blur-sm shadow-sm dark:shadow-none",
  active: "bg-cyan-50/90 dark:bg-[#20e3ff]/10 border border-cyan-400 dark:border-[#20e3ff]/80 text-cyan-600 dark:text-[#20e3ff] font-bold backdrop-blur-sm shadow-[0_0_15px_rgba(32,227,255,0.3)] animate-pulse",
  success: "bg-emerald-50/90 dark:bg-[#38e6a5]/10 border border-emerald-400 dark:border-[#38e6a5]/80 text-emerald-600 dark:text-[#38e6a5] backdrop-blur-sm shadow-sm dark:shadow-[0_0_10px_rgba(56,230,165,0.2)]",
  skipped: "bg-slate-50/90 dark:bg-[#121926]/80 border border-dashed border-slate-300 dark:border-slate-500/50 text-slate-500 dark:text-slate-400 backdrop-blur-sm shadow-sm dark:shadow-none",
  unavailable: "bg-amber-50/90 dark:bg-[#ffb547]/10 border border-amber-400 dark:border-[#ffb547]/50 text-amber-600 dark:text-[#ffb547] backdrop-blur-sm shadow-sm dark:shadow-none",
  error: "bg-pink-50/90 dark:bg-[#ff3ea5]/10 border border-pink-400 dark:border-[#ff3ea5]/80 text-pink-600 dark:text-[#ff3ea5] backdrop-blur-sm shadow-[0_0_15px_rgba(255,62,165,0.3)]",
};

const NODE_LABELS: Record<string, string> = {
  plan: "📋 Plan",
  retrieve: "🔍 Retrieve",
  vision: "👁 Vision",
  codegen: "🖥 CodeGen",
  sandbox_exec: "⚙ Sandbox",
  reflect: "🔄 Reflect",
  compile_result: "✅ Compile",
};

const DAG_NODES: Node[] = [
  { id: "plan", position: { x: 250, y: 0 }, data: { label: NODE_LABELS.plan }, style: {} },
  { id: "retrieve", position: { x: 250, y: 90 }, data: { label: NODE_LABELS.retrieve }, style: {} },
  { id: "vision", position: { x: 50, y: 180 }, data: { label: NODE_LABELS.vision }, style: {} },
  { id: "codegen", position: { x: 250, y: 180 }, data: { label: NODE_LABELS.codegen }, style: {} },
  { id: "sandbox_exec", position: { x: 250, y: 270 }, data: { label: NODE_LABELS.sandbox_exec }, style: {} },
  { id: "reflect", position: { x: 250, y: 360 }, data: { label: NODE_LABELS.reflect }, style: {} },
  { id: "compile_result", position: { x: 250, y: 450 }, data: { label: NODE_LABELS.compile_result }, style: {} },
];

const DAG_EDGES: Edge[] = [
  { id: "e-plan-retrieve", source: "plan", target: "retrieve", animated: false },
  { id: "e-retrieve-vision", source: "retrieve", target: "vision", animated: false, style: { stroke: "rgba(113, 128, 150, 0.5)" } },
  { id: "e-retrieve-codegen", source: "retrieve", target: "codegen", animated: false },
  { id: "e-vision-compile", source: "vision", target: "compile_result", animated: false, style: { stroke: "rgba(113, 128, 150, 0.5)" } },
  { id: "e-codegen-sandbox", source: "codegen", target: "sandbox_exec", animated: false },
  { id: "e-sandbox-reflect", source: "sandbox_exec", target: "reflect", animated: false },
  { id: "e-reflect-compile", source: "reflect", target: "compile_result", animated: false },
  { id: "e-reflect-codegen", source: "reflect", target: "codegen", animated: false, style: { stroke: "#FFB547", strokeDasharray: "4" } },
];

export const AgentDag: React.FC<{ onNodeSelect?: (nodeId: string) => void }> = ({ onNodeSelect }) => {
  const { nodeStates, visionStatus } = useAgentStore();

  const nodes = useMemo(() =>
    DAG_NODES.map((n) => ({
      ...n,
      className: `${NODE_CLASSES[nodeStates[n.id] ?? "idle"]} rounded-sm px-3.5 py-2 text-[11px] font-mono uppercase tracking-[0.05em] min-w-[130px] text-center transition-all duration-300`,
    })),
    [nodeStates]
  );

  // Animate active edges with glowing stroke
  const edges = useMemo(() =>
    DAG_EDGES.map((e) => ({
      ...e,
      animated: nodeStates[e.target] === "active",
      style: nodeStates[e.target] === "active" 
        ? { stroke: "#20E3FF", strokeWidth: 2, filter: "drop-shadow(0 0 5px rgba(32,227,255,0.5))" } 
        : { ...e.style, stroke: "rgba(113, 128, 150, 0.6)" },
    })),
    [nodeStates]
  );

  return (
    <div className="h-[500px] bg-slate-50 dark:bg-[#070a0f]/50 rounded-sm border border-slate-200 dark:border-slate-500/20 overflow-hidden relative transition-colors duration-400">
      <div className="absolute inset-0 scanlines opacity-5 dark:opacity-30 mix-blend-overlay pointer-events-none transition-opacity duration-400"></div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        onNodeClick={(_, node) => onNodeSelect?.(node.id)}
        panOnDrag={true}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(32, 227, 255, 0.05)" gap={20} size={1} />
        <Controls showInteractive={false} style={{ display: 'none' }} />
      </ReactFlow>
      {/* Vision status label */}
      {visionStatus === "VISION_UNAVAILABLE" && (
        <div className="absolute bottom-0 w-full text-[9px] text-amber-700 dark:text-neon-amber font-mono text-center py-1.5 bg-amber-50/90 dark:bg-black/80 border-t border-amber-300 dark:border-neon-amber/20 z-10 backdrop-blur-md uppercase tracking-widest transition-colors duration-400">
          ⚠ Vision Sensor Offline
        </div>
      )}
    </div>
  );
};
