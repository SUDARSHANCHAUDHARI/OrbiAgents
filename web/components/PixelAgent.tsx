"use client";

import { Agent } from "@/lib/types";

interface Props {
  agent: Agent;
  selected: boolean;
  onClick: (agent: Agent) => void;
}

const SCALE = 5; // 5px per pixel

// ── Pixel sprite maps (8 cols × 18 rows) ──────────────────────────
// '.' = transparent, every other char = palette key
// prettier-ignore
const SPRITES: Record<string, string[]> = {
  "1": [ // Alpha — violet planner
    "..pppppp..",
    ".pppppppp.",
    "psssssssp.",
    "psssssssp.",
    ".sseessss.",
    ".ssssssss.",
    ".ssmmssss.",
    ".ssssssss.",
    "vvvvvvvvvv",
    "vvvvvvvvvv",
    "vvvvvvvvvv",
    ".vv....vv.",
    ".nn....nn.",
    ".nn....nn.",
    ".nn....nn.",
    ".kk....kk.",
    ".kk....kk.",
    "..........",
  ],
  "2": [ // Beta — dark-hair coder
    "hhhhhhhhhh",
    ".hhhhhhhh.",
    "hssssssshh",
    "hssssssshh",
    ".sseessss.",
    ".ssssssss.",
    ".ssmmssss.",
    ".ssssssss.",
    "bbbbbbbbbb",
    "bbbbbbbbbb",
    "bbbbbbbbbb",
    ".bb....bb.",
    ".qq....qq.",
    ".qq....qq.",
    ".qq....qq.",
    ".zz....zz.",
    ".zz....zz.",
    "..........",
  ],
  "3": [ // Gamma — green tester
    "..gggggg..",
    ".gggggggg.",
    "gsssssssg.",
    "gsssssssg.",
    ".sseessss.",
    ".ssssssss.",
    ".ssmmssss.",
    ".ssssssss.",
    "tttttttttt",
    "tttttttttt",
    "tttttttttt",
    ".tt....tt.",
    ".uu....uu.",
    ".uu....uu.",
    ".uu....uu.",
    ".ww....ww.",
    ".ww....ww.",
    "..........",
  ],
  "4": [ // Delta — amber reviewer
    "..yyyyyy..",
    ".yyyyyyyy.",
    "ysssssssy.",
    "ysssssssy.",
    ".sseessss.",
    ".ssssssss.",
    ".ssmmssss.",
    ".ssssssss.",
    "oooooooooo",
    "oooooooooo",
    "oooooooooo",
    ".oo....oo.",
    ".jj....jj.",
    ".jj....jj.",
    ".jj....jj.",
    ".xx....xx.",
    ".xx....xx.",
    "..........",
  ],
  "5": [ // Epsilon — rose debugger
    "..rrrrrr..",
    "rrrrrrrrrr",
    "rssssssssr",
    "rssssssssr",
    ".sseessss.",
    ".ssssssss.",
    ".ssmmssss.",
    ".ssssssss.",
    "ffffffffff",
    "ffffffffff",
    "ffffffffff",
    ".ff....ff.",
    ".cc....cc.",
    ".cc....cc.",
    ".cc....cc.",
    ".aa....aa.",
    ".aa....aa.",
    "..........",
  ],
};

// Per-agent color palettes
const PALETTES: Record<string, Record<string, string>> = {
  "1": { p:"#7C3AED", s:"#F5CBA7", e:"#1C1C2E", m:"#C0392B", v:"#6D28D9", n:"#3730A3", k:"#1E1B4B" },
  "2": { h:"#1E293B", s:"#F5CBA7", e:"#1C1C2E", m:"#C0392B", b:"#1D4ED8", q:"#1E3A5F", z:"#0F172A" },
  "3": { g:"#166534", s:"#F5CBA7", e:"#1C1C2E", m:"#C0392B", t:"#16A34A", u:"#14532D", w:"#052E16" },
  "4": { y:"#D97706", s:"#F5CBA7", e:"#1C1C2E", m:"#C0392B", o:"#F59E0B", j:"#92400E", x:"#451A03" },
  "5": { r:"#BE123C", s:"#F5CBA7", e:"#1C1C2E", m:"#C0392B", f:"#E11D48", c:"#881337", a:"#4C0519" },
};

// Walking animation: alternate 2 frames (idle = stand, active = step)
const WALK_FRAME_SHIFT = 2; // px offset for "walk" frame on active

// State→ glow color map
const STATE_GLOW: Record<Agent["state"], string> = {
  idle:      "transparent",
  thinking:  "rgba(139,92,246,0.9)",
  coding:    "rgba(56,189,248,0.9)",
  testing:   "rgba(52,211,153,0.9)",
  reviewing: "rgba(251,191,36,0.9)",
  debugging: "rgba(251,113,133,0.9)",
  done:      "rgba(74,222,128,0.9)",
};

