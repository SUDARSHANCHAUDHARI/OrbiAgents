import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import { safeRequestPath } from "../logger";
import { createRateLimit, getBucketKey } from "../rateLimit";
import { db } from "../db";

test("request logs omit query strings that may contain credentials", () => {
  assert.equal(safeRequestPath("/socket?token=secret&mode=live"), "/socket");
  assert.equal(safeRequestPath("/health"), "/health");
});

test("rate limiting uses Express trusted-proxy resolution instead of raw forwarded headers", () => {
  const request = {
    headers: { "x-forwarded-for": "203.0.113.9" },
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as Request;
  assert.equal(getBucketKey(request, "auth"), "auth:anon:127.0.0.1");
});

test("rate limiting counts parallel requests atomically and restarts an expired window", async () => {
  const key = `race-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const limit = createRateLimit({ key, windowMs: 60_000, max: 3, message: "slow down" });
  const request = { ip: "127.0.0.1", socket: {} } as unknown as Request;
  const attempt = () => new Promise<number>((resolve) => {
    const res = { setHeader() {}, status(code: number) { resolve(code); return { json() {} }; } };
    void limit(request, res as never, () => resolve(200));
  });
  const codes = await Promise.all(Array.from({ length: 8 }, attempt));
  assert.deepEqual([codes.filter((code) => code === 200).length, codes.filter((code) => code === 429).length], [3, 5]);

  await db.rateLimitBucket.update({ where: { id: `${key}:anon:127.0.0.1` }, data: { resetAt: new Date(Date.now() - 1) } });
  assert.equal(await attempt(), 200);
  assert.equal((await db.rateLimitBucket.findUnique({ where: { id: `${key}:anon:127.0.0.1` } }))?.count, 1);
});
