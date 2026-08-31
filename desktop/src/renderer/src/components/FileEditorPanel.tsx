import Editor, { DiffEditor } from "@monaco-editor/react";
import { useEffect, useState } from "react";
import type { GitWorkspaceSnapshot, WorkspaceFileDocument, WorkspaceFileEntry, WorkspaceFileRevision } from "../../../shared/contracts";

export function FileEditorPanel({ agentId, onError }: { agentId: string | null; onError(message: string): void }) {
  const [entries, setEntries] = useState<WorkspaceFileEntry[]>([]);
  const [document, setDocument] = useState<WorkspaceFileDocument | null>(null);
  const [content, setContent] = useState("");
  const [history, setHistory] = useState<WorkspaceFileRevision[]>([]);
  const [comparison, setComparison] = useState<WorkspaceFileDocument | null>(null);
  const [selectedRevision, setSelectedRevision] = useState("");
  const [busy, setBusy] = useState(false);
  const [git, setGit] = useState<GitWorkspaceSnapshot | null>(null);
  const [rail, setRail] = useState<"files" | "changes" | "history">("files");

  async function refresh() {
    if (!agentId) return setEntries([]);
    try { const [nextEntries, nextGit] = await Promise.all([window.orbi.files.list({ agentId }), window.orbi.git.snapshot({ agentId }).catch(() => null)]); setEntries(nextEntries); setGit(nextGit); }
    catch (error) { onError(message(error)); }
  }

  useEffect(() => {
    setDocument(null); setContent(""); setHistory([]); setComparison(null); setSelectedRevision(""); setGit(null); setRail("files"); void refresh();
  }, [agentId]);

  async function openFile(entry: WorkspaceFileEntry) {
    if (!agentId || entry.type !== "file" || !entry.editable) return;
    if (document && content !== document.content && !window.confirm("Discard unsaved editor changes?")) return;
    setBusy(true);
    try {
      const opened = await window.orbi.files.read({ agentId, path: entry.path });
      setDocument(opened); setContent(opened.content); setComparison(null); setSelectedRevision("");
      try { setHistory(await window.orbi.files.history({ agentId, path: entry.path })); } catch { setHistory([]); }
      onError("");
    } catch (error) { onError(message(error)); } finally { setBusy(false); }
  }

  async function save() {
    if (!agentId || !document || !window.confirm(`Save changes to ${document.path}?`)) return;
    setBusy(true);
    try {
      const saved = await window.orbi.files.write({ agentId, path: document.path, content, expectedHash: document.hash });
      setDocument(saved); setContent(saved.content); setComparison(null); setSelectedRevision(""); onError("");
    } catch (error) { onError(message(error)); } finally { setBusy(false); }
  }

  async function compare(revision: string) {
    setSelectedRevision(revision);
    if (!agentId || !document) return setComparison(null);
    setBusy(true);
    try { setComparison(revision ? await window.orbi.files.readRevision({ agentId, path: document.path, revision }) : null); onError(""); }
    catch (error) { setSelectedRevision(""); onError(message(error)); } finally { setBusy(false); }
  }

  function openChanged(path: string) { const entry = entries.find((candidate) => candidate.type === "file" && candidate.path === path); if (entry) void openFile(entry); else onError("Changed file is unavailable in the safe editable file tree"); }

  if (!agentId) return <section className="command-panel"><div className="section-title">Workspace files</div><p className="empty">Select an agent to open its recorded workspace.</p></section>;
  return <section className="command-panel file-editor-panel" aria-label="Workspace file editor">
    <div className="section-title"><span>Workspace IDE</span><span className="mission-actions"><button type="button" aria-pressed={rail === "files"} onClick={() => setRail("files")}>Files</button><button type="button" aria-pressed={rail === "changes"} onClick={() => setRail("changes")}>Changes {git ? `(${git.changes.length})` : ""}</button><button type="button" aria-pressed={rail === "history"} disabled={!document} onClick={() => setRail("history")}>History {history.length ? `(${history.length})` : ""}</button><button type="button" onClick={() => void refresh()}>Refresh</button></span></div>
    <div className="ide-layout">
      <nav className="file-tree" aria-label={`${rail} rail`}><ul>{rail === "files" ? entries.map((entry) => <li key={entry.path} style={{ paddingLeft: `${entry.depth * 12}px` }}>{entry.type === "file" ? <button type="button" disabled={!entry.editable || busy} aria-current={document?.path === entry.path ? "page" : undefined} onClick={() => void openFile(entry)}>{entry.name}{!entry.editable ? " (large)" : ""}</button> : <span>▸ {entry.name}</span>}</li>) : rail === "changes" ? git?.changes.map((change) => <li key={`${change.status}-${change.path}`}><button type="button" disabled={busy} onClick={() => openChanged(change.path)}><strong>{change.status}</strong> {change.path}</button></li>) : history.map((item) => <li key={item.revision}><button type="button" aria-current={selectedRevision === item.revision ? "page" : undefined} onClick={() => void compare(item.revision)}>{item.subject}<small>{new Date(item.timestamp).toLocaleDateString()}</small></button></li>)}</ul>{rail === "changes" && !git?.changes.length ? <p className="empty">Working tree is clean.</p> : null}{rail === "history" && !history.length ? <p className="empty">No file history.</p> : null}</nav>
      <div className="editor-area">{document ? <>
        <div className="editor-toolbar"><strong>{document.path}</strong><select aria-label="Compare with Git revision" value={selectedRevision} onChange={(event) => void compare(event.target.value)}><option value="">Working copy</option>{history.map((item) => <option key={item.revision} value={item.revision}>{new Date(item.timestamp).toLocaleDateString()} · {item.subject}</option>)}</select>{selectedRevision ? <button type="button" onClick={() => void compare("")}>Exit compare</button> : null}<button type="button" disabled={busy || content === document.content} onClick={() => void save()}>Save</button></div>
        {comparison ? <DiffEditor height="58vh" original={comparison.content} modified={content} language={document.language} theme="vs-dark" options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false }, originalAriaLabel: "Historical file revision", modifiedAriaLabel: "Current file content" }} /> : <Editor height="58vh" value={content} language={document.language} theme="vs-dark" onChange={(value) => setContent(value ?? "")} options={{ ariaLabel: `Editor for ${document.path}`, minimap: { enabled: false }, automaticLayout: true }} />}
      </> : <p className="empty">Choose an editable text file. Secret-bearing, binary, symlinked, and oversized files are excluded.</p>}</div>
    </div>
  </section>;
}

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