const STATE_LABEL: Record<Agent["state"], string> = {
  idle:      "#4B5563",
  thinking:  "#A78BFA",
  coding:    "#7DD3FC",
  testing:   "#6EE7B7",
  reviewing: "#FCD34D",
  debugging: "#FDA4AF",
  done:      "#86EFAC",
};

const isActive = (state: Agent["state"]) =>
  state !== "idle" && state !== "done";

function PixelSprite({ id }: { id: string }) {
  const rows = SPRITES[id];
  const palette = PALETTES[id];
  if (!rows || !palette) return null;

  const rects: React.ReactElement[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      const color = palette[ch];
      if (!color) continue;
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={x * SCALE}
          y={y * SCALE}
          width={SCALE}
          height={SCALE}
          fill={color}
        />
      );
    }
  });

  const w = (rows[0]?.length ?? 0) * SCALE;
  const h = rows.length * SCALE;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ imageRendering: "pixelated", display: "block" }}
    >
      {rects}
    </svg>
  );
}

export default function PixelAgent({ agent, selected, onClick }: Props) {
  const active   = !agent.paused && isActive(agent.state);
  const glow     = agent.paused ? "transparent" : STATE_GLOW[agent.state];
  const labelCol = agent.paused ? "#374151" : STATE_LABEL[agent.state];

  return (
    <div
      className={`absolute flex flex-col items-center cursor-pointer select-none group ${active ? "animate-orbi-float" : ""}`}
      style={{ left: agent.x, top: agent.y, zIndex: 10 }}
      onClick={() => onClick(agent)}
    >
      {/* Glow halo behind sprite when active */}
      {active && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 50, height: 50,
            top: 10, left: 0,
            background: glow.replace("0.9", "0.2"),
            filter: "blur(12px)",
          }}
        />
      )}

      {/* Selection ring */}
      {selected && (
        <div
          className="absolute pointer-events-none animate-orbi-ping"
          style={{
            inset: -4,
            border: "2px solid rgba(255,255,255,0.6)",
            borderRadius: 2,
          }}
        />
      )}

      {/* Pixel sprite */}
      <div
        style={{
          filter: active ? `drop-shadow(0 0 6px ${glow})` : "none",
          opacity: agent.paused ? 0.4 : 1,
          transition: "filter 0.3s, opacity 0.3s",
        }}
      >
        <PixelSprite id={agent.id} />
      </div>

      {/* Name tag — pixel font */}
      <div
        className="mt-1 px-2 py-0.5 text-center"
        style={{
          fontFamily: "var(--font-pixel, monospace)",
          fontSize: 6,
          color: "#D1D5DB",
          background: "rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,255,255,0.1)",
          whiteSpace: "nowrap",
          lineHeight: "1.8",
          letterSpacing: "0.05em",
        }}
      >
        {agent.name}
      </div>

      {/* State badge */}
      <div
        key={agent.state}
        className="animate-orbi-slide-up mt-0.5 px-1.5"
        style={{
          fontFamily: "var(--font-pixel, monospace)",
          fontSize: 5,
          color: labelCol,
          background: "rgba(0,0,0,0.5)",
          border: `1px solid ${labelCol}40`,
          lineHeight: "1.8",
          letterSpacing: "0.1em",
          whiteSpace: "nowrap",
          textTransform: "uppercase",
        }}
      >
        {agent.paused ? "paused" : agent.state}
      </div>

      {/* Cost badge */}
      {agent.costUsd > 0 && (
        <div
          className="mt-0.5"
          style={{
            fontFamily: "var(--font-pixel, monospace)",
            fontSize: 5,
            color: "#FCD34D",
            background: "rgba(0,0,0,0.5)",
            padding: "1px 4px",
            border: "1px solid rgba(253,211,77,0.3)",
            letterSpacing: "0.05em",
          }}
        >
          ${agent.costUsd.toFixed(4)}
        </div>
      )}

      {/* Hover tooltip */}
      <div
        className="absolute bottom-full mb-3 hidden group-hover:flex z-50 pointer-events-none justify-center"
        style={{ minWidth: 160 }}
      >
        <div
          style={{
            background: "rgba(10,14,24,0.95)",
            border: `2px solid ${labelCol}60`,
            padding: "8px 10px",
            fontFamily: "var(--font-pixel, monospace)",
            imageRendering: "pixelated",
          }}
        >
          <p style={{ fontSize: 6, color: labelCol, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {agent.paused ? "Paused" : agent.state}
          </p>
          <p style={{ fontSize: 6, color: "#9CA3AF", lineHeight: 1.8, maxWidth: 160 }}>
            {agent.task || "Waiting…"}
          </p>
          {agent.costUsd > 0 && (
            <p style={{ fontSize: 6, color: "#FCD34D", marginTop: 4, letterSpacing: "0.05em" }}>
              ${agent.costUsd.toFixed(4)} spent
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
