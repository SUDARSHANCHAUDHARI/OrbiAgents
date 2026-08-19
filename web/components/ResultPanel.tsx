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
  compact?: boolean;
  provider?: string | null;
  onClose: () => void;
  onReplay: (sessionId: string) => void;
}

function CodeBlock({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <div className="orbi-code-block overflow-x-auto">
      {lines.map((line, i) => (
        <div key={i} className="orbi-line flex">
          <span className="shrink-0 w-8 text-right text-[10px] font-mono select-none pr-3 pt-0.5" style={{ color: "#8BCFE6" }}>
            {i + 1}
          </span>
          <span className="text-[11px] font-mono leading-relaxed whitespace-pre" style={{ color: "#E8FCFF" }}>
            {line || " "}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ResultPanel({ result, compact = false, provider, onClose, onReplay }: Props) {
  const chrome = {
    bg: "#0F172A",
    bgMid: "#111827",
    border: "#374151",
    text: "#E5E7EB",
    textMuted: "#9CA3AF",
    accent: "#3B82F6",
  };
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
    <div style={{ width: compact ? 340 : 420, flexShrink: 0, height: "100vh", background: chrome.bg, borderLeft: `1px solid ${chrome.border}`, display: "flex", flexDirection: "column", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", borderBottom: `1px solid ${chrome.border}`, background: chrome.bgMid }}>
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h2 className="text-white font-semibold text-sm" style={{ fontSize: 18 }}>Workflow Complete</h2>
          {provider && (
            <span className="text-[10px] font-semibold uppercase rounded-md px-1.5 py-0.5" style={{ color: "#93C5FD", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}>
              {provider}
            </span>
          )}
          {costLabel && (
            <span className="text-[10px] font-mono font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-md px-1.5 py-0.5">
              {costLabel}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-base leading-none transition-colors"
          style={{ color: chrome.textMuted }}
        >
          ✕
        </button>
      </div>

      {result.steps.length > 0 ? (
        <div style={{ display: "flex", borderBottom: `2px solid ${chrome.border}`, overflowX: "auto" as const }}>
          {result.steps.map((step) => {
            const selected = step.nodeId === activeStep?.nodeId;
            return (
              <button
                key={step.nodeId}
                onClick={() => setActiveStepId(step.nodeId)}
                style={{
                  flex: 1,
                  padding: "7px",
                  background: selected ? chrome.bgMid : "transparent",
                  borderBottom: selected ? `2px solid ${chrome.accent}` : "2px solid transparent",
                  color: selected ? chrome.text : chrome.textMuted,
                  fontSize: 14,
                  fontWeight: 500,
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
      ) : (
        <div style={{ padding: 16, color: chrome.textMuted, fontSize: 14, lineHeight: 1.6 }}>
          No workflow steps were recorded for this run yet.
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" as const }}>
        {activeStep && (
          <div className="p-4">
            {activeStep.workspaceDisposition === "preserved" && activeStep.workspacePath && (
              <section aria-label="Preserved agent workspace" style={{ marginBottom: 12, padding: 12, borderRadius: 8, border: "1px solid #92400E", background: "rgba(120,53,15,0.2)" }}>
                <strong style={{ display: "block", color: "#FCD34D", fontSize: 12, marginBottom: 6 }}>Agent changes preserved for review</strong>
                <code style={{ display: "block", color: "#FDE68A", fontSize: 11, overflowWrap: "anywhere" }}>{activeStep.workspacePath}</code>
                <span style={{ display: "block", color: chrome.textMuted, fontSize: 11, marginTop: 6 }}>OrbiAgents did not commit, merge, push, or delete these files.</span>
              </section>
            )}
            {isCodeLikeStep(activeStep.type) ? (
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  background: "#111827",
                  border: `1px solid ${chrome.border}`,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <div
                  className="flex items-center justify-between px-4 py-2"
                  style={{
                    borderBottom: `1px solid ${chrome.border}`,
                    background: "#1F2937",
                  }}
                >
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: chrome.textMuted, fontSize: 12, fontWeight: 700 }}>
                    {NODE_KIND_LABEL[activeStep.type]}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(activeStep.output)}
                    className="text-[10px] transition-colors"
                    style={{ color: chrome.accent }}
                  >
                    Copy
                  </button>
                </div>
                <div className="p-3 overflow-x-auto">
                  <CodeBlock code={activeStep.output} />
                </div>
              </div>
            ) : (
              <div
                className="rounded-xl p-4 text-xs leading-relaxed whitespace-pre-wrap font-mono"
                style={{
                  background: "#1F2937",
                  color: chrome.text,
                  border: `1px solid ${chrome.border}`,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                {activeStep.output}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: "16px", borderTop: `1px solid ${chrome.border}`, display: "flex", flexDirection: "column" as const, gap: 8 }}>
        {shareError && (
          <div style={{ color: "#FCA5A5", fontSize: 9, fontFamily: "monospace" }}>
            {shareError}
          </div>
        )}
        {shareUrl && (
          <div style={{ background: chrome.bgMid, border: `1px solid ${chrome.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: chrome.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {shareUrl}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            disabled={sharing}
            style={{ flex: 1, minHeight: 40, background: chrome.bgMid, border: `1px solid ${chrome.border}`, borderRadius: 8, color: chrome.text, fontSize: 14, fontWeight: 500, padding: "0 12px", cursor: "pointer" }}
          >
            {copied ? "✓ COPIED" : sharing ? "CREATING..." : "SHARE"}
          </button>
          <button
            onClick={() => onReplay(result.sessionId)}
            style={{ flex: 1, minHeight: 40, background: "#2563EB", border: `1px solid #1D4ED8`, borderRadius: 8, color: "#F8FAFC", fontSize: 14, fontWeight: 600, padding: "0 12px", cursor: "pointer" }}
          >
            ▶ REPLAY
          </button>
        </div>
      </div>
    </div>
  );
}
