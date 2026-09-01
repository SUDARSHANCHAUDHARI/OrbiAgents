import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { RemoteCatalogClient } from "../src/main/catalog/remoteCatalogClient";

const now = Date.parse("2026-09-01T00:00:00.000Z");
const keys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ format: "der", type: "spki" }).toString("base64");
const request = { url: "https://catalog.example.com/orbi/catalog.json", publisherId: "sudarshan-tech-labs", keyId: "release-2026", publicKey };
const publicResolver = async () => [{ address: "8.8.8.8" }];

function signedCatalog(overrides: Record<string, unknown> = {}) {
  const payload = { schemaVersion: 1, publisher: { id: request.publisherId, keyId: request.keyId }, issuedAt: "2026-08-31T23:00:00.000Z", expiresAt: "2026-09-08T00:00:00.000Z", entries: [{ id: "android-review", kind: "skill", name: "Android Review", description: "Review Android changes", version: "1.0.0", artifactUrl: "https://catalog.example.com/orbi/android-review.zip", sha256: "a".repeat(64), size: 4096 }], ...overrides };
  return { ...payload, signature: sign(null, Buffer.from(canonical(payload)), keys.privateKey).toString("base64") };
}

test("catalog review verifies pinned publisher signature and returns bounded metadata", async () => {
  let calls = 0; const client = new RemoteCatalogClient((async (_url, init) => { calls++; assert.equal(init?.redirect, "manual"); assert.ok(init?.signal); return Response.json(signedCatalog()); }) as typeof fetch, () => now, publicResolver);
  const first = await client.review(request); assert.equal(first.publisherId, request.publisherId); assert.equal(first.entries.length, 1); assert.equal(first.fromCache, false);
  const second = await client.review(request); assert.equal(second.fromCache, true); assert.equal(calls, 1);
});

test("catalog review rejects signature, identity, origin, and private network violations", async () => {
  const invalidSignature = signedCatalog(); invalidSignature.signature = Buffer.alloc(64).toString("base64");
  await assert.rejects(new RemoteCatalogClient((async () => Response.json(invalidSignature)) as typeof fetch, () => now, publicResolver).review(request), /signature verification failed/);
  await assert.rejects(new RemoteCatalogClient((async () => Response.json(signedCatalog({ publisher: { id: "attacker", keyId: request.keyId } }))) as typeof fetch, () => now, publicResolver).review(request), /publisher identity/);
  await assert.rejects(new RemoteCatalogClient((async () => Response.json(signedCatalog({ entries: [{ ...signedCatalog().entries[0], artifactUrl: "https://evil.example/file.zip" }] }))) as typeof fetch, () => now, publicResolver).review(request), /catalog origin/);
  await assert.rejects(new RemoteCatalogClient().review({ ...request, url: "https://127.0.0.1/catalog.json" }), /Catalog URL is invalid/);
  await assert.rejects(new RemoteCatalogClient((async () => Response.json(signedCatalog())) as typeof fetch, () => now, async () => [{ address: "127.0.0.1" }]).review(request), /unsafe address/);
  await assert.rejects(new RemoteCatalogClient((async () => Response.json(signedCatalog())) as typeof fetch, () => now, async () => [{ address: "100.64.0.1" }]).review(request), /unsafe address/);
  await assert.rejects(new RemoteCatalogClient((async () => Response.json(signedCatalog())) as typeof fetch, () => now, async () => [{ address: "fe90::1" }]).review(request), /unsafe address/);
  await assert.rejects(new RemoteCatalogClient().review({ ...request, url: "https://[::ffff:127.0.0.1]/catalog.json" }), /Catalog URL is invalid/);
});

test("catalog review rejects redirects, expiry, unknown fields, and oversized responses", async () => {
  await assert.rejects(new RemoteCatalogClient((async () => new Response(null, { status: 302, headers: { location: "https://catalog.example.com/next" } })) as typeof fetch, () => now, publicResolver).review(request), /redirects/);
  await assert.rejects(new RemoteCatalogClient((async () => Response.json(signedCatalog({ expiresAt: "2026-08-31T23:30:00.000Z" }))) as typeof fetch, () => now, publicResolver).review(request), /validity window/);
  await assert.rejects(new RemoteCatalogClient((async () => Response.json(signedCatalog({ extra: true }))) as typeof fetch, () => now, publicResolver).review(request), /unsupported fields/);
  await assert.rejects(new RemoteCatalogClient((async () => Response.json(signedCatalog())) as typeof fetch, () => now, publicResolver).review({ ...request, extra: true }), /request contains unsupported fields/);
  await assert.rejects(new RemoteCatalogClient((async () => Response.json(signedCatalog({ publisher: { id: request.publisherId, keyId: request.keyId, extra: true } }))) as typeof fetch, () => now, publicResolver).review(request), /publisher contains unsupported fields/);
  await assert.rejects(new RemoteCatalogClient((async () => new Response("{}", { headers: { "content-length": String(1024 * 1024 + 1) } })) as typeof fetch, () => now, publicResolver).review(request), /exceeded 1 MB/);
});

function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`; return JSON.stringify(value); }
