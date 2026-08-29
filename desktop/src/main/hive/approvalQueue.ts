import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const HIVE_ACTION_CATEGORIES = ["routine", "spend-increase", "destructive-operation", "scope-expansion"] as const;
export type HiveActionCategory = (typeof HIVE_ACTION_CATEGORIES)[number];
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ProposedHiveAction {
  category: HiveActionCategory;
  title: string;
  rationale: string;
  requestedByAgentId: string;
  taskId?: string;
  estimatedAdditionalCostUsd?: number;
}

export interface ApprovalRequest extends ProposedHiveAction {
  id: string;
  status: ApprovalStatus;
  createdAt: number;
  decidedAt?: number;
  decisionReason?: string;
}

export function requiresApproval(action: ProposedHiveAction): boolean {
  return action.category !== "routine";
}

export class ApprovalQueue {
  private writeQueue = Promise.resolve();
  private readonly path: string;

  constructor(root: string) {
    this.path = join(root, "approvals.json");
  }

  async request(action: ProposedHiveAction): Promise<ApprovalRequest | null> {
    validateAction(action);
    if (!requiresApproval(action)) return null;
    const request: ApprovalRequest = { ...action, requestedByAgentId: safeId(action.requestedByAgentId), id: randomUUID(), status: "pending", createdAt: Date.now() };
    await this.update((requests) => [...requests, request]);
    return request;
  }

  async decide(id: string, decision: "approved" | "rejected", reason: string): Promise<ApprovalRequest> {
    const cleanReason = reason.trim();
    if (!cleanReason || cleanReason.length > 2_000) throw new Error("Approval decision reason must contain 1 to 2000 characters");
    let decided: ApprovalRequest | undefined;
    await this.update((requests) => requests.map((request) => {
      if (request.id !== id) return request;
      if (request.status !== "pending") throw new Error("Approval request is already decided");
      decided = { ...request, status: decision, decisionReason: cleanReason, decidedAt: Date.now() };
      return decided;
    }));
    if (!decided) throw new Error("Approval request not found");
    return decided;
  }

  async list(status?: ApprovalStatus): Promise<ApprovalRequest[]> {
    const requests = await this.read();
    return requests.filter((request) => !status || request.status === status).sort((a, b) => a.createdAt - b.createdAt);
  }

  async assertApproved(id: string): Promise<ApprovalRequest> {
    const request = (await this.read()).find((candidate) => candidate.id === id);
    if (!request || request.status !== "approved") throw new Error("Action does not have operator approval");
    return request;
  }

  private async update(change: (requests: ApprovalRequest[]) => ApprovalRequest[]): Promise<void> {
    const operation = this.writeQueue.then(async () => atomicWrite(this.path, change(await this.read())));
    this.writeQueue = operation.catch(() => undefined);
    await operation;
  }

  private async read(): Promise<ApprovalRequest[]> {
    try { return JSON.parse(await readFile(this.path, "utf8")) as ApprovalRequest[]; } catch { return []; }
  }
}

function validateAction(action: ProposedHiveAction): void {
  if (!HIVE_ACTION_CATEGORIES.includes(action.category)) throw new Error("Unknown Hive action category");
  if (!action.title.trim() || action.title.length > 300) throw new Error("Action title must contain 1 to 300 characters");
  if (!action.rationale.trim() || action.rationale.length > 5_000) throw new Error("Action rationale must contain 1 to 5000 characters");
  safeId(action.requestedByAgentId);
  if (action.category === "spend-increase" && (!(action.estimatedAdditionalCostUsd && action.estimatedAdditionalCostUsd > 0) || !Number.isFinite(action.estimatedAdditionalCostUsd))) throw new Error("Spend increases require a positive finite cost estimate");
}

function safeId(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(normalized)) throw new Error("Invalid Hive identifier");
  return normalized;
}

async function atomicWrite(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}
