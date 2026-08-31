import { useEffect, useState } from "react";
import type { WebhookStatus } from "../../../shared/contracts";
import { useI18n } from "../i18n";
import { PixelButton } from "./ui/PixelButton";
import { PixelPanel } from "./ui/PixelPanel";
export function WebhookPanel({ onError }: { onError(message: string): void }) {
  const { t } = useI18n(); const [status, setStatus] = useState<WebhookStatus | null>(null); const [busy, setBusy] = useState(false); const [copied, setCopied] = useState(false);
  useEffect(() => { void window.orbi.webhooks.status().then(setStatus).catch((error) => onError(String(error))); }, [onError]);
  async function act(action: "start" | "stop") { setBusy(true); onError(""); try { setStatus(await window.orbi.webhooks[action]()); setCopied(false); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }
  async function copySecret() { try { await window.orbi.webhooks.copySecret(); setCopied(true); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } }
  return <PixelPanel title={t("inboundWebhooks")} eyebrow={status?.enabled ? t("enabled") : t("disabled")} ariaLabel={t("inboundWebhooks")}><p className="mission-policy">{t("webhookPolicy")}</p>{status?.endpoint ? <label>{t("loopbackEndpoint")}<input readOnly value={status.endpoint} aria-label={t("loopbackEndpoint")} /></label> : null}<div className="button-row">{status?.enabled ? <><PixelButton type="button" onClick={() => void copySecret()}>{copied ? t("secretCopied") : t("copyWebhookSecret")}</PixelButton><PixelButton type="button" variant="danger" disabled={busy} onClick={() => void act("stop")}>{t("disable")}</PixelButton></> : <PixelButton type="button" variant="primary" disabled={busy} onClick={() => void act("start")}>{t("enable")}</PixelButton>}</div><div className="section-title">{t("recentWebhookEvents")}</div>{status?.events.length ? <ul>{status.events.map((event) => <li key={event.id}><strong>{event.title}</strong><small>{event.source} · {new Date(event.receivedAt).toLocaleString()}</small><span>{event.detail}</span></li>)}</ul> : <p className="empty">{t("noWebhookEvents")}</p>}</PixelPanel>;
}
