import { DEFAULT_PROVIDER, availableProviders, Provider } from "./ai";
import path from "node:path";

const FALLBACK_JWT_SECRET = "orbiagents-dev-secret-change-in-prod";

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function validateServerEnv(env: NodeJS.ProcessEnv = process.env): void {
  const appUrl = env.APP_URL ?? "http://localhost:3000";
  const corsOrigin = env.CORS_ORIGIN ?? appUrl;
  const jwtSecret = env.JWT_SECRET ?? FALLBACK_JWT_SECRET;
  const isProduction = env.NODE_ENV === "production";
  const provider = (env.DEFAULT_PROVIDER as Provider | undefined) ?? DEFAULT_PROVIDER;
  const available = availableProviders();
  const numericVars = [
    "RATE_LIMIT_AUTH_MAX",
    "RATE_LIMIT_WORKFLOW_MAX",
    "MAX_RUNS_PER_HOUR",
    "MAX_DAILY_COST_USD",
    "MAX_WORKFLOW_NODES",
    "MEMORY_EMBEDDING_CACHE_TTL_DAYS",
    "MEMORY_EMBEDDING_CACHE_MAX_ENTRIES",
  ] as const;

  if (!isValidUrl(appUrl)) {
    throw new Error(`Invalid APP_URL: ${appUrl}`);
  }

  if (!isValidUrl(corsOrigin)) {
    throw new Error(`Invalid CORS_ORIGIN: ${corsOrigin}`);
  }

  if (!["anthropic", "openai", "gemini"].includes(provider)) {
    throw new Error(`Invalid DEFAULT_PROVIDER: ${provider}`);
  }

  for (const key of numericVars) {
    const value = env[key];
    if (value == null || value === "") continue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`${key} must be a non-negative number`);
    }
  }

  if (env.LOCAL_CLI_ENABLED != null && !["true", "false"].includes(env.LOCAL_CLI_ENABLED)) {
    throw new Error("LOCAL_CLI_ENABLED must be true or false");
  }
  if (env.MEMORY_EMBEDDINGS_ENABLED != null && !["true", "false"].includes(env.MEMORY_EMBEDDINGS_ENABLED)) throw new Error("MEMORY_EMBEDDINGS_ENABLED must be true or false");
  if (env.MEMORY_EMBEDDINGS_ENABLED === "true" && !env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required when memory embeddings are enabled");
  if (env.LOCAL_CLI_ENABLED === "true") {
    for (const key of ["LOCAL_CLI_REPO_PATH", "LOCAL_CLI_WORKTREE_ROOT"] as const) {
      const value = env[key];
      if (!value || !path.isAbsolute(value) || path.resolve(value) !== path.normalize(value)) {
        throw new Error(`${key} must be an absolute normalized path when local CLI execution is enabled`);
      }
    }
    const repoPath = path.resolve(env.LOCAL_CLI_REPO_PATH!);
    const worktreeRoot = path.resolve(env.LOCAL_CLI_WORKTREE_ROOT!);
    const relativeRoot = path.relative(repoPath, worktreeRoot);
    if (relativeRoot === "" || (!relativeRoot.startsWith(`..${path.sep}`) && relativeRoot !== "..")) {
      throw new Error("LOCAL_CLI_WORKTREE_ROOT must be outside LOCAL_CLI_REPO_PATH");
    }
  }

  if (isProduction && jwtSecret === FALLBACK_JWT_SECRET) {
    throw new Error("JWT_SECRET must be set in production");
  }

  if (available.length === 0) {
    const message = "No AI provider API keys configured";
    if (isProduction) {
      throw new Error(message);
    }
    console.warn(`[env] ${message}. The dashboard can load, but runs will fail until a provider key is set.`);
  }

  if (available.length > 0 && !available.includes(provider)) {
    const message = `DEFAULT_PROVIDER "${provider}" is not configured. Available providers: ${available.join(", ")}`;
    if (isProduction) {
      throw new Error(message);
    }
    console.warn(`[env] ${message}`);
  }
}
