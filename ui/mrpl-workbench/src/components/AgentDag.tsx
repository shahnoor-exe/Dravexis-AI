// components/AgentDag.tsx — React Flow agent DAG driven strictly by events[] from backend
import React, { useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import { useAgentStore } from "../store/agentStore";
import type { NodeState } from "../lib/constants";

// Node state → visual style
const NODE_STYLES: Record<NodeState, React.CSSProperties> = {
  idle: { background: "#27272a", border: "1px solid #52525b", color: "#a1a1aa" },
  active: { background: "#1e3a5f", border: "2px solid #3b82f6", color: "#93c5fd", animation: "pulse 1s infinite" },
  success: { background: "#14532d", border: "1px solid #22c55e", color: "#86efac" },
  skipped: { background: "#1c1917", border: "1px dashed #57534e", color: "#78716c" },
  unavailable: { background: "#450a0a", border: "1px solid #dc2626", color: "#fca5a5" },
  error: { background: "#450a0a", border: "2px solid #ef4444", color: "#f87171" },
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
  { id: "e-retrieve-vision", source: "retrieve", target: "vision", animated: false, style: { stroke: "#57534e" } },
  { id: "e-retrieve-codegen", source: "retrieve", target: "codegen", animated: false },
  { id: "e-vision-compile", source: "vision", target: "compile_result", animated: false, style: { stroke: "#57534e" } },
  { id: "e-codegen-sandbox", source: "codegen", target: "sandbox_exec", animated: false },
  { id: "e-sandbox-reflect", source: "sandbox_exec", target: "reflect", animated: false },
  { id: "e-reflect-compile", source: "reflect", target: "compile_result", animated: false },
  { id: "e-reflect-codegen", source: "reflect", target: "codegen", animated: false, style: { stroke: "#f59e0b", strokeDasharray: "4" } },
];

export const AgentDag: React.FC = () => {
  const { nodeStates, visionStatus } = useAgentStore();

  const nodes = useMemo(() =>
    DAG_NODES.map((n) => ({
      ...n,
      style: { ...NODE_STYLES[nodeStates[n.id] ?? "idle"], borderRadius: 8, padding: "6px 12px", fontSize: 12, minWidth: 120, textAlign: "center" as const },
    })),
    [nodeStates]
  );

  // Animate active edges
  const edges = useMemo(() =>
    DAG_EDGES.map((e) => ({
      ...e,
      animated: nodeStates[e.target] === "active",
    })),
    [nodeStates]
  );

  return (
    <div style={{ height: 540, background: "#18181b", borderRadius: 8, border: "1px solid #27272a" }}>
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
        <Background color="#27272a" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {/* Vision status label */}
      {visionStatus === "VISION_UNAVAILABLE" && (
        <div className="text-[10px] text-red-400 text-center py-1 border-t border-zinc-800">
          Vision: VISION_UNAVAILABLE — VL model not loaded
        </div>
      )}
    </div>
  );
};
