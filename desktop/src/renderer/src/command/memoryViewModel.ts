import type { MemoryRecord } from "../../../shared/contracts";

export function memoryOverview(records: MemoryRecord[], activeQuery: string): string {
  if (!records.length) return activeQuery ? `No results for “${activeQuery}”` : "No project memories captured yet";
  const condensed = records.filter((record) => record.condensed).length;
  const sources = new Set(records.map((record) => record.source)).size;
  const scope = activeQuery ? `${records.length} results for “${activeQuery}”` : `${records.length} project memories`;
  return `${scope} · ${sources} source${sources === 1 ? "" : "s"}${condensed ? ` · ${condensed} condensed` : ""}`;
}

export interface MemoryRelationship { sourceId: string; targetId: string; sharedTerms: string[]; }
export function memoryRelationships(records: MemoryRecord[], limit = 20): MemoryRelationship[] {
  const terms = new Map(records.slice(0, 100).map((record) => [record.id, keywords(`${record.title} ${record.content}`)]));
  const edges: MemoryRelationship[] = [];
  const bounded = records.slice(0, 100);
  for (let left = 0; left < bounded.length; left += 1) for (let right = left + 1; right < bounded.length; right += 1) {
    const shared = [...(terms.get(bounded[left]!.id) ?? [])].filter((term) => terms.get(bounded[right]!.id)?.has(term)).slice(0, 4);
    if (shared.length >= 2) edges.push({ sourceId: bounded[left]!.id, targetId: bounded[right]!.id, sharedTerms: shared });
  }
  return edges.sort((a, b) => b.sharedTerms.length - a.sharedTerms.length || a.sourceId.localeCompare(b.sourceId)).slice(0, Math.max(1, Math.min(limit, 50)));
}

function keywords(value: string): Set<string> { return new Set((value.toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? []).filter((term) => !STOP.has(term)).slice(0, 200)); }
const STOP = new Set(["the", "and", "for", "that", "this", "with", "from", "into", "are", "was", "were", "will", "have", "has", "not", "but", "you", "your"]);
