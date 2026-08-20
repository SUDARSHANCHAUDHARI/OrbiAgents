"use client";

import { useEffect, useRef, useState } from "react";
import { use } from "react";
import { Agent, Session } from "@/lib/types";
import { getApiBaseUrl } from "@/lib/config";
import AgentBox from "@/components/Agent";
import ReplayBar, { ReplaySpeed } from "@/components/ReplayBar";
import { replayDelay } from "@/lib/replayTiming";

export default function PublicReplayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [session, setSession] = useState<Session | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const [notFound, setNotFound] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedRef = useRef<ReplaySpeed>(1);

  useEffect(() => {
    fetch(`${getApiBaseUrl()}/replay/public/${token}`)
      .then(async (res) => {
        if (!res.ok) { setNotFound(true); return; }
        const s = (await res.json()) as Session;
        setSession(s);
        if (s.frames.length > 0) setAgents(s.frames[0].agents);
      })
      .catch(() => setNotFound(true));
  }, [token]);

  function startPlay() {
    if (!session || intervalRef.current) return;
    setPlaying(true);
    let i = frame >= session.frames.length ? 0 : frame;
    const tick = () => {
      setAgents(session.frames[i].agents);
      setFrame(i + 1);
      if (i >= session.frames.length - 1) { intervalRef.current = null; setPlaying(false); return; }
      const delay = replayDelay(session.frames, i, speedRef.current);
      i++;
      intervalRef.current = setTimeout(tick, delay);
    };
    tick();
  }

  function stopPlay() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
  }

  function reset() {
    stopPlay();
    setFrame(0);
    if (session?.frames[0]) setAgents(session.frames[0].agents);
  }

  function seek(nextFrame: number) {
    stopPlay();
    const safeFrame = Math.max(1, Math.min(nextFrame, session?.frames.length ?? 1));
    setFrame(safeFrame);
    if (session?.frames[safeFrame - 1]) setAgents(session.frames[safeFrame - 1].agents);
  }

  function changeSpeed(nextSpeed: ReplaySpeed) { speedRef.current = nextSpeed; setSpeed(nextSpeed); }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-center px-4">
        <div>
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-white text-lg font-semibold mb-2">Replay not found</h1>
          <p className="text-gray-500 text-sm">This share link may be invalid or the session has expired.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-600 text-sm">
        Loading replay…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center text-sm font-bold">O</div>
          <span className="font-semibold tracking-tight">OrbiAgents</span>
          <span className="text-gray-600 text-xs">/ Shared Replay</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs max-w-[300px] truncate">
            {session.task}
          </span>
          <span className="text-gray-600 text-xs">
            · {session.frames.length} frames
          </span>
        </div>
      </header>

      {/* Canvas */}
      <main className="flex-1 relative overflow-hidden bg-gray-900">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="absolute top-3 left-3 text-xs text-purple-500 select-none font-medium">
          Replay Mode
        </div>

        {agents.map((agent) => (
          <AgentBox
            key={agent.id}
            agent={agent}
            selected={false}
            onClick={() => {}}
          />
        ))}

        <ReplayBar
            task={session.task}
            current={frame}
            total={session.frames.length}
            speed={speed}
            playing={playing}
            onSpeedChange={changeSpeed}
            onStop={reset}
            onTogglePlaying={playing ? stopPlay : startPlay}
            onSeek={seek}
            onStep={(delta) => seek(frame + delta)}
        />
      </main>
    </div>
  );
}
