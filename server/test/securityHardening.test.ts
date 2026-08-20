import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import { safeRequestPath } from "../logger";
import { getBucketKey } from "../rateLimit";

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
