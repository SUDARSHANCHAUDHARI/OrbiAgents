import { WorkflowStepResult, WorkflowNodeType } from "./types";

export const NODE_KIND_LABEL: Record<WorkflowNodeType, string> = {
  planner: "Plan",
  coder: "Code",
  tester: "Tests",
  reviewer: "Review",
  debugger: "Fix",
};

export const CODE_LIKE_TYPES = new Set<WorkflowNodeType>(["coder", "tester", "debugger"]);

export function getActiveWorkflowStep(
  steps: WorkflowStepResult[],
  activeStepId: string
): WorkflowStepResult | null {
  return steps.find((step) => step.nodeId === activeStepId) ?? steps[0] ?? null;
}

export function isCodeLikeStep(type: WorkflowNodeType): boolean {
  return CODE_LIKE_TYPES.has(type);
}

export function formatWorkflowCost(totalCostUsd?: number): string | null {
  if (totalCostUsd == null) return null;
  return totalCostUsd >= 0.01
    ? `$${totalCostUsd.toFixed(3)}`
    : `$${totalCostUsd.toFixed(5)}`;
}
