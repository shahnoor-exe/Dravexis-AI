// store/agentStore.ts — Zustand store for agent run state.
import { create } from "zustand";
import type { AgentRunResponse, EvidenceChunk, AgentEvent } from "../lib/api";
import type { NodeState } from "../lib/constants";
import { AGENT_NODES } from "../lib/constants";

export type RunStatus = "idle" | "running" | "success" | "error" | "partial";

type NodeStates = Record<string, NodeState>;

function computeNodeStates(events: AgentEvent[], visionStatus: string): NodeStates {
  const states: NodeStates = {};
  for (const n of AGENT_NODES) states[n] = "idle";

  for (const ev of events) {
    const node = ev.node as string;
    const event = ev.event as string;
    if (!node) continue;
    if (event === "enter") states[node] = "active";
    else if (event === "exit") {
      if (ev.error || ev.status === "error") states[node] = "error";
      else if (ev.skipped || ev.status === "skipped") states[node] = "skipped";
      else if (ev.status === "VISION_UNAVAILABLE" || ev.status === "unavailable") states[node] = "unavailable";
      else states[node] = "success";
    }
  }

  // Vision: if no image supplied vs capability unavailable
  if (states["vision"] === "idle") {
    if (visionStatus === "VISION_UNAVAILABLE") states["vision"] = "unavailable";
    else states["vision"] = "skipped";
  }

  return states;
}

type AgentStore = {
  // Run state
  runStatus: RunStatus;
  sessionId: string | null;
  query: string;
  intent: string | null;
  confidence: number | null;
  finalAnswer: string | null;
  error: string | null;

  // Evidence
  evidence: EvidenceChunk[];

  // Audit trace
  events: AgentEvent[];
  nodeStates: NodeStates;

  // Capability labels
  visionStatus: string;
  sandboxMode: string;
  codeStatus: string;
  activeModel: string | null;
  latencyMs: number | null;

  // Artifacts
  lastResponse: AgentRunResponse | null;

  // Actions
  setQuery: (q: string) => void;
  startRun: (sessionId: string) => void;
  completeRun: (response: AgentRunResponse) => void;
  failRun: (error: string) => void;
  reset: () => void;
};

const INITIAL_NODE_STATES: NodeStates = Object.fromEntries(
  AGENT_NODES.map((n) => [n, "idle" as NodeState])
);

export const useAgentStore = create<AgentStore>((set) => ({
  runStatus: "idle",
  sessionId: null,
  query: "",
  intent: null,
  confidence: null,
  finalAnswer: null,
  error: null,
  evidence: [],
  events: [],
  nodeStates: { ...INITIAL_NODE_STATES },
  visionStatus: "VISION_UNAVAILABLE",
  sandboxMode: "not_run",
  codeStatus: "not_requested",
  activeModel: null,
  latencyMs: null,
  lastResponse: null,

  setQuery: (q) => set({ query: q }),

  startRun: (sessionId) =>
    set({
      runStatus: "running",
      sessionId,
      intent: null,
      confidence: null,
      finalAnswer: null,
      error: null,
      evidence: [],
      events: [],
      nodeStates: { ...INITIAL_NODE_STATES },
      visionStatus: "VISION_UNAVAILABLE",
      sandboxMode: "not_run",
      codeStatus: "not_requested",
      activeModel: null,
      latencyMs: null,
      lastResponse: null,
    }),

  completeRun: (response) =>
    set({
      runStatus: response.status === "ok" ? "success" : response.status === "partial" ? "partial" : "error",
      intent: response.intent,
      confidence: response.confidence,
      finalAnswer: response.final_answer,
      error: response.error,
      evidence: response.retrieved_evidence,
      events: response.events,
      nodeStates: computeNodeStates(response.events, response.vision_status),
      visionStatus: response.vision_status,
      sandboxMode: response.sandbox_mode,
      codeStatus: response.code_status,
      activeModel: response.active_model,
      latencyMs: response.total_latency_ms,
      lastResponse: response,
    }),

  failRun: (error) =>
    set({
      runStatus: "error",
      error,
      finalAnswer: null,
    }),

  reset: () =>
    set({
      runStatus: "idle",
      sessionId: null,
      query: "",
      intent: null,
      confidence: null,
      finalAnswer: null,
      error: null,
      evidence: [],
      events: [],
      nodeStates: { ...INITIAL_NODE_STATES },
      visionStatus: "VISION_UNAVAILABLE",
      sandboxMode: "not_run",
      codeStatus: "not_requested",
      activeModel: null,
      latencyMs: null,
      lastResponse: null,
    }),
}));
