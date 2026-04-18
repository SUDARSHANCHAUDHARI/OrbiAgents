"use client";

import { useEffect } from "react";

interface Shortcuts {
  onRun: () => void;
  onStop: () => void;
  onTogglePause: () => void;
  onClosePanel: () => void;
  onToggleLogs: () => void;
}

function isTyping(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useKeyboardShortcuts({
  onRun,
  onStop,
  onTogglePause,
  onClosePanel,
  onToggleLogs,
}: Shortcuts) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (isTyping(e)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "r": case "R":
          e.preventDefault();
          onRun();
          break;
        case "s": case "S":
          e.preventDefault();
          onStop();
          break;
        case " ":
          e.preventDefault();
          onTogglePause();
          break;
        case "Escape":
          onClosePanel();
          break;
        case "l": case "L":
          e.preventDefault();
          onToggleLogs();
          break;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onRun, onStop, onTogglePause, onClosePanel, onToggleLogs]);
}
