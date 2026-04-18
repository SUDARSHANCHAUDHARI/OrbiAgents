"use client";

import { useEffect, useRef } from "react";

interface Shortcuts {
  enabled: boolean;
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
  enabled,
  onRun,
  onStop,
  onTogglePause,
  onClosePanel,
  onToggleLogs,
}: Shortcuts) {
  // Keep latest callbacks in a ref so the effect never needs to re-register
  const cbRef = useRef({ onRun, onStop, onTogglePause, onClosePanel, onToggleLogs });
  cbRef.current = { onRun, onStop, onTogglePause, onClosePanel, onToggleLogs };

  useEffect(() => {
    if (!enabled) return;

    function handler(e: KeyboardEvent) {
      if (isTyping(e)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "r": case "R":
          e.preventDefault();
          cbRef.current.onRun();
          break;
        case "s": case "S":
          e.preventDefault();
          cbRef.current.onStop();
          break;
        case " ":
          e.preventDefault();
          cbRef.current.onTogglePause();
          break;
        case "Escape":
          cbRef.current.onClosePanel();
          break;
        case "l": case "L":
          e.preventDefault();
          cbRef.current.onToggleLogs();
          break;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}
