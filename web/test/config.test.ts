import test from "node:test";
import assert from "node:assert/strict";
import { resolveApiBaseUrl, resolveWebSocketBaseUrl } from "../lib/config";

test("resolveApiBaseUrl falls back to localhost backend", () => {
  assert.equal(resolveApiBaseUrl({}), "http://localhost:4000");
});

test("resolveApiBaseUrl trims trailing slash", () => {
  assert.equal(
    resolveApiBaseUrl({ NEXT_PUBLIC_API_BASE_URL: "https://api.example.com/" }),
    "https://api.example.com"
  );
});

test("resolveWebSocketBaseUrl derives ws URL from api base URL", () => {
  assert.equal(
    resolveWebSocketBaseUrl({}, "https://api.example.com"),
    "wss://api.example.com"
  );
});

test("resolveWebSocketBaseUrl prefers explicit env override", () => {
  assert.equal(
    resolveWebSocketBaseUrl(
      { NEXT_PUBLIC_WS_BASE_URL: "wss://ws.example.com/" },
      "https://api.example.com"
    ),
    "wss://ws.example.com"
  );
});
