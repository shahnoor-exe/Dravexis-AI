// components/EvidencePanel.tsx — Grounded evidence display
import React from "react";
import { useAgentStore } from "../store/agentStore";

export const EvidencePanel: React.FC = () => {
  const { evidence, runStatus } = useAgentStore();

    return (
      <div className="flex flex-col items-center justify-center text-slate-500 dark:text-zinc-600 h-64 border border-slate-300 dark:border-zinc-800/50 border-dashed rounded-xl bg-slate-100 dark:bg-zinc-900/20 transition-colors duration-400">
        <svg className="w-8 h-8 mb-3 text-slate-400 dark:text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        <div className="text-xs font-mono uppercase tracking-widest">EVIDENCE BUFFER EMPTY</div>
        <div className="text-[10px] mt-1 opacity-60">Awaiting vector search results...</div>
      </div>
    );
  }

  if (evidence.length === 0) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-neon-amber/40 rounded-xl p-6 text-center shadow-sm dark:shadow-[0_0_15px_rgba(255,153,0,0.1)] transition-colors duration-400">
        <div className="text-amber-700 dark:text-neon-amber font-mono font-bold text-xs tracking-widest mb-2 uppercase">⚠ INSUFFICIENT_EVIDENCE</div>
        <div className="text-amber-600 dark:text-amber-200/70 text-xs font-mono max-w-lg mx-auto">
          No documents retrieved above confidence threshold (0.45).
          This query may be outside the ingested corpus.
          <br /><br />
          <span className="text-amber-700 dark:text-neon-amber font-bold p-1 border border-amber-300 dark:border-neon-amber/50 bg-white dark:bg-neon-amber/10 rounded block">
            DO NOT INTERPRET THIS AS A NEGATIVE STATUTORY FINDING.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-zinc-800/80 pb-2 transition-colors duration-400">
        <span className="text-[10px] text-emerald-700 dark:text-neon-emerald font-bold uppercase tracking-widest bg-emerald-50 dark:bg-neon-emerald/10 px-2 py-1 rounded border border-emerald-300 dark:border-neon-emerald/30 transition-colors duration-400">
          GROUNDED EVIDENCE
        </span>
        <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono tracking-widest transition-colors duration-400">({evidence.length} CHUNKS SECURED)</span>
      </div>
      
      <div className="grid gap-3">
        {evidence.map((ev, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-neon-cyan/20 rounded-xl p-4 transition-all duration-400 hover:border-slate-400 dark:hover:border-neon-cyan/50 shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-[0_0_15px_rgba(0,240,255,0.1)] group">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 dark:border-zinc-800 transition-colors duration-400">
              <span className="text-slate-800 dark:text-neon-cyan text-[11px] font-mono tracking-widest group-hover:text-black dark:group-hover:text-white transition-colors">{ev.doc_id}</span>
              <span className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors duration-400 ${ev.score >= 0.7 ? "text-emerald-700 dark:text-neon-emerald border-emerald-300 dark:border-neon-emerald/50 bg-emerald-50 dark:bg-neon-emerald/10" : ev.score >= 0.5 ? "text-amber-700 dark:text-neon-amber border-amber-300 dark:border-neon-amber/50 bg-amber-50 dark:bg-neon-amber/10" : "text-slate-500 dark:text-zinc-400 border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-black"}`}>
                CONF: {(ev.score * 100).toFixed(1)}%
              </span>
            </div>
            <p className="text-slate-700 dark:text-zinc-300 text-xs font-sans leading-relaxed line-clamp-4 pl-3 border-l-2 border-slate-300 dark:border-zinc-800 group-hover:border-slate-500 dark:group-hover:border-neon-cyan/50 transition-colors">
              {ev.text_preview}
            </p>
            <div className="mt-3 text-[9px] text-slate-500 dark:text-zinc-600 font-mono uppercase tracking-widest transition-colors duration-400">
              CHUNK_IDX: {ev.chunk_index}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-zinc-800 text-[9px] text-slate-500 dark:text-zinc-600 font-mono uppercase tracking-widest text-center transition-colors duration-400">
        Vector Store: Qdrant Embedded [bge-large-en-v1.5]
      </div>
    </div>
  );
};
