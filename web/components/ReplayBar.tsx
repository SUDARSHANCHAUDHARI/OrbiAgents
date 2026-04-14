"use client";

interface Props {
  task: string;
  current: number;
  total: number;
  onStop: () => void;
}

export default function ReplayBar({ task, current, total, onStop }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[500px] orbi-glass border border-violet-700/40 rounded-2xl px-5 py-3.5 shadow-2xl z-10 animate-orbi-slide-up">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-orbi-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-70" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-400" />
          </span>
          <span className="text-violet-300 text-xs font-semibold tracking-wide">
            Replay
          </span>
          <span className="text-gray-500 text-xs truncate max-w-[260px]">
            — {task}
          </span>
        </div>
        <button
          onClick={onStop}
          className="text-gray-600 hover:text-gray-300 text-xs transition-colors"
        >
          ✕ Stop
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #7c3aed, #818cf8)",
          }}
        />
      </div>

      <div className="flex justify-between mt-1.5">
        <span className="text-gray-700 text-[10px] font-mono">
          {current} / {total} frames
        </span>
        <span className="text-gray-700 text-[10px] font-mono">{pct}%</span>
      </div>
    </div>
  );
}
