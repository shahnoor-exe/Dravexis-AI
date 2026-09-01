// components/CapabilityBadge.tsx — Shows real capability state, never hides limitations
import React from "react";

type Props = {
  label: string;
  status: string;
  compact?: boolean;
};

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: "bg-emerald-900/60 text-emerald-300 border-emerald-700",
  CONNECTED: "bg-emerald-900/60 text-emerald-300 border-emerald-700",
  ok: "bg-emerald-900/60 text-emerald-300 border-emerald-700",
  LOADING: "bg-amber-900/60 text-amber-300 border-amber-700 animate-pulse",
  DEGRADED: "bg-orange-900/60 text-orange-300 border-orange-700",
  DEGRADED_SANDBOX: "bg-orange-900/60 text-orange-300 border-orange-700",
  VISION_UNAVAILABLE: "bg-red-900/60 text-red-300 border-red-700",
  UNAVAILABLE: "bg-red-900/60 text-red-300 border-red-700",
  DISCONNECTED: "bg-red-900/60 text-red-300 border-red-700",
  ERROR: "bg-red-900/60 text-red-300 border-red-700",
  error: "bg-red-900/60 text-red-300 border-red-700",
  psutil_only: "bg-sky-900/60 text-sky-300 border-sky-700",
  UNKNOWN: "bg-zinc-700/60 text-zinc-300 border-zinc-600",
};

function getStyle(status: string): string {
  return (
    STATUS_STYLES[status] ??
    STATUS_STYLES["UNKNOWN"]
  );
}

export const CapabilityBadge: React.FC<Props> = ({ label, status, compact }) => {
  const style = getStyle(status);
  return (
    <div className={`flex ${compact ? "flex-row gap-2 items-center" : "flex-col gap-1"}`}>
      {!compact && <span className="text-xs text-zinc-400 font-medium uppercase tracking-wide">{label}</span>}
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono font-semibold ${style}`}
        title={`${label}: ${status}`}
      >
        {compact && <span className="text-zinc-400 mr-1 text-[10px]">{label}:</span>}
        {status}
      </span>
    </div>
  );
};
