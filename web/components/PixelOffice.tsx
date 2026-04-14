"use client";

// ── Tiny pixel-art furniture primitives ─────────────────────────────

function Bookshelf({ x, y, w = 96 }: { x: number; y: number; w?: number }) {
  const BOOKS = ["#DC2626","#2563EB","#16A34A","#D97706","#7C3AED","#0891B2","#DB2777","#EA580C"];
  const count = Math.floor((w - 8) / 11);
  return (
    <div className="absolute" style={{ left: x, top: y, width: w, imageRendering: "pixelated" }}>
      {/* Frame */}
      <div style={{ background: "#3D2409", padding: 4, border: "2px solid #1C0A00" }}>
        {/* Row 1 */}
        <div style={{ display: "flex", gap: 1, marginBottom: 2 }}>
          {BOOKS.slice(0, count).map((c, i) => (
            <div key={i} style={{ width: 10, height: 38, background: c, boxShadow: "inset -2px 0 0 rgba(0,0,0,0.4)" }} />
          ))}
        </div>
        {/* Shelf divider */}
        <div style={{ height: 3, background: "#5C3D1E" }} />
        {/* Row 2 */}
        <div style={{ display: "flex", gap: 1, marginTop: 2 }}>
          {BOOKS.slice(0, count).reverse().map((c, i) => (
            <div key={i} style={{ width: 10, height: 20, background: c, boxShadow: "inset -2px 0 0 rgba(0,0,0,0.4)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Desk({ x, y, active = false, agentColor = "#0a0a0a" }: { x: number; y: number; active?: boolean; agentColor?: string }) {
  return (
    <div className="absolute" style={{ left: x, top: y, imageRendering: "pixelated" }}>
      {/* Monitor */}
      <div style={{
        position: "absolute", left: 14, top: -36,
        width: 36, height: 30,
        background: "#1F2937",
        outline: "3px solid #374151",
        outlineOffset: 0,
      }}>
        {/* Screen */}
        <div style={{
          position: "absolute", inset: 4,
          background: active ? agentColor : "#0a0f1a",
          boxShadow: active ? `0 0 8px ${agentColor}` : "none",
        }} />
      </div>
      {/* Monitor stand */}
      <div style={{ position: "absolute", left: 28, top: -6, width: 8, height: 6, background: "#374151" }} />
      {/* Desk surface */}
      <div style={{
        width: 80, height: 34,
        background: "#7A5230",
        boxShadow: "inset 0 -4px 0 #4A2F14, inset 0 2px 0 #8B6040",
        border: "2px solid #4A2F14",
      }} />
      {/* Keyboard */}
      <div style={{
        position: "absolute", left: 8, top: 8,
        width: 44, height: 9,
        background: "#374151",
        boxShadow: "inset 0 -2px 0 #1F2937",
        border: "1px solid #4B5563",
      }} />
      {/* Mouse */}
      <div style={{
        position: "absolute", left: 56, top: 9,
        width: 10, height: 14,
        background: "#4B5563",
        borderRadius: "40% 40% 30% 30%",
        border: "1px solid #374151",
      }} />
    </div>
  );
}

function Plant({ x, y }: { x: number; y: number }) {
  return (
    <div className="absolute" style={{ left: x, top: y, imageRendering: "pixelated" }}>
      {/* Leaves */}
      <div style={{ position: "relative", width: 36, height: 32, marginBottom: -2 }}>
        <div style={{
          position: "absolute", left: 8, top: 4,
          width: 20, height: 20,
          background: "#16A34A",
          borderRadius: "50%",
          boxShadow: "-10px 6px 0 #15803D, 10px 4px 0 #166534, 0px -4px 0 #22C55E",
        }} />
      </div>
      {/* Pot */}
      <div style={{
        width: 24, height: 20,
        margin: "0 auto",
        background: "#DC2626",
        boxShadow: "inset 0 -3px 0 #991B1B, inset 0 3px 0 #EF4444",
        clipPath: "polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)",
      }} />
    </div>
  );
}

function Chair({ x, y, color = "#7C3AED" }: { x: number; y: number; color?: string }) {
  return (
    <div className="absolute" style={{ left: x, top: y, imageRendering: "pixelated" }}>
      <div style={{
        width: 28, height: 28,
        background: color,
        border: `3px solid rgba(0,0,0,0.4)`,
        borderRadius: 4,
        boxShadow: `inset 0 4px 0 rgba(255,255,255,0.1), 0 4px 0 rgba(0,0,0,0.3)`,
      }} />
    </div>
  );
}

function WallClock({ x, y }: { x: number; y: number }) {
  const now = new Date();
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const hDeg = (h * 30) + (m * 0.5);
  const mDeg = m * 6;
  return (
    <div className="absolute" style={{ left: x, top: y, width: 32, height: 32, imageRendering: "pixelated" }}>
      <div style={{
        width: 32, height: 32,
        background: "#E5E7EB",
        border: "3px solid #374151",
        borderRadius: "50%",
        position: "relative",
      }}>
        {/* Hour hand */}
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          width: 2, height: 9,
          background: "#111",
          transformOrigin: "bottom center",
          transform: `translateX(-50%) rotate(${hDeg}deg)`,
          marginTop: -9,
        }} />
        {/* Minute hand */}
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          width: 1, height: 11,
          background: "#374151",
          transformOrigin: "bottom center",
          transform: `translateX(-50%) rotate(${mDeg}deg)`,
          marginTop: -11,
        }} />
        {/* Center dot */}
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          width: 4, height: 4,
          background: "#111",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
        }} />
      </div>
    </div>
  );
}

