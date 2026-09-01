// hooks/useGSAPAnimations.ts — App-load GSAP timeline + cleanup
// Uses free-tier GSAP only: gsap.timeline(), fromTo(), ScrollTrigger
// Does NOT use Flip (Club plugin — not licensed)
// Cleanup on unmount: kills all tweens to prevent cross-run leakage

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * App-load animation: slide rails in, fade logo.
 * Called once from App.tsx.
 */
export function useAppLoadAnimation() {
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

    // Left rail slides in from left
    tl.fromTo(
      "[data-anim='left-rail']",
      { x: -60, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.6 }
    );

    // Right rail slides in from right
    tl.fromTo(
      "[data-anim='right-rail']",
      { x: 60, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.6 },
      "<" // same time as left rail
    );

    // Logo fades in
    tl.fromTo(
      "[data-anim='logo']",
      { opacity: 0, y: -8 },
      { opacity: 1, y: 0, duration: 0.4 },
      "-=0.3"
    );

    // Center stage fades up
    tl.fromTo(
      "[data-anim='center-stage']",
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.5 },
      "-=0.2"
    );

    return () => {
      tl.kill();
    };
  }, []);
}

/**
 * Query submit animation: pulse the submit button + composer.
 * Call with runStatus from agentStore.
 */
export function useQuerySubmitAnimation(runStatus: string) {
  const prevStatus = useRef(runStatus);

  useGSAP(() => {
    if (runStatus === "running" && prevStatus.current !== "running") {
      // Pulse the composer border
      gsap.to("[data-anim='query-composer']", {
        boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.8)",
        duration: 0.3,
        ease: "power2.out",
        yoyo: true,
        repeat: -1,
        repeatDelay: 0.5,
        id: "composer-pulse",
      });
    } else if (runStatus !== "running") {
      gsap.killTweensOf("[data-anim='query-composer']");
      gsap.to("[data-anim='query-composer']", {
        boxShadow: "0 0 0 0px rgba(59, 130, 246, 0)",
        duration: 0.3,
      });

      // Flash success or error
      if (runStatus === "success") {
        gsap.fromTo(
          "[data-anim='answer-panel']",
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
        );
      }
    }
    prevStatus.current = runStatus;
  }, [runStatus]);
}

/**
 * Agent node activation animation — called when nodeStates changes.
 * Drives node glow from real event data, not a fixed timer.
 */
export function useNodeActivationAnimation(nodeId: string, state: string) {
  useGSAP(() => {
    const selector = `[data-node-id='${nodeId}']`;
    if (state === "active") {
      gsap.to(selector, {
        filter: "drop-shadow(0 0 8px rgba(59,130,246,0.9))",
        duration: 0.3,
        ease: "power2.out",
        yoyo: true,
        repeat: -1,
      });
    } else {
      gsap.killTweensOf(selector);
      const color =
        state === "success" ? "rgba(34,197,94,0.6)" :
        state === "error" || state === "unavailable" ? "rgba(239,68,68,0.6)" :
        "none";
      gsap.to(selector, {
        filter: color === "none" ? "none" : `drop-shadow(0 0 6px ${color})`,
        duration: 0.4,
        ease: "power2.out",
      });
    }
  }, [state]);
}

/**
 * Panel switch animation: parallax-style opacity + x offset.
 * Call when active tab changes in CenterStage.
 */
export function usePanelSwitchAnimation(panelId: string, isActive: boolean) {
  useGSAP(() => {
    const selector = `[data-panel='${panelId}']`;
    if (isActive) {
      gsap.fromTo(
        selector,
        { opacity: 0, x: 16 },
        { opacity: 1, x: 0, duration: 0.35, ease: "power2.out" }
      );
    }
  }, [isActive]);
}

/**
 * Network egress counter animation.
 * CRITICAL: only animates real numeric values.
 * If value is null (UNKNOWN), shows static UNKNOWN label — never animates 0 as proof.
 */
export function useEgressAnimation(
  elementId: string,
  value: number | null,
  unit = "B"
) {
  const prevValue = useRef<number>(0);

  useGSAP(() => {
    if (value === null) {
      // Do NOT animate — just ensure label is UNKNOWN
      gsap.killTweensOf(`#${elementId}`);
      return;
    }

    const el = document.getElementById(elementId);
    if (!el) return;

    gsap.to(prevValue, {
      current: value,
      duration: 0.8,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = `${Math.round(prevValue.current)} ${unit}`;
      },
      onComplete: () => {
        el.textContent = `${value} ${unit}`;
      },
    });
  }, [value]);
}

/**
 * Hover micro-interaction helper — add to interactive elements.
 * Subtle scale + brightness, no bounce.
 */
export function addHoverMicroInteraction(selector: string) {
  const els = document.querySelectorAll(selector);
  els.forEach((el) => {
    el.addEventListener("mouseenter", () => {
      gsap.to(el, { scale: 1.03, filter: "brightness(1.15)", duration: 0.18, ease: "power2.out" });
    });
    el.addEventListener("mouseleave", () => {
      gsap.to(el, { scale: 1, filter: "brightness(1)", duration: 0.2, ease: "power2.out" });
    });
  });
}
