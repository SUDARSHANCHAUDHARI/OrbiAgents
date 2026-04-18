import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildTileMap, buildFurnitureInstances, AGENT_HOME_TILES, TILE_SIZE } from "shared/engine/tileMap";
import { createGameLoop } from "shared/engine/gameLoop";
import { renderFrame } from "shared/engine/renderer";
import { SoundSystem } from "shared/engine/soundSystem";
import {
  loadCustomFurniture,
  saveCustomFurniture,
  customItemToFurnitureInstance,
  SPRITE_LABELS,
  type CustomFurnitureItem,
  type SpriteKey,
} from "shared/engine/layoutStorage";
import type { AgentInput } from "shared/engine/gameLoop";
import type { CharacterRenderState, FurnitureInstance } from "shared/types";

const tileMap = buildTileMap();
const defaultFurniture = buildFurnitureInstances();
const ZOOM = 2;
const CHIME_STATES = new Set(["done", "permission-waiting"]);
const sound = new SoundSystem();
const SPRITE_KEYS = Object.keys(SPRITE_LABELS) as SpriteKey[];

interface AgentUpdate {
  id: string;
  name: string;
  agentState: string;
  paused: boolean;
  paletteIndex: number;
  activeToolName?: string;
}

const CHAR_W = 16;
const CHAR_H = 26;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<ReturnType<typeof createGameLoop> | null>(null);
  const latestChars = useRef<CharacterRenderState[]>([]);
  const [agents, setAgents] = useState<AgentUpdate[]>([]);
  const agentsRef = useRef<AgentUpdate[]>([]);
  agentsRef.current = agents;
  const prevStatesRef = useRef<Map<string, string>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  // Layout editor state
  const [editMode, setEditMode] = useState(false);
  const [selectedSprite, setSelectedSprite] = useState<SpriteKey>("plant");
  const [customItems, setCustomItems] = useState<CustomFurnitureItem[]>([]);
  const historyRef = useRef<CustomFurnitureItem[][]>([]);

  const furnitureRef = useRef<FurnitureInstance[]>(defaultFurniture);

  useEffect(() => {
    setCustomItems(loadCustomFurniture());
  }, []);

  const mergedFurniture = useMemo<FurnitureInstance[]>(
    () => [...defaultFurniture, ...customItems.map(customItemToFurnitureInstance)],
    [customItems],
  );
  furnitureRef.current = mergedFurniture;

  // Init game loop once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const loop = createGameLoop(tileMap, AGENT_HOME_TILES, (chars) => {
      latestChars.current = chars.map(c => ({
        ...c,
        selected: c.id === selectedIdRef.current,
      }));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderFrame(ctx, tileMap, furnitureRef.current, latestChars.current, 0, 0, ZOOM);
    });

    loopRef.current = loop;
    loop.start();

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) renderFrame(ctx, tileMap, furnitureRef.current, latestChars.current, 0, 0, ZOOM);
    };
    window.addEventListener("resize", onResize);

    return () => {
      loop.stop();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Detect state transitions and play chime
  useEffect(() => {
    const prev = prevStatesRef.current;
    let shouldChime = false;
    for (const agent of agents) {
      const prevState = prev.get(agent.id);
      if (prevState !== agent.agentState && CHIME_STATES.has(agent.agentState)) {
        shouldChime = true;
      }
      prev.set(agent.id, agent.agentState);
    }
    if (shouldChime) sound.play();
  }, [agents]);

  // Feed agents to game loop when state changes
  useEffect(() => {
    const inputs: AgentInput[] = agents.map(a => ({
      id: a.id,
      name: a.name,
      agentState: a.agentState,
      paused: a.paused,
      paletteIndex: a.paletteIndex,
      activeToolName: a.activeToolName,
    }));
    loopRef.current?.setAgents(inputs);
  }, [agents]);

  // Listen for messages from the extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data && typeof data === "object" && data.type === "agents" && Array.isArray(data.agents)) {
        setAgents(data.agents as AgentUpdate[]);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Ctrl+Z undo in edit mode
  useEffect(() => {
    if (!editMode) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        const history = historyRef.current;
        if (history.length === 0) return;
        const prev = history[history.length - 1];
        historyRef.current = history.slice(0, -1);
        setCustomItems(prev);
        saveCustomFurniture(prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editMode]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    sound.unlock();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (editMode) {
      const col = Math.floor(mx / (TILE_SIZE * ZOOM));
      const row = Math.floor(my / (TILE_SIZE * ZOOM));
      setCustomItems(prev => {
        historyRef.current = [...historyRef.current, prev];
        const next = [...prev, { spriteKey: selectedSprite, col, row }];
        saveCustomFurniture(next);
        return next;
      });
      return;
    }

    for (const ch of latestChars.current) {
      const px = ch.col * TILE_SIZE * ZOOM - (CHAR_W * ZOOM) / 2;
      const py = ch.row * TILE_SIZE * ZOOM - CHAR_H * ZOOM;
      if (mx >= px && mx <= px + CHAR_W * ZOOM && my >= py && my <= py + CHAR_H * ZOOM) {
        setSelectedId(prev => prev === ch.id ? null : ch.id);
        return;
      }
    }
    setSelectedId(null);
  }, [editMode, selectedSprite]);

  const undo = useCallback(() => {
    const history = historyRef.current;
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    historyRef.current = history.slice(0, -1);
    setCustomItems(prev);
    saveCustomFurniture(prev);
  }, []);

  const clearAll = useCallback(() => {
    historyRef.current = [...historyRef.current, customItems];
    setCustomItems([]);
    saveCustomFurniture([]);
  }, [customItems]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{ display: "block", width: "100%", height: "100%", cursor: editMode ? "crosshair" : "pointer" }}
      />

      {/* Edit toggle */}
      <button
        onClick={() => setEditMode(m => !m)}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 10,
          padding: "4px 10px",
          borderRadius: 6,
          border: `1px solid ${editMode ? "#F59E0B" : "#374151"}`,
          background: editMode ? "#422006" : "#1F2937",
          color: editMode ? "#FCD34D" : "#9CA3AF",
          fontSize: 11,
          fontFamily: "monospace",
          cursor: "pointer",
        }}
      >
        {editMode ? "✕ Done" : "✏"}
      </button>

      {/* Editor toolbar */}
      {editMode && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 10px",
            borderRadius: 10,
            background: "rgba(15,23,42,0.95)",
            border: "1px solid #334155",
            boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
          }}
        >
          {SPRITE_KEYS.map(key => (
            <button
              key={key}
              onClick={() => setSelectedSprite(key)}
              style={{
                padding: "3px 8px",
                borderRadius: 5,
                border: `1px solid ${selectedSprite === key ? "#60A5FA" : "#374151"}`,
                background: selectedSprite === key ? "#1E3A5F" : "#111827",
                color: selectedSprite === key ? "#93C5FD" : "#9CA3AF",
                fontSize: 10,
                fontFamily: "monospace",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {SPRITE_LABELS[key]}
            </button>
          ))}

          <div style={{ width: 1, background: "#334155", alignSelf: "stretch", margin: "0 2px" }} />

          <button
            onClick={undo}
            style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #374151", background: "#111827", color: "#9CA3AF", fontSize: 10, fontFamily: "monospace", cursor: "pointer" }}
          >
            ↩
          </button>
          <button
            onClick={clearAll}
            style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #374151", background: "#111827", color: "#EF4444", fontSize: 10, fontFamily: "monospace", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
