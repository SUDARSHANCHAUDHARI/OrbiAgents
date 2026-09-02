import { useEffect, useState } from "react";
import type { UpdateState } from "../../../shared/contracts";
import { PixelButton } from "./ui/PixelButton";
import { PixelPanel } from "./ui/PixelPanel";
import { useI18n, type MessageKey } from "../i18n";
import { releaseNoteBlocks } from "../command/releaseNotesViewModel";

export function UpdatesPanel({ onError }: { onError(message: string): void }) {
  const { t } = useI18n();
  const [state, setState] = useState<UpdateState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void window.orbi.updates.status().then(setState).catch((error) => onError(message(error))); }, []);

  async function run(action: "check" | "download" | "install") {
    setBusy(true); onError("");
    try {
      if (action === "install") { await window.orbi.updates.install(); return; }
      setState(await window.orbi.updates[action]());
    } catch (error) { onError(message(error)); }
    finally { setBusy(false); }
  }

  return <PixelPanel title={t("applicationUpdates")} eyebrow={state ? `${t("installed")} ${state.currentVersion}` : t("loading")} ariaLabel={t("orbiUpdates")}>
    <p className="mission-policy">{t("updatePolicy")}</p>
    <div className="update-status" data-phase={state?.phase ?? "idle"}>
      <strong>{label(state, t)}</strong>
      {state?.availableVersion ? <small>{t("version")} {state.availableVersion}{state.artifactSize ? ` · ${formatBytes(state.artifactSize)}` : ""}</small> : null}
      {state?.message ? <span>{state.message}</span> : null}
      {state?.releaseNotes ? <article className="release-notes" aria-label={t("releaseNotes")}>{state.releaseName ? <h3>{state.releaseName}</h3> : null}{releaseNoteBlocks(state.releaseNotes).map((block, index) => block.kind === "heading" ? <h4 key={index}>{block.text}</h4> : block.kind === "item" ? <div className="release-note-item" key={index}>• {block.text}</div> : <p key={index}>{block.text}</p>)}</article> : null}
    </div>
    <div className="update-actions">
      <PixelButton type="button" variant="primary" disabled={busy || state?.phase === "checking" || state?.phase === "downloading"} onClick={() => void run("check")}>{state?.phase === "checking" ? t("checking") : t("checkUpdates")}</PixelButton>
      <PixelButton type="button" variant="secondary" disabled={busy || state?.phase !== "available"} onClick={() => void run("download")}>{state?.phase === "downloading" ? t("downloading") : t("download")}</PixelButton>
      <PixelButton type="button" variant="danger" disabled={busy || state?.phase !== "downloaded"} onClick={() => void run("install")}>{t("restartInstall")}</PixelButton>
    </div>
  </PixelPanel>;
}

function label(state: UpdateState | null, t: (key: MessageKey) => string): string { if (!state) return t("updateReading"); return t(({ idle: "updateReadyCheck", checking: "updateCheckingReleases", available: "updateAvailable", "not-available": "updateCurrent", downloading: "updateDownloadingPackage", downloaded: "updateReadyInstall", error: "updateFailed" } as const)[state.phase]); }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function formatBytes(value: number): string { return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB`; }
