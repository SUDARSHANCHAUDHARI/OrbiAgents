import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LocalModelClient } from "../src/main/models/localModelClient";
import { LocalModelEndpointStore } from "../src/main/models/localModelEndpointStore";

async function storeWithKey() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "orbi-model-client-"));
  const store = new LocalModelEndpointStore(path.join(directory, "models.json"), { isAvailable: () => true, encrypt: (value) => Buffer.from(value), decrypt: (value) => value.toString("utf8") });
  await store.load(); await store.create({ id: "local", name: "Local", baseUrl: "http://localhost:11434/v1" }); await store.setCredential("local", "private-token"); return store;
}

test("client probes OpenAI models with the decrypted credential only in the request", async () => {
  const store = await storeWithKey(); let request: { url: string; authorization?: string } | undefined;
  const client = new LocalModelClient(store, (async (input, init) => { request = { url: String(input), authorization: new Headers(init?.headers).get("authorization") ?? undefined }; return Response.json({ data: [{ id: "qwen3" }, { id: "llama3" }] }); }) as typeof fetch);
  assert.deepEqual(await client.probe("local"), { models: ["qwen3", "llama3"], truncated: false });
  assert.deepEqual(request, { url: "http://localhost:11434/v1/models", authorization: "Bearer private-token" });
});

test("client redacts network failures and never includes credentials in errors", async () => {
  const store = await storeWithKey();
  const client = new LocalModelClient(store, (async () => { throw new Error("request private-token failed"); }) as typeof fetch);
  await assert.rejects(client.probe("local"), (error: Error) => error.message === "Endpoint probe failed");
});

test("client rejects invalid and oversized model responses", async () => {
  const store = await storeWithKey();
  await assert.rejects(new LocalModelClient(store, (async () => Response.json({ other: [] })) as typeof fetch).probe("local"), /invalid OpenAI models response/);
  const oversized = new Response("x", { headers: { "content-length": String(1024 * 1024 + 1) } });
  await assert.rejects(new LocalModelClient(store, (async () => oversized) as typeof fetch).probe("local"), /exceeded 1 MB/);
});

test("client bounds the returned model list", async () => {
  const store = await storeWithKey(); const data = Array.from({ length: 205 }, (_, index) => ({ id: `model-${index}` }));
  const result = await new LocalModelClient(store, (async () => Response.json({ data })) as typeof fetch).probe("local");
  assert.equal(result.models.length, 200); assert.equal(result.truncated, true);
});

test("client aborts a probe after its bounded timeout", async () => {
  const store = await storeWithKey();
  const fetcher = ((_input: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("private-token timeout")), { once: true }))) as typeof fetch;
  await assert.rejects(new LocalModelClient(store, fetcher, 5).probe("local"), (error: Error) => error.message === "Endpoint probe timed out");
});
