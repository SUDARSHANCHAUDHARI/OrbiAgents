"use client";

import { Agent } from "@/lib/types";

interface Props {
  agent: Agent;
  selected: boolean;
  onClick: (agent: Agent) => void;
}

const AGENT_AVATAR: Record<string, string> = {
  "1": "🧠",
  "2": "💻",
  "3": "🧪",
  "4": "👁️",
  "5": "🔍",
};

// Vibrant per-role card styling
const AGENT_STYLE: Record<string, { card: string; dot: string; label: string; glow: string }> = {
  "1": {
    card:  "bg-gradient-to-b from-violet-900/70 to-violet-950/80 border-violet-500/30",
    dot:   "bg-violet-400",
    label: "text-violet-300",
    glow:  "shadow-[0_0_24px_6px_rgba(139,92,246,0.45)]",
  },
  "2": {
    card:  "bg-gradient-to-b from-sky-900/70 to-sky-950/80 border-sky-500/30",
    dot:   "bg-sky-400",
    label: "text-sky-300",
    glow:  "shadow-[0_0_24px_6px_rgba(56,189,248,0.45)]",
  },
  "3": {
    card:  "bg-gradient-to-b from-emerald-900/70 to-emerald-950/80 border-emerald-500/30",
    dot:   "bg-emerald-400",
    label: "text-emerald-300",
    glow:  "shadow-[0_0_24px_6px_rgba(52,211,153,0.45)]",
  },
  "4": {
    card:  "bg-gradient-to-b from-amber-900/70 to-amber-950/80 border-amber-500/30",
    dot:   "bg-amber-400",
    label: "text-amber-300",
    glow:  "shadow-[0_0_24px_6px_rgba(251,191,36,0.45)]",
  },
  "5": {
    card:  "bg-gradient-to-b from-rose-900/70 to-rose-950/80 border-rose-500/30",
    dot:   "bg-rose-400",
    label: "text-rose-300",
    glow:  "shadow-[0_0_24px_6px_rgba(251,113,133,0.45)]",
  },
};

const STATE_INACTIVE_CARD = "shadow-none opacity-80";

const STATE_LABEL_COLOR: Record<Agent["state"], string> = {
  idle:      "text-gray-500",
  thinking:  "text-violet-400",
  reading:   "text-violet-300",
  coding:    "text-sky-400",
  testing:   "text-emerald-400",
  reviewing: "text-amber-400",
  debugging: "text-rose-400",
  "permission-waiting": "text-orange-400",
  done:      "text-green-400",
};

const isActive = (state: Agent["state"]) =>
  state !== "idle" && state !== "done";

export default function AgentBox({ agent, selected, onClick }: Props) {
  const style  = AGENT_STYLE[agent.id] ?? AGENT_STYLE["1"];
  const active = !agent.paused && isActive(agent.state);
  const labelColor = agent.paused ? "text-gray-600" : STATE_LABEL_COLOR[agent.state];

  return (
    <div
      className={`absolute flex flex-col items-center cursor-pointer select-none group ${active ? "animate-orbi-float" : ""}`}
      style={{ left: agent.x, top: agent.y }}
      onClick={() => onClick(agent)}
    >
      {/* Card */}
      <div
        className={`
          relative w-[88px] rounded-2xl border
          px-2 pt-4 pb-3
          flex flex-col items-center gap-2
          transition-all duration-500 ease-out
          backdrop-blur-sm
          ${style.card}
          ${active ? style.glow : STATE_INACTIVE_CARD}
          ${selected ? "ring-2 ring-white/30 scale-110" : "hover:scale-105"}
          ${agent.paused ? "opacity-35" : ""}
        `}
      >
        {/* Status dot */}
        <div className="absolute top-2.5 right-2.5">
          <span className="relative flex h-2 w-2">
            {active && (
              <span className={`animate-orbi-ping absolute inline-flex h-full w-full rounded-full ${style.dot} opacity-70`} />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${active ? style.dot : "bg-gray-700"}`} />
          </span>
        </div>

        {/* Avatar */}
        <span className="text-3xl leading-none drop-shadow-lg">
          {AGENT_AVATAR[agent.id] ?? "🤖"}
        </span>

        {/* State badge */}
        <span
          key={agent.state}
          className={`text-[9px] font-bold uppercase tracking-widest animate-orbi-slide-up px-1.5 py-0.5 rounded-full bg-black/30 ${labelColor}`}
        >
          {agent.paused ? "paused" : agent.state}
        </span>
      </div>

      {/* Name */}
      <span className="mt-2 text-[11px] text-gray-300 font-semibold tracking-tight whitespace-nowrap">
        {agent.name}
      </span>

      {/* Cost badge if non-zero */}
      {agent.costUsd > 0 && (
        <span className="text-[9px] font-mono text-yellow-500/70 mt-0.5">
          ${agent.costUsd.toFixed(4)}
        </span>
      )}

      {/* Hover tooltip */}
      <div className="absolute bottom-full mb-3 hidden group-hover:flex z-30 pointer-events-none justify-center">
        <div className="orbi-glass border border-white/10 rounded-xl px-3 py-2.5 shadow-2xl max-w-[200px] min-w-[140px]">
          <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${labelColor}`}>
            {agent.paused ? "paused" : agent.state}
          </p>
          <p className="text-[11px] text-gray-300 leading-snug line-clamp-3">
            {agent.task || "Waiting…"}
          </p>
          {agent.costUsd > 0 && (
            <p className="text-[10px] font-mono text-yellow-400 mt-1.5 border-t border-white/5 pt-1.5">
              ${agent.costUsd.toFixed(4)} this run
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
