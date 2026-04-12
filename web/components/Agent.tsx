"use client";

import { Agent } from "@/lib/types";

interface Props {
  agent: Agent;
  selected: boolean;
  onClick: (agent: Agent) => void;
}

const STATE_STYLES: Record<Agent["state"], string> = {
  idle: "bg-gray-500",
  thinking: "bg-yellow-500 animate-bounce",
  coding: "bg-blue-500 animate-pulse",
  done: "bg-green-500",
};

const STATE_EMOJI: Record<Agent["state"], string> = {
  idle: "💤",
  thinking: "🤔",
  coding: "💻",
  done: "✅",
};

export default function AgentBox({ agent, selected, onClick }: Props) {
  const baseStyle = agent.paused
    ? "bg-gray-700 opacity-60"
    : STATE_STYLES[agent.state];

  return (
    <div
      className="absolute flex flex-col items-center cursor-pointer select-none"
      style={{ left: agent.x, top: agent.y }}
      onClick={() => onClick(agent)}
    >
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg transition-all duration-300 ${baseStyle} ${
          selected ? "ring-2 ring-white ring-offset-2 ring-offset-gray-800" : ""
        }`}
      >
        {agent.paused ? "⏸️" : STATE_EMOJI[agent.state]}
      </div>
      <span className="mt-1 text-xs text-gray-300 whitespace-nowrap font-medium">
        {agent.name}
      </span>
      <span className="text-[10px] text-gray-500 whitespace-nowrap max-w-[90px] truncate">
        {agent.paused ? "Paused" : agent.state}
      </span>
    </div>
  );
}
