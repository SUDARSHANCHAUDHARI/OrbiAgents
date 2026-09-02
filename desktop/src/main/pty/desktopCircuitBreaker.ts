import type { AgentActivityState } from "../../shared/contracts";

export type DesktopCircuitAction = "steer" | "constrain" | "stop";
export type DesktopCircuitReason = "runtime" | "output-storm" | "consecutive-failures";
export interface DesktopCircuitDecision { action: DesktopCircuitAction; reason: DesktopCircuitReason; summary: string; }
export interface DesktopCircuitLimits { maxRuntimeMs: number; outputWindowMs: number; steerOutputBytes: number; constrainOutputBytes: number; stopOutputBytes: number; }

const DEFAULT_OUTPUT_LIMITS = { outputWindowMs: 60_000, steerOutputBytes: 8 * 1024 * 1024, constrainOutputBytes: 16 * 1024 * 1024, stopOutputBytes: 32 * 1024 * 1024 };
const SEVERITY: Record<DesktopCircuitAction, number> = { steer: 1, constrain: 2, stop: 3 };

export class DesktopCircuitBreaker {
  private readonly startedAt: number;
  private readonly output: Array<{ at: number; bytes: number }> = [];
  private consecutiveFailures = 0;
  private severity = 0;

  constructor(private readonly limits: DesktopCircuitLimits, now: number = Date.now()) { this.startedAt = now; }

  static forBudgetMinutes(budgetMinutes: number, now: number = Date.now()): DesktopCircuitBreaker {
    if (!Number.isFinite(budgetMinutes) || budgetMinutes < 1 || budgetMinutes > 24 * 60) throw new Error("Desktop circuit runtime budget is invalid");
    return new DesktopCircuitBreaker({ maxRuntimeMs: budgetMinutes * 60_000, ...DEFAULT_OUTPUT_LIMITS }, now);
  }

  checkRuntime(now: number = Date.now()): DesktopCircuitDecision | undefined {
    const ratio = (now - this.startedAt) / this.limits.maxRuntimeMs;
    if (ratio >= 1) return this.escalate("stop", "runtime", "Runtime budget reached; the agent was stopped");
    if (ratio >= 0.9) return this.escalate("constrain", "runtime", "Runtime budget is 90% consumed; the current operation was interrupted");
    if (ratio >= 0.8) return this.escalate("steer", "runtime", "Runtime budget is 80% consumed; operator attention is recommended");
    return undefined;
  }

  recordOutput(bytes: number, now: number = Date.now()): DesktopCircuitDecision | undefined {
    if (!Number.isFinite(bytes) || bytes < 0) throw new Error("Desktop circuit output measurement is invalid");
    this.output.push({ at: now, bytes });
    while (this.output[0] && now - this.output[0].at > this.limits.outputWindowMs) this.output.shift();
    const total = this.output.reduce((sum, sample) => sum + sample.bytes, 0);
    if (total >= this.limits.stopOutputBytes) return this.escalate("stop", "output-storm", "Terminal output safety limit reached; the agent was stopped");
    if (total >= this.limits.constrainOutputBytes) return this.escalate("constrain", "output-storm", "Terminal output is excessive; the current operation was interrupted");
    if (total >= this.limits.steerOutputBytes) return this.escalate("steer", "output-storm", "Terminal output is unusually high; operator attention is recommended");
    return undefined;
  }

  recordProviderState(state: AgentActivityState): DesktopCircuitDecision | undefined {
    if (state === "failed") this.consecutiveFailures += 1;
    else if (state === "done" || state === "idle") this.consecutiveFailures = 0;
    if (this.consecutiveFailures >= 3) return this.escalate("stop", "consecutive-failures", "Three consecutive provider failures opened the circuit; the agent was stopped");
    if (this.consecutiveFailures === 2) return this.escalate("constrain", "consecutive-failures", "Two consecutive provider failures interrupted the current operation");
    if (this.consecutiveFailures === 1) return this.escalate("steer", "consecutive-failures", "Provider failure detected; operator attention is recommended");
    return undefined;
  }

  private escalate(action: DesktopCircuitAction, reason: DesktopCircuitReason, summary: string): DesktopCircuitDecision | undefined {
    if (SEVERITY[action] <= this.severity) return undefined;
    this.severity = SEVERITY[action]; return { action, reason, summary };
  }
}
