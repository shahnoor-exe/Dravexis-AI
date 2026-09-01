import React from "react";
import { TopBar } from "./components/TopBar";
import { LeftRail } from "./components/LeftRail";
import { CenterStage } from "./components/CenterStage";
import { RightRail } from "./components/RightRail";
import { useBackendHealth } from "./hooks/useBackendHealth";
import { useAppLoadAnimation } from "./hooks/useGSAPAnimations";
import "./index.css";

export default function App() {
  useBackendHealth();
  useAppLoadAnimation();   // Phase 4 GSAP app-load timeline

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div data-anim="logo">
        <TopBar />
      </div>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div data-anim="left-rail" className="flex">
          <LeftRail />
        </div>
        <div data-anim="center-stage" className="flex flex-1 min-w-0">
          <CenterStage />
        </div>
        <div data-anim="right-rail" className="flex">
          <RightRail />
        </div>
      </div>
    </div>
  );
}
