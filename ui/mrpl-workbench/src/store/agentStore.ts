// store/agentStore.ts — Zustand store for agent run state.
import { create } from "zustand";
import type { AgentRunResponse, EvidenceChunk, AgentEvent } from "../lib/api";
import type { NodeState } from "../lib/constants";
import { AGENT_NODES } from "../lib/constants";

export type RunStatus = "idle" | "validating" | "routing" | "retrieving" | "loading_model" | "generating" | "awaiting_approval" | "completed" | "partial" | "failed" | "disconnected" | "cancelled" | "hitl_awaiting";
export type HitlState = "none" | "awaiting_approval" | "approved" | "edited" | "rejected" | "rolled_back" | "expired";

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
  error: { code: string; message: string } | string | null;
  uploadedImagePath: string | null;
  intentOverride: string | null;

  // HITL
  hitlEnabled: boolean;
  hitlState: HitlState;
  hitlCode: string | null;
  hitlInputs: Record<string, unknown> | null;

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
  setUploadedImagePath: (path: string | null) => void;
  setSessionId: (id: string | null) => void;
  setIntentOverride: (intent: string | null) => void;
  setHitlEnabled: (enabled: boolean) => void;
  setHitlState: (state: HitlState) => void;
  setHitlCode: (code: string) => void;
  triggerHitlMock: () => void;
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
  uploadedImagePath: null,
  intentOverride: null,
  hitlEnabled: false,
  hitlState: "none",
  hitlCode: null,
  hitlInputs: null,

  setQuery: (q) => set({ query: q }),
  setUploadedImagePath: (path) => set({ uploadedImagePath: path }),
  setSessionId: (id) => set({ sessionId: id }),
  setIntentOverride: (intent) => set({ intentOverride: intent }),
  setHitlEnabled: (enabled) => set({ hitlEnabled: enabled }),
  setHitlState: (state) => set({ hitlState: state }),
  setHitlCode: (code) => set({ hitlCode: code, hitlState: "edited" }),
  
  triggerHitlMock: () => set({
    runStatus: "hitl_awaiting",
    hitlState: "awaiting_approval",
    hitlCode: "import math\ncorrosion_rate_mm_per_year = 0.3\nactual_thickness_mm = 8.5\nmin_required_mm = 6.0\nremaining_life_years = (actual_thickness_mm - min_required_mm) / corrosion_rate_mm_per_year\nprint(f'Remaining life: {remaining_life_years:.1f} years')\n",
    hitlInputs: { "corrosion_rate_mm_per_year": 0.3, "actual_thickness_mm": 8.5, "min_required_mm": 6.0 }
  }),

  startRun: (sessionId) =>
    set({
      runStatus: "validating",
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
      hitlState: "none",
      hitlCode: null,
      hitlInputs: null,
      // intentionally preserving uploadedImagePath so the run can use it
    }),

  completeRun: (response) =>
    set((state) => {
      // Merge unique events based on run_id and event_id
      const newEvents = response.events || [];
      const currentEvents = state.events;
      const combined = [...currentEvents];
      
      for (const ne of newEvents) {
        if (!combined.some(ce => ce.event_id === ne.event_id && ce.run_id === ne.run_id)) {
          combined.push(ne);
        }
      }

      return {
        runStatus: response.status,
        intent: response.intent,
        confidence: response.confidence,
        finalAnswer: response.answer,
        error: response.error,
        evidence: response.retrieved_evidence,
        events: combined,
        nodeStates: computeNodeStates(combined, response.vision_status),
        visionStatus: response.vision_status,
        sandboxMode: response.sandbox_mode,
        codeStatus: response.code_status,
        activeModel: response.model_role,
        latencyMs: response.latency_ms,
        lastResponse: response,
      };
    }),

  failRun: (error) =>
    set({
      runStatus: "failed",
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
      uploadedImagePath: null,
    }),
}));
