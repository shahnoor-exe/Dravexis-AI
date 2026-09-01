// store/settingsStore.ts — App-level settings store
import { create } from "zustand";
import type { ConnectionStatus } from "../lib/constants";
import { REFINERY_CONTEXTS, OPERATOR_ROLES } from "../lib/constants";

type SettingsStore = {
  refineryContext: (typeof REFINERY_CONTEXTS)[number];
  operatorRole: (typeof OPERATOR_ROLES)[number];
  connectionStatus: ConnectionStatus;
  graphInfo: Record<string, unknown> | null;
  networkSummary: Record<string, unknown> | null;

  setRefineryContext: (ctx: (typeof REFINERY_CONTEXTS)[number]) => void;
  setOperatorRole: (role: (typeof OPERATOR_ROLES)[number]) => void;
  setConnectionStatus: (s: ConnectionStatus) => void;
  setGraphInfo: (info: Record<string, unknown>) => void;
  setNetworkSummary: (s: Record<string, unknown>) => void;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  refineryContext: "CDU",
  operatorRole: "Engineer",
  connectionStatus: "DISCONNECTED",
  graphInfo: null,
  networkSummary: null,

  setRefineryContext: (ctx) => set({ refineryContext: ctx }),
  setOperatorRole: (role) => set({ operatorRole: role }),
  setConnectionStatus: (s) => set({ connectionStatus: s }),
  setGraphInfo: (info) => set({ graphInfo: info }),
  setNetworkSummary: (s) => set({ networkSummary: s }),
}));
