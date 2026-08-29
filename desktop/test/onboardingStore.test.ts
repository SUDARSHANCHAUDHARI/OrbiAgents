import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ONBOARDING_VERSION, OnboardingStore } from "../src/main/onboarding/onboardingStore";

test("onboarding store persists versioned completion atomically", async () => { const directory = await mkdtemp(path.join(os.tmpdir(), "orbi-onboarding-")); const file = path.join(directory, "state.json"); const store = new OnboardingStore(file, () => 123); assert.equal(await store.load(), null); assert.deepEqual(await store.complete(), { version: ONBOARDING_VERSION, completedAt: 123 }); assert.deepEqual(JSON.parse(await readFile(file, "utf8")), { version: ONBOARDING_VERSION, completedAt: 123 }); });
test("onboarding store treats corruption and version mismatch as incomplete", async () => { const directory = await mkdtemp(path.join(os.tmpdir(), "orbi-onboarding-")); const file = path.join(directory, "state.json"); await writeFile(file, "{", "utf8"); const store = new OnboardingStore(file); assert.equal(await store.load(), null); await writeFile(file, JSON.stringify({ version: ONBOARDING_VERSION + 1, completedAt: 123 }), "utf8"); assert.equal(await store.load(), null); });
