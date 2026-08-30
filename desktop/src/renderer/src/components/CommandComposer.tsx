import { useMemo, useState } from "react";
import type { AgentSession } from "../../../shared/contracts";
import { commandsForAgent, createCommandEntry, terminalPayload, updateCommandEntry, type CommandQueueEntry } from "../command/commandComposerModel";
import { PixelButton } from "./ui/PixelButton";

let sessionEntries: CommandQueueEntry[] = [];

export function CommandComposer({ agent, onError }: { agent: AgentSession | null; onError(message: string): void }) {
  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState(sessionEntries);
  const [sending, setSending] = useState(false);
  const agentEntries = useMemo(() => agent ? commandsForAgent(entries, agent.id).slice().reverse() : [], [agent, entries]);
  const queued = agentEntries.filter((entry) => entry.status === "queued").reverse();

  function save(next: CommandQueueEntry[]): void { sessionEntries = next; setEntries(next); }

  function queue(): void {
    if (!agent) return;
    try {
      const entry = createCommandEntry(agent.id, draft, Date.now(), crypto.randomUUID());
      save([...entries, entry].slice(-100)); setDraft(""); onError("");
    } catch (reason) { onError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function send(entry: CommandQueueEntry): Promise<void> {
    if (!agent || agent.status !== "running") return;
    let next = updateCommandEntry(sessionEntries, entry.id, "sending"); save(next);
    try {
      await window.orbi.agents.write({ id: agent.id, data: terminalPayload(entry) });
      next = updateCommandEntry(sessionEntries, entry.id, "sent"); save(next); onError("");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      next = updateCommandEntry(sessionEntries, entry.id, "failed", message); save(next); onError(message);
    }
  }

  async function sendAll(): Promise<void> {
    if (!agent || sending) return; setSending(true);
    try { for (const entry of queued) await send(entry); } finally { setSending(false); }
  }

  return <section className="command-composer" aria-label="Agent command composer">
    <div className="composer-input"><label htmlFor="agent-command">Command</label><textarea id="agent-command" aria-label="Agent command" value={draft} maxLength={65535} disabled={!agent || agent.status !== "running"} placeholder={agent ? `Send an instruction to ${agent.name}` : "Select a running agent"} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); queue(); } }} /><PixelButton type="button" variant="primary" disabled={!draft.trim() || !agent || agent.status !== "running"} onClick={queue}>Queue</PixelButton></div>
    <div className="composer-toolbar"><span>{queued.length} queued · session-only history</span><PixelButton type="button" variant="secondary" disabled={!queued.length || !agent || agent.status !== "running" || sending} onClick={() => void sendAll()}>{sending ? "Sending…" : "Send all"}</PixelButton></div>
    {agentEntries.length ? <ol className="composer-history">{agentEntries.slice(0, 8).map((entry) => <li key={entry.id} data-status={entry.status}><span><strong>{entry.body}</strong><small>{new Date(entry.createdAt).toLocaleTimeString()} · {entry.status}</small></span>{entry.status === "queued" || entry.status === "failed" ? <PixelButton type="button" variant="ghost" disabled={!agent || agent.status !== "running" || sending} onClick={() => void send(entry)}>{entry.status === "failed" ? "Retry" : "Send"}</PixelButton> : null}</li>)}</ol> : null}
  </section>;
}
