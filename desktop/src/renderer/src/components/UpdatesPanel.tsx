import { useEffect, useState } from "react";
import type { UpdateState } from "../../../shared/contracts";
import { PixelButton } from "./ui/PixelButton";
import { PixelPanel } from "./ui/PixelPanel";

export function UpdatesPanel({ onError }: { onError(message: string): void }) {
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

  return <PixelPanel title="Application updates" eyebrow={state ? `installed ${state.currentVersion}` : "loading"} ariaLabel="OrbiAgents updates">
    <p className="mission-policy">Updates are operator-controlled. OrbiAgents never checks, downloads, or restarts silently, and restart fails closed while agents, approvals, missions, or preserved workspaces require attention.</p>
    <div className="update-status" data-phase={state?.phase ?? "idle"}>
      <strong>{label(state)}</strong>
      {state?.availableVersion ? <small>Version {state.availableVersion}{state.artifactSize ? ` · ${formatBytes(state.artifactSize)}` : ""}</small> : null}
      {state?.message ? <span>{state.message}</span> : null}
      {state?.releaseNotes ? <pre>{state.releaseNotes}</pre> : null}
    </div>
    <div className="update-actions">
      <PixelButton type="button" variant="primary" disabled={busy || state?.phase === "checking" || state?.phase === "downloading"} onClick={() => void run("check")}>{state?.phase === "checking" ? "Checking…" : "Check for updates"}</PixelButton>
      <PixelButton type="button" variant="secondary" disabled={busy || state?.phase !== "available"} onClick={() => void run("download")}>{state?.phase === "downloading" ? "Downloading…" : "Download"}</PixelButton>
      <PixelButton type="button" variant="danger" disabled={busy || state?.phase !== "downloaded"} onClick={() => void run("install")}>Restart and install</PixelButton>
    </div>
  </PixelPanel>;
}

function label(state: UpdateState | null): string { if (!state) return "Reading update status…"; return ({ idle: "Ready to check", checking: "Checking GitHub releases…", available: "Update available", "not-available": "You are up to date", downloading: "Downloading release package…", downloaded: "Update ready to install", error: "Update action failed" } as const)[state.phase]; }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function formatBytes(value: number): string { return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB`; }
