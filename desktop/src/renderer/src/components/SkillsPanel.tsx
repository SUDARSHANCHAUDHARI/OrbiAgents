import { useEffect, useMemo, useState } from "react";
import type { SkillCatalogEntry } from "../../../shared/contracts";
import { PixelButton } from "./ui/PixelButton";
import { PixelPanel } from "./ui/PixelPanel";
import { useI18n } from "../i18n";

export function SkillsPanel({ onError }: { onError(message: string): void }) {
  const { t } = useI18n();
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
  async function remove(skill: SkillCatalogEntry) { if (!window.confirm(`${t("removeSkillPrefix")} “${skill.name}” ${t("removeSkillSuffix")}`)) return; setLoading(true); try { setSkills(await window.orbi.skills.remove({ id: skill.id })); onError(""); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } finally { setLoading(false); } }

  return <PixelPanel title={t("installedSkills")} eyebrow={`${skills.length} ${t("discovered")}`} ariaLabel={t("installedAgentSkills")}>
    <form className="skills-search" onSubmit={(event) => { event.preventDefault(); void load(); }}>
      <label>{t("searchSkills")}<input aria-label={t("searchInstalledSkills")} value={query} maxLength={200} placeholder={t("skillsPlaceholder")} onChange={(event) => setQuery(event.target.value)} /></label>
      <label>{t("source")}<select aria-label={t("filterSkillsSource")} value={source} onChange={(event) => setSource(event.target.value)}><option value="all">{t("allSources")}</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <PixelButton type="submit" variant="primary" disabled={loading}>{loading ? t("scanning") : t("search")}</PixelButton>
      <PixelButton type="button" variant="ghost" disabled={loading || (!query && source === "all")} onClick={() => { setQuery(""); setSource("all"); void load(""); }}>{t("reset")}</PixelButton>
    </form>
    <p className="skills-policy">{t("skillsPolicy")}</p>
    {visible.length ? <ul className="skills-grid">{visible.map((skill) => <li key={skill.id}><strong>{skill.name}</strong><small>{skill.source} · {skill.relativePath}</small><span>{skill.description}</span><PixelButton type="button" variant="danger" disabled={loading} onClick={() => void remove(skill)}>{t("moveTrash")}</PixelButton></li>)}</ul> : <p className="empty">{loading ? t("scanningSkills") : t("noSkillsMatch")}</p>}
  </PixelPanel>;
}
