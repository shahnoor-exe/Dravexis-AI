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

// Node state → visual style with Cyberpunk aesthetic
const NODE_STYLES: Record<NodeState, React.CSSProperties> = {
  idle: { background: "rgba(24, 24, 27, 0.8)", border: "1px solid rgba(82, 82, 91, 0.5)", color: "#a1a1aa", backdropFilter: "blur(4px)" },
  active: { background: "rgba(0, 240, 255, 0.1)", border: "1px solid rgba(0, 240, 255, 0.8)", color: "#00f0ff", animation: "pulse 1s infinite", boxShadow: "0 0 20px #00f0ff", backdropFilter: "blur(4px)", fontWeight: "bold" },
  success: { background: "rgba(0, 255, 102, 0.1)", border: "1px solid rgba(0, 255, 102, 0.8)", color: "#00ff66", boxShadow: "0 0 10px #00ff66", backdropFilter: "blur(4px)" },
  skipped: { background: "rgba(28, 25, 23, 0.8)", border: "1px dashed rgba(87, 83, 78, 0.5)", color: "#78716c", backdropFilter: "blur(4px)" },
  unavailable: { background: "rgba(255, 153, 0, 0.1)", border: "1px solid rgba(255, 153, 0, 0.5)", color: "#ff9900", backdropFilter: "blur(4px)" },
  error: { background: "rgba(255, 0, 85, 0.1)", border: "1px solid rgba(255, 0, 85, 0.8)", color: "#ff0055", boxShadow: "0 0 15px rgba(255, 0, 85, 0.4)", backdropFilter: "blur(4px)" },
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
  { id: "e-retrieve-vision", source: "retrieve", target: "vision", animated: false, style: { stroke: "rgba(87, 83, 78, 0.5)" } },
  { id: "e-retrieve-codegen", source: "retrieve", target: "codegen", animated: false },
  { id: "e-vision-compile", source: "vision", target: "compile_result", animated: false, style: { stroke: "rgba(87, 83, 78, 0.5)" } },
  { id: "e-codegen-sandbox", source: "codegen", target: "sandbox_exec", animated: false },
  { id: "e-sandbox-reflect", source: "sandbox_exec", target: "reflect", animated: false },
  { id: "e-reflect-compile", source: "reflect", target: "compile_result", animated: false },
  { id: "e-reflect-codegen", source: "reflect", target: "codegen", animated: false, style: { stroke: "#ff9900", strokeDasharray: "4" } },
];

export const AgentDag: React.FC = () => {
  const { nodeStates, visionStatus } = useAgentStore();

  const nodes = useMemo(() =>
    DAG_NODES.map((n) => ({
      ...n,
      style: { ...NODE_STYLES[nodeStates[n.id] ?? "idle"], borderRadius: 6, padding: "8px 14px", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em", minWidth: 130, textAlign: "center" as const, transition: "all 0.3s ease" },
    })),
    [nodeStates]
  );

  // Animate active edges with glowing stroke
  const edges = useMemo(() =>
    DAG_EDGES.map((e) => ({
      ...e,
      animated: nodeStates[e.target] === "active",
      style: nodeStates[e.target] === "active" 
        ? { stroke: "#00f0ff", strokeWidth: 2, filter: "drop-shadow(0 0 5px rgba(0,240,255,0.5))" } 
        : { ...e.style, stroke: "rgba(82, 82, 91, 0.6)" },
    })),
    [nodeStates]
  );

  return (
    <div style={{ height: 500, background: "rgba(5, 8, 17, 0.5)", borderRadius: 8, border: "1px solid rgba(39, 39, 42, 0.5)", overflow: "hidden", position: "relative" }}>
      <div className="absolute inset-0 scanlines opacity-30 mix-blend-overlay pointer-events-none"></div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={true}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(0, 240, 255, 0.05)" gap={20} size={1} />
        <Controls showInteractive={false} style={{ display: 'none' }} />
      </ReactFlow>
      {/* Vision status label */}
      {visionStatus === "VISION_UNAVAILABLE" && (
        <div className="absolute bottom-0 w-full text-[9px] text-neon-amber font-mono text-center py-1.5 bg-black/80 border-t border-neon-amber/20 z-10 backdrop-blur-md uppercase tracking-widest">
          ⚠ Vision Sensor Offline
        </div>
      )}
    </div>
  );
};
