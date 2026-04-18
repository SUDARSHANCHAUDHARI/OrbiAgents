import React, { useCallback, useEffect, useRef, useState } from "react";
import { buildTileMap, buildFurnitureInstances, buildAgentHomeTiles, TILE_SIZE } from "shared/engine/tileMap";
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

const ZOOM = 2;

function gridFromWindow() {
  return {
    cols: Math.max(20, Math.ceil(window.innerWidth / (TILE_SIZE * ZOOM))),
    rows: Math.max(15, Math.ceil(window.innerHeight / (TILE_SIZE * ZOOM))),
  };
}
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

interface DiagnosticsData {
  hookServerPort: number | null;
  hookServerOwner: boolean;
  hookServerPid: number | null;
  hookEventsReceived: number;
  activeSessions: number;
  hooksInstalled: boolean;
  watcherRunning: boolean;
  uptime: number;
  workspaceFolder: string | null;
  assetPackLoaded: boolean;
  assetPackItems: number;
}

interface CharPos {
  id: string;
  col: number;
  row: number;
}

const CHAR_W = 16;
const CHAR_H = 26;

const STATE_COLORS: Record<string, string> = {
  thinking: "#818CF8",
  coding: "#34D399",
  reading: "#60A5FA",
  "permission-waiting": "#FBBF24",
  done: "#A78BFA",
  idle: "#4B5563",
  debugging: "#F87171",
};

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

  // Always-show labels
  const [alwaysShowLabels, setAlwaysShowLabels] = useState(false);
  const [charPositions, setCharPositions] = useState<CharPos[]>([]);

  // Diagnostics
  const [showDiag, setShowDiag] = useState(false);
  const [diagData, setDiagData] = useState<DiagnosticsData | null>(null);

  // Layout editor state
  const [editMode, setEditMode] = useState(false);
  const [selectedSprite, setSelectedSprite] = useState<SpriteKey>("plant");
  const [customItems, setCustomItems] = useState<CustomFurnitureItem[]>([]);
  const historyRef = useRef<CustomFurnitureItem[][]>([]);

  const baseFurnitureRef = useRef<FurnitureInstance[]>([]);
  const furnitureRef = useRef<FurnitureInstance[]>([]);
  const customItemsRef = useRef<CustomFurnitureItem[]>([]);
  customItemsRef.current = customItems;

  const rebuildFurniture = useCallback((base: FurnitureInstance[]) => {
    baseFurnitureRef.current = base;
    furnitureRef.current = [...base, ...customItemsRef.current.map(customItemToFurnitureInstance)];
  }, []);

  useEffect(() => {
    setCustomItems(loadCustomFurniture());
  }, []);

  useEffect(() => {
    furnitureRef.current = [...baseFurnitureRef.current, ...customItems.map(customItemToFurnitureInstance)];
  }, [customItems]);

  // Init game loop once, rebuild tileMap/furniture on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { cols, rows } = gridFromWindow();
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let currentTileMap = buildTileMap(cols, rows);
    rebuildFurniture(buildFurnitureInstances(cols, rows));

    const loop = createGameLoop(currentTileMap, buildAgentHomeTiles(cols, rows), (chars) => {
      latestChars.current = chars.map(c => ({
        ...c,
        selected: c.id === selectedIdRef.current,
      }));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderFrame(ctx, currentTileMap, furnitureRef.current, latestChars.current, 0, 0, ZOOM);

      // Update label positions for always-show overlay
      setCharPositions(chars.map(c => ({ id: c.id, col: c.col, row: c.row })));
    });

    loopRef.current = loop;
    loop.start();

    const onResize = () => {
      const { cols: c, rows: r } = gridFromWindow();
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      currentTileMap = buildTileMap(c, r);
      rebuildFurniture(buildFurnitureInstances(c, r));
      loop.setTileMap(currentTileMap);
      const ctx = canvas.getContext("2d");
      if (ctx) renderFrame(ctx, currentTileMap, furnitureRef.current, latestChars.current, 0, 0, ZOOM);
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
      if (!data || typeof data !== "object") return;

      if (data.type === "agents" && Array.isArray(data.agents)) {
        setAgents(data.agents as AgentUpdate[]);
      }

      if (data.type === "diagnostics") {
        setDiagData(data.payload as DiagnosticsData);
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

  const requestDiagnostics = useCallback(() => {
    // @ts-expect-error acquireVsCodeApi is injected by the extension host
    const vscode = window.acquireVsCodeApi?.();
    vscode?.postMessage({ type: "requestDiagnostics" });
    setShowDiag(d => !d);
  }, []);

  // Build a lookup from agent id → agent for label rendering
  const agentById = new Map(agents.map(a => [a.id, a]));

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{ display: "block", width: "100%", height: "100%", cursor: editMode ? "crosshair" : "pointer" }}
      />

      {/* Always-show label overlays */}
      {alwaysShowLabels && charPositions.map(pos => {
        const agent = agentById.get(pos.id);
        if (!agent || agent.agentState === "idle") return null;
        const px = pos.col * TILE_SIZE * ZOOM - (CHAR_W * ZOOM) / 2;
        const py = pos.row * TILE_SIZE * ZOOM - CHAR_H * ZOOM - 18;
        const color = STATE_COLORS[agent.agentState] ?? "#9CA3AF";
        return (
          <div
            key={pos.id}
            style={{
              position: "absolute",
              left: px,
              top: py,
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
            }}
          >
            <div style={{
              fontSize: 8,
              fontFamily: "monospace",
              color,
              background: "rgba(0,0,0,0.7)",
              padding: "1px 4px",
              borderRadius: 3,
              whiteSpace: "nowrap",
              border: `1px solid ${color}44`,
            }}>
              {agent.name}
            </div>
            <div style={{
              fontSize: 7,
              fontFamily: "monospace",
              color: "#6B7280",
              background: "rgba(0,0,0,0.6)",
              padding: "1px 3px",
              borderRadius: 2,
              whiteSpace: "nowrap",
            }}>
              {agent.activeToolName ?? agent.agentState}
            </div>
          </div>
        );
      })}

      {/* Toolbar — top-right */}
      <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10, display: "flex", gap: 4 }}>
        {/* Labels toggle */}
        <button
          onClick={() => setAlwaysShowLabels(l => !l)}
          title="Toggle always-show agent labels"
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: `1px solid ${alwaysShowLabels ? "#818CF8" : "#374151"}`,
            background: alwaysShowLabels ? "#1E1B4B" : "#1F2937",
            color: alwaysShowLabels ? "#A5B4FC" : "#9CA3AF",
            fontSize: 10,
            fontFamily: "monospace",
            cursor: "pointer",
          }}
        >
          {alwaysShowLabels ? "🏷 ON" : "🏷"}
        </button>

        {/* Diagnostics toggle */}
        <button
          onClick={requestDiagnostics}
          title="Connection diagnostics"
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: `1px solid ${showDiag ? "#34D399" : "#374151"}`,
            background: showDiag ? "#064E3B" : "#1F2937",
            color: showDiag ? "#6EE7B7" : "#9CA3AF",
            fontSize: 10,
            fontFamily: "monospace",
            cursor: "pointer",
          }}
        >
          DIAG
        </button>

        {/* Edit toggle */}
        <button
          onClick={() => setEditMode(m => !m)}
          style={{
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
      </div>

      {/* Diagnostics panel */}
      {showDiag && (
        <div style={{
          position: "absolute",
          top: 40,
          right: 8,
          zIndex: 20,
          width: 240,
          background: "rgba(10,15,25,0.97)",
          border: "1px solid #1F4B3A",
          borderRadius: 8,
          padding: "10px 12px",
          fontFamily: "monospace",
          fontSize: 10,
          color: "#9CA3AF",
          boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
        }}>
          <div style={{ color: "#34D399", fontWeight: "bold", marginBottom: 8, fontSize: 11 }}>
            ● Connection Diagnostics
          </div>
          {diagData ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["Hook server", diagData.hookServerPort
                    ? `port ${diagData.hookServerPort} (${diagData.hookServerOwner ? "owner" : "secondary"})`
                    : "stopped"],
                  ["Hook server PID", diagData.hookServerPid ?? "—"],
                  ["Uptime", diagData.uptime ? `${diagData.uptime}s` : "—"],
                  ["Events received", diagData.hookEventsReceived],
                  ["Active sessions", diagData.activeSessions],
                  ["Hooks installed", diagData.hooksInstalled ? "✓ yes" : "✗ no"],
                  ["JSONL watcher", diagData.watcherRunning ? "running" : "stopped"],
                  ["Workspace", diagData.workspaceFolder
                    ? diagData.workspaceFolder.split("/").pop()
                    : "none"],
                  ["Asset pack", diagData.assetPackLoaded
                    ? `✓ ${diagData.assetPackItems} items`
                    : "none"],
                ].map(([k, v]) => (
                  <tr key={String(k)}>
                    <td style={{ color: "#6B7280", paddingRight: 8, paddingBottom: 3 }}>{k}</td>
                    <td style={{ color: "#E5E7EB" }}>{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: "#6B7280" }}>Requesting diagnostics…</div>
          )}
        </div>
      )}

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
