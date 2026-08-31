import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { SkillCatalogEntry } from "../../shared/contracts";

const MAX_SKILLS = 500;
const MAX_DEPTH = 4;
const MAX_SKILL_BYTES = 64 * 1024;

export interface SkillRoot { label: string; path: string; }

export class SkillCatalog {
  constructor(private readonly roots: SkillRoot[]) {}

  async list(query = ""): Promise<SkillCatalogEntry[]> {
    const normalizedQuery = query.trim().toLocaleLowerCase().slice(0, 200);
    const entries: SkillCatalogEntry[] = [];
    for (const root of this.roots) {
      await this.scan(root, root.path, 0, entries);
      if (entries.length >= MAX_SKILLS) break;
    }
    return entries
      .filter((entry) => !normalizedQuery || `${entry.name} ${entry.description} ${entry.source}`.toLocaleLowerCase().includes(normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
  }

  private async scan(root: SkillRoot, directory: string, depth: number, entries: SkillCatalogEntry[]): Promise<void> {
    if (depth > MAX_DEPTH || entries.length >= MAX_SKILLS) return;
    const children = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entries.length >= MAX_SKILLS || child.name.startsWith(".")) continue;
      const candidate = path.join(directory, child.name);
      const info = await lstat(candidate).catch(() => null);
      if (!info || info.isSymbolicLink()) continue;
      if (info.isDirectory()) { await this.scan(root, candidate, depth + 1, entries); continue; }
      if (child.name !== "SKILL.md" || !info.isFile() || info.size > MAX_SKILL_BYTES) continue;
      const source = await readFile(candidate, "utf8").catch(() => "");
      const parsed = parseSkill(source);
      if (!parsed) continue;
      const relativePath = path.relative(root.path, candidate).split(path.sep).join("/");
      entries.push({ id: `${root.label}:${relativePath}`, name: parsed.name, description: parsed.description, source: root.label, relativePath });
    }
  }
}

export function parseSkill(source: string): { name: string; description: string } | null {
  if (!source.startsWith("---\n")) return null;
  const end = source.indexOf("\n---", 4);
  if (end < 0) return null;
  const frontmatter = source.slice(4, end);
  const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!name || name.length > 120 || !description || description.length > 500 || /[\0\r\n]/.test(name + description)) return null;
  return { name, description };
}
