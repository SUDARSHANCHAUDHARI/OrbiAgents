import test from "node:test";
import assert from "node:assert/strict";
import {
  formatWorkflowCost,
  getActiveWorkflowStep,
  isCodeLikeStep,
  NODE_KIND_LABEL,
} from "../lib/resultPanel";
import { WorkflowStepResult } from "../lib/types";

const steps: WorkflowStepResult[] = [
  { nodeId: "plan", type: "planner", label: "Planner", output: "1. Do work" },
  { nodeId: "code", type: "coder", label: "Coder", output: "const x = 1;" },
];

test("getActiveWorkflowStep falls back to the first step", () => {
  assert.deepEqual(getActiveWorkflowStep(steps, "missing"), steps[0]);
});

test("getActiveWorkflowStep returns null for empty workflows", () => {
  assert.equal(getActiveWorkflowStep([], "anything"), null);
});

test("formatWorkflowCost uses compact precision for larger costs", () => {
  assert.equal(formatWorkflowCost(0.0152), "$0.015");
});

test("formatWorkflowCost uses extended precision for tiny costs", () => {
  assert.equal(formatWorkflowCost(0.00042), "$0.00042");
});

test("isCodeLikeStep identifies code-oriented tabs", () => {
  assert.equal(isCodeLikeStep("coder"), true);
  assert.equal(isCodeLikeStep("reviewer"), false);
});

test("NODE_KIND_LABEL exposes stable tab labels", () => {
  assert.equal(NODE_KIND_LABEL.debugger, "Fix");
  assert.equal(NODE_KIND_LABEL.tester, "Tests");
});
