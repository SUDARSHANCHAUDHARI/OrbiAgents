import { useEffect, useMemo, useState } from "react";
import type { SkillCatalogEntry } from "../../../shared/contracts";
import { PixelButton } from "./ui/PixelButton";
import { PixelPanel } from "./ui/PixelPanel";

export function SkillsPanel({ onError }: { onError(message: string): void }) {
  const [skills, setSkills] = useState<SkillCatalogEntry[]>([]);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [loading, setLoading] = useState(true);
  const sources = useMemo(() => [...new Set(skills.map((skill) => skill.source))].sort(), [skills]);
  const visible = source === "all" ? skills : skills.filter((skill) => skill.source === source);

  async function load(search = query) {
    setLoading(true);
    try { setSkills(await window.orbi.skills.list(search.trim() ? { query: search } : undefined)); onError(""); }
    catch (error) { onError(error instanceof Error ? error.message : String(error)); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(""); }, []);
  async function remove(skill: SkillCatalogEntry) { if (!window.confirm(`Move the installed skill “${skill.name}” to Trash?`)) return; setLoading(true); try { setSkills(await window.orbi.skills.remove({ id: skill.id })); onError(""); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } finally { setLoading(false); } }

  return <PixelPanel title="Installed skills" eyebrow={`${skills.length} discovered`} ariaLabel="Installed agent skills">
    <form className="skills-search" onSubmit={(event) => { event.preventDefault(); void load(); }}>
      <label>Search skills<input aria-label="Search installed skills" value={query} maxLength={200} placeholder="Testing, Android, security…" onChange={(event) => setQuery(event.target.value)} /></label>
      <label>Source<select aria-label="Filter skills by source" value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All sources</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <PixelButton type="submit" variant="primary" disabled={loading}>{loading ? "Scanning…" : "Search"}</PixelButton>
      <PixelButton type="button" variant="ghost" disabled={loading || (!query && source === "all")} onClick={() => { setQuery(""); setSource("all"); void load(""); }}>Reset</PixelButton>
    </form>
    <p className="skills-policy">Browsing reads bounded frontmatter and never executes skill instructions. Removal requires confirmation and moves only a freshly verified installed skill directory to the OS Trash.</p>
    {visible.length ? <ul className="skills-grid">{visible.map((skill) => <li key={skill.id}><strong>{skill.name}</strong><small>{skill.source} · {skill.relativePath}</small><span>{skill.description}</span><PixelButton type="button" variant="danger" disabled={loading} onClick={() => void remove(skill)}>Move to Trash</PixelButton></li>)}</ul> : <p className="empty">{loading ? "Scanning installed skills…" : "No installed skills match this search."}</p>}
  </PixelPanel>;
}
