const API = "http://localhost:4000";
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
  const token = getToken();
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

export async function listWorkflows(): Promise<WorkflowMeta[]> {
  const res = await fetch(`${API}/workflows`, { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json() as Promise<WorkflowMeta[]>;
}

export async function saveWorkflow(name: string, data: unknown): Promise<WorkflowMeta> {
  const res = await fetch(`${API}/workflows/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name, data }),
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
