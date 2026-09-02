export type ReleaseNoteBlock = { kind: "heading" | "item" | "paragraph"; text: string };

export function releaseNoteBlocks(value: string): ReleaseNoteBlock[] {
  return value.replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 100).map((line) => {
    const heading = /^#{1,6}\s+(.+)$/.exec(line); if (heading) return { kind: "heading", text: clean(heading[1]!) };
    const item = /^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/.exec(line); if (item) return { kind: "item", text: clean(item[1]!) };
    return { kind: "paragraph", text: clean(line) };
  });
}
function clean(value: string): string { return value.replace(/\[([^\]]+)]\([^\s)]+\)/g, "$1").replace(/[*_`~]/g, "").slice(0, 1_000); }
