import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { useSettingsStore } from "../store/settingsStore";
import { api } from "../lib/api";
import { ThemeToggle } from "./ThemeToggle";

export const LandingPage: React.FC = () => {
  const { capabilities, setCapabilities, setHasInitialized, setSkipIntro } = useSettingsStore();
  const heroRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial fetch of capabilities
    api.capabilities().then(setCapabilities).catch(console.error);
  }, [setCapabilities]);

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline();

      // Title & Hero entry
      tl.fromTo(
        heroRef.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 1, ease: "power3.out" }
      );

      // Core breathing
      gsap.to(coreRef.current, {
        scale: 1.05,
        opacity: 0.8,
        duration: 3,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut"
      });

      // Buttons entry
      tl.fromTo(
        buttonsRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
        "-=0.4"
      );

      // Strip entry
      tl.fromTo(
        stripRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.8 },
        "-=0.2"
      );
    });

    mm.add("(prefers-reduced-motion: reduce)", () => {
      // Direct opacity for reduced motion
      gsap.set([heroRef.current, buttonsRef.current, stripRef.current], { opacity: 1 });
    });

    return () => mm.revert();
  }, []);

  const handleInitialize = () => {
    // Lock and animate out
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to(coreRef.current, { backgroundColor: "#FF3EA5", duration: 0.4 }); // neon-magenta
      gsap.to(".landing-container", {
        opacity: 0,
        scale: 0.98,
        duration: 0.6,
        ease: "power2.inOut",
        onComplete: () => {
          setHasInitialized(true);
        }
      });
    });

    mm.add("(prefers-reduced-motion: reduce)", () => {
      setHasInitialized(true);
    });
  };

  const handleSkipIntro = () => {
    setSkipIntro(true);
    handleInitialize();
  };

  return (
    <div className="landing-container block h-screen w-full bg-slate-50 dark:bg-cyber-obsidian text-slate-900 dark:text-zinc-100 relative overflow-x-hidden overflow-y-auto transition-colors duration-400">
      
      {/* Theme Toggle Top Right */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Backgrounds */}
      <div className="absolute inset-0 bg-radial-hero z-0 pointer-events-none transition-opacity duration-400"></div>
      <div className="scanlines z-10 opacity-10 dark:opacity-30 mix-blend-overlay"></div>
      <div className="radar-sweep z-10"></div>
      <div className="grid-overlay z-0 opacity-20 dark:opacity-40"></div>

      {/* Main Content */}
      <div className="relative z-20 flex flex-col items-center min-h-screen px-4 md:px-12 pt-16 pb-12 w-full max-w-7xl mx-auto shrink-0">
        
        {/* Hero Section */}
        <div ref={heroRef} className="flex flex-col items-center text-center max-w-4xl opacity-0">
          <div className="text-neon-cyan text-[10px] md:text-xs font-mono uppercase tracking-[0.2em] mb-4 border border-neon-cyan/30 dark:border-neon-cyan/20 px-4 py-2 rounded bg-neon-cyan/10 dark:bg-neon-cyan/5 leading-normal">
            Sovereign Industrial Intelligence
          </div>
          
          <div className="relative mb-6">
            <div ref={coreRef} className="absolute inset-0 bg-neon-cyan/10 dark:bg-neon-cyan/20 blur-2xl rounded-full"></div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 dark:text-white drop-shadow-sm dark:drop-shadow-lg relative z-10 transition-colors duration-400">
              Dravexis AI
            </h1>
          </div>
          
          <h2 className="text-xl md:text-3xl font-medium text-slate-600 dark:text-zinc-300 mb-6 transition-colors duration-400">
            Turn plant data into defensible decisions.
          </h2>
          
          <p className="text-sm md:text-base text-slate-500 dark:text-zinc-400 max-w-2xl leading-relaxed mb-6 transition-colors duration-400">
            Local retrieval, multimodal inspection, controlled computation, and evidence-first outputs — designed for air-gappable industrial workflows.
          </p>

          <div className="text-[10px] text-amber-700 dark:text-neon-amber font-mono bg-amber-50 dark:bg-neon-amber/5 border border-amber-200 dark:border-neon-amber/20 px-4 py-1.5 rounded-sm inline-flex items-center gap-2 mb-10 transition-colors duration-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-neon-amber animate-pulse"></span>
            Current development mode: CPU fallback, AST-only sandbox, process-level network telemetry.
          </div>
        </div>

        {/* Action Buttons */}
        <div ref={buttonsRef} className="flex flex-col sm:flex-row gap-4 mb-16 opacity-0">
          <button 
            onClick={handleInitialize}
            className="px-8 py-3 border border-neon-cyan/80 bg-white/80 dark:bg-neon-cyan/10 hover:bg-neon-cyan/10 dark:hover:bg-neon-cyan/20 text-neon-cyan dark:text-neon-cyan hover:text-neon-cyan dark:hover:text-white font-mono text-sm uppercase tracking-wider rounded backdrop-blur transition-all duration-300 shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-[0_0_20px_rgba(32,227,255,0.4)] group relative overflow-hidden flex items-center justify-center leading-normal cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-neon-cyan/10 dark:via-neon-cyan/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            Initialize Workbench
          </button>
          <button 
            onClick={handleSkipIntro}
            className="px-8 py-3 border border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-neon-cyan/50 bg-white/50 dark:bg-zinc-900/50 hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-neon-cyan font-mono text-sm uppercase tracking-wider rounded backdrop-blur transition-all flex items-center justify-center leading-normal cursor-pointer"
          >
            Skip Intro Next Time
          </button>
        </div>

        {/* Interactive Mission Preview Nodes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-12">
          {[
            { icon: "🔍", title: "Ask the corpus", desc: "Retrieve evidence from OISD/ASME guidelines.", limitation: "Limited to 17-vector demo corpus." },
            { icon: "👁️", title: "Inspect a P&ID", desc: "Multimodal visual inspection of isometric drawings.", limitation: "Requires local vision model and image attachment." },
            { icon: "⚙️", title: "Controlled calculation", desc: "Run remaining-life math via code gen.", limitation: "Runs through AST-allowlist controls; Docker isolation unavailable." },
            { icon: "📋", title: "Compile artifact", desc: "Generate DOCX/PPTX evidence reports.", limitation: "Generated locally; review outputs before operational use." }
          ].map((node, i) => (
            <div key={i} className="group p-4 bg-white/80 dark:bg-[rgba(11,15,25,0.6)] backdrop-blur-md border border-slate-200 dark:border-[rgba(0,240,255,0.08)] hover:bg-slate-50 dark:hover:bg-slate-glass hover:border-neon-cyan/30 dark:hover:border-neon-cyan/50 transition-all duration-300 rounded cursor-pointer relative overflow-hidden shadow-sm dark:shadow-none">
              <div className="absolute inset-0 bg-neon-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10 flex items-start gap-4">
                <div className="text-2xl group-hover:scale-110 transition-transform">{node.icon}</div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase font-mono tracking-wider mb-1 group-hover:text-neon-cyan transition-colors">{node.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2">{node.desc}</p>
                  <p className="text-[10px] text-amber-700 dark:text-neon-amber font-mono border-l-2 border-amber-300 dark:border-neon-amber/50 pl-2 transition-colors duration-400">{node.limitation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Live Capability Strip */}
        <div ref={stripRef} className="w-full opacity-0 mb-12">
          <h3 className="text-center text-[10px] font-mono text-slate-500 dark:text-zinc-500 uppercase tracking-[0.2em] mb-4 transition-colors duration-400">Live Subsystem Telemetry</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {capabilities ? (
              <>
                <CapabilityPill label="LOCAL REASONING" status={capabilities.reasoning.status} detail={capabilities.reasoning.model} />
                <CapabilityPill label="VISION" status={capabilities.vision.status} detail={capabilities.vision.model} />
                <CapabilityPill label="CODE ENGINE" status="available" detail="Qwen2.5-Coder" />
                <CapabilityPill label="SANDBOX" status={capabilities.sandbox.status} detail={capabilities.sandbox.mode} />
                <CapabilityPill label="NET MONITOR" status={capabilities.network.status} detail={capabilities.network.mode} />
                <CapabilityPill label="GPU" status={capabilities.gpu.status} detail={capabilities.gpu.evidence || undefined} />
              </>
            ) : (
              <div className="text-xs font-mono text-slate-500 dark:text-zinc-500 animate-pulse transition-colors duration-400">Polling subsystems...</div>
            )}
          </div>
        </div>

        {/* Limitations Accordion (Simplified as a visible panel) */}
        <div className="w-full max-w-3xl border border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-[#0A0E17]/80 rounded p-6 backdrop-blur shadow-sm dark:shadow-none transition-colors duration-400">
          <h3 className="text-sm font-mono text-slate-700 dark:text-zinc-300 uppercase tracking-widest mb-4 border-b border-slate-200 dark:border-zinc-800 pb-2 flex items-center justify-between">
            <span>Know the Runtime</span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500">TRANSPARENCY REPORT</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-xs text-slate-500 dark:text-zinc-400 transition-colors duration-400">
            <div>
              <strong className="block text-slate-700 dark:text-zinc-300 mb-1">CPU_FALLBACK</strong>
              Partial GPU offload due to VRAM limits. Model cold-start latency applies.
            </div>
            <div>
              <strong className="block text-slate-700 dark:text-zinc-300 mb-1">DEGRADED_SANDBOX</strong>
              Code runs via restricted AST-allowlist. No Docker cgroups or resource limits.
            </div>
            <div>
              <strong className="block text-slate-700 dark:text-zinc-300 mb-1">PROCESS TELEMETRY</strong>
              Uses `psutil` for socket monitoring. Requires NPCAP/admin for packet-level capture.
            </div>
            <div>
              <strong className="block text-slate-700 dark:text-zinc-300 mb-1">DEMO CORPUS</strong>
              RAG limited to 17 vectors. Production requires full batch ingest of OISD/ASME.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

function CapabilityPill({ label, status, detail }: { label: string, status: string, detail?: string }) {
  const isOk = status === "available" || status === "ok" || status === "SOVEREIGN [Loopback Only]";
  const isDegraded = status === "degraded";
  
  let color = "text-red-600 dark:text-red-400 border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10";
  if (isOk) color = "text-emerald-700 dark:text-neon-emerald border-emerald-300 dark:border-neon-emerald/30 bg-emerald-50 dark:bg-neon-emerald/10";
  else if (isDegraded) color = "text-amber-700 dark:text-neon-amber border-amber-300 dark:border-neon-amber/30 bg-amber-50 dark:bg-neon-amber/10";

  return (
    <div className={`flex flex-col justify-center px-3 py-2 border rounded-sm ${color} backdrop-blur min-w-[120px] text-center group relative cursor-help leading-normal shrink-0 transition-colors duration-400`}>
      <span className="text-[9px] font-mono font-bold uppercase tracking-widest mb-0.5">{label}</span>
      <span className="text-[8px] font-mono opacity-80 uppercase">{isOk ? "AVAILABLE" : isDegraded ? "DEGRADED" : "UNAVAILABLE"}</span>
      
      {detail && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-white dark:bg-cyber-obsidian border border-slate-300 dark:border-zinc-700 p-2 rounded-sm text-[9px] text-slate-700 dark:text-zinc-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl pointer-events-none text-left">
          {detail}
        </div>
      )}
    </div>
  );
}
