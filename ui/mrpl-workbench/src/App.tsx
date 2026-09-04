import React, { useState } from "react";
import { TopBar } from "./components/TopBar";
import { LeftRail } from "./components/LeftRail";
import { CenterStage } from "./components/CenterStage";
import { RightRail } from "./components/RightRail";
import { HistoryWorkspace } from "./components/HistoryWorkspace";
import { LandingPage } from "./components/LandingPage";
import { useBackendHealth } from "./hooks/useBackendHealth";
import { useSettingsStore } from "./store/settingsStore";
import { useAppLoadAnimation } from "./hooks/useGSAPAnimations";
import { useResizer } from "./hooks/useResizer";
import "./index.css";

export default function App() {
  useBackendHealth();
  const { hasInitialized, skipIntro } = useSettingsStore();
  const showLanding = !hasInitialized && !skipIntro;

  // We only run the workbench's initial load animation if the landing page is bypassed or done.
  // We'll wrapper this inside a sub-component or just conditional.
  // Wait, `useAppLoadAnimation` targets data-anim attributes in the workbench.
  // It runs a useEffect on mount. To prevent it running early, we can conditionally render the workbench.
  const [historyOpen, setHistoryOpen] = useState(false);

  const leftResizer = useResizer('dravexis-left-width', 288, 200, 600, 'left');
  const rightResizer = useResizer('dravexis-right-width', 320, 240, 800, 'right');

  if (showLanding) {
    return <LandingPage />;
  }

  return (
    <WorkbenchLayout 
      historyOpen={historyOpen} 
      setHistoryOpen={setHistoryOpen} 
      leftResizer={leftResizer} 
      rightResizer={rightResizer} 
    />
  );
}

function WorkbenchLayout({ historyOpen, setHistoryOpen, leftResizer, rightResizer }: any) {
  useAppLoadAnimation(); // Triggers only when WorkbenchLayout mounts
  
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-cyber-bg text-text-main transition-colors duration-400">
      <div data-anim="logo">
        <TopBar onToggleHistory={() => setHistoryOpen(!historyOpen)} />
      </div>
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <div data-anim="left-rail" className="flex relative group">
          <LeftRail width={leftResizer.width} />
          <div 
            className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-50 transition-colors ${leftResizer.isResizing ? 'bg-neon-cyan' : 'bg-transparent hover:bg-neon-cyan/50'}`}
            onMouseDown={leftResizer.startResizing}
          />
        </div>
        <div data-anim="center-stage" className="flex flex-1 min-w-0">
          <CenterStage />
        </div>
        <div data-anim="right-rail" className="flex relative group">
          <div 
            className={`absolute top-0 left-0 w-1.5 h-full cursor-col-resize z-50 transition-colors ${rightResizer.isResizing ? 'bg-neon-cyan' : 'bg-transparent hover:bg-neon-cyan/50'}`}
            onMouseDown={rightResizer.startResizing}
          />
          <RightRail width={rightResizer.width} />
        </div>
        
        {/* History Workspace Drawer */}
        <HistoryWorkspace isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
      </div>
    </div>
  );
}
