import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { findExecutable, PrerequisiteChecker } from "../src/main/onboarding/prerequisiteChecker";

test("prerequisite checker reports only directly verified capabilities", async () => {
  const executable = new Set(["/bin/git", "/tools/codex", "/tools/gh"]);
  const report = await new PrerequisiteChecker({ platform: "darwin", environment: { PATH: ["relative", "/bin", "/tools", "/tools"].join(path.delimiter) }, encryptionAvailable: () => true, now: () => 123, canExecute: async (file) => executable.has(file) }).check();
  assert.equal(report.ready, true); assert.equal(report.checkedAt, 123); assert.equal(report.checks.find((check) => check.id === "agent-runtime")?.detail, "Available: codex."); assert.equal(report.checks.find((check) => check.id === "claude")?.status, "warn"); assert.equal(report.checks.find((check) => check.id === "github")?.status, "pass");
});

test("prerequisite checker fails readiness without platform, Git, or an agent runtime", async () => {
  const report = await new PrerequisiteChecker({ platform: "linux", environment: { PATH: "/empty" }, encryptionAvailable: () => false, canExecute: async () => false }).check();
  assert.equal(report.ready, false); assert.deepEqual(report.checks.filter((check) => check.required).map((check) => check.status), ["fail", "fail", "fail"]); assert.equal(report.checks.find((check) => check.id === "secure-storage")?.status, "warn");
});

test("executable lookup ignores relative and duplicate PATH entries", async () => {
  const seen: string[] = []; const result = await findExecutable("git", ["relative", "/one", "/one", "/two"].join(path.delimiter), async (file) => { seen.push(file); return file === "/two/git"; });
  assert.equal(result, "/two/git"); assert.deepEqual(seen, ["/one/git", "/two/git"]); assert.equal(await findExecutable("../bad", "/bin", async () => true), undefined);
});
