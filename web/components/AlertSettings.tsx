"use client";

import { useState } from "react";
import { getWebhookUrl, setWebhookUrl } from "@/lib/useAlerts";

interface Props {
  onClose: () => void;
}

export default function AlertSettings({ onClose }: Props) {
  const [url, setUrl] = useState(getWebhookUrl);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setWebhookUrl(url.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
          width: 420,
          boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ color: chrome.text, fontSize: 18, fontWeight: 600 }}>Alert Settings</div>
            <div style={{ color: chrome.textMuted, fontSize: 13, marginTop: 2 }}>
              Browser notifications + optional webhook
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
            background: chrome.card,
            border: `1px solid ${chrome.border}`,
            borderRadius: 10,
            padding: 14,
            marginBottom: 16,
            fontSize: 13,
            color: chrome.textMuted,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: chrome.text }}>Browser notifications</strong> fire automatically
          when an agent enters a debugging state or a workflow errors.
          Your browser will prompt for permission on the first alert.
        </div>

        <label style={{ display: "block", marginBottom: 6, color: chrome.textMuted, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Webhook URL (optional)
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hooks.slack.com/..."
          style={{
            width: "100%",
            background: chrome.card,
            border: `1px solid ${chrome.border}`,
            borderRadius: 8,
            color: chrome.text,
            fontSize: 14,
            padding: "8px 12px",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 12,
          }}
        />
        <div style={{ color: chrome.textMuted, fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>
          POST requests will be sent to this URL with a JSON payload on agent errors.
          Works with Slack incoming webhooks, Discord webhooks, or any HTTP endpoint.
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              minHeight: 40,
              background: chrome.accent,
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {saved ? "✓ Saved" : "Save"}
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              minHeight: 40,
              background: "transparent",
              border: `1px solid ${chrome.border}`,
              borderRadius: 8,
              color: chrome.textMuted,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
