import { ApprovalQueue, type ApprovalRequest, type ProposedHiveAction } from "./approvalQueue";
import { HiveMailbox } from "./hiveMailbox";
import { HiveState, type HiveTask } from "./hiveState";

export interface OrbiAssignment {
  title: string;
  detail: string;
  agentId: string;
  dependencyIds?: string[];
  maxAttempts?: number;
}

export class OrbiPrime {
  constructor(
    private readonly state: HiveState,
    private readonly mailbox: HiveMailbox,
    private readonly approvals: ApprovalQueue,
  ) {}

  async assign(input: OrbiAssignment): Promise<HiveTask> {
    const task = await this.state.createTask(input);
    const assigned = await this.state.assign(task.id, input.agentId);
    await this.mailbox.send({ senderAgentId: "orbi-prime", recipientAgentId: input.agentId, kind: "request", body: `${assigned.title}\n\n${assigned.detail}`, conversationId: assigned.id });
    return assigned;
  }

  async delegate(parentTaskId: string, input: Omit<OrbiAssignment, "dependencyIds">): Promise<HiveTask> {
    return this.assign({ ...input, dependencyIds: [parentTaskId] });
  }

  async start(taskId: string): Promise<HiveTask> {
    return this.state.transition(taskId, "in-progress");
  }

  async followUp(taskId: string, question: string): Promise<void> {
    const task = (await this.state.listTasks()).find((candidate) => candidate.id === taskId);
    if (!task?.assigneeAgentId) throw new Error("Assigned task not found");
    await this.mailbox.send({ senderAgentId: "orbi-prime", recipientAgentId: task.assigneeAgentId, kind: "query", body: question, conversationId: task.id, hopCount: task.attempt, maxHops: task.maxAttempts + 4 });
  }

  async block(taskId: string): Promise<HiveTask> {
    return this.state.transition(taskId, "blocked");
  }

  async retry(taskId: string, agentId: string): Promise<HiveTask> {
    const assigned = await this.state.assign(taskId, agentId);
    await this.mailbox.send({ senderAgentId: "orbi-prime", recipientAgentId: agentId, kind: "request", body: `Retry: ${assigned.title}\n\n${assigned.detail}`, conversationId: assigned.id, hopCount: assigned.attempt, maxHops: assigned.maxAttempts });
    return assigned;
  }

  async complete(taskId: string, agentId: string, result: string): Promise<HiveTask> {
    const task = (await this.state.listTasks()).find((candidate) => candidate.id === taskId);
    if (!task || task.assigneeAgentId !== agentId) throw new Error("Task is not assigned to this agent");
    await this.state.putBlackboard(`results/${task.id}`, result, agentId, 0);
    const completed = await this.state.transition(taskId, "completed");
    await this.mailbox.send({ senderAgentId: agentId, recipientAgentId: "orbi-prime", kind: "done", body: result, conversationId: task.id, hopCount: task.attempt, maxHops: task.maxAttempts + 4 });
    return completed;
  }

  async escalate(action: ProposedHiveAction): Promise<ApprovalRequest> {
    const request = await this.approvals.request(action);
    if (!request) throw new Error("Routine actions do not require escalation");
    return request;
  }

  async synthesize(taskIds: string[]): Promise<string> {
    if (!taskIds.length) throw new Error("At least one task is required for synthesis");
    const tasks = await this.state.listTasks();
    const selected = taskIds.map((id) => tasks.find((task) => task.id === id));
    if (selected.some((task) => !task)) throw new Error("Synthesis task not found");
    if (selected.some((task) => task?.status !== "completed")) throw new Error("Cannot synthesize incomplete tasks");
    const blackboard = await this.state.readBlackboard();
    return selected.map((task) => `${task!.title}: ${blackboard[`results/${task!.id}`]?.value ?? "Completed without a recorded result"}`).join("\n");
  }
}
