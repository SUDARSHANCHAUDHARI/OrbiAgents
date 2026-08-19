"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import type { Agent, Workflow, WorkflowEvent } from "@/lib/types";
import { buildTileMap, TILE_SIZE } from "../../shared/engine/tileMap";
import { createGameLoop } from "../../shared/engine/gameLoop";
import { renderFrame } from "../../shared/engine/renderer";
import type { CharacterRenderState, FurnitureInstance } from "../../shared/types";
import {
  calculateCamera,
  calculateViewport,
  layoutAgents,
} from "@/lib/dashboardLayout";
import { SoundSystem } from "../../shared/engine/soundSystem";

interface Props {
  agents: Agent[];
  selectedId: string | null;
  isReplaying: boolean;
  workflow?: Workflow | null;
  events?: WorkflowEvent[];
  onAgentClick: (agent: Agent) => void;
  soundEnabled?: boolean;
  extraFurniture?: FurnitureInstance[];
  editMode?: boolean;
  onLayoutClick?: (col: number, row: number) => void;
}


const TYPE_TO_AGENT_ID: Record<string, string> = {
  planner: "1",
  coder: "2",
  tester: "3",
  reviewer: "4",
  debugger: "5",
};

const CHIME_STATES = new Set(["done", "permission-waiting"]);

