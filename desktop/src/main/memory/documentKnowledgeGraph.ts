import type { DocumentKnowledgeGraph, WorkspaceFileDocument, WorkspaceFileEntry } from "../../shared/contracts";

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
}

function extension(path: string): string { return path.split(".").at(-1)?.toLowerCase() ?? ""; }
function title(content: string, fallback: string): string { return content.match(/^#\s+(.+)$/m)?.[1]?.trim().slice(0, 200) || fallback; }
function concepts(text: string): string[] {
  const counts = new Map<string, number>();
  for (const term of text.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_-]{3,}/gu) ?? []) if (!STOP_WORDS.has(term)) counts.set(term, (counts.get(term) ?? 0) + 1);
  return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 20).map(([term]) => term);
}
