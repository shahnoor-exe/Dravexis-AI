// hooks/useBackendHealth.ts — Polls backend health every 5s, updates connection status
import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { useSettingsStore } from "../store/settingsStore";

export function useBackendHealth() {
  const { setConnectionStatus, setGraphInfo } = useSettingsStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = async () => {
    try {
      const health = await api.health();
      if (health?.status === "running" || health?.service === "Dravexis AI") {
        setConnectionStatus("CONNECTED");
        // Also fetch graph info for model status
        try {
          const info = await api.agentGraphInfo();
          setGraphInfo(info as Record<string, unknown>);
        } catch {
          // Graph info failure doesn't affect connection status
        }
      } else {
        setConnectionStatus("DEGRADED");
      }
    } catch {
      setConnectionStatus("DISCONNECTED");
    }
  };

  useEffect(() => {
    check();
    timerRef.current = setInterval(check, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
}
