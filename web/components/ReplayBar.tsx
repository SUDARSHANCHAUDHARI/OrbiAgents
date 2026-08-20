"use client";

import React from "react";

const SPEEDS = [0.5, 1, 2, 4] as const;
export type ReplaySpeed = (typeof SPEEDS)[number];

interface Props {
  task: string;
  current: number;
  total: number;
  speed: ReplaySpeed;
  playing: boolean;
  onStop: () => void;
  onSpeedChange: (speed: ReplaySpeed) => void;
  onTogglePlaying: () => void;
  onSeek: (frame: number) => void;
  onStep: (delta: number) => void;
  bookmarked?: boolean;
  onToggleBookmark?: () => void;
  bookmarkFrames?: number[];
  eventTypes?: string[];
  eventFilter?: string;
  onEventFilterChange?: (value: string) => void;
}

export default function ReplayBar({ task, current, total, speed, playing, onStop, onSpeedChange, onTogglePlaying, onSeek, onStep, bookmarked, onToggleBookmark, bookmarkFrames = [], eventTypes = [], eventFilter = "all", onEventFilterChange }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const previousBookmark = [...bookmarkFrames].reverse().find((frame) => frame < current);
  const nextBookmark = bookmarkFrames.find((frame) => frame > current);
  const chrome = {
    bg: "rgba(15, 23, 42, 0.96)",
    bgMid: "rgba(31, 41, 55, 0.96)",
    border: "#374151",
    text: "#E5E7EB",
    textMuted: "#9CA3AF",
    accent: "#3B82F6",
    accentSoft: "#60A5FA",
  };

  return (
    <div
      className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[560px] rounded-2xl px-5 py-3.5 shadow-2xl z-10 animate-orbi-slide-up"
      style={{
        background: `linear-gradient(180deg, ${chrome.bgMid} 0%, ${chrome.bg} 100%)`,
        border: `2px solid ${chrome.border}`,
        boxShadow: "0 18px 38px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-orbi-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: chrome.accent }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: chrome.accentSoft }} />
          </span>
          <span className="text-xs font-semibold tracking-wide" style={{ color: chrome.text }}>
            Replay
          </span>
          <span className="text-xs truncate max-w-[220px]" style={{ color: chrome.textMuted }}>
            — {task}
          </span>
        </div>

        {/* Speed controls */}
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className="text-[11px] font-mono px-1.5 py-0.5 rounded transition-colors"
              style={{
                background: speed === s ? chrome.accent : "transparent",
                color: speed === s ? "#fff" : chrome.textMuted,
                border: `1px solid ${speed === s ? chrome.accent : chrome.border}`,
                cursor: "pointer",
              }}
            >
              {s}×
            </button>
          ))}
        </div>

        <button
          onClick={onStop}
          className="text-xs transition-colors"
          style={{ color: chrome.textMuted }}
        >
          ✕ Stop
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-2">
        <button disabled={!previousBookmark} onClick={() => previousBookmark && onSeek(previousBookmark)} aria-label="Previous bookmark">★←</button>
        <button disabled={!nextBookmark} onClick={() => nextBookmark && onSeek(nextBookmark)} aria-label="Next bookmark">→★</button>
        <button onClick={() => onStep(-1)} disabled={current <= 1} aria-label="Previous replay frame">◀</button>
        <button onClick={onTogglePlaying} aria-label={playing ? "Pause replay" : "Play replay"}>{playing ? "Pause" : "Play"}</button>
        <button onClick={() => onStep(1)} disabled={current >= total} aria-label="Next replay frame">▶</button>
        <input aria-label="Replay timeline" type="range" min={1} max={Math.max(total, 1)} value={Math.max(current, 1)} onChange={(event) => onSeek(Number(event.target.value))} style={{ flex: 1 }} />
        {onToggleBookmark&&<button onClick={onToggleBookmark} aria-label={bookmarked?"Remove replay bookmark":"Add replay bookmark"}>{bookmarked?"★":"☆"}</button>}
      </div>
      {eventTypes.length>0&&<label className="text-[10px]" style={{color:chrome.textMuted}}>Events <select aria-label="Replay event filter" value={eventFilter} onChange={(event)=>onEventFilterChange?.(event.target.value)}><option value="all">All</option>{eventTypes.map((type)=><option key={type} value={type}>{type}</option>)}</select></label>}
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(11, 15, 20, 0.72)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.25)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #2563EB, #60A5FA)",
          }}
        />
      </div>

      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] font-mono" style={{ color: chrome.textMuted }}>
          {current} / {total} frames
        </span>
        <span className="text-[10px] font-mono" style={{ color: chrome.textMuted }}>{pct}%</span>
      </div>
    </div>
  );
}