export default function GameCanvas({ agents, selectedId, isReplaying, workflow, events = [], onAgentClick, soundEnabled = true, extraFurniture, editMode, onLayoutClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<ReturnType<typeof createGameLoop> | null>(null);
  const latestChars = useRef<CharacterRenderState[]>([]);
  const offsetRef = useRef({ x: 0, y: 0 });
  const targetOffsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1.8);
  const furnitureRef = useRef<FurnitureInstance[]>([]);
  const [cameraFrame, setCameraFrame] = useState({ offsetX: 0, offsetY: 0, zoom: 1.8 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const extraFurnitureRef = useRef<FurnitureInstance[]>(extraFurniture ?? []);
  extraFurnitureRef.current = extraFurniture ?? [];
  const tileMapRef = useRef<import("../../shared/types").TileType[][]>([]);
  const soundRef = useRef(new SoundSystem(soundEnabled));
  const prevStatesRef = useRef<Map<string, string>>(new Map());
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const officeLayout = useMemo(
    () => layoutAgents(agents, calculateViewport(viewportSize.width, viewportSize.height)),
    [agents, viewportSize.height, viewportSize.width],
  );
  furnitureRef.current = [...officeLayout.furniture, ...extraFurnitureRef.current];

  // Init game loop once with a placeholder tileMap — updated on first resize
  useEffect(() => {
    const initCols = Math.max(20, Math.ceil((containerRef.current?.clientWidth ?? 800) / TILE_SIZE));
    const initRows = Math.max(15, Math.ceil((containerRef.current?.clientHeight ?? 600) / TILE_SIZE));
    tileMapRef.current = buildTileMap(initCols, initRows);
    const loop = createGameLoop(tileMapRef.current, officeLayout.homeTiles, (chars) => {
      latestChars.current = chars.map(c => ({
        ...c,
        selected: c.id === selectedIdRef.current,
      }));

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      offsetRef.current = {
        x: offsetRef.current.x + (targetOffsetRef.current.x - offsetRef.current.x) * 0.16,
        y: offsetRef.current.y + (targetOffsetRef.current.y - offsetRef.current.y) * 0.16,
      };

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderFrame(
        ctx,
        tileMapRef.current,
        furnitureRef.current,
        latestChars.current,
        offsetRef.current.x,
        offsetRef.current.y,
        zoomRef.current,
      );
    });

    loopRef.current = loop;
    loop.start();
    return () => loop.stop();
  }, []);

  // Sync sound enabled flag
  useEffect(() => {
    soundRef.current.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Detect state transitions and play chime
  useEffect(() => {
    const prev = prevStatesRef.current;
    let shouldChime = false;
    for (const agent of agents) {
      const prevState = prev.get(agent.id);
      if (prevState !== agent.state && CHIME_STATES.has(agent.state)) {
        shouldChime = true;
      }
      prev.set(agent.id, agent.state);
    }
    if (shouldChime) soundRef.current.play();
  }, [agents]);

  // Feed agents to game loop on change
  useEffect(() => {
    loopRef.current?.setAgents(
      officeLayout.agents.map((agent, i) => ({
        id: agent.id,
        name: agent.name,
        agentState: agent.state,
        paused: agent.paused,
        paletteIndex: i % 5,
        homeTile: agent.homeTile,
        activeToolName: agent.state !== "idle" && agent.state !== "done"
          ? (agentsRef.current.find(a => a.id === agent.id)?.lastAction ?? undefined)
          : undefined,
      }))
    );
  }, [officeLayout.agents]);

  useEffect(() => {
    if (!viewportSize.width || !viewportSize.height) return;
    const viewport = calculateViewport(viewportSize.width, viewportSize.height);
    const camera = calculateCamera(viewport, officeLayout.contentBounds);
    zoomRef.current = camera.zoom;
    targetOffsetRef.current = { x: camera.offsetX, y: camera.offsetY };
    offsetRef.current = { x: camera.offsetX, y: camera.offsetY };
    setCameraFrame({ offsetX: camera.offsetX, offsetY: camera.offsetY, zoom: camera.zoom });
  }, [officeLayout.contentBounds, viewportSize.height, viewportSize.width]);

  // Resize canvas to container, recompute offset
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = w;
      canvas.height = h;
      // Rebuild tileMap to fill the new viewport
      const cols = Math.max(20, Math.ceil(w / TILE_SIZE));
      const rows = Math.max(15, Math.ceil(h / TILE_SIZE));
      tileMapRef.current = buildTileMap(cols, rows);
      loopRef.current?.setTileMap(tileMapRef.current);
      setViewportSize({ width: w, height: h });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;
  const onLayoutClickRef = useRef(onLayoutClick);
  onLayoutClickRef.current = onLayoutClick;

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    soundRef.current.unlock();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const zoom = zoomRef.current;

    if (editModeRef.current && onLayoutClickRef.current) {
      const col = Math.floor((mx - offsetRef.current.x) / (TILE_SIZE * zoom));
      const row = Math.floor((my - offsetRef.current.y) / (TILE_SIZE * zoom));
      onLayoutClickRef.current(col, row);
      return;
    }

    if (isReplaying) return;
    for (const ch of latestChars.current) {
      const px = offsetRef.current.x + ch.col * TILE_SIZE * zoom - (16 * zoom) / 2;
      const py = offsetRef.current.y + ch.row * TILE_SIZE * zoom - 26 * zoom;
      if (mx >= px && mx <= px + 16 * zoom && my >= py && my <= py + 26 * zoom) {
        const agent = agentsRef.current.find(a => a.id === ch.id);
        if (agent) { onAgentClick(agent); return; }
      }
    }
  }, [isReplaying, onAgentClick]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "var(--map-bg)",
        borderRadius: 16,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03), 0 20px 40px rgba(0,0,0,0.22)",
      }}
    >
      {/* Sub-agent parent→child relationship lines */}
      {(() => {
        const subEdges: Array<{ parentId: string; childId: string }> = [];
        for (const agent of agents) {
          const m = agent.id.match(/^sub-(.+)-\d+$/);
          if (m) subEdges.push({ parentId: m[1], childId: agent.id });
        }
        if (subEdges.length === 0) return null;
        return (
          <svg
            style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }}
            width="100%"
            height="100%"
          >
            <defs>
              <marker id="dag-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="rgba(251,191,36,0.7)" />
              </marker>
            </defs>
            {subEdges.map(({ parentId, childId }) => {
              const fromTile = officeLayout.homeTiles[parentId];
              const toTile = officeLayout.homeTiles[childId];
              if (!fromTile || !toTile) return null;
              const x1 = cameraFrame.offsetX + fromTile.col * TILE_SIZE * cameraFrame.zoom;
              const y1 = cameraFrame.offsetY + fromTile.row * TILE_SIZE * cameraFrame.zoom - 8 * cameraFrame.zoom;
              const x2 = cameraFrame.offsetX + toTile.col * TILE_SIZE * cameraFrame.zoom;
              const y2 = cameraFrame.offsetY + toTile.row * TILE_SIZE * cameraFrame.zoom - 8 * cameraFrame.zoom;
              const midX = (x1 + x2) / 2;
              return (
                <path
                  key={`${parentId}-${childId}`}
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="rgba(251,191,36,0.55)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                  markerEnd="url(#dag-arrow)"
                />
              );
            })}
          </svg>
        );
      })()}

      {workflow && workflow.edges.length > 0 && (
        <svg
          style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
          width="100%"
          height="100%"
        >
          {workflow.edges.map((edge) => {
            const fromNode = workflow.nodes.find((node) => node.id === edge.from);
            const toNode = workflow.nodes.find((node) => node.id === edge.to);
            if (!fromNode || !toNode) return null;
            const fromTile = officeLayout.homeTiles[TYPE_TO_AGENT_ID[fromNode.type]];
            const toTile = officeLayout.homeTiles[TYPE_TO_AGENT_ID[toNode.type]];
            if (!fromTile || !toTile) return null;

            const x1 = cameraFrame.offsetX + fromTile.col * TILE_SIZE * cameraFrame.zoom;
            const y1 = cameraFrame.offsetY + fromTile.row * TILE_SIZE * cameraFrame.zoom - 8 * cameraFrame.zoom;
            const x2 = cameraFrame.offsetX + toTile.col * TILE_SIZE * cameraFrame.zoom;
            const y2 = cameraFrame.offsetY + toTile.row * TILE_SIZE * cameraFrame.zoom - 8 * cameraFrame.zoom;
            const midX = (x1 + x2) / 2;

            return (
              <path
                key={`${edge.from}-${edge.to}`}
                d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="rgba(96,165,250,0.42)"
                strokeWidth={2}
                strokeDasharray="7 6"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      )}
      <svg
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4 }}
        width="100%"
        height="100%"
      >
        {events.filter((event) => event.type === "mailbox-message").slice(-4).map((event, index) => {
          const from = event.senderAgentId ? officeLayout.homeTiles[event.senderAgentId] : undefined;
          const to = event.recipientAgentId ? officeLayout.homeTiles[event.recipientAgentId] : undefined;
          if (!from || !to) return null;
          const x1 = cameraFrame.offsetX + from.col * TILE_SIZE * cameraFrame.zoom;
          const y1 = cameraFrame.offsetY + from.row * TILE_SIZE * cameraFrame.zoom - 12 * cameraFrame.zoom;
          const x2 = cameraFrame.offsetX + to.col * TILE_SIZE * cameraFrame.zoom;
          const y2 = cameraFrame.offsetY + to.row * TILE_SIZE * cameraFrame.zoom - 12 * cameraFrame.zoom;
          const path = `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.min(y1, y2) - 60} ${x2} ${y2}`;
          return (
            <g key={`${event.timestamp}-${index}`} className="orbi-mail-flight">
              <path d={path} fill="none" stroke="rgba(250,204,21,0.28)" strokeWidth="2" strokeDasharray="4 5" />
              <text fontSize="18">✉
                <animateMotion path={path} dur="1.4s" begin={`${index * 0.12}s`} fill="freeze" />
              </text>
            </g>
          );
        })}
      </svg>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{ display: "block", imageRendering: "pixelated", cursor: "pointer", position: "relative", zIndex: 1 }}
      />
    </div>
  );
}
