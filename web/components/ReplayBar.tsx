"use client";

const SPEEDS = [0.5, 1, 2, 4] as const;
export type ReplaySpeed = (typeof SPEEDS)[number];

interface Props {
  task: string;
  current: number;
  total: number;
  speed: ReplaySpeed;
  onStop: () => void;
  onSpeedChange: (speed: ReplaySpeed) => void;
}

export default function ReplayBar({ task, current, total, speed, onStop, onSpeedChange }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
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
