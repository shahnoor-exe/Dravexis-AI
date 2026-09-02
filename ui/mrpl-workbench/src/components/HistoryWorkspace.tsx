import React, { useState } from 'react';
import { useHistoryStore, SessionRecord } from '../store/historyStore';
import { useAgentStore } from '../store/agentStore';
import { Button } from './ui/Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryWorkspace: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'artifacts' | 'media' | 'memories'>('sessions');
  const { sessions, artifacts, media, memories, deleteSession, deleteMemory, clearMemories, clearHistory, setActiveParentId } = useHistoryStore();
  const { setQuery, setIntentOverride } = useAgentStore();

  const handleFork = (s: SessionRecord) => {
    setActiveParentId(s.id);
    setQuery(s.query);
    if (s.intent) setIntentOverride(s.intent);
    onClose();
  };

  const treeSessions = React.useMemo(() => {
    const nodeMap = new Map<string, SessionRecord & { children: any[], depth: number }>();
    sessions.forEach(s => nodeMap.set(s.id, { ...s, children: [], depth: 0 }));
    const roots: any[] = [];
    nodeMap.forEach(node => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    
    // Reverse roots so newest are at the top (sessions is newest first originally)
    const flatTree: any[] = [];
    const traverse = (node: any, depth: number) => {
      node.depth = depth;
      flatTree.push(node);
      // Newest children first
      node.children.sort((a: any, b: any) => b.timestamp - a.timestamp).forEach((c: any) => traverse(c, depth + 1));
    };
    roots.sort((a, b) => b.timestamp - a.timestamp).forEach(r => traverse(r, 0));
    
    return flatTree;
  }, [sessions]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-y-0 right-0 w-80 bg-cyber-obsidian border-l border-zinc-800/80 shadow-[0_0_40px_rgba(0,0,0,0.8)] z-50 flex flex-col transform transition-transform duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800/80 bg-slate-glass/30 backdrop-blur-md">
        <h2 className="text-zinc-300 text-[10px] font-mono uppercase tracking-[0.2em] flex items-center gap-2">
          <svg className="w-4 h-4 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Local History
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={clearHistory} tooltip="Clear All History">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} tooltip="Close Workspace">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800/80 bg-zinc-950/80">
        {(['sessions', 'artifacts', 'media', 'memories'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-[9px] font-mono uppercase tracking-widest border-b-2 transition-colors ${
              activeTab === tab ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/5' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'sessions' && (
          treeSessions.length === 0 ? (
            <div className="text-zinc-600 text-[10px] font-mono text-center mt-10">No local sessions found.</div>
          ) : (
            treeSessions.map(s => (
              <div 
                key={s.id} 
                className="bg-black/40 border border-zinc-800 rounded p-3 group hover:border-neon-cyan/30 transition-colors relative"
                style={{ marginLeft: `${Math.min(s.depth * 16, 64)}px` }}
              >
                {s.depth > 0 && (
                  <div className="absolute top-1/2 -left-3 w-3 border-t border-zinc-700"></div>
                )}
                {s.depth > 0 && (
                  <div className="absolute -top-3 -left-3 h-full border-l border-zinc-700"></div>
                )}
                <div className="flex justify-between items-start mb-2 relative z-10">
                  <span className="text-neon-cyan text-[9px] font-mono bg-neon-cyan/10 px-1.5 py-0.5 rounded uppercase">{s.intent || 'AUTO'}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleFork(s)} className="text-zinc-500 hover:text-neon-amber transition-colors flex items-center gap-1 text-[9px] uppercase tracking-widest" title="Fork from this step">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7l-2 2m2-2l2 2M16 17l-2-2m2 2l2-2" /></svg>
                      Fork
                    </button>
                    <button onClick={() => deleteSession(s.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="text-zinc-300 text-[11px] font-mono line-clamp-2 mb-2">{s.query}</div>
                <div className="text-zinc-500 text-[9px] font-mono flex justify-between">
                  <span>{new Date(s.timestamp).toLocaleTimeString()}</span>
                  <span>{(s.latencyMs / 1000).toFixed(1)}s</span>
                </div>
              </div>
            ))
          )
        )}
        {activeTab === 'artifacts' && (
          artifacts.length === 0 ? (
            <div className="text-zinc-600 text-[10px] font-mono text-center mt-10">No generated artifacts.</div>
          ) : (
            artifacts.map(a => (
              <div key={a.id} className="bg-black/40 border border-zinc-800 rounded p-3">
                <div className="text-neon-magenta text-[10px] font-mono mb-1">{a.fileName}</div>
                <div className="text-zinc-500 text-[9px] font-mono">{new Date(a.timestamp).toLocaleDateString()}</div>
              </div>
            ))
          )
        )}
        {activeTab === 'media' && (
          media.length === 0 ? (
            <div className="text-zinc-600 text-[10px] font-mono text-center mt-10">No uploaded media.</div>
          ) : (
            media.map(m => (
              <div key={m.id} className="bg-black/40 border border-zinc-800 rounded p-3">
                <div className="text-neon-amber text-[10px] font-mono mb-1 truncate">{m.originalName}</div>
                <div className="text-zinc-500 text-[9px] font-mono uppercase">{m.type} • {(m.sizeBytes / 1024).toFixed(0)} KB</div>
              </div>
            ))
          )
        )}
        {activeTab === 'memories' && (
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">Global Memory Store</span>
              {memories.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearMemories} className="text-red-400 hover:text-red-300">
                  Clear All
                </Button>
              )}
            </div>
            {memories.length === 0 ? (
              <div className="text-zinc-600 text-[10px] font-mono text-center mt-10">No stored memories.</div>
            ) : (
              <div className="space-y-3">
                {memories.map(m => (
                  <div key={m.id} className="bg-black/40 border border-zinc-800 rounded p-3 relative group">
                    <button onClick={() => deleteMemory(m.id)} className="absolute top-2 right-2 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="text-neon-cyan text-[10px] font-mono mb-1 font-bold">{m.key}</div>
                    <div className="text-zinc-300 text-[10px] font-mono whitespace-pre-wrap leading-relaxed">{m.value}</div>
                    <div className="text-zinc-600 text-[8px] font-mono mt-2 uppercase tracking-widest">Source: {m.source} • {new Date(m.timestamp).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
