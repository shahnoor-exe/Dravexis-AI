// lib/api.ts — All backend HTTP calls. Single boundary: no other file calls fetch directly.
// Input validation: only approved endpoint keys accepted; no user-supplied URLs.

import { API } from "./constants";

export type AgentRunRequest = {
  query: string;
  session_id?: string;
  image_path?: string | null;
  intent_override?: string | null;
};

export type EvidenceChunk = {
  doc_id: string;
  chunk_index: number;
  score: number;
  text_preview: string;
};

export type AgentEvent = {
  node: string;
  event: string;
  timestamp?: number;
  [key: string]: unknown;
};

export type AgentRunResponse = {
  session_id: string;
  status: "ok" | "error" | "partial";
  intent: string;
  confidence: number;
  method: string;
  events: AgentEvent[];
  retrieved_evidence: EvidenceChunk[];
  vision_status: string;
  code_status: string;
  sandbox_mode: string;
  iteration: number;
  final_answer: string | null;
  error: string | null;
  active_model: string | null;
  model_switch_latency_ms: number | null;
  total_latency_ms: number;
};

export type ArtifactRequest = {
  type: "docx" | "xlsx" | "pptx";
  query: string;
  evidence: EvidenceChunk[];
  session_id?: string;
  model_role?: string | null;
  label?: string;
  vision_status?: string;
  sandbox_mode?: string;
};

export type ArtifactResponse = {
  status: string;
  type: string;
  file_name?: string;
  file_path?: string;
  provenance?: Record<string, unknown>;
  error?: string;
};

export type NetworkSummary = {
  monitor_capability: string;
  bytes_sent_delta: number | null;
  bytes_recv_delta: number | null;
  egress_note: string;
  service_health: Record<string, string>;
  packet_capture: string;
  timestamp_utc: number;
};

async function _fetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => _fetch<{ status: string; phase: number }>(API.health),

  agentRun: (req: AgentRunRequest) =>
    _fetch<AgentRunResponse>(API.agentRun, {
      method: "POST",
      body: JSON.stringify(req),
    }),

  agentGraphInfo: () => _fetch<Record<string, unknown>>(API.agentGraphInfo),

  artifactGenerate: (req: ArtifactRequest) =>
    _fetch<ArtifactResponse>(API.artifactGenerate, {
      method: "POST",
      body: JSON.stringify(req),
    }),

  artifactGenerateAll: (req: Omit<ArtifactRequest, "type"> & { type?: "docx" }) =>
    _fetch<{ docx: ArtifactResponse; xlsx: ArtifactResponse; pptx: ArtifactResponse; any_success: boolean }>(
      API.artifactGenerateAll,
      { method: "POST", body: JSON.stringify({ ...req, type: "docx" }) }
    ),

  artifactList: () => _fetch<{ artifacts: Array<{ name: string; type: string; size_bytes: number }>; total: number }>(API.artifactList),

  artifactDownloadUrl: (name: string) => API.artifactDownload(name),

  networkSummary: () => _fetch<NetworkSummary>(API.networkMonitorSummary),

  networkMonitor: () => _fetch<Record<string, unknown>>(API.networkMonitor),
};
