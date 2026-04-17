"use client";

import { useState } from "react";
import { createReplayShareLink } from "@/lib/auth";
import { WorkflowStepResult } from "@/lib/types";
import {
  formatWorkflowCost,
  getActiveWorkflowStep,
  isCodeLikeStep,
  NODE_KIND_LABEL,
} from "@/lib/resultPanel";

interface WorkflowResult {
  sessionId: string;
  steps: WorkflowStepResult[];
  totalCostUsd?: number;
}

interface Props {
  result: WorkflowResult;
  onClose: () => void;
  onReplay: (sessionId: string) => void;
}

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
  const [activeStepId, setActiveStepId] = useState<string>(result.steps[0]?.nodeId ?? "");
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const activeStep = getActiveWorkflowStep(result.steps, activeStepId);
  const costLabel = formatWorkflowCost(result.totalCostUsd);

  async function handleShare() {
    setSharing(true);
    setShareError(null);
    try {
      const data = await createReplayShareLink(result.sessionId);
      setShareUrl(data.url);
      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Could not create share link");
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

      {result.steps.length > 0 && (
        <div style={{ display: "flex", borderBottom: "2px solid #3D2409", overflowX: "auto" as const }}>
          {result.steps.map((step) => {
            const selected = step.nodeId === activeStep?.nodeId;
            return (
              <button
                key={step.nodeId}
                onClick={() => setActiveStepId(step.nodeId)}
                style={{
                  flex: 1,
                  padding: "7px",
                  background: selected ? "#1a1208" : "transparent",
                  borderBottom: selected ? "2px solid #7C3AED" : "2px solid transparent",
                  color: selected ? "#A78BFA" : "#7A5230",
                  fontFamily: "monospace",
                  fontSize: 8,
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                  borderLeft: "none",
                  borderRight: "none",
                  borderTop: "none",
                  whiteSpace: "nowrap",
                }}
              >
                [{` ${step.label.toUpperCase()} `}]
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" as const }}>
        {activeStep && (
          <div className="p-4">
            {isCodeLikeStep(activeStep.type) ? (
              <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/60">
                  <span className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">
                    {NODE_KIND_LABEL[activeStep.type]}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(activeStep.output)}
                    className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <div className="p-3 overflow-x-auto">
                  <CodeBlock code={activeStep.output} />
                </div>
              </div>
            ) : (
              <div className="bg-gray-800/60 rounded-xl p-4 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-mono border border-gray-700/50">
                {activeStep.output}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: "10px 12px", borderTop: "2px solid #3D2409", display: "flex", flexDirection: "column" as const, gap: 8 }}>
        {shareError && (
          <div style={{ color: "#FCA5A5", fontSize: 9, fontFamily: "monospace" }}>
            {shareError}
          </div>
        )}
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
