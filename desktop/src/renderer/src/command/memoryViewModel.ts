import type { MemoryRecord } from "../../../shared/contracts";

export function memoryOverview(records: MemoryRecord[], activeQuery: string): string {
  if (!records.length) return activeQuery ? `No results for “${activeQuery}”` : "No project memories captured yet";
  const condensed = records.filter((record) => record.condensed).length;
  const sources = new Set(records.map((record) => record.source)).size;
  const scope = activeQuery ? `${records.length} results for “${activeQuery}”` : `${records.length} project memories`;
  return `${scope} · ${sources} source${sources === 1 ? "" : "s"}${condensed ? ` · ${condensed} condensed` : ""}`;
}
