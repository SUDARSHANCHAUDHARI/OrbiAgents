import type { DocumentKnowledgeGraph, DocumentKnowledgeResult, WorkspaceFileDocument, WorkspaceFileEntry } from "../../shared/contracts";

interface DocumentSource {
  list(rootPath: string): Promise<WorkspaceFileEntry[]>;
  read(rootPath: string, relativePath: unknown): Promise<WorkspaceFileDocument>;
}

const DOCUMENT_EXTENSIONS = new Set(["md", "mdx", "txt", "rst", "adoc"]);
const STOP_WORDS = new Set(["about", "after", "also", "been", "before", "being", "between", "could", "from", "have", "into", "more", "other", "should", "their", "there", "these", "this", "through", "using", "were", "what", "when", "where", "which", "while", "with", "would"]);

export class DocumentKnowledgeGraphBuilder {
  constructor(private readonly source: DocumentSource, private readonly maxDocuments = 100) {}

  async build(rootPath: string): Promise<DocumentKnowledgeGraph> {
    const entries = await this.source.list(rootPath);
    const candidates = entries.filter((entry) => entry.type === "file" && entry.size !== undefined && entry.size <= 128 * 1024 && DOCUMENT_EXTENSIONS.has(extension(entry.path))).slice(0, this.maxDocuments);
    const nodes: DocumentKnowledgeGraph["nodes"] = [];
    for (const entry of candidates) {
      const document = await this.source.read(rootPath, entry.path).catch(() => null);
      if (!document) continue;
      nodes.push({ id: entry.path, path: entry.path, title: title(document.content, entry.name), terms: concepts(document.content) });
    }
    const edges: DocumentKnowledgeGraph["edges"] = [];
    for (let left = 0; left < nodes.length; left += 1) for (let right = left + 1; right < nodes.length; right += 1) {
      const sharedTerms = nodes[left].terms.filter((term) => nodes[right].terms.includes(term)).slice(0, 8);
      if (sharedTerms.length >= 2) edges.push({ sourceId: nodes[left].id, targetId: nodes[right].id, sharedTerms });
    }
    return { nodes, edges, truncated: candidates.length === this.maxDocuments && entries.some((entry) => entry.type === "file" && DOCUMENT_EXTENSIONS.has(extension(entry.path)) && !candidates.includes(entry)) };
  }

  async query(rootPath: string, input: unknown, requestedLimit: unknown = 5): Promise<DocumentKnowledgeResult[]> {
    if (typeof input !== "string" || !input.trim() || input.length > 500 || /\0/.test(input)) throw new Error("Document query is invalid");
    const limit = requestedLimit === undefined ? 5 : requestedLimit;
    if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 10) throw new Error("Document query limit is invalid");
    const queryTerms = concepts(input).slice(0, 12);
    if (!queryTerms.length) return [];
    const entries = await this.source.list(rootPath);
    const candidates = entries.filter((entry) => entry.type === "file" && entry.size !== undefined && entry.size <= 128 * 1024 && DOCUMENT_EXTENSIONS.has(extension(entry.path))).slice(0, this.maxDocuments);
    const results: Array<DocumentKnowledgeResult & { score: number }> = [];
    for (const entry of candidates) {
      const document = await this.source.read(rootPath, entry.path).catch(() => null);
      if (!document) continue;
      const lower = document.content.toLocaleLowerCase(); const documentTitle = title(document.content, entry.name); const lowerTitle = documentTitle.toLocaleLowerCase(); const phrase = input.trim().toLocaleLowerCase().replace(/\s+/g, " ");
      const matchedTerms = queryTerms.filter((term) => lower.includes(term));
      if (!matchedTerms.length) continue;
      const score = matchedTerms.reduce((sum, term) => sum + Math.min(5, occurrences(lower, term)) + (lowerTitle.includes(term) ? 8 : 0), 0) + (lower.replace(/\s+/g, " ").includes(phrase) ? 20 : 0);
      results.push({ path: entry.path, title: documentTitle, snippet: snippet(document.content, matchedTerms), matchedTerms, score });
    }
    return results.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path)).slice(0, limit as number).map(({ score: _score, ...result }) => result);
  }
}

function extension(path: string): string { return path.split(".").at(-1)?.toLowerCase() ?? ""; }
function title(content: string, fallback: string): string { return content.match(/^#\s+(.+)$/m)?.[1]?.trim().slice(0, 200) || fallback; }
function concepts(text: string): string[] {
  const counts = new Map<string, number>();
  for (const term of text.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_-]{3,}/gu) ?? []) if (!STOP_WORDS.has(term)) counts.set(term, (counts.get(term) ?? 0) + 1);
  return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 20).map(([term]) => term);
}
function occurrences(text: string, term: string): number { let count = 0; let offset = 0; while ((offset = text.indexOf(term, offset)) >= 0) { count += 1; offset += term.length; } return count; }
function snippet(content: string, terms: string[]): string { const lower = content.toLocaleLowerCase(); const positions = terms.map((term) => lower.indexOf(term)).filter((position) => position >= 0); const center = Math.min(...positions); const start = Math.max(0, center - 180); const end = Math.min(content.length, center + 420); return `${start ? "…" : ""}${content.slice(start, end).replace(/\s+/g, " ").trim()}${end < content.length ? "…" : ""}`.slice(0, 600); }
