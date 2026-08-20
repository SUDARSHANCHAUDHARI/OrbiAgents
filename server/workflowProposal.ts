import { topoSort } from "./workflowRunner";
import { Workflow, WorkflowNodeType } from "./workflowTypes";

export interface WorkflowProposal {
  kind: "add-role" | "remove-duplicate-role" | "normalize-label" | "none";
  summary: string;
  rationale: string;
  changes: string[];
  workflow: Workflow;
  changed: boolean;
}

const IMPROVEMENT_ORDER: Array<{ type: WorkflowNodeType; label: string; rationale: string }> = [
  { type: "tester", label: "Tester", rationale: "Add an explicit verification step after implementation." },
  { type: "reviewer", label: "Reviewer", rationale: "Add an independent review step before the workflow completes." },
  { type: "debugger", label: "Debugger", rationale: "Add a bounded recovery step for issues found downstream." },
];
const NODE_TYPES = new Set<WorkflowNodeType>(["planner", "coder", "tester", "reviewer", "debugger"]);

export function validateWorkflowGraph(workflow: Workflow, maxNodes = 12): void {
  if (!workflow || !Array.isArray(workflow.nodes) || !Array.isArray(workflow.edges)) throw new Error("Invalid workflow");
  if (workflow.nodes.length === 0 || workflow.nodes.length > maxNodes) throw new Error(`Workflow must contain 1 to ${maxNodes} nodes`);
  const ids = new Set<string>();
  for (const node of workflow.nodes) {
    if (!node.id?.trim() || ids.has(node.id)) throw new Error("Workflow node ids must be non-empty and unique");
    if (!NODE_TYPES.has(node.type)) throw new Error("Workflow contains an unsupported node type");
    ids.add(node.id);
  }
  for (const edge of workflow.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) throw new Error("Workflow edges must reference distinct existing nodes");
  }
  topoSort(workflow);
}

export function proposeWorkflowImprovement(workflow: Workflow, maxNodes = 12): WorkflowProposal {
  validateWorkflowGraph(workflow, maxNodes);
  const duplicate = workflow.nodes.find((node, index) => workflow.nodes.findIndex((candidate) => candidate.type === node.type) !== index);
  if (duplicate) {
    const incoming = workflow.edges.filter((edge) => edge.to === duplicate.id);
    const outgoing = workflow.edges.filter((edge) => edge.from === duplicate.id);
    const retained = workflow.edges.filter((edge) => edge.from !== duplicate.id && edge.to !== duplicate.id);
    const bypasses = incoming.flatMap((left) => outgoing.map((right) => ({ from: left.from, to: right.to })));
    const edgeKeys = new Set<string>();
    const edges = [...retained, ...bypasses].filter((edge) => {
      const key = `${edge.from}\0${edge.to}`;
      if (edge.from === edge.to || edgeKeys.has(key)) return false;
      edgeKeys.add(key); return true;
    });
    const proposed = { nodes: workflow.nodes.filter((node) => node.id !== duplicate.id), edges };
    validateWorkflowGraph(proposed, maxNodes);
    return {
      kind: "remove-duplicate-role",
      summary: `Remove duplicate ${duplicate.type} node`,
      rationale: "Keep one owner for each workflow role and preserve dependency flow through validated bypass edges.",
      changes: [`Remove ${duplicate.id}`, `Replace ${incoming.length + outgoing.length} connected edge(s) with ${bypasses.length} safe bypass edge(s)`],
      workflow: proposed,
      changed: true,
    };
  }
  const improvement = IMPROVEMENT_ORDER.find((item) => !workflow.nodes.some((node) => node.type === item.type));
  if (!improvement || workflow.nodes.length >= maxNodes) {
    const unlabeled = workflow.nodes.find((node) => !node.label?.trim());
    if (unlabeled) {
      const label = unlabeled.type[0].toUpperCase() + unlabeled.type.slice(1);
      return {
        kind: "normalize-label",
        summary: `Label ${unlabeled.type} node`,
        rationale: "Give the operator a stable human-readable step name.",
        changes: [`Set ${unlabeled.id} label to ${label}`],
        workflow: { ...workflow, nodes: workflow.nodes.map((node) => node.id === unlabeled.id ? { ...node, label } : node) },
        changed: true,
      };
    }
    return { kind: "none", summary: "No bounded structural change proposed", rationale: "The workflow already satisfies the current safe proposal policies.", changes: [], workflow, changed: false };
  }
  const source = [...workflow.nodes].reverse().find((node) => node.type === "coder") ?? workflow.nodes.at(-1)!;
  let suffix = 1;
  while (workflow.nodes.some((node) => node.id === `orbi-${improvement.type}-${suffix}`)) suffix += 1;
  const id = `orbi-${improvement.type}-${suffix}`;
  const outgoing = workflow.edges.filter((edge) => edge.from === source.id);
  const retained = workflow.edges.filter((edge) => edge.from !== source.id);
  const proposed: Workflow = {
    nodes: [...workflow.nodes, { id, type: improvement.type, label: improvement.label }],
    edges: [...retained, { from: source.id, to: id }, ...outgoing.map((edge) => ({ from: id, to: edge.to }))],
  };
  validateWorkflowGraph(proposed, maxNodes);
  return { kind: "add-role", summary: `Add ${improvement.label} after ${source.label ?? source.type}`, rationale: improvement.rationale, changes: [`Add ${improvement.type} node ${id}`, `Rewire ${outgoing.length} outgoing edge(s)`], workflow: proposed, changed: true };
}