function WaterCooler({ x, y }: { x: number; y: number }) {
  return (
    <div className="absolute" style={{ left: x, top: y, imageRendering: "pixelated" }}>
      {/* Bottle */}
      <div style={{
        width: 22, height: 28,
        background: "#BFDBFE",
        border: "2px solid #93C5FD",
        borderRadius: "3px 3px 0 0",
        margin: "0 auto",
        boxShadow: "inset 4px 0 0 rgba(255,255,255,0.5)",
      }} />
      {/* Body */}
      <div style={{
        width: 28, height: 24,
        background: "#D1D5DB",
        border: "2px solid #9CA3AF",
        boxShadow: "inset 2px 0 0 rgba(255,255,255,0.4)",
      }} />
      {/* Spout */}
      <div style={{
        width: 10, height: 6,
        background: "#3B82F6",
        margin: "0 auto",
        borderRadius: "0 0 3px 3px",
      }} />
      {/* Base */}
      <div style={{ width: "100%", height: 8, background: "#9CA3AF", border: "1px solid #6B7280" }} />
    </div>
  );
}

function MeetingTable({ x, y }: { x: number; y: number }) {
  const CHAIR_COLORS = ["#7C3AED","#1D4ED8","#DC2626","#D97706"];
  return (
    <div className="absolute" style={{ left: x, top: y, imageRendering: "pixelated" }}>
      {/* Chairs top row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 6, paddingLeft: 12 }}>
        {CHAIR_COLORS.slice(0,2).map((c, i) => (
          <div key={i} style={{ width: 30, height: 20, background: c, border: "2px solid rgba(0,0,0,0.3)", borderRadius: 3 }} />
        ))}
      </div>
      {/* Table */}
      <div style={{
        width: 120, height: 60,
        background: "#8B5E3C",
        border: "3px solid #4A2F14",
        boxShadow: "inset 0 4px 0 #A07040",
      }}>
        {/* Laptop on table */}
        <div style={{
          margin: "8px auto", width: 48, height: 32,
          background: "#1F2937",
          border: "2px solid #374151",
        }}>
          <div style={{ margin: 4, height: "60%", background: "#065F46", opacity: 0.8 }} />
        </div>
      </div>
      {/* Chairs bottom row */}
      <div style={{ display: "flex", gap: 8, marginTop: 6, paddingLeft: 12 }}>
        {CHAIR_COLORS.slice(2).map((c, i) => (
          <div key={i} style={{ width: 30, height: 20, background: c, border: "2px solid rgba(0,0,0,0.3)", borderRadius: 3 }} />
        ))}
      </div>
    </div>
  );
}

// ── Agent desk positions (match server agent x,y) ──────────────────
const DESK_DATA = [
  { agentId: "1", x: 60,  y: 134, chairColor: "#7C3AED", screenColor: "#2D1F69" },
  { agentId: "2", x: 300, y: 234, chairColor: "#1D4ED8", screenColor: "#1a2f5a" },
  { agentId: "3", x: 550, y: 154, chairColor: "#059669", screenColor: "#0a2e1a" },
  { agentId: "4", x: 180, y: 374, chairColor: "#D97706", screenColor: "#3d2200" },
  { agentId: "5", x: 430, y: 344, chairColor: "#E11D48", screenColor: "#3d0012" },
];

interface Props {
  activeAgentIds?: string[];
  agentColors?: Record<string, string>;
}

