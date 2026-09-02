// hooks/useAgentRun.ts — Handles agent run lifecycle
import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { api } from "../lib/api";
import { useAgentStore } from "../store/agentStore";
import { useHistoryStore } from "../store/historyStore";

export function useAgentRun() {
  const { query, startRun, completeRun, failRun } = useAgentStore();
  const [isRunning, setIsRunning] = useState(false);

  const run = useCallback(async () => {
    // If it's just an image upload, query could be empty but we still want to run
    const { query, sessionId: existingSessionId, uploadedImagePath, intentOverride, startRun, completeRun, failRun } = useAgentStore.getState();
    if ((!query.trim() && !uploadedImagePath) || isRunning) return;
    
    const sessionId = existingSessionId || uuidv4();
    setIsRunning(true);
    startRun(sessionId);
    try {
      const response = await api.agentRun({ 
        query: query.trim(), 
        session_id: sessionId,
        image_path: uploadedImagePath || undefined,
        intent_override: intentOverride || undefined,
      });
      completeRun(response);
      
      // Save to local history
      const historyStore = useHistoryStore.getState();
      historyStore.saveSession({
        id: sessionId,
        timestamp: Date.now(),
        query: query.trim() || "[Media Upload]",
        intent: response.intent,
        model: response.active_model,
        latencyMs: response.total_latency_ms,
        isFavorite: false,
        finalAnswer: response.answer,
        parentId: historyStore.activeParentId,
      });
      if (historyStore.activeParentId) {
        historyStore.setActiveParentId(null);
      }
    } catch (err) {
      failRun(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsRunning(false);
    }
  }, [isRunning]);

  return { run, isRunning };
}
