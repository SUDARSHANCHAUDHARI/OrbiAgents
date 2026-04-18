"use client";

import { useState } from "react";

interface Props {
  url: string;
  onClose: () => void;
}

export default function ShareModal({ url, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the input
    }
  }

  const chrome = {
    bg: "#111827",
    border: "#374151",
    text: "#E5E7EB",
    textMuted: "#9CA3AF",
    card: "#1F2937",
    accent: "#3B82F6",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: chrome.bg,
          border: `1px solid ${chrome.border}`,
          borderRadius: 16,
          padding: 24,
          width: 460,
          boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ color: chrome.text, fontSize: 18, fontWeight: 600 }}>Share Replay</div>
            <div style={{ color: chrome.textMuted, fontSize: 13, marginTop: 2 }}>
              Anyone with this link can view the replay — no login required
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: chrome.textMuted, cursor: "pointer", fontSize: 18 }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            background: chrome.card,
            border: `1px solid ${chrome.border}`,
            borderRadius: 10,
            padding: "10px 12px",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <input
            type="text"
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: chrome.text,
              fontSize: 13,
              outline: "none",
              fontFamily: "monospace",
              minWidth: 0,
            }}
          />
          <button
            onClick={handleCopy}
            style={{
              background: copied ? "#14532D" : chrome.accent,
              border: "none",
              borderRadius: 7,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              padding: "6px 14px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "background 0.2s",
            }}
          >
            {copied ? "✓ Copied!" : "Copy"}
          </button>
        </div>

        <div style={{ color: chrome.textMuted, fontSize: 12, lineHeight: 1.6 }}>
          This link will show an interactive replay of the session. The link never expires.
        </div>
      </div>
    </div>
  );
}
