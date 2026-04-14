"use client";

import { useState } from "react";

interface WorkflowResult {
  sessionId: string;
  plan: string;
  code: string;
  totalCostUsd?: number;
}

interface Props {
  result: WorkflowResult;
  onClose: () => void;
  onReplay: (sessionId: string) => void;
}

type Tab = "plan" | "code";

function CodeBlock({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <div className="orbi-code-block overflow-x-auto">
      {lines.map((line, i) => (
        <div key={i} className="orbi-line flex">
          <span className="shrink-0 w-8 text-right text-[10px] font-mono text-gray-700 select-none pr-3 pt-0.5">
            {i + 1}
          </span>
          <span className="text-[11px] font-mono text-green-300/90 leading-relaxed whitespace-pre">
            {line || " "}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ResultPanel({ result, onClose, onReplay }: Props) {
  const [tab, setTab] = useState<Tab>("plan");
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const costLabel =
    result.totalCostUsd != null
      ? result.totalCostUsd >= 0.01
        ? `$${result.totalCostUsd.toFixed(3)}`
        : `$${result.totalCostUsd.toFixed(5)}`
      : null;

  async function handleShare() {
    setSharing(true);
    try {
      const res = await fetch(
        `http://localhost:4000/replay/${result.sessionId}/share`,
        { method: "POST" }
      );
      const data = (await res.json()) as { url: string };
      setShareUrl(data.url);
      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } finally {
      setSharing(false);
    }
  }

  return (
    <div style={{ width: 420, background: "#0d0907", borderLeft: "3px solid #3D2409", display: "flex", flexDirection: "column", fontFamily: "monospace" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "2px solid #3D2409", background: "#1a1208" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h2 className="text-white font-semibold text-sm">Workflow Complete</h2>
          {costLabel && (
            <span className="text-[10px] font-mono font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-md px-1.5 py-0.5">
              {costLabel}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-300 text-base leading-none transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid #3D2409" }}>
        <button
          onClick={() => setTab("plan")}
          style={{ flex: 1, padding: "7px", background: tab === "plan" ? "#1a1208" : "transparent", borderBottom: tab === "plan" ? "2px solid #7C3AED" : "2px solid transparent", color: tab === "plan" ? "#A78BFA" : "#7A5230", fontFamily: "monospace", fontSize: 8, letterSpacing: "0.1em", cursor: "pointer", border: "none" }}
        >
          [ PLAN ]
        </button>
        <button
          onClick={() => setTab("code")}
          style={{ flex: 1, padding: "7px", background: tab === "code" ? "#1a1208" : "transparent", borderBottom: tab === "code" ? "2px solid #7C3AED" : "2px solid transparent", color: tab === "code" ? "#A78BFA" : "#7A5230", fontFamily: "monospace", fontSize: 8, letterSpacing: "0.1em", cursor: "pointer", border: "none" }}
        >
          [ CODE ]
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" as const }}>
        {tab === "plan" && (
          <div className="p-4">
            <div className="bg-gray-800/60 rounded-xl p-4 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-mono border border-gray-700/50">
              {result.plan}
            </div>
          </div>
        )}

        {tab === "code" && (
          <div className="p-4">
            <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
              {/* Code toolbar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/60">
                <span className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">
                  TypeScript
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(result.code)}
                  className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                >
                  Copy
                </button>
              </div>
              <div className="p-3 overflow-x-auto">
                <CodeBlock code={result.code} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: "10px 12px", borderTop: "2px solid #3D2409", display: "flex", flexDirection: "column" as const, gap: 8 }}>
        {shareUrl && (
          <div style={{ background: "#1a1208", border: "2px solid #3D2409", padding: "4px 8px", fontSize: 9, fontFamily: "monospace", color: "#A78BFA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {shareUrl}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            disabled={sharing}
            style={{ flex: 1, background: "#1a1208", border: "2px solid #3D2409", color: "#7A5230", fontFamily: "monospace", fontSize: 8, letterSpacing: "0.1em", padding: "7px", cursor: "pointer" }}
          >
            {copied ? "✓ COPIED" : sharing ? "CREATING..." : "SHARE"}
          </button>
          <button
            onClick={() => onReplay(result.sessionId)}
            style={{ flex: 1, background: "#2e1065", border: "2px solid #7C3AED", color: "#A78BFA", fontFamily: "monospace", fontSize: 8, letterSpacing: "0.1em", padding: "7px", cursor: "pointer" }}
          >
            ▶ REPLAY
          </button>
        </div>
      </div>
    </div>
  );
}
