import { getApiBaseUrl } from "./config";
import { Provider, Session, SessionMeta } from "./types";

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
