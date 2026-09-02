import assert from "node:assert/strict";
import test from "node:test";
import { DesktopCircuitBreaker } from "../src/main/pty/desktopCircuitBreaker";

const limits = {
  maxRuntimeMs: 1_000,
  outputWindowMs: 100,
  steerOutputBytes: 10,
  constrainOutputBytes: 20,
  stopOutputBytes: 30,
};

test("runtime budget escalates once through steer, constrain, and stop", () => {
  const circuit = new DesktopCircuitBreaker(limits, 1_000);
  assert.equal(circuit.checkRuntime(1_799), undefined);
  assert.equal(circuit.checkRuntime(1_800)?.action, "steer");
  assert.equal(circuit.checkRuntime(1_850), undefined);
  assert.equal(circuit.checkRuntime(1_900)?.action, "constrain");
  assert.equal(circuit.checkRuntime(2_000)?.action, "stop");
});

test("rolling output measurement expires old samples and escalates monotonically", () => {
  const circuit = new DesktopCircuitBreaker(limits, 0);
  assert.equal(circuit.recordOutput(9, 0), undefined);
  assert.equal(circuit.recordOutput(1, 1)?.action, "steer");
  assert.equal(circuit.recordOutput(10, 2)?.action, "constrain");
  assert.equal(circuit.recordOutput(9, 103), undefined);
  assert.equal(circuit.recordOutput(21, 104)?.action, "stop");
});

test("consecutive provider failures escalate and successful states reset the count", () => {
  const circuit = new DesktopCircuitBreaker(limits, 0);
  assert.equal(circuit.recordProviderState("failed")?.action, "steer");
  assert.equal(circuit.recordProviderState("idle"), undefined);
  assert.equal(circuit.recordProviderState("failed"), undefined);
  assert.equal(circuit.recordProviderState("failed")?.action, "constrain");
  assert.equal(circuit.recordProviderState("failed")?.action, "stop");
});

test("invalid budget and output measurements are rejected", () => {
  assert.throws(() => DesktopCircuitBreaker.forBudgetMinutes(0), /invalid/);
  const circuit = new DesktopCircuitBreaker(limits, 0);
  assert.throws(() => circuit.recordOutput(-1), /invalid/);
});
