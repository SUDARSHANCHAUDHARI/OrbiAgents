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
  return row ? validateProposalPolicies(JSON.parse(row.enabledPolicies)) : WORKFLOW_PROPOSAL_POLICIES;
}
export async function saveProposalPolicies(userId: string, policies: WorkflowProposalPolicy[]) {
  await db.supervisorPreference.upsert({ where: { userId }, create: { userId, enabledPolicies: JSON.stringify(policies) }, update: { enabledPolicies: JSON.stringify(policies) } });
  return policies;
}
export async function recordProposal(userId: string, proposal: WorkflowProposal) {
  return db.workflowProposalHistory.create({ data: { userId, kind: proposal.kind, summary: proposal.summary, proposal: JSON.stringify(proposal) } });
}
