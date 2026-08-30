import { useEffect, useState } from "react";
import type { MemoryRecord } from "../../../shared/contracts";
import { memoryOverview } from "../command/memoryViewModel";

export function MemoryPanel({ projectPath, onError }: { projectPath: string; onError(message: string): void }) {
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRecords([]); setQuery(""); setActiveQuery("");
    if (projectPath) void window.orbi.memory.list({ projectPath }).then((next) => { if (!cancelled) setRecords(next); }).catch((error) => { if (!cancelled) onError(error instanceof Error ? error.message : String(error)); });
    return () => { cancelled = true; };
  }, [projectPath]);

  async function capture(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      setRecords(await window.orbi.memory.capture({ projectPath, title, content, source: "operator", authorAgentId: "orbi-prime" }));
      setTitle(""); setContent(""); setQuery(""); setActiveQuery(""); onError("");
    } catch (error) { onError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try { const nextQuery = query.trim(); setRecords(nextQuery ? await window.orbi.memory.search({ projectPath, query: nextQuery, limit: 20 }) : await window.orbi.memory.list({ projectPath })); setActiveQuery(nextQuery); onError(""); }
    catch (error) { onError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  async function clearSearch() {
    setBusy(true);
    try { setRecords(await window.orbi.memory.list({ projectPath })); setQuery(""); setActiveQuery(""); onError(""); }
    catch (error) { onError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  if (!projectPath) return <section className="command-panel"><div className="section-title">Project memory</div><p className="empty">Select an agent to open its project memory.</p></section>;
  return <section className="command-panel memory-panel" aria-label="Project markdown memory">
    <div className="section-title"><span>Project markdown memory</span><button type="button" disabled={busy} onClick={() => void clearSearch()}>Refresh</button></div>
    <form className="memory-capture" onSubmit={capture}><input aria-label="Memory title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Memory title" maxLength={200} required /><textarea aria-label="Memory content" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Verified decision, result, or reusable context" maxLength={20000} required /><button type="submit" disabled={busy}>Capture</button></form>
    <form className="memory-search" role="search" onSubmit={search}><input aria-label="Search project memory" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search local memory" maxLength={500} /><button type="submit" disabled={busy}>Search</button>{activeQuery ? <button type="button" disabled={busy} onClick={() => void clearSearch()}>Clear</button> : null}</form>
    <p className="empty" aria-live="polite">{memoryOverview(records, activeQuery)}</p>
    {records.length ? <ul>{records.map((record) => <li key={record.id}><strong>{record.title}</strong><small>{record.source} · {record.authorAgentId} · {new Date(record.createdAt).toLocaleString()}{record.condensed ? " · condensed" : ""}</small><span>{record.content}</span></li>)}</ul> : null}
  </section>;
}
