import React from 'react';
import { useAgentStore } from '../store/agentStore';
import { Button } from './ui/Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiInspectorModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { lastResponse, query, sessionId, uploadedImagePath, intentOverride } = useAgentStore();

  if (!isOpen) return null;

  const requestPayload = {
    query,
    session_id: sessionId,
    image_path: uploadedImagePath || undefined,
    intent_override: intentOverride || undefined
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-cyber-obsidian border border-zinc-800/80 rounded-sm w-full max-w-4xl max-h-[85vh] flex flex-col shadow-[0_0_50px_rgba(32,227,255,0.1)]">
        
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/80 bg-slate-glass/50">
          <h2 className="text-neon-cyan font-mono text-xs uppercase tracking-[0.2em] flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            Raw API Payload Inspector
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </Button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-zinc-800/80">
          {/* Request */}
          <div className="flex-1 flex flex-col bg-[#080b13]">
            <div className="px-4 py-2 border-b border-zinc-800/50 bg-black/40 text-[10px] font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neon-cyan"></span>
              Request (POST /agent/run)
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-[11px] font-mono text-neon-cyan/90 whitespace-pre-wrap">
                {JSON.stringify(requestPayload, null, 2)}
              </pre>
            </div>
          </div>

          {/* Response */}
          <div className="flex-1 flex flex-col bg-[#080b13]">
            <div className="px-4 py-2 border-b border-zinc-800/50 bg-black/40 text-[10px] font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neon-emerald"></span>
              Response (AgentRunResponse)
            </div>
            <div className="flex-1 overflow-auto p-4">
              {lastResponse ? (
                <pre className="text-[11px] font-mono text-neon-emerald/90 whitespace-pre-wrap">
                  {JSON.stringify(lastResponse, null, 2)}
                </pre>
              ) : (
                <div className="text-zinc-600 font-mono text-[10px] h-full flex items-center justify-center text-center px-4">
                  No response data available. Initialize a run first.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
