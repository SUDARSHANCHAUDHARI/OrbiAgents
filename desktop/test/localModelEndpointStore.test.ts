import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LocalModelEndpointStore, validateLocalBaseUrl, type CredentialCipher } from "../src/main/models/localModelEndpointStore";

const cipher: CredentialCipher = {
  isAvailable: () => true,
  encrypt: (value) => Buffer.from(`encrypted:${value}`, "utf8"),
  decrypt: (value) => value.toString("utf8").replace(/^encrypted:/, ""),
};
async function fixture(customCipher = cipher) { const directory = await mkdtemp(path.join(os.tmpdir(), "orbi-models-")); const file = path.join(directory, "models.json"); return { file, store: new LocalModelEndpointStore(file, customCipher, () => 123) }; }

test("endpoint store encrypts API keys and exposes only redacted metadata", async () => {
  const { file, store } = await fixture(); await store.load();
  await store.create({ id: "ollama", name: "Ollama", baseUrl: "http://127.0.0.1:11434/v1/", defaultModel: "qwen3" });
  const endpoints = await store.setCredential("ollama", "private-token");
  assert.deepEqual(endpoints, [{ id: "ollama", name: "Ollama", baseUrl: "http://127.0.0.1:11434/v1", defaultModel: "qwen3", hasApiKey: true, createdAt: 123, updatedAt: 123 }]);
  const persisted = await readFile(file, "utf8"); assert.equal(persisted.includes("private-token"), false); assert.equal(persisted.includes("encryptedApiKey"), true);
  assert.equal(store.resolve("ollama").apiKey, "private-token");
});

test("endpoint store fails closed when encryption is unavailable", async () => {
  const { store } = await fixture({ ...cipher, isAvailable: () => false }); await store.load();
  await store.create({ id: "secured", name: "Secured", baseUrl: "http://localhost:1234/v1" });
  await assert.rejects(store.setCredential("secured", "secret"), /not saved/);
  assert.equal(store.list()[0]?.hasApiKey, false);
});

test("endpoint validation prevents non-loopback and credential-bearing URLs", () => {
  assert.equal(validateLocalBaseUrl("http://localhost:11434/v1"), "http://localhost:11434/v1");
  assert.throws(() => validateLocalBaseUrl("https://api.openai.com/v1"), /loopback/);
  assert.throws(() => validateLocalBaseUrl("http://user:pass@localhost/v1"), /loopback/);
  assert.throws(() => validateLocalBaseUrl("http://localhost/api/v1"), /end with \/v1/);
  assert.throws(() => validateLocalBaseUrl("file:///v1"), /loopback/);
});

test("endpoint store ignores corrupt records and rejects undecryptable credentials", async () => {
  const { file, store } = await fixture({ ...cipher, decrypt: () => { throw new Error("secret detail"); } });
  await writeFile(file, JSON.stringify([{ id: "bad", name: "Bad", baseUrl: "https://remote.test/v1", createdAt: 1, updatedAt: 1 }, { id: "valid", name: "Valid", baseUrl: "http://localhost/v1", encryptedApiKey: Buffer.from("cipher").toString("base64"), createdAt: 1, updatedAt: 1 }]), "utf8");
  assert.equal((await store.load()).length, 1);
  assert.throws(() => store.resolve("valid"), /cannot be decrypted/);
  assert.equal((await store.clearCredential("valid"))[0]?.hasApiKey, false);
  assert.equal((await store.remove("valid")).length, 0);
});
