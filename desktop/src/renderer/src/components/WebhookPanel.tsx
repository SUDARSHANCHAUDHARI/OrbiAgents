import { useEffect, useState } from "react";
import type { WebhookStatus } from "../../../shared/contracts";
import { useI18n } from "../i18n";
import { PixelButton } from "./ui/PixelButton";
import { PixelPanel } from "./ui/PixelPanel";

export function WebhookPanel({ templateAgentId, onError }: { templateAgentId: string | null; onError(message: string): void }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<WebhookStatus | null>(null); const [busy, setBusy] = useState(false); const [copied, setCopied] = useState(false);
  useEffect(() => { void window.orbi.webhooks.status().then(setStatus).catch((error) => onError(String(error))); }, [onError]);
  async function act(action: "start" | "stop") { setBusy(true); onError(""); try { setStatus(await window.orbi.webhooks[action]()); setCopied(false); } catch (error) { onError(text(error)); } finally { setBusy(false); } }
  async function copySecret() { try { await window.orbi.webhooks.copySecret(); setCopied(true); } catch (error) { onError(text(error)); } }
  async function launchWorker(eventId: string) { if (!templateAgentId) return; setBusy(true); try { setStatus(await window.orbi.webhooks.launchWorker({ eventId, templateAgentId })); onError(""); } catch (error) { onError(text(error)); } finally { setBusy(false); } }
  async function completeWorker(eventId: string) { setBusy(true); try { setStatus(await window.orbi.webhooks.completeWorker({ eventId })); onError(""); } catch (error) { onError(text(error)); } finally { setBusy(false); } }
  return <PixelPanel title={t("inboundWebhooks")} eyebrow={status?.enabled ? t("enabled") : t("disabled")} ariaLabel={t("inboundWebhooks")}>
    <p className="mission-policy">{t("webhookPolicy")}</p>
    {status?.endpoint ? <label>{t("loopbackEndpoint")}<input readOnly value={status.endpoint} aria-label={t("loopbackEndpoint")} /></label> : null}
    {status?.slackEndpoint ? <label>{t("slackEventsEndpoint")}<input readOnly value={status.slackEndpoint} aria-label={t("slackEventsEndpoint")} /></label> : null}
    <div className="button-row">{status?.enabled ? <><PixelButton type="button" onClick={() => void copySecret()}>{copied ? t("secretCopied") : t("copyWebhookSecret")}</PixelButton><PixelButton type="button" variant="danger" disabled={busy} onClick={() => void act("stop")}>{t("disable")}</PixelButton></> : <PixelButton type="button" variant="primary" disabled={busy} onClick={() => void act("start")}>{t("enable")}</PixelButton>}</div>
    <div className="section-title">{t("recentWebhookEvents")}</div>
    {status?.events.length ? <ul>{status.events.map((event) => <li key={event.id}><strong>{event.title}</strong><small>{event.source} · {new Date(event.receivedAt).toLocaleString()}</small><span>{event.detail}</span>{event.completedAt ? <small>{t("workerCompleted")}: {event.workerAgentId}</small> : event.workerAgentId ? <><small>{t("workerLaunched")}: {event.workerAgentId}</small><PixelButton type="button" variant="secondary" disabled={busy} onClick={() => void completeWorker(event.id)}>{t("completeWorker")}</PixelButton></> : <PixelButton type="button" variant="secondary" disabled={busy || !templateAgentId} onClick={() => void launchWorker(event.id)}>{t("launchWorker")}</PixelButton>}</li>)}</ul> : <p className="empty">{t("noWebhookEvents")}</p>}
  </PixelPanel>;
}
function text(error: unknown): string { return error instanceof Error ? error.message : String(error); }
