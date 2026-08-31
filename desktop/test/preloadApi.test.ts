import assert from "node:assert/strict";
import test from "node:test";
import { createDesktopApi } from "../src/preload/api";
import { IPC_CHANNELS } from "../src/shared/contracts";

test("preload bridge exposes only fixed agent operations and removable event subscriptions", async () => {
  const invocations: Array<[string, unknown]> = [];
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const ipc = {
    invoke(channel: string, value?: unknown) { invocations.push([channel, value]); return Promise.resolve([]); },
    on(channel: string, listener: (...args: unknown[]) => void) { listeners.set(channel, listener); return ipc; },
    removeListener(channel: string, listener: (...args: unknown[]) => void) { if (listeners.get(channel) === listener) listeners.delete(channel); return ipc; },
  };
  const api = createDesktopApi(ipc as never);
  await api.agents.list();
  await api.commands.list({ agentId: "alpha" });
  await api.hive.snapshot({ projectPath: "/repo" });
  await api.memory.search({ projectPath: "/repo", query: "retry" });
  await api.runtimeAdapters.list();
  await api.localModels.list();
  await api.files.list({ agentId: "alpha" });
  await api.github.authStatus();
  await api.onboarding.status();
  await api.recovery.status();
  await api.costs.snapshot();
  await api.skills.list({ query: "testing" });
  await api.updates.status();
  assert.deepEqual(invocations, [[IPC_CHANNELS.list, undefined], [IPC_CHANNELS.commandHistoryList, { agentId: "alpha" }], [IPC_CHANNELS.hiveSnapshot, { projectPath: "/repo" }], [IPC_CHANNELS.memorySearch, { projectPath: "/repo", query: "retry" }], [IPC_CHANNELS.runtimeAdapterList, undefined], [IPC_CHANNELS.localModelList, undefined], [IPC_CHANNELS.fileList, { agentId: "alpha" }], [IPC_CHANNELS.githubAuthStatus, undefined], [IPC_CHANNELS.onboardingStatus, undefined], [IPC_CHANNELS.recoveryStatus, undefined], [IPC_CHANNELS.costSnapshot, undefined], [IPC_CHANNELS.skillList, { query: "testing" }], [IPC_CHANNELS.updateStatus, undefined]]);
  assert.deepEqual(Object.keys(api.agents).sort(), ["applyWorkspace", "create", "discardWorkspace", "list", "onActivity", "onExit", "onOutput", "resize", "stop", "write"]);
  assert.deepEqual(Object.keys(api.commands).sort(), ["list", "upsert"]); assert.equal(Object.isFrozen(api.commands), true);
  assert.deepEqual(Object.keys(api.hive).sort(), ["assign", "decideApproval", "snapshot", "transitionTask"]);
  assert.equal(Object.isFrozen(api.hive), true);
  assert.deepEqual(Object.keys(api.memory).sort(), ["capture", "list", "search"]);
  assert.equal(Object.isFrozen(api.memory), true);
  assert.deepEqual(Object.keys(api.missions).sort(), ["create", "list", "run", "setEnabled"]);
  assert.equal(Object.isFrozen(api.missions), true);
  assert.deepEqual(Object.keys(api.runtimeAdapters).sort(), ["create", "list", "remove"]);
  assert.equal(Object.isFrozen(api.runtimeAdapters), true);
  assert.deepEqual(Object.keys(api.localModels).sort(), ["clearCredential", "create", "list", "probe", "remove", "saveCredentialFromClipboard"]);
  assert.equal(Object.isFrozen(api.localModels), true);
  assert.deepEqual(Object.keys(api.files).sort(), ["history", "list", "read", "readRevision", "write"]);
  assert.equal(Object.isFrozen(api.files), true);
  assert.deepEqual(Object.keys(api.github).sort(), ["authStatus", "snapshot"]);
  assert.equal(Object.isFrozen(api.github), true);
  assert.deepEqual(Object.keys(api.onboarding).sort(), ["complete", "refresh", "status"]);
  assert.equal(Object.isFrozen(api.onboarding), true);
  assert.deepEqual(Object.keys(api.recovery), ["status"]); assert.equal(Object.isFrozen(api.recovery), true);
  assert.deepEqual(Object.keys(api.costs), ["snapshot"]); assert.equal(Object.isFrozen(api.costs), true);
  assert.deepEqual(Object.keys(api.skills), ["list"]); assert.equal(Object.isFrozen(api.skills), true);
  assert.deepEqual(Object.keys(api.updates).sort(), ["check", "download", "install", "status"]); assert.equal(Object.isFrozen(api.updates), true);
  const remove = api.agents.onOutput(() => undefined);
  assert.equal(listeners.has(IPC_CHANNELS.output), true);
  remove();
  assert.equal(listeners.has(IPC_CHANNELS.output), false);
});
