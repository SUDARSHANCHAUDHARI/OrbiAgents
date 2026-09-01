import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SlackStore } from "../src/main/slack/slackStore";
const cipher = { isAvailable: () => true, encrypt: (value: string) => Buffer.from(`sealed:${value}`), decrypt: (value: Buffer) => value.toString().replace(/^sealed:/, "") };
test("Slack store encrypts bot tokens and exposes redacted status", async () => { const root = await mkdtemp(path.join(os.tmpdir(), "orbi-slack-")); const file = path.join(root, "slack.json"); const store = new SlackStore(file, cipher, () => 123); await store.load(); assert.deepEqual(await store.setToken("xoxb-1234567890-abcdefghij"), { configured: true, updatedAt: 123 }); assert.equal((await readFile(file, "utf8")).includes("xoxb-"), false); assert.equal(store.token(), "xoxb-1234567890-abcdefghij"); assert.equal((await store.clear()).configured, false); });
test("Slack store fails closed without secure storage or a bot token", async () => { const root = await mkdtemp(path.join(os.tmpdir(), "orbi-slack-")); const store = new SlackStore(path.join(root, "slack.json"), { ...cipher, isAvailable: () => false }); await store.load(); await assert.rejects(store.setToken("xoxb-1234567890-abcdefghij"), /unavailable/); await assert.rejects(store.setToken("xoxp-user-token"), /bot token/); assert.throws(() => store.token(), /not configured/); });
