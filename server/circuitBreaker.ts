export interface CircuitBreakerLimits {
  maxRuntimeMs: number;
  maxRetriesPerNode: number;
  maxTotalTokens: number;
  maxCostUsd: number;
  maxConsecutiveFailures: number;
}

export const DEFAULT_CIRCUIT_LIMITS: CircuitBreakerLimits = {
  maxRuntimeMs: 15 * 60_000,
  maxRetriesPerNode: 1,
  maxTotalTokens: 100_000,
  maxCostUsd: 5,
  maxConsecutiveFailures: 3,
};

export type CircuitReason = "runtime" | "retries" | "tokens" | "cost" | "failures";

export class CircuitOpenError extends Error {
  constructor(readonly reason: CircuitReason, message: string) {
    super(message);
    this.name = "CircuitOpenError";
  }
}

export class WorkflowCircuitBreaker {
  private readonly startedAt: number;
  private totalTokens = 0;
  private totalCostUsd = 0;
  private consecutiveFailures = 0;
  private readonly retries = new Map<string, number>();

  constructor(
    private readonly limits: CircuitBreakerLimits = DEFAULT_CIRCUIT_LIMITS,
    now: number = Date.now()
  ) {
    this.startedAt = now;
  }

  check(now: number = Date.now()): void {
    if (now - this.startedAt > this.limits.maxRuntimeMs) {
      throw new CircuitOpenError("runtime", "Workflow runtime limit exceeded");
    }
    if (this.totalTokens > this.limits.maxTotalTokens) {
      throw new CircuitOpenError("tokens", "Workflow token budget exceeded");
    }
    if (this.totalCostUsd > this.limits.maxCostUsd) {
      throw new CircuitOpenError("cost", "Workflow cost budget exceeded");
    }
    if (this.consecutiveFailures >= this.limits.maxConsecutiveFailures) {
      throw new CircuitOpenError("failures", "Workflow consecutive failure limit reached");
    }
  }

  recordSuccess(inputTokens: number, outputTokens: number, costUsd: number): void {
    this.totalTokens += inputTokens + outputTokens;
    this.totalCostUsd += costUsd;
    this.consecutiveFailures = 0;
    this.check();
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
    this.check();
  }

  recordRetry(nodeId: string): number {
    const count = (this.retries.get(nodeId) ?? 0) + 1;
    this.retries.set(nodeId, count);
    if (count > this.limits.maxRetriesPerNode) {
      throw new CircuitOpenError("retries", `Retry limit exceeded for node ${nodeId}`);
    }
    return count;
  }
}
