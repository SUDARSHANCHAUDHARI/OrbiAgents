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

test("inference posts bounded chat requests and never follows redirects", async () => {
  const store = await storeWithKey(); let seen: RequestInit | undefined;
  const client = new LocalModelClient(store, (async (url, init) => { assert.equal(String(url), "http://localhost:11434/v1/chat/completions"); seen = init; return Response.json({ choices: [{ finish_reason: "stop", message: { content: "A real response" } }] }); }) as typeof fetch);
  assert.deepEqual(await client.complete({ id: "local", requestId: "one", model: "qwen", prompt: "Explain a parser" }), { text: "A real response", model: "qwen" });
  assert.equal(seen?.redirect, "error"); assert.equal(seen?.method, "POST");
  assert.equal(new Headers(seen?.headers).get("authorization"), "Bearer private-token");
  assert.deepEqual(JSON.parse(String(seen?.body)), { model: "qwen", messages: [{ role: "user", content: "Explain a parser" }], stream: false, max_tokens: 4096 });
});

test("inference cancellation rejects late results and releases the slot", async () => {
  const store = await storeWithKey(); let release!: (response: Response) => void;
  const client = new LocalModelClient(store, (() => new Promise<Response>((resolve) => { release = resolve; })) as typeof fetch);
  const request = { id: "local", requestId: "one", model: "qwen", prompt: "Explain" };
  const pending = client.complete(request); await assert.rejects(client.complete(request), /already running/);
  client.cancel("one");
  release(Response.json({ choices: [{ finish_reason: "stop", message: { content: "late" } }] }));
  await assert.rejects(pending, /cancelled/);
  const next = client.complete(request); release(Response.json({ choices: [{ finish_reason: "stop", message: { content: "fresh" } }] }));
  assert.equal((await next).text, "fresh");
});

test("inference times out and redacts provider failures", async () => {
  const store = await storeWithKey();
  const fetcher = ((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("private-token")), { once: true }))) as typeof fetch;
  const request = { id: "local", requestId: "one", model: "qwen", prompt: "Explain" };
  await assert.rejects(new LocalModelClient(store, fetcher, 5000, 5).complete(request), /timed out/);
  await assert.rejects(new LocalModelClient(store, (async () => { throw new Error("private-token"); }) as typeof fetch).complete(request), (error: Error) => !error.message.includes("private-token") && error.message.includes("failed"));
});

test("inference rejects unbounded input, incomplete output and tool calls", async () => {
  const store = await storeWithKey();
  const request = { id: "local", requestId: "one", model: "qwen", prompt: "Explain" };
  const never = new LocalModelClient(store, (async () => { assert.fail("must not fetch"); }) as typeof fetch);
  for (const prompt of ["", " ", "x".repeat(20_001), "\x1b[bad"]) await assert.rejects(never.complete({ ...request, prompt }));
  await assert.rejects(never.complete({ ...request, model: "" }), /Choose a model/);
  for (const value of [null, {}, { choices: [{ finish_reason: "length", message: { content: "partial" } }] }, { choices: [{ finish_reason: "stop", message: { content: "text", tool_calls: [{}] } }] }, { choices: [{ finish_reason: "stop", message: { content: "x".repeat(50_001) } }] }]) {
    await assert.rejects(new LocalModelClient(store, (async () => Response.json(value)) as typeof fetch).complete(request), /incomplete response/);
  }
});

test("inference limits concurrency and disposal cancels all running requests", async () => {
  const store = await storeWithKey();
  const fetcher = ((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("abort")), { once: true }))) as typeof fetch;
  const client = new LocalModelClient(store, fetcher);
  const request = { id: "local", requestId: "one", model: "qwen", prompt: "Explain" };
  const one = client.complete(request); const two = client.complete({ ...request, requestId: "two" });
  await assert.rejects(client.complete({ ...request, requestId: "three" }), /At most two/);
  client.dispose(); await assert.rejects(one, /cancelled/); await assert.rejects(two, /cancelled/);
});

test("inference honors cancellation arriving before async IPC validation finishes", async () => {
  const store = await storeWithKey();
  const client = new LocalModelClient(store, (async () => { assert.fail("must not fetch"); }) as typeof fetch);
  const request = { id: "local", requestId: "early", model: "qwen", prompt: "Explain" };
  client.cancel("early"); await assert.rejects(client.complete(request), /cancelled/);
  client.dispose(); await assert.rejects(client.complete({ ...request, requestId: "after-close" }), /closed/);
});

test("planner JSON mode is explicit while regular inference remains text", async () => {
  const store = await storeWithKey(); const bodies: Record<string, unknown>[] = [];
  const client = new LocalModelClient(store, (async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: '{"steps":[]}' } }] });
  }) as typeof fetch);
  const request = { id: "local", requestId: "json", model: "qwen", prompt: "Return a JSON object" };
  await client.complete(request, "json"); await client.complete({ ...request, requestId: "text" });
  assert.deepEqual(bodies[0].response_format, { type: "json_object" });
  assert.equal("response_format" in bodies[1], false);
});
