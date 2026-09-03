import assert from "node:assert/strict";
import test from "node:test";
import type { AgentSession } from "../src/shared/contracts";
import { dispatchVoice } from "../src/main/voice/voiceDispatcher";

const agents = [{ id: "coder", status: "running", workspace: { sourcePath: "/repo" } }] as AgentSession[];
const request = { projectPath: "/repo", agentId: "coder", text: "Review the parser", confirmed: true };
test("voice dispatch sends reviewed text exactly once without saving a second transcript", () => {
  const writes: unknown[] = []; dispatchVoice(request, true, agents, (id, data) => writes.push([id, data]));
  assert.deepEqual(writes, [["coder", "Review the parser\r"]]);
});
test("voice dispatch rejects absent consent, confirmation, wrong project and stopped agent", () => {
  const write = () => assert.fail("must not write");
  assert.throws(() => dispatchVoice(request, false, agents, write), /consent/);
  assert.throws(() => dispatchVoice({ ...request, confirmed: false }, true, agents, write), /confirmation/);
  assert.throws(() => dispatchVoice({ ...request, projectPath: "/other" }, true, agents, write), /running agent/);
  assert.throws(() => dispatchVoice(request, true, [], write), /running agent/);
});
test("voice dispatch rejects blank, multibyte oversized, and terminal control input", () => {
  for (const text of [" ", "界".repeat(3000), "hello\rreboot", "\x1b[200~escape", "\0"]) assert.throws(() => dispatchVoice({ ...request, text }, true, agents, () => assert.fail("must not write")), /printable/);
});
