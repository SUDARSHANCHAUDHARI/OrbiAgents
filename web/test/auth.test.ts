import test from "node:test";
import assert from "node:assert/strict";
import { buildAuthHeaders } from "../lib/auth";

test("buildAuthHeaders returns bearer header when token exists", () => {
  assert.deepEqual(buildAuthHeaders("abc123"), {
    Authorization: "Bearer abc123",
  });
});

test("buildAuthHeaders returns empty object when token is missing", () => {
  assert.deepEqual(buildAuthHeaders(null), {});
});
