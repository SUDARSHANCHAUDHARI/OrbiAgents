export function resolveApiBaseUrl(env: NodeJS.ProcessEnv): string {
  return env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:4000";
}

export function resolveWebSocketBaseUrl(env: NodeJS.ProcessEnv, apiBaseUrl: string): string {
  return env.NEXT_PUBLIC_WS_BASE_URL?.replace(/\/$/, "") ??
    apiBaseUrl.replace(/^http/i, "ws");
}

const API_BASE_URL = resolveApiBaseUrl(process.env);
const WS_BASE_URL = resolveWebSocketBaseUrl(process.env, API_BASE_URL);

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function getWebSocketBaseUrl(): string {
  return WS_BASE_URL;
}
