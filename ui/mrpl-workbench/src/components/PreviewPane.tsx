import React, { useEffect, useState } from 'react';
import { Button } from './ui/Button';

interface PreviewPaneProps {
  fileName: string | null;
  onClose: () => void;
}

export const PreviewPane: React.FC<PreviewPaneProps> = ({ fileName, onClose }) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fileName) return;
    setLoading(true);
    // Mock extraction: In a real app we'd fetch the document text. Here we fake a preview.
    setTimeout(() => {
      setContent(`[PREVIEW EXTRACTION]
Document: ${fileName}
Generated via Dravexis AI.

Confidentiality: STRICTLY CONFIDENTIAL
======================================
This document contains synthesized context and execution results from the latest agent run.
Review thoroughly before finalizing.
`);
      setLoading(false);
    }, 800);
  }, [fileName]);

  if (!fileName) return null;

  return (
    <div className="absolute inset-y-0 right-full w-[400px] bg-cyber-obsidian border-l border-r border-zinc-800/80 shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-zinc-800/80 bg-slate-glass/50">
        <h3 className="text-neon-cyan font-mono text-xs uppercase tracking-widest flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          Artifact Preview
        </h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-white">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 bg-[#0b0f19]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-neon-cyan/50 font-mono text-[10px] uppercase tracking-widest animate-pulse">
            <div className="w-6 h-6 border-2 border-neon-cyan/30 border-t-neon-cyan rounded-full animate-spin mb-3"></div>
            Extracting text preview...
          </div>
        ) : (
          <pre className="text-[11px] font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {content}
          </pre>
        )}
      </div>

      <div className="p-3 border-t border-zinc-800/80 bg-black/50 flex justify-between items-center">
        <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">{fileName}</span>
        <Button variant="ghost" size="sm" onClick={() => window.open(`http://127.0.0.1:8080/artifacts/download/${encodeURIComponent(fileName)}`, "_blank")}>
          Download Full
        </Button>
      </div>
    </div>
  );
};