export default function PixelOffice({ activeAgentIds = [], agentColors = {} }: Props) {
  const WOOD = "repeating-linear-gradient(180deg, #8B6040 0px, #9A6E46 14px, #8B6040 14px, #7A5230 15px, #7A5230 30px, #8B6040 30px)";
  const TILE = "repeating-linear-gradient(90deg, #C8C0B0 0px, #C8C0B0 23px, #B0A898 23px, #B0A898 24px), repeating-linear-gradient(180deg, #C8C0B0 0px, #C8C0B0 23px, #B0A898 23px, #B0A898 24px)";
  const CARPET = "repeating-linear-gradient(45deg, #1E3A5F 0px, #1E3A5F 8px, #172D4A 8px, #172D4A 16px)";

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>

      {/* ── Main office floor (wood) ─────────────────────────── */}
      <div className="absolute" style={{
        left: 0, top: 0, width: "72%", height: "100%",
        background: WOOD,
        opacity: 0.85,
      }} />

      {/* ── Break room — top right (tile) ───────────────────── */}
      <div className="absolute" style={{
        right: 0, top: 0, width: "28%", height: "42%",
        background: TILE,
        opacity: 0.9,
      }} />

      {/* ── Meeting room — bottom right (carpet) ────────────── */}
      <div className="absolute" style={{
        right: 0, bottom: 0, width: "28%", height: "55%",
        background: CARPET,
        opacity: 0.85,
      }} />

      {/* ── Wall dividers ───────────────────────────────────── */}
      {/* Vertical room divider */}
      <div className="absolute" style={{
        right: "28%", top: 0, width: 6, height: "100%",
        background: "#2D2010",
        boxShadow: "2px 0 0 #1C1208, -2px 0 0 #3D2A14",
      }} />
      {/* Horizontal divider in right column */}
      <div className="absolute" style={{
        right: 0, top: "42%", width: "28%", height: 6,
        background: "#2D2010",
        boxShadow: "0 2px 0 #1C1208, 0 -2px 0 #3D2A14",
      }} />

      {/* ── Top wall (back wall of main office) ─────────────── */}
      <div className="absolute" style={{
        left: 0, top: 0, width: "72%", height: 8,
        background: "#1C1208",
      }} />

      {/* ── Bookshelves along top wall ───────────────────────── */}
      <Bookshelf x={10}  y={8} />
      <Bookshelf x={116} y={8} />
      <Bookshelf x={222} y={8} />
      <Bookshelf x={328} y={8} />
      <Bookshelf x={434} y={8} />
      <Bookshelf x={540} y={8} w={80} />

      {/* ── Bookshelves in break room ────────────────────────── */}
      <div className="absolute" style={{ right: 10, top: 10 }}>
        <Bookshelf x={0} y={0} w={80} />
      </div>
      <div className="absolute" style={{ right: 100, top: 10 }}>
        <Bookshelf x={0} y={0} w={80} />
      </div>

      {/* ── Bookshelves in meeting room ──────────────────────── */}
      <div className="absolute" style={{ right: 10, bottom: 10 }}>
        <Bookshelf x={0} y={0} w={80} />
      </div>
      <div className="absolute" style={{ right: 100, bottom: 10 }}>
        <Bookshelf x={0} y={0} w={80} />
      </div>

      {/* ── Wall clock ───────────────────────────────────────── */}
      <WallClock x={680} y={12} />

      {/* ── Agent desks ──────────────────────────────────────── */}
      {DESK_DATA.map((d) => {
        const isActive = activeAgentIds.includes(d.agentId);
        const agentColor = agentColors[d.agentId] ?? d.screenColor;
        return (
          <Desk key={d.agentId} x={d.x} y={d.y} active={isActive} agentColor={agentColor} />
        );
      })}

      {/* ── Chairs (below each desk — in front of agent) ─────── */}
      {DESK_DATA.map((d) => (
        <Chair key={`chair-${d.agentId}`} x={d.x + 26} y={d.y + 38} color={d.chairColor} />
      ))}

      {/* ── Plants — corners and sides ───────────────────────── */}
      <Plant x={8}   y={90} />
      <Plant x={8}   y={240} />
      <Plant x={8}   y={400} />
      <Plant x={700} y={90} />

      {/* ── Break room water cooler ──────────────────────────── */}
      <div className="absolute" style={{ right: 20, top: 100 }}>
        <WaterCooler x={0} y={0} />
      </div>

      {/* ── Meeting table ────────────────────────────────────── */}
      <div className="absolute" style={{ right: 30, bottom: 80 }}>
        <MeetingTable x={0} y={0} />
      </div>

      {/* ── Room labels ──────────────────────────────────────── */}
      <div
        className="absolute text-[7px] uppercase tracking-widest select-none"
        style={{
          right: "14%", top: "21%",
          fontFamily: "var(--font-pixel, monospace)",
          color: "rgba(120,100,80,0.5)",
          transform: "translateX(50%)",
        }}
      >
        Break Room
      </div>
      <div
        className="absolute text-[7px] uppercase tracking-widest select-none"
        style={{
          right: "14%", bottom: "27%",
          fontFamily: "var(--font-pixel, monospace)",
          color: "rgba(80,100,130,0.5)",
          transform: "translateX(50%)",
        }}
      >
        Meeting
      </div>
    </div>
  );
}
