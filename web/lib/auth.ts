import { getApiBaseUrl } from "./config";
import { MailboxMessage, MemoryEntry, MemoryScope, MessageKind, PreservedWorkspace, Provider, RuntimeId, Session, SessionMeta, Workflow, WorkflowProposal, WorkspaceChanges } from "./types";

const API = getApiBaseUrl();
const TOKEN_KEY = "orbi_token";

export interface AuthUser {
  id: string;
  email: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(): Record<string, string> {
  return buildAuthHeaders(getToken());
}

export function buildAuthHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function signup(
  email: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = (await res.json()) as { token: string; user: AuthUser; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Signup failed");
  return data as { token: string; user: AuthUser };
}

export async function login(
  email: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = (await res.json()) as { token: string; user: AuthUser; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Login failed");
  return data as { token: string; user: AuthUser };
}

// Workflow persistence
export interface WorkflowMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProvidersResponse {
  providers: Provider[];
  default: Provider;
}

export interface RuntimesResponse {
  runtimes: RuntimeId[];
  default: RuntimeId;
}

export async function listWorkflows(): Promise<WorkflowMeta[]> {
  const res = await fetch(`${API}/workflows`, { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json() as Promise<WorkflowMeta[]>;
}

export async function saveWorkflow(name: string, data: unknown, id?: string): Promise<WorkflowMeta> {
  const res = await fetch(`${API}/workflows/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ id, name, data }),
  });
  const body = (await res.json()) as WorkflowMeta & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Save failed");
  return body;
}

export async function loadWorkflow(id: string): Promise<{ id: string; name: string; data: unknown }> {
  const res = await fetch(`${API}/workflows/${id}`, { headers: authHeaders() });
  const body = (await res.json()) as { id: string; name: string; data: unknown; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Load failed");
  return body;
}

export async function deleteWorkflow(id: string): Promise<void> {
  await fetch(`${API}/workflows/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function listProviders(): Promise<ProvidersResponse> {
  const res = await fetch(`${API}/providers`);
  if (!res.ok) {
    throw new Error("Could not load providers");
  }
  return res.json() as Promise<ProvidersResponse>;
}

export async function listRuntimes(): Promise<RuntimesResponse> {
  const res = await fetch(`${API}/runtimes`);
  if (!res.ok) throw new Error("Could not load runtimes");
  return res.json() as Promise<RuntimesResponse>;
}

export async function proposeWorkflow(workflow: Workflow): Promise<WorkflowProposal> {
  const res = await fetch(`${API}/workflow/proposal`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ workflow }) });
  const body = (await res.json()) as WorkflowProposal & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Could not create workflow proposal");
  return body;
}

export async function listPreservedWorkspaces(): Promise<PreservedWorkspace[]> {
  const res = await fetch(`${API}/workspaces`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Could not load preserved workspaces");
  return res.json() as Promise<PreservedWorkspace[]>;
}

export async function inspectPreservedWorkspace(id: string): Promise<WorkspaceChanges> {
  const res = await fetch(`${API}/workspaces/${encodeURIComponent(id)}/changes`, { headers: authHeaders() });
  const body = (await res.json()) as WorkspaceChanges & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Could not inspect workspace");
  return body;
}

export async function discardPreservedWorkspace(id: string): Promise<void> {
  const res = await fetch(`${API}/workspaces/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ confirm: true }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? "Could not discard workspace");
  }
}

export async function applyWorkspaceFiles(id: string, files: string[], untrackedFiles: string[] = []): Promise<void> {
  const res = await fetch(`${API}/workspaces/${encodeURIComponent(id)}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ confirm: true, files, untrackedFiles }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? "Could not apply workspace files");
  }
}

export async function listMemory(scope: MemoryScope, agentId?: string): Promise<MemoryEntry[]> {
  const query = new URLSearchParams({ scope });
  if (agentId) query.set("agentId", agentId);
  const res = await fetch(`${API}/memory?${query}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Could not load memory");
  return res.json() as Promise<MemoryEntry[]>;
}

export async function createMemory(scope: MemoryScope, content: string, agentId?: string, retentionDays?: number): Promise<MemoryEntry> {
  const res = await fetch(`${API}/memory`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ scope, agentId: scope === "agent" ? agentId : undefined, content, retentionDays }) });
  const body = (await res.json()) as MemoryEntry & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Could not save memory");
  return body;
}

export async function updateMemoryEntry(id: string, content: string): Promise<MemoryEntry> {
  const res = await fetch(`${API}/memory/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ content }) });
  const body = (await res.json()) as MemoryEntry & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Could not update memory");
  return body;
}

export async function deleteMemoryEntry(id: string): Promise<void> {
  const res = await fetch(`${API}/memory/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error("Could not delete memory");
}

export async function listInbox(agentId: string): Promise<MailboxMessage[]> {
  const res = await fetch(`${API}/messages/${encodeURIComponent(agentId)}?includeRead=true`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Could not load inbox");
  return res.json() as Promise<MailboxMessage[]>;
}

export async function sendMailboxMessage(input: { senderAgentId: string; recipientAgentId: string; kind: MessageKind; body: string; replyToId?: string }): Promise<MailboxMessage> {
  const res = await fetch(`${API}/messages`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(input) });
  const body = (await res.json()) as MailboxMessage & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Could not send message");
  return body;
}

export async function markMailboxMessageRead(id: string): Promise<void> {
  const res = await fetch(`${API}/messages/${encodeURIComponent(id)}/read`, { method: "POST", headers: authHeaders() });
  if (!res.ok) throw new Error("Could not mark message read");
}

export interface UsageStats {
  dailyCostUsd: number;
  maxDailyCostUsd: number;
  hourlyRuns: number;
  maxRunsPerHour: number;
}

export async function getUsage(): Promise<UsageStats> {
  const res = await fetch(`${API}/usage`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Could not load usage");
  return res.json() as Promise<UsageStats>;
}

export async function listSessions(): Promise<SessionMeta[]> {
  const res = await fetch(`${API}/sessions`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json() as Promise<SessionMeta[]>;
}

export async function getSessionDetails(sessionId: string): Promise<Session> {
  const res = await fetch(`${API}/replay/${sessionId}`, {
    headers: authHeaders(),
  });
  const body = (await res.json()) as Session & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? "Could not load session");
  }
  return body;
}

export async function createReplayShareLink(sessionId: string): Promise<{ token: string; url: string }> {
  const res = await fetch(`${API}/replay/${sessionId}/share`, {
    method: "POST",
    headers: authHeaders(),
  });
  const body = (await res.json()) as { token?: string; url?: string; error?: string };
  if (!res.ok || !body.token || !body.url) {
    throw new Error(body.error ?? "Could not create share link");
  }
  return { token: body.token, url: body.url };
}
