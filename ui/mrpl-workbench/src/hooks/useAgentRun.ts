// hooks/useAgentRun.ts — Handles agent run lifecycle
import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { api } from "../lib/api";
import { useAgentStore } from "../store/agentStore";

export function useAgentRun() {
  const { query, startRun, completeRun, failRun } = useAgentStore();
  const [isRunning, setIsRunning] = useState(false);

  const run = useCallback(async () => {
    if (!query.trim() || isRunning) return;
    const sessionId = uuidv4();
    setIsRunning(true);
    startRun(sessionId);
    try {
      const response = await api.agentRun({ query: query.trim(), session_id: sessionId });
      completeRun(response);
    } catch (err) {
      failRun(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsRunning(false);
    }
  }, [query, isRunning, startRun, completeRun, failRun]);

  return { run, isRunning };
}
