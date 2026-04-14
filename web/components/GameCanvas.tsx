"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Agent } from "@/lib/types";
import { buildTileMap, buildFurnitureInstances, TILE_SIZE, AGENT_HOME_TILES } from "../../shared/engine/tileMap";
import { createGameLoop } from "../../shared/engine/gameLoop";
import { renderFrame } from "../../shared/engine/renderer";
import type { CharacterRenderState } from "../../shared/types";

interface Props {
  agents: Agent[];
  selectedId: string | null;
  isReplaying: boolean;
  onAgentClick: (agent: Agent) => void;
}

const ZOOM = 2;
const tileMap = buildTileMap();
const furniture = buildFurnitureInstances();

export default function GameCanvas({ agents, selectedId, isReplaying, onAgentClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<ReturnType<typeof createGameLoop> | null>(null);
  const latestChars = useRef<CharacterRenderState[]>([]);
  const offsetRef = useRef({ x: 0, y: 0 });

  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  // Init game loop once
  useEffect(() => {
    const loop = createGameLoop(tileMap, AGENT_HOME_TILES, (chars) => {
      latestChars.current = chars.map(c => ({
        ...c,
        selected: c.id === selectedIdRef.current,
      }));

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderFrame(ctx, tileMap, furniture, latestChars.current, offsetRef.current.x, offsetRef.current.y, ZOOM);
    });

    loopRef.current = loop;
    loop.start();
    return () => loop.stop();
  }, []);

  // Feed agents to game loop on change
  useEffect(() => {
    loopRef.current?.setAgents(
      agents.map((a, i) => ({
        id: a.id,
        name: a.name,
        agentState: a.state,
        paused: a.paused,
        paletteIndex: i % 5,
      }))
    );
  }, [agents]);

  // Resize canvas to container, recompute offset
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      const mapW = 45 * TILE_SIZE * ZOOM;
      const mapH = 30 * TILE_SIZE * ZOOM;
      offsetRef.current = {
        x: Math.max(0, (canvas.width - mapW) / 2),
        y: Math.max(0, (canvas.height - mapH) / 2),
      };
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isReplaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (const ch of latestChars.current) {
      const px = offsetRef.current.x + ch.col * TILE_SIZE * ZOOM - (16 * ZOOM) / 2;
      const py = offsetRef.current.y + ch.row * TILE_SIZE * ZOOM - 26 * ZOOM;
      if (mx >= px && mx <= px + 16 * ZOOM && my >= py && my <= py + 26 * ZOOM) {
        const agent = agentsRef.current.find(a => a.id === ch.id);
        if (agent) { onAgentClick(agent); return; }
      }
    }
  }, [isReplaying, onAgentClick]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "hidden", background: "#1a1208" }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{ display: "block", imageRendering: "pixelated", cursor: "pointer" }}
      />
    </div>
  );
}
