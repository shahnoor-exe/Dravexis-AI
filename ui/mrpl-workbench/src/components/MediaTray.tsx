import React from 'react';
import { useAgentStore } from '../store/agentStore';
import { Button } from './ui/Button';

export const MediaTray: React.FC = () => {
  const { uploadedImagePath, sessionId, setUploadedImagePath, setSessionId } = useAgentStore();

  const hasMedia = uploadedImagePath || sessionId;
  if (!hasMedia) return null;

  return (
    <div className="flex gap-3 mb-3 p-2 bg-black/30 border border-zinc-800/80 rounded-sm">
      {uploadedImagePath && (
        <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-700 px-2 py-1 rounded relative group">
          <div className="w-8 h-8 bg-black rounded overflow-hidden flex items-center justify-center border border-zinc-700">
            {/* Because we don't have a direct file blob, and tauri can't easily serve local files without custom protocol, 
                we'll just show an icon, or if it's in the data/ dir we might be able to proxy it via the backend.
                We'll just use an icon for safety in this UI prototype. */}
            <svg className="w-4 h-4 text-neon-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-zinc-300 truncate max-w-[150px]" title={uploadedImagePath}>
              {uploadedImagePath.split(/[/\\]/).pop()}
            </span>
            <span className="text-[8px] font-mono text-neon-emerald uppercase tracking-widest">Pinned Image</span>
          </div>
          <Button 
            variant="icon" 
            size="icon" 
            className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 h-5 w-5" 
            onClick={() => setUploadedImagePath(null)}
          >
            <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </Button>
        </div>
      )}

      {sessionId && !uploadedImagePath && (
        <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-700 px-2 py-1 rounded relative group">
          <div className="w-8 h-8 bg-black rounded flex items-center justify-center border border-zinc-700 text-neon-amber">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-zinc-300">Document Context</span>
            <span className="text-[8px] font-mono text-neon-amber uppercase tracking-widest">Pinned PDF Session</span>
          </div>
          <Button 
            variant="icon" 
            size="icon" 
            className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 h-5 w-5" 
            onClick={() => setSessionId(null)}
          >
            <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </Button>
        </div>
      )}
    </div>
  );
};
