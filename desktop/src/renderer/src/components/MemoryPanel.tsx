import { useEffect, useState } from "react";
import type { DocumentKnowledgeGraph, MemoryRecord } from "../../../shared/contracts";
import { memoryOverview, memoryRelationships } from "../command/memoryViewModel";
import { useI18n } from "../i18n";

export function MemoryPanel({ projectPath, agentId, onError }: { projectPath: string; agentId: string | null; onError(message: string): void }) {
  const { t } = useI18n();
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [documentGraph, setDocumentGraph] = useState<DocumentKnowledgeGraph | null>(null);
  const relationships = memoryRelationships(records); const titles = new Map(records.map((record) => [record.id, record.title]));
  const overview = memoryOverview(records, activeQuery);

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

  async function buildDocumentGraph() {
    if (!agentId) return;
    setBusy(true);
    try { setDocumentGraph(await window.orbi.memory.documentGraph({ agentId })); onError(""); }
    catch (error) { onError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  if (!projectPath) return <section className="command-panel"><div className="section-title">{t("projectMemory")}</div><p className="empty">{t("selectProjectMemory")}</p></section>;
  return <section className="command-panel memory-panel" aria-label={t("markdownMemory")}>
    <div className="section-title"><span>{t("markdownMemory")}</span><button type="button" disabled={busy} onClick={() => void clearSearch()}>{t("refresh")}</button></div>
    <form className="memory-capture" onSubmit={capture}><input aria-label={t("memoryTitle")} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("memoryTitle")} maxLength={200} required /><textarea aria-label={t("memoryContent")} value={content} onChange={(event) => setContent(event.target.value)} placeholder={t("memoryContentPlaceholder")} maxLength={20000} required /><button type="submit" disabled={busy}>{t("capture")}</button></form>
    <form className="memory-search" role="search" onSubmit={search}><input aria-label={t("searchProjectMemory")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchLocalMemory")} maxLength={500} /><button type="submit" disabled={busy}>{t("search")}</button>{activeQuery ? <button type="button" disabled={busy} onClick={() => void clearSearch()}>{t("clear")}</button> : null}</form>
    <p className="empty" aria-live="polite">{overview.count ? `${overview.count} ${overview.query ? `${t("resultsFor")} “${overview.query}”` : t("projectMemories")} · ${overview.sources} ${t("sourcesCount")}${overview.condensed ? ` · ${overview.condensed} ${t("condensed")}` : ""}` : overview.query ? `${t("noMemoryResults")} “${overview.query}”` : t("noProjectMemories")}</p>
    <div className="section-title"><span>{t("knowledgeMap")}</span><small>{relationships.length} {t("verifiedRelationships")}</small></div>
    {relationships.length ? <ul>{relationships.map((edge) => <li key={`${edge.sourceId}-${edge.targetId}`}><strong>{titles.get(edge.sourceId)} → {titles.get(edge.targetId)}</strong><small>{t("sharedConcepts")}: {edge.sharedTerms.join(", ")}</small></li>)}</ul> : <p className="empty">{t("noRelationships")}</p>}
    <div className="section-title"><span>{t("documentKnowledgeGraph")}</span><button type="button" disabled={busy || !agentId} onClick={() => void buildDocumentGraph()}>{t("buildGraph")}</button></div>
    {documentGraph ? <><p className="empty">{documentGraph.nodes.length} {t("documentsCount")} · {documentGraph.edges.length} {t("verifiedRelationships")}{documentGraph.truncated ? ` · ${t("boundedSet")}` : ""}</p>{documentGraph.edges.length ? <ul>{documentGraph.edges.map((edge) => <li key={`${edge.sourceId}-${edge.targetId}`}><strong>{edge.sourceId} → {edge.targetId}</strong><small>{t("sharedConcepts")}: {edge.sharedTerms.join(", ")}</small></li>)}</ul> : <p className="empty">{t("noDocumentRelationships")}</p>}</> : <p className="empty">{t("buildGraphPrompt")}</p>}
    {records.length ? <ul>{records.map((record) => <li key={record.id}><strong>{record.title}</strong><small>{record.source} · {record.authorAgentId} · {new Date(record.createdAt).toLocaleString()}{record.condensed ? ` · ${t("condensed")}` : ""}</small><span>{record.content}</span></li>)}</ul> : null}
  </section>;
}
