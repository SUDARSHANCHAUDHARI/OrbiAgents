import type { AgentSession } from "../../shared/contracts";

export function dispatchVoice(value: unknown, consent: boolean, agents: AgentSession[], write: (id: string, data: string) => void): void {
  if (!consent) throw new Error("Save microphone consent before dispatching a transcript");
  if (!value || typeof value !== "object") throw new Error("Invalid voice dispatch");
  const request = value as Record<string, unknown>;
  if (request.confirmed !== true) throw new Error("Transcript dispatch requires confirmation");
  if (typeof request.text !== "string" || !request.text.trim() || Buffer.byteLength(request.text, "utf8") > 8192 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(request.text)) throw new Error("Transcript must be printable text no larger than 8 KB");
  const agent = agents.find((candidate) => candidate.id === request.agentId && candidate.status === "running" && candidate.workspace.sourcePath === request.projectPath);
  if (!agent) throw new Error("Choose a running agent in the selected project");
  // Explicit terminal dispatch is independent of transcript retention. Never save a second copy here.
  write(agent.id, `${request.text.trim()}\r`);
}
