// components/EvidencePanel.tsx — Grounded evidence display
import React from "react";
import { useAgentStore } from "../store/agentStore";

export const EvidencePanel: React.FC = () => {
  const { evidence, runStatus } = useAgentStore();

  if (runStatus === "idle") {
    return (
      <div className="text-zinc-600 text-sm text-center py-8">
        Submit a query to see retrieved evidence.
      </div>
    );
  }

  if (evidence.length === 0) {
    return (
      <div className="bg-amber-950/40 border border-amber-800/50 rounded-lg p-4 text-center">
        <div className="text-amber-400 font-semibold text-sm mb-1">⚠ INSUFFICIENT_EVIDENCE</div>
        <div className="text-amber-200/70 text-xs">
          No documents retrieved above confidence threshold (0.45).
          This query may be outside the ingested corpus.
          <br /><span className="text-amber-400">Do not interpret this as a negative finding.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] text-emerald-500 font-semibold uppercase tracking-widest">Grounded Evidence</span>
        <span className="text-[10px] text-zinc-600">({evidence.length} chunk{evidence.length !== 1 ? "s" : ""})</span>
      </div>
      {evidence.map((ev, i) => (
        <div key={i} className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-blue-400 text-xs font-mono font-semibold">{ev.doc_id}</span>
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${ev.score >= 0.7 ? "text-emerald-300 bg-emerald-900/50" : ev.score >= 0.5 ? "text-amber-300 bg-amber-900/50" : "text-zinc-400 bg-zinc-700/50"}`}>
              {ev.score.toFixed(4)}
            </span>
          </div>
          <p className="text-zinc-300 text-xs leading-relaxed line-clamp-4">
            {ev.text_preview}
          </p>
          <div className="mt-1.5 text-[9px] text-zinc-600">chunk #{ev.chunk_index}</div>
        </div>
      ))}
      <div className="mt-1 text-[10px] text-zinc-600 italic">
        Evidence from Qdrant Embedded (bge-large-en-v1.5, 9-vector corpus).
        Expand corpus before production use.
      </div>
    </div>
  );
};
