import { useEffect, useState } from "react";
import type { RecoveryReport } from "../../../shared/contracts";
import { PixelButton } from "./ui/PixelButton";
import { PixelPanel } from "./ui/PixelPanel";
import { useI18n } from "../i18n";

export function RecoveryPanel({ onError }: { onError(message: string): void }) {
  const { t } = useI18n();
  const [report, setReport] = useState<RecoveryReport | null>(null); const [loaded, setLoaded] = useState(false); const [busy, setBusy] = useState(false);
  async function refresh() { setBusy(true); try { setReport(await window.orbi.recovery.status()); setLoaded(true); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  useEffect(() => { void refresh(); }, []);
  return <PixelPanel title={t("startupRecovery")} eyebrow={t("readOnlyInventory")} ariaLabel={t("recoveryReport")} className="recovery-panel" action={<PixelButton type="button" variant="ghost" disabled={busy} onClick={() => void refresh()}>{t("refreshReport")}</PixelButton>}>
    <p className="mission-policy">{t("recoveryPolicy")}</p>
    {!loaded ? <p className="empty">{t("loadingRecovery")}</p> : report?.items.length ? <><p><strong>{report.items.length} {t("needReview")}</strong>{report.truncated ? ` ${t("reportTruncated")}` : ""}</p><ul>{report.items.map((entry) => <li key={entry.id}><strong>{entry.title}</strong><small>{label(entry.kind)} · {new Date(entry.detectedAt).toLocaleString()}</small><span>{entry.detail}{entry.projectPath ? `\n${entry.projectPath}` : ""}</span></li>)}</ul></> : <p className="empty">{t("noRecoveryItems")}</p>}
    {report ? <small>{t("inventoryGenerated")} {new Date(report.generatedAt).toLocaleString()}</small> : null}
  </PixelPanel>;
}
function label(kind: string): string { return kind.replaceAll("-", " "); }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
