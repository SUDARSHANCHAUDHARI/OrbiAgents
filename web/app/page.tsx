"use client";

import { useEffect, useRef, useState } from "react";
import { Agent, ClientMessage } from "@/lib/types";
import AgentBox from "@/components/Agent";
import SidePanel from "@/components/SidePanel";

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:4000");
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data: Agent[] = JSON.parse(event.data);
      setAgents(data);
      setSelected((prev) => (prev ? data.find((a) => a.id === prev.id) ?? null : null));
    };

    return () => ws.close();
  }, []);

  function send(msg: ClientMessage) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  function handlePause(agentId: string) {
    send({ type: "pause", agentId });
  }

  function handleResume(agentId: string) {
    send({ type: "resume", agentId });
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className="flex-1 flex flex-col">
        <header className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center text-sm font-bold">
              O
            </div>
            <span className="font-semibold tracking-tight">OrbiAgents</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            {agents.length} agents live
          </div>
        </header>

        <main className="flex-1 relative overflow-hidden bg-gray-900">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          <div className="absolute top-3 left-3 text-xs text-gray-600 select-none">
            Office Floor
          </div>

          {agents.map((agent) => (
            <AgentBox
              key={agent.id}
              agent={agent}
              selected={selected?.id === agent.id}
              onClick={setSelected}
            />
          ))}

          {agents.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
              Connecting to agents...
            </div>
          )}
        </main>
      </div>

      {selected && (
        <SidePanel
          agent={selected}
          onClose={() => setSelected(null)}
          onPause={handlePause}
          onResume={handleResume}
        />
      )}
    </div>
  );
}
