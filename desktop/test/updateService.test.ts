import assert from "node:assert/strict";
import test from "node:test";
import { UpdateService, type UpdaterLike } from "../src/main/updates/updateService";

function fake(version = "0.3.0") {
  const calls: string[] = [];
  const updater: UpdaterLike = {
    autoDownload: true, autoInstallOnAppQuit: true, allowPrerelease: true, currentVersion: { version },
    async checkForUpdates() { calls.push("check"); return { updateInfo: { version: "0.4.0", releaseName: "Orbi 0.4", releaseNotes: "Safer fleet updates", files: [{ size: 42 }] } }; },
    async downloadUpdate() { calls.push("download"); }, quitAndInstall() { calls.push("install"); },
  };
  return { updater, calls };
}

test("updates require explicit check, download, and safe restart", async () => {
  const { updater, calls } = fake(); const service = new UpdateService(updater, async () => []);
  assert.equal(updater.autoDownload, false); assert.equal(updater.autoInstallOnAppQuit, false); assert.equal(updater.allowPrerelease, false);
  assert.equal((await service.check()).phase, "available"); assert.equal(service.status().artifactSize, 42);
  assert.equal((await service.download()).phase, "downloaded"); await service.install();
  assert.deepEqual(calls, ["check", "download", "install"]);
});

test("update install fails closed while operator work is active", async () => {
  const { updater, calls } = fake(); const service = new UpdateService(updater, async () => ["one agent is running", "an approval is pending"]);
  await service.check(); await service.download();
  await assert.rejects(service.install(), /one agent is running; an approval is pending/);
  assert.deepEqual(calls, ["check", "download"]);
});

test("update errors are bounded non-destructive states", async () => {
  const { updater } = fake(); updater.checkForUpdates = async () => { throw new Error("offline"); };
  const service = new UpdateService(updater);
  assert.deepEqual(await service.check(), { currentVersion: "0.3.0", phase: "error", message: "offline" });
  await assert.rejects(service.download(), /Check for an available update/);
});

test("downgrade and malformed update metadata fail safely", async () => {
  const { updater, calls } = fake();
  updater.checkForUpdates = async () => { calls.push("check"); return { updateInfo: { version: "0.2.9" } }; };
  const service = new UpdateService(updater);
  assert.match((await service.check()).message ?? "", /downgrade/);
  updater.checkForUpdates = async () => ({ updateInfo: { version: "latest" } });
  assert.match((await service.check()).message ?? "", /invalid version/);
  assert.deepEqual(calls, ["check"]);
});
