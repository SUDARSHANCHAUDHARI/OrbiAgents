export type WorkflowNodeType = "planner" | "coder" | "tester" | "reviewer" | "debugger";

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label?: string;
}

export interface WorkflowEdge {
  from: string;
  to: string;
}

export interface Workflow {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// Maps node type → the OrbiAgent id that visually represents it
export const NODE_AGENT_ID: Record<WorkflowNodeType, string> = {
  planner: "1",
  coder: "2",
  tester: "3",
  reviewer: "4",
  debugger: "5",
};
