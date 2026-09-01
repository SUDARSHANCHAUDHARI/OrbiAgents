import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SlackStatus } from "../../shared/contracts";
import type { CredentialCipher } from "../models/localModelEndpointStore";

interface StoredSlack { encryptedBotToken?: string; team?: string; botUser?: string; updatedAt: number; }

export class SlackStore {
  private value: StoredSlack = { updatedAt: 0 }; private saveQueue = Promise.resolve();
  constructor(private readonly filePath: string, private readonly cipher: CredentialCipher, private readonly now: () => number = Date.now) {}
  async load(): Promise<SlackStatus> { const raw = await readFile(this.filePath, "utf8").catch((error: NodeJS.ErrnoException) => error.code === "ENOENT" ? "{}" : Promise.reject(error)); try { this.value = parseStored(JSON.parse(raw)); } catch { this.value = { updatedAt: 0 }; } return this.status(); }
  status(): SlackStatus {
    return {
      configured: Boolean(this.value.encryptedBotToken),
      ...(this.value.team ? { team: this.value.team } : {}),
      ...(this.value.botUser ? { botUser: this.value.botUser } : {}),
      updatedAt: this.value.updatedAt,
    };
  }
  async setToken(token: unknown): Promise<SlackStatus> { if (typeof token !== "string" || !/^xoxb-[A-Za-z0-9-]{10,500}$/.test(token)) throw new Error("Clipboard does not contain a Slack bot token"); if (!this.cipher.isAvailable()) throw new Error("Secure credential storage is unavailable; the Slack token was not saved"); await this.save({ encryptedBotToken: this.cipher.encrypt(token).toString("base64"), updatedAt: this.now() }); return this.status(); }
  async clear(): Promise<SlackStatus> { await this.save({ updatedAt: this.now() }); return this.status(); }
  async identify(team: string, botUser: string): Promise<SlackStatus> { await this.save({ ...this.value, team: bounded(team, 120), botUser: bounded(botUser, 120), updatedAt: this.now() }); return this.status(); }
  token(): string { if (!this.value.encryptedBotToken) throw new Error("Slack is not configured"); if (!this.cipher.isAvailable()) throw new Error("Secure credential storage is unavailable"); try { return this.cipher.decrypt(Buffer.from(this.value.encryptedBotToken, "base64")); } catch { throw new Error("The stored Slack credential cannot be decrypted"); } }
  private async save(value: StoredSlack): Promise<void> { const snapshot = { ...value }; this.saveQueue = this.saveQueue.catch(() => undefined).then(async () => { await mkdir(path.dirname(this.filePath), { recursive: true }); const temporary = `${this.filePath}.tmp`; await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); await rename(temporary, this.filePath); }); await this.saveQueue; this.value = snapshot; }
}
function parseStored(value: unknown): StoredSlack {
  if (!value || typeof value !== "object") return { updatedAt: 0 };
  const row = value as Record<string, unknown>;
  const allowedKeys = new Set(["encryptedBotToken", "team", "botUser", "updatedAt"]);
  if (
    Object.keys(row).some((key) => !allowedKeys.has(key)) ||
    typeof row.updatedAt !== "number" ||
    !Number.isFinite(row.updatedAt) ||
    (row.encryptedBotToken !== undefined &&
      (typeof row.encryptedBotToken !== "string" ||
        row.encryptedBotToken.length > 2_000 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(row.encryptedBotToken))) ||
    (row.team !== undefined && typeof row.team !== "string") ||
    (row.botUser !== undefined && typeof row.botUser !== "string")
  ) {
    return { updatedAt: 0 };
  }
  return {
    encryptedBotToken: row.encryptedBotToken as string | undefined,
    team: row.team ? bounded(row.team, 120) : undefined,
    botUser: row.botUser ? bounded(row.botUser, 120) : undefined,
    updatedAt: row.updatedAt,
  };
}
function bounded(value: string, max: number): string { if (!value.trim() || value.length > max || /[\0\r\n]/.test(value)) throw new Error("Slack identity response is invalid"); return value.trim(); }
