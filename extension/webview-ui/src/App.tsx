import React, { useEffect, useRef, useState } from "react";
import { buildTileMap, buildFurnitureInstances, AGENT_HOME_TILES } from "shared/engine/tileMap";
import { createGameLoop } from "shared/engine/gameLoop";
import { renderFrame } from "shared/engine/renderer";
import type { AgentInput } from "shared/engine/gameLoop";
import type { CharacterRenderState } from "shared/types";

const tileMap = buildTileMap();
const furniture = buildFurnitureInstances();
const ZOOM = 2;

interface AgentUpdate {
  id: string;
  name: string;
  agentState: string;
  paused: boolean;
  paletteIndex: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<ReturnType<typeof createGameLoop> | null>(null);
  const latestChars = useRef<CharacterRenderState[]>([]);
  const [agents, setAgents] = useState<AgentUpdate[]>([]);
  const agentsRef = useRef<AgentUpdate[]>([]);
  agentsRef.current = agents;

  // Init game loop once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const loop = createGameLoop(tileMap, AGENT_HOME_TILES, (chars) => {
      latestChars.current = chars;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderFrame(ctx, tileMap, furniture, chars, 0, 0, ZOOM);
    });

    loopRef.current = loop;
    loop.start();

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    return () => {
      loop.stop();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Feed agents to game loop when state changes
  useEffect(() => {
    const inputs: AgentInput[] = agents.map(a => ({
      id: a.id,
      name: a.name,
      agentState: a.agentState,
      paused: a.paused,
      paletteIndex: a.paletteIndex,
    }));
    loopRef.current?.setAgents(inputs);
  }, [agents]);

  // Listen for messages from the extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as { type: string; agents?: AgentUpdate[] };
      if (msg.type === "agents" && msg.agents) {
        setAgents(msg.agents);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
