import { useEffect, useMemo, useState } from "react";
import type { AgentSession, WorkspaceFileEntry } from "../../../shared/contracts";
import { commandsForAgent, createCommandEntry, isCommandQueueShortcut, terminalPayload, updateCommandEntry, type CommandQueueEntry } from "../command/commandComposerModel";
import { PixelButton } from "./ui/PixelButton";

let sessionEntries: CommandQueueEntry[] = [];

export function CommandComposer({ agent, onError }: { agent: AgentSession | null; onError(message: string): void }) {
  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState(sessionEntries);
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<WorkspaceFileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const agentEntries = useMemo(() => agent ? commandsForAgent(entries, agent.id).slice().reverse() : [], [agent, entries]);
  const queued = agentEntries.filter((entry) => entry.status === "queued").reverse();

  useEffect(() => {
    setAttachments([]); setSelectedFile(""); setFiles([]);
    if (!agent) return;
    let cancelled = false;
    void window.orbi.commands.list({ agentId: agent.id }).then((restored) => {
      if (cancelled) return;
      const next = [...sessionEntries.filter((entry) => entry.agentId !== agent.id), ...restored].sort((a, b) => a.createdAt - b.createdAt).slice(-100);
      save(next);
    }).catch((reason) => { if (!cancelled) onError(reason instanceof Error ? reason.message : String(reason)); });
    void window.orbi.files.list({ agentId: agent.id }).then((listed) => { if (!cancelled) setFiles(listed.filter((entry) => entry.type === "file")); }).catch((reason) => { if (!cancelled) onError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { cancelled = true; };
  }, [agent?.id]);

  function save(next: CommandQueueEntry[]): void { sessionEntries = next; setEntries(next); }

  function queue(): void {
    if (!agent) return;
    try {
      const entry = createCommandEntry(agent.id, draft, Date.now(), crypto.randomUUID(), attachments);
      save([...entries, entry].slice(-100)); setDraft(""); setAttachments([]); setSelectedFile(""); onError("");
      void window.orbi.commands.upsert(entry).catch((reason) => onError(reason instanceof Error ? reason.message : String(reason)));
    } catch (reason) { onError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function send(entry: CommandQueueEntry): Promise<void> {
    if (!agent || agent.status !== "running") return;
    let next = updateCommandEntry(sessionEntries, entry.id, "sending"); save(next);
    try {
      await window.orbi.commands.upsert(next.find((candidate) => candidate.id === entry.id)!);
      await window.orbi.agents.write({ id: agent.id, data: terminalPayload(entry) });
      next = updateCommandEntry(sessionEntries, entry.id, "sent"); save(next); await window.orbi.commands.upsert(next.find((candidate) => candidate.id === entry.id)!); onError("");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      next = updateCommandEntry(sessionEntries, entry.id, "failed", message.slice(0, 500)); save(next); await window.orbi.commands.upsert(next.find((candidate) => candidate.id === entry.id)!).catch(() => undefined); onError(message);
    }
  }

  async function sendAll(): Promise<void> {
    if (!agent || sending) return; setSending(true);
    try { for (const entry of queued) await send(entry); } finally { setSending(false); }
  }

  return <section className="command-composer" aria-label="Agent command composer">
    <div className="composer-input"><label htmlFor="agent-command">Command</label><textarea id="agent-command" aria-label="Agent command" value={draft} maxLength={8192} disabled={!agent || agent.status !== "running"} placeholder={agent ? `Send an instruction to ${agent.name}` : "Select a running agent"} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (isCommandQueueShortcut({ key: event.key, metaKey: event.metaKey, ctrlKey: event.ctrlKey, isComposing: event.nativeEvent.isComposing })) { event.preventDefault(); queue(); } }} /><PixelButton type="button" variant="primary" disabled={!draft.trim() || !agent || agent.status !== "running"} onClick={queue}>Queue</PixelButton></div>
    <div className="composer-files"><select aria-label="Workspace file attachment" value={selectedFile} disabled={!agent || attachments.length >= 5} onChange={(event) => setSelectedFile(event.target.value)}><option value="">Attach workspace file…</option>{files.filter((file) => !attachments.includes(file.path)).map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}</select><PixelButton type="button" variant="ghost" disabled={!selectedFile || attachments.length >= 5} onClick={() => { setAttachments((current) => [...current, selectedFile]); setSelectedFile(""); }}>Attach</PixelButton>{attachments.map((file) => <button key={file} type="button" className="composer-file" aria-label={`Remove ${file}`} onClick={() => setAttachments((current) => current.filter((item) => item !== file))}>{file} ×</button>)}</div>
    <div className="composer-toolbar"><span>{queued.length} queued · encrypted local resume</span><PixelButton type="button" variant="secondary" disabled={!queued.length || !agent || agent.status !== "running" || sending} onClick={() => void sendAll()}>{sending ? "Sending…" : "Send all"}</PixelButton></div>
    {agentEntries.length ? <ol className="composer-history">{agentEntries.slice(0, 8).map((entry) => <li key={entry.id} data-status={entry.status}><span><strong>{entry.body}</strong><small>{new Date(entry.createdAt).toLocaleTimeString()} · {entry.status}{entry.attachments?.length ? ` · ${entry.attachments.length} files` : ""}</small></span>{entry.status === "queued" || entry.status === "failed" ? <PixelButton type="button" variant="ghost" disabled={!agent || agent.status !== "running" || sending} onClick={() => void send(entry)}>{entry.status === "failed" ? "Retry" : "Send"}</PixelButton> : null}</li>)}</ol> : null}
  </section>;
}
