"use client";

import { useCallback, useEffect, useRef } from "react";
import { Agent } from "./types";

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

export function useAlerts() {
  const prevStatesRef = useRef<Map<string, string>>(new Map());

  const checkAgents = useCallback((agents: Agent[]) => {
    agents.forEach((agent) => {
      const prev = prevStatesRef.current.get(agent.id);
      if (prev !== agent.state) {
        if (agent.state === "debugging" && prev !== undefined) {
          const title = `${agent.name} hit an error`;
          const body = agent.lastAction || "Agent entered debugging state";
          void fireNotification(title, body);
          const webhookUrl = getWebhookUrl();
          if (webhookUrl) {
            void sendWebhook(webhookUrl, {
              event: "agent_error",
              agentId: agent.id,
              agentName: agent.name,
              state: agent.state,
              lastAction: agent.lastAction,
              timestamp: Date.now(),
            });
          }
        }
        prevStatesRef.current.set(agent.id, agent.state);
      }
    });
  }, []);

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

  // Reset state tracking when a new run starts
  function resetAlertState() {
    prevStatesRef.current.clear();
  }

  return { checkAgents, alertWorkflowError, resetAlertState };
}
