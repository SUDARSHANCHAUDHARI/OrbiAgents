import { useEffect, useRef, useState } from "react";
import type { VoicePolicy, VoiceRetention, VoiceTranscriptionStatus } from "../../../shared/contracts";
import { useI18n } from "../i18n";
import { PixelButton } from "./ui/PixelButton";
import { PixelPanel } from "./ui/PixelPanel";

export function VoicePolicyPanel({ onError }: { onError(message: string): void }) {
  const { t } = useI18n();
  const [policy, setPolicy] = useState<VoicePolicy | null>(null); const [status, setStatus] = useState<VoiceTranscriptionStatus | null>(null);
  const [consent, setConsent] = useState(false); const [retention, setRetention] = useState<VoiceRetention>("none"); const [recording, setRecording] = useState(false); const [busy, setBusy] = useState(false); const [transcript, setTranscript] = useState("");
  const recorder = useRef<MediaRecorder | null>(null); const stream = useRef<MediaStream | null>(null); const chunks = useRef<Blob[]>([]);
  useEffect(() => { void Promise.all([window.orbi.voice.policy(), window.orbi.voice.status()]).then(([nextPolicy, nextStatus]) => { setPolicy(nextPolicy); setConsent(nextPolicy.consent); setRetention(nextPolicy.retention); setStatus(nextStatus); }).catch((error) => onError(text(error))); return () => stream.current?.getTracks().forEach((track) => track.stop()); }, [onError]);
  async function save() { onError(""); try { const next = await window.orbi.voice.updatePolicy({ consent, retention }); setPolicy(next); } catch (error) { onError(text(error)); } }
  async function chooseModel() { onError(""); try { const next = await window.orbi.voice.chooseModel(); setStatus(next); setPolicy(await window.orbi.voice.policy()); } catch (error) { onError(text(error)); } }
  async function start() {
    onError(""); setTranscript("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const next = new MediaRecorder(media, { mimeType }); stream.current = media; chunks.current = [];
      next.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      next.onstop = () => { void finish(mimeType); };
      recorder.current = next; next.start(1000); setRecording(true);
    } catch (error) { onError(text(error)); }
  }
  function stop() { recorder.current?.stop(); setRecording(false); }
  async function finish(mimeType: "audio/webm" | "audio/mp4") { setBusy(true); stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; try { const bytes = new Uint8Array(await new Blob(chunks.current, { type: mimeType }).arrayBuffer()); const result = await window.orbi.voice.transcribe({ audio: bytes, mimeType }); setTranscript(result.text); } catch (error) { onError(text(error)); } finally { chunks.current = []; setBusy(false); } }
  return <PixelPanel title={t("voiceControl")} eyebrow={t("consentRetention")} ariaLabel={t("voiceControl")}><p className="mission-policy">{t("voicePolicy")}</p><label><input aria-label={t("voiceConsent")} type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); if (!event.target.checked) setRetention("none"); }} /> {t("voiceConsent")}</label><label>{t("transcriptRetention")}<select aria-label={t("transcriptRetention")} value={retention} disabled={!consent} onChange={(event) => setRetention(event.target.value as VoiceRetention)}><option value="none">{t("retainNothing")}</option><option value="session">{t("retainSession")}</option><option value="24-hours">{t("retain24Hours")}</option></select></label><div className="update-actions"><PixelButton type="button" onClick={() => void save()}>{t("savePolicy")}</PixelButton><PixelButton type="button" variant="secondary" onClick={() => void chooseModel()}>{t("chooseVoiceModel")}</PixelButton>{recording ? <PixelButton type="button" variant="danger" onClick={stop}>{t("stopRecording")}</PixelButton> : <PixelButton type="button" variant="primary" disabled={busy || !policy?.captureEnabled} onClick={() => void start()}>{busy ? t("transcribing") : t("startRecording")}</PixelButton>}</div><p className="empty">{status?.detail ?? t("voiceCaptureUnavailable")}</p>{transcript ? <label>{t("voiceTranscript")}<textarea aria-label={t("voiceTranscript")} value={transcript} readOnly /></label> : null}</PixelPanel>;
}
function text(error: unknown): string { return error instanceof Error ? error.message : String(error); }
