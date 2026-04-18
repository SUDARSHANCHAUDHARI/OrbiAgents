// Heuristic fallback for detecting permission-waiting state when the
// PermissionRequest hook is unavailable. If a non-exempt tool (Write/Edit/Bash/MCP)
// has been active for NON_EXEMPT_TIMEOUT_MS without a PostToolUse/Stop/PermissionRequest
// hook clearing it, we assume Claude is waiting for the user to approve.

const NON_EXEMPT_TIMEOUT_MS = 7_000;

export class PermissionTimer {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Start (or restart) the 7s timer for a session.
   * Fires onTimeout if no clearing event arrives in time.
   */
  start(sessionId: string, onTimeout: () => void): void {
    this.clear(sessionId);
    const timer = setTimeout(() => {
      this.timers.delete(sessionId);
      onTimeout();
    }, NON_EXEMPT_TIMEOUT_MS);
    this.timers.set(sessionId, timer);
  }

  /** Cancel the timer for a session — tool completed or hook took over. */
  clear(sessionId: string): void {
    const t = this.timers.get(sessionId);
    if (t !== undefined) {
      clearTimeout(t);
      this.timers.delete(sessionId);
    }
  }

  /** Cancel all timers — called on extension deactivate. */
  clearAll(): void {
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
  }
}
