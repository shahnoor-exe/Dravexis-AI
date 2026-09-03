// lib/constants.ts — Single source of truth for all backend endpoints.
// NEVER let user input become an arbitrary URL. All calls go through api.ts only.

export const BACKEND_URL = "http://127.0.0.1:8080" as const;
export const LLAMA_URL = "http://127.0.0.1:8080" as const;

export const API = {
  health: `${BACKEND_URL}/`,
  chat: `${BACKEND_URL}/chat`,
  ingest: `${BACKEND_URL}/ingest`,
  networkStatus: `${BACKEND_URL}/network-status`,
  agentRun: `${BACKEND_URL}/agent/run`,
  agentRouterInfo: `${BACKEND_URL}/agent/router-info`,
  agentGraphInfo: `${BACKEND_URL}/agent/graph-info`,
  artifactGenerate: `${BACKEND_URL}/artifacts/generate`,
  artifactGenerateAll: `${BACKEND_URL}/artifacts/generate-all`,
  artifactList: `${BACKEND_URL}/artifacts/list`,
  artifactDownload: (name: string) => `${BACKEND_URL}/artifacts/download/${encodeURIComponent(name)}`,
  networkMonitor: `${BACKEND_URL}/network/monitor`,
  networkMonitorSummary: `${BACKEND_URL}/network/monitor/summary`,
} as const;

export const REFINERY_CONTEXTS = ["CDU", "Hydrocracker", "FCC"] as const;
export const OPERATOR_ROLES = ["Engineer", "Safety Officer"] as const;

export const AGENT_NODES = [
  "plan", "retrieve", "vision", "codegen", "sandbox_exec", "reflect", "compile_result",
] as const;

export type NodeState = "idle" | "active" | "success" | "skipped" | "unavailable" | "error";
export type ConnectionStatus = "CONNECTED" | "DISCONNECTED" | "DEGRADED";
