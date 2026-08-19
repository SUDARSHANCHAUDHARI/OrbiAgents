"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Agent, Workflow, WorkflowEvent } from "@/lib/types";
import GameCanvas from "./GameCanvas";
import {
  loadCustomFurniture,
  saveCustomFurniture,
  customItemToFurnitureInstance,
  SPRITE_LABELS,
  type CustomFurnitureItem,
  type SpriteKey,
} from "../../shared/engine/layoutStorage";
import type { FurnitureInstance } from "../../shared/types";

const SPRITE_KEYS = Object.keys(SPRITE_LABELS) as SpriteKey[];

interface Props {
  agents: Agent[];
  selectedId: string | null;
  isReplaying: boolean;
  workflow?: Workflow | null;
  events?: WorkflowEvent[];
  onAgentClick: (agent: Agent) => void;
  soundEnabled?: boolean;
}

export default function LayoutEditor(props: Props) {
  const [editMode, setEditMode] = useState(false);
  const [selectedSprite, setSelectedSprite] = useState<SpriteKey>("plant");
  const [items, setItems] = useState<CustomFurnitureItem[]>([]);
  const historyRef = useRef<CustomFurnitureItem[][]>([]);

  useEffect(() => {
    setItems(loadCustomFurniture());
  }, []);

  const extraFurniture = useMemo<FurnitureInstance[]>(
    () => items.map(customItemToFurnitureInstance),
    [items],
  );

  const handleLayoutClick = useCallback((col: number, row: number) => {
    setItems(prev => {
      historyRef.current = [...historyRef.current, prev];
      const next = [...prev, { spriteKey: selectedSprite, col, row }];
      saveCustomFurniture(next);
      return next;
    });
  }, [selectedSprite]);

  const undo = useCallback(() => {
    const history = historyRef.current;
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    historyRef.current = history.slice(0, -1);
    setItems(prev);
    saveCustomFurniture(prev);
  }, []);

  const clearAll = useCallback(() => {
    historyRef.current = [...historyRef.current, items];
    setItems([]);
    saveCustomFurniture([]);
  }, [items]);

  useEffect(() => {
    if (!editMode) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editMode, undo]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <GameCanvas
        {...props}
        extraFurniture={extraFurniture}
        editMode={editMode}
        onLayoutClick={handleLayoutClick}
      />

      {/* Edit toggle button */}
      <button
        onClick={() => setEditMode(m => !m)}
        title={editMode ? "Exit layout editor" : "Open layout editor"}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 10,
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid",
          borderColor: editMode ? "#F59E0B" : "#374151",
          background: editMode ? "#422006" : "#1F2937",
          color: editMode ? "#FCD34D" : "#9CA3AF",
          fontSize: 12,
          fontFamily: "monospace",
          cursor: "pointer",
          letterSpacing: "0.04em",
        }}
      >
        {editMode ? "✕ Done" : "✏ Layout"}
      </button>

      {/* Editor toolbar */}
      {editMode && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            borderRadius: 12,
            background: "rgba(15,23,42,0.92)",
            border: "1px solid #334155",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span style={{ color: "#64748B", fontSize: 11, fontFamily: "monospace", marginRight: 4 }}>
            PLACE
          </span>

          {SPRITE_KEYS.map(key => (
            <button
              key={key}
              onClick={() => setSelectedSprite(key)}
              title={SPRITE_LABELS[key]}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid",
                borderColor: selectedSprite === key ? "#60A5FA" : "#374151",
                background: selectedSprite === key ? "#1E3A5F" : "#111827",
                color: selectedSprite === key ? "#93C5FD" : "#9CA3AF",
                fontSize: 11,
                fontFamily: "monospace",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {SPRITE_LABELS[key]}
            </button>
          ))}

          <div style={{ width: 1, background: "#334155", alignSelf: "stretch", margin: "0 4px" }} />

          <button
            onClick={undo}
            disabled={historyRef.current.length === 0}
            title="Undo (Ctrl+Z)"
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #374151",
              background: "#111827",
              color: "#9CA3AF",
              fontSize: 11,
              fontFamily: "monospace",
              cursor: historyRef.current.length === 0 ? "not-allowed" : "pointer",
              opacity: historyRef.current.length === 0 ? 0.4 : 1,
            }}
          >
            ↩ Undo
          </button>

          <button
            onClick={clearAll}
            disabled={items.length === 0}
            title="Clear all custom furniture"
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #374151",
              background: "#111827",
              color: "#EF4444",
              fontSize: 11,
              fontFamily: "monospace",
              cursor: items.length === 0 ? "not-allowed" : "pointer",
              opacity: items.length === 0 ? 0.4 : 1,
            }}
          >
            ✕ Clear
          </button>
        </div>
      )}
    </div>
  );
}
