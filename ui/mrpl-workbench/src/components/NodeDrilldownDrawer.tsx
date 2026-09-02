import React, { useMemo } from 'react';
import { useAgentStore } from '../store/agentStore';

interface NodeDrilldownDrawerProps {
  nodeId: string | null;
  onClose: () => void;
}

export const NodeDrilldownDrawer: React.FC<NodeDrilldownDrawerProps> = ({ nodeId, onClose }) => {
  const { events, nodeStates, lastResponse } = useAgentStore();

  const nodeEvents = useMemo(() => {
    if (!nodeId) return [];
    return events.filter(e => e.node === nodeId);
  }, [events, nodeId]);

  const enterEvent = nodeEvents.find(e => e.event === 'enter');
  const exitEvent = nodeEvents.find(e => e.event === 'exit');
  
  const status = nodeId ? nodeStates[nodeId] : 'idle';
  const duration = (enterEvent && exitEvent && enterEvent.timestamp && exitEvent.timestamp) 
    ? ((exitEvent.timestamp - enterEvent.timestamp) * 1000).toFixed(0) + 'ms' 
    : 'N/A';

  if (!nodeId) return null;

  return (
    <div className="absolute inset-y-0 left-0 w-full bg-cyber-obsidian border-r border-zinc-800/80 shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
      <div className="flex items-center justify-between p-3 border-b border-zinc-800/80 bg-slate-glass/50">
        <h3 className="text-neon-cyan font-mono text-xs uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse"></span>
          Node: {nodeId}
        </h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-white">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-[10px]">
        <div className="space-y-1">
          <div className="text-zinc-500 uppercase tracking-widest">Status</div>
          <div className={`px-2 py-1 rounded-sm border ${status === 'success' ? 'bg-neon-emerald/10 border-neon-emerald/30 text-neon-emerald' : status === 'error' ? 'bg-neon-amber/10 border-neon-amber/30 text-neon-amber' : 'bg-zinc-800 border-zinc-700 text-zinc-300'} inline-block`}>
            {status}
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="text-zinc-500 uppercase tracking-widest">Duration</div>
          <div className="text-zinc-300">{duration}</div>
        </div>

        <div className="space-y-1">
          <div className="text-zinc-500 uppercase tracking-widest">Telemetry / Model</div>
          <div className="text-zinc-300">{lastResponse?.active_model || 'N/A'}</div>
        </div>

        <div className="space-y-1">
          <div className="text-zinc-500 uppercase tracking-widest">Raw Events ({nodeEvents.length})</div>
          <div className="bg-[#0b0f19] border border-zinc-800/80 rounded p-2 overflow-x-auto max-h-64">
            <pre className="text-zinc-400">
              {JSON.stringify(nodeEvents, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
