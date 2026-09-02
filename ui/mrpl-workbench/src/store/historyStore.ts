import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AgentRunResponse } from "../lib/api";

export type SessionRecord = {
  id: string; // session_id
  timestamp: number;
  query: string;
  intent: string | null;
  model: string | null;
  latencyMs: number;
  isFavorite: boolean;
  finalAnswer: string | null;
  parentId?: string | null;
};

export type ArtifactRecord = {
  id: string;
  sessionId: string;
  timestamp: number;
  type: string;
  fileName: string;
  sizeBytes: number;
  status: string;
};

export type MediaRecord = {
  id: string;
  sessionId: string;
  timestamp: number;
  type: "pdf" | "image";
  originalName: string;
  sizeBytes: number;
  status: string;
};

export type MemoryRecord = {
  id: string;
  timestamp: number;
  key: string;
  value: string;
  source: string;
};

type HistoryStore = {
  sessions: SessionRecord[];
  artifacts: ArtifactRecord[];
  media: MediaRecord[];
  memories: MemoryRecord[];
  activeParentId: string | null;

  // Actions
  setActiveParentId: (id: string | null) => void;
  saveSession: (session: SessionRecord) => void;
  deleteSession: (id: string) => void;
  toggleFavorite: (id: string) => void;

  saveArtifact: (artifact: ArtifactRecord) => void;
  deleteArtifact: (id: string) => void;

  saveMedia: (media: MediaRecord) => void;
  deleteMedia: (id: string) => void;

  saveMemory: (memory: MemoryRecord) => void;
  deleteMemory: (id: string) => void;
  clearMemories: () => void;

  clearHistory: () => void;
};

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set) => ({
      sessions: [],
      artifacts: [],
      media: [],
      memories: [],
      activeParentId: null,

      setActiveParentId: (id) => set({ activeParentId: id }),

      saveSession: (session) =>
        set((state) => {
          const exists = state.sessions.find((s) => s.id === session.id);
          if (exists) {
            return {
              sessions: state.sessions.map((s) => (s.id === session.id ? session : s)),
            };
          }
          // Cap at 100 sessions to prevent localStorage bloat
          return { sessions: [session, ...state.sessions].slice(0, 100) };
        }),
      
      deleteSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
        })),
        
      toggleFavorite: (id) =>
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, isFavorite: !s.isFavorite } : s)),
        })),

      saveArtifact: (artifact) =>
        set((state) => ({
          artifacts: [artifact, ...state.artifacts].slice(0, 50),
        })),
        
      deleteArtifact: (id) =>
        set((state) => ({
          artifacts: state.artifacts.filter((a) => a.id !== id),
        })),

      saveMedia: (media) =>
        set((state) => ({
          media: [media, ...state.media].slice(0, 50),
        })),
        
      deleteMedia: (id) =>
        set((state) => ({
          media: state.media.filter((m) => m.id !== id),
        })),

      saveMemory: (memory) =>
        set((state) => {
          const filtered = state.memories.filter((m) => m.key !== memory.key);
          return { memories: [memory, ...filtered].slice(0, 100) };
        }),
        
      deleteMemory: (id) =>
        set((state) => ({
          memories: state.memories.filter((m) => m.id !== id),
        })),
        
      clearMemories: () => set({ memories: [] }),

      clearHistory: () => set({ sessions: [], artifacts: [], media: [] }),
    }),
    {
      name: "dravexis-history-storage",
      // Only store specific fields, never raw file contents
      partialize: (state) => ({
        sessions: state.sessions,
        artifacts: state.artifacts,
        media: state.media,
        memories: state.memories,
      }),
    }
  )
);
