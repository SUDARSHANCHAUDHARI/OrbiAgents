import type { HireProfile } from "../../shared/contracts";
import { validateAgentName, validateAgentProfile, validateRuntimeId } from "../security/validators";

const PREFIX = "orbiagents://hire"; const MAX_LINK = 8_192;
export function encodeHireProfile(value: HireProfile): string {
  const profile = validateHireProfile(value); const payload = Buffer.from(JSON.stringify({ version: 1, ...profile }), "utf8").toString("base64url");
  return `${PREFIX}?profile=${payload}`;
}
export function decodeHireProfile(value: unknown): HireProfile {
  if (typeof value !== "string" || value.length > MAX_LINK) throw new Error("Hire link is invalid");
  let url: URL; try { url = new URL(value); } catch { throw new Error("Hire link is invalid"); }
  if (`${url.protocol}//${url.hostname}${url.pathname}` !== PREFIX || url.username || url.password || url.hash || [...url.searchParams.keys()].some((key) => key !== "profile")) throw new Error("Hire link is invalid");
  const encoded = url.searchParams.get("profile"); if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("Hire link is invalid");
  let parsed: unknown; try { parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); } catch { throw new Error("Hire link payload is invalid"); }
  if (!parsed || typeof parsed !== "object" || (parsed as Record<string, unknown>).version !== 1) throw new Error("Unsupported hire link version");
  return validateHireProfile(parsed);
}
export function validateHireProfile(value: unknown): HireProfile {
  if (!value || typeof value !== "object") throw new Error("Hire profile is invalid"); const row = value as Record<string, unknown>;
  const allowed = new Set(["version", "name", "runtimeId", "isolateWorkspace", "profile"]); if (Object.keys(row).some((key) => !allowed.has(key))) throw new Error("Hire profile contains unsupported fields");
  if (typeof row.isolateWorkspace !== "boolean") throw new Error("Hire workspace mode is invalid");
  return { name: validateAgentName(row.name), runtimeId: validateRuntimeId(row.runtimeId), isolateWorkspace: row.isolateWorkspace, profile: validateAgentProfile(row.profile) };
}
