import { db } from "./db";
import { WORKFLOW_PROPOSAL_POLICIES, WorkflowProposal, WorkflowProposalPolicy } from "./workflowProposal";

export function validateProposalPolicies(value: unknown): WorkflowProposalPolicy[] {
  if (!Array.isArray(value)) throw new Error("enabledPolicies must be an array");
  const policies = [...new Set(value.map(String))];
  if (policies.some((policy) => !WORKFLOW_PROPOSAL_POLICIES.includes(policy as WorkflowProposalPolicy))) throw new Error("Unknown supervisor proposal policy");
  return policies as WorkflowProposalPolicy[];
}
export async function getProposalPolicies(userId: string): Promise<WorkflowProposalPolicy[]> {
  const row = await db.supervisorPreference.findUnique({ where: { userId } });
  if (!row) return WORKFLOW_PROPOSAL_POLICIES;
  try { return validateProposalPolicies(JSON.parse(row.enabledPolicies)); }
  catch { return WORKFLOW_PROPOSAL_POLICIES; }
}
export function parseProposalHistoryPayload(value: string): { proposal: WorkflowProposal; beforeWorkflow?: unknown } | null {
  try {
    const parsed = JSON.parse(value);
    const proposal = parsed?.proposal ?? parsed;
    const workflow = proposal?.workflow;
    if (!proposal || typeof proposal !== "object" || typeof proposal.kind !== "string" || typeof proposal.summary !== "string" || !workflow || !Array.isArray(workflow.nodes) || !Array.isArray(workflow.edges)) return null;
    return { proposal, beforeWorkflow: parsed?.beforeWorkflow };
  }
  catch { return null; }
}
export async function saveProposalPolicies(userId: string, policies: WorkflowProposalPolicy[]) {
  await db.supervisorPreference.upsert({ where: { userId }, create: { userId, enabledPolicies: JSON.stringify(policies) }, update: { enabledPolicies: JSON.stringify(policies) } });
  return policies;
}
export async function recordProposal(userId: string, proposal: WorkflowProposal, beforeWorkflow: unknown) {
  return db.workflowProposalHistory.create({ data: { userId, kind: proposal.kind, summary: proposal.summary, proposal: JSON.stringify({ proposal, beforeWorkflow }) } });
}
