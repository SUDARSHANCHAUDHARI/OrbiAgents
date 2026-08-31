import { useEffect, useState } from "react";
import type { VoicePolicy, VoiceRetention } from "../../../shared/contracts";
import { useI18n } from "../i18n";
import { PixelButton } from "./ui/PixelButton";
import { PixelPanel } from "./ui/PixelPanel";
export function VoicePolicyPanel({ onError }: { onError(message: string): void }) {
  const { t } = useI18n(); const [policy, setPolicy] = useState<VoicePolicy | null>(null); const [consent, setConsent] = useState(false); const [retention, setRetention] = useState<VoiceRetention>("none");
  useEffect(() => { void window.orbi.voice.policy().then((value) => { setPolicy(value); setConsent(value.consent); setRetention(value.retention); }).catch((error) => onError(String(error))); }, [onError]);
  async function save() { try { const next = await window.orbi.voice.updatePolicy({ consent, retention }); setPolicy(next); setConsent(next.consent); setRetention(next.retention); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } }
  return <PixelPanel title={t("voiceControl")} eyebrow={t("consentRetention")} ariaLabel={t("voiceControl")}><p className="mission-policy">{t("voicePolicy")}</p><label><input aria-label={t("voiceConsent")} type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); if (!event.target.checked) setRetention("none"); }} /> {t("voiceConsent")}</label><label>{t("transcriptRetention")}<select aria-label={t("transcriptRetention")} value={retention} disabled={!consent} onChange={(event) => setRetention(event.target.value as VoiceRetention)}><option value="none">{t("retainNothing")}</option><option value="session">{t("retainSession")}</option><option value="24-hours">{t("retain24Hours")}</option></select></label><PixelButton type="button" onClick={() => void save()}>{t("savePolicy")}</PixelButton><p className="empty">{policy?.captureEnabled ? t("voiceCaptureEnabled") : t("voiceCaptureUnavailable")}</p></PixelPanel>;
}
