"use client";

import { useCallback } from "react";

const STORAGE_KEY = "orbi_webhook_url";

export function getWebhookUrl(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function setWebhookUrl(url: string) {
  if (typeof window === "undefined") return;
  if (url) {
    localStorage.setItem(STORAGE_KEY, url);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

async function sendWebhook(url: string, payload: object) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // webhook errors are non-fatal
  }
}

async function fireNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }
}

// No AgentState signals an error ("debugging" is the Debugger node's normal
// active state); failures reach the client as workflow errors only.
export function useAlerts() {
  const alertWorkflowError = useCallback((message: string) => {
    void fireNotification("OrbiAgents — workflow error", message);
    const webhookUrl = getWebhookUrl();
    if (webhookUrl) {
      void sendWebhook(webhookUrl, {
        event: "workflow_error",
        message,
        timestamp: Date.now(),
      });
    }
  }, []);

  return { alertWorkflowError };
}
