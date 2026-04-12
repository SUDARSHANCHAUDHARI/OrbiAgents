"use client";

import { Agent } from "@/lib/types";

interface Props {
  agent: Agent;
  onClose: () => void;
  onPause: (agentId: string) => void;
  onResume: (agentId: string) => void;
}

const STATE_COLOR: Record<Agent["state"], string> = {
  idle: "text-gray-400",
  thinking: "text-yellow-400",
  coding: "text-blue-400",
  done: "text-green-400",
};

export default function SidePanel({ agent, onClose, onPause, onResume }: Props) {
  return (
    <div className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="text-white font-semibold text-sm">{agent.name}</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-lg leading-none"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        <Row label="Status">
          <span
            className={`font-medium capitalize ${
              agent.paused ? "text-gray-400" : STATE_COLOR[agent.state]
            }`}
          >
            {agent.paused ? "Paused" : agent.state}
          </span>
        </Row>

        <Row label="Current Task">
          <span className="text-gray-300 text-xs leading-snug">{agent.task}</span>
        </Row>

        <Row label="Last Action">
          <span className="text-gray-400 text-xs">{agent.lastAction}</span>
        </Row>

        <Row label="Tokens Used">
          <span className="text-gray-300 font-mono text-xs">
            {agent.tokensUsed.toLocaleString()}
          </span>
        </Row>

        <Row label="Position">
          <span className="text-gray-400 font-mono text-xs">
            x:{agent.x} y:{agent.y}
          </span>
        </Row>
      </div>

      <div className="px-4 py-4 border-t border-gray-700">
        {agent.paused ? (
          <button
            onClick={() => onResume(agent.id)}
            className="w-full bg-green-600 hover:bg-green-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            ▶ Resume Agent
          </button>
        ) : (
          <button
            onClick={() => onPause(agent.id)}
            className="w-full bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            ⏸ Pause Agent
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      {children}
    </div>
  );
}
