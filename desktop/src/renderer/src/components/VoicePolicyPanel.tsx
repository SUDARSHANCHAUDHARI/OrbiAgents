import { useEffect, useRef, useState } from "react";
import type { AgentSession, VoicePolicy, VoiceRetention, VoiceTranscriptionStatus } from "../../../shared/contracts";
import { useI18n } from "../i18n";
import { PixelButton } from "./ui/PixelButton";
import { PixelPanel } from "./ui/PixelPanel";

export function VoicePolicyPanel({ projectPath, agents, onError }: { projectPath: string; agents: AgentSession[]; onError(message: string): void }) {
  const { t } = useI18n();
  const [destination, setDestination] = useState("");
  useEffect(() => { setDestination(""); }, [projectPath]);
  async function dispatch() {
    if (busy || !transcript.trim() || !destination || !window.confirm(`${t("dispatchVoiceConfirm")}\n\n${agents.find((agent) => agent.id === destination)?.name ?? destination}\n\n${transcript}`)) return;
    setBusy(true); onError("");
    try { await window.orbi.voice.dispatch({ projectPath, agentId: destination, text: transcript, confirmed: true }); setTranscript(""); }
    catch (error) { onError(text(error)); } finally { setBusy(false); }
  }
  const [policy, setPolicy] = useState<VoicePolicy | null>(null); const [status, setStatus] = useState<VoiceTranscriptionStatus | null>(null);
  const [consent, setConsent] = useState(false); const [retention, setRetention] = useState<VoiceRetention>("none"); const [recording, setRecording] = useState(false); const [busy, setBusy] = useState(false); const [transcript, setTranscript] = useState("");
  const recorder = useRef<MediaRecorder | null>(null); const stream = useRef<MediaStream | null>(null); const chunks = useRef<Blob[]>([]);
  const generation = useRef(0); const reportError = useRef(onError); reportError.current = onError;
  function disposeCapture() { generation.current += 1; if (recorder.current) { recorder.current.onstop = null; recorder.current.ondataavailable = null; if (recorder.current.state !== "inactive") recorder.current.stop(); } recorder.current = null; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; chunks.current = []; }
  useEffect(() => { let cancelled = false; void Promise.all([window.orbi.voice.policy(), window.orbi.voice.status()]).then(([nextPolicy, nextStatus]) => { if (cancelled) return; setPolicy(nextPolicy); setConsent(nextPolicy.consent); setRetention(nextPolicy.retention); setStatus(nextStatus); }).catch((error) => { if (!cancelled) reportError.current(text(error)); }); return () => { cancelled = true; disposeCapture(); }; }, []);
  async function save() { onError(""); try { const next = await window.orbi.voice.updatePolicy({ consent, retention }); setPolicy(next); if (!next.consent || next.retention === "none") { disposeCapture(); setTranscript(""); setRecording(false); setBusy(false); } } catch (error) { onError(text(error)); } }
  async function chooseModel() { onError(""); try { const next = await window.orbi.voice.chooseModel(); setStatus(next); setPolicy(await window.orbi.voice.policy()); } catch (error) { onError(text(error)); } }
  async function start() {
    const started = generation.current; onError(""); setTranscript(""); setBusy(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (started !== generation.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media; const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const next = new MediaRecorder(media, { mimeType }); chunks.current = [];
      next.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      next.onstop = () => { void finish(mimeType); };
      recorder.current = next; next.start(1000); setRecording(true);
    } catch (error) { if (started === generation.current) { disposeCapture(); setBusy(false); onError(text(error)); } }
    finally { if (started === generation.current) setBusy(false); }
  }
  function stop() { recorder.current?.stop(); setRecording(false); }
  async function finish(mimeType: "audio/webm" | "audio/mp4") { const started = generation.current; setBusy(true); stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; try { const bytes = new Uint8Array(await new Blob(chunks.current, { type: mimeType }).arrayBuffer()); if (started !== generation.current) return; const result = await window.orbi.voice.transcribe({ audio: bytes, mimeType }); if (started === generation.current) setTranscript(result.text); } catch (error) { if (started === generation.current) onError(text(error)); } finally { if (started === generation.current) { chunks.current = []; setBusy(false); } } }
  return <PixelPanel title={t("voiceControl")} eyebrow={t("consentRetention")} ariaLabel={t("voiceControl")}><p className="mission-policy">{t("voicePolicy")}</p><label><input aria-label={t("voiceConsent")} type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); if (!event.target.checked) setRetention("none"); }} /> {t("voiceConsent")}</label><label>{t("transcriptRetention")}<select aria-label={t("transcriptRetention")} value={retention} disabled={!consent} onChange={(event) => setRetention(event.target.value as VoiceRetention)}><option value="none">{t("retainNothing")}</option><option value="session">{t("retainSession")}</option><option value="24-hours">{t("retain24Hours")}</option></select></label><div className="update-actions"><PixelButton type="button" onClick={() => void save()}>{t("savePolicy")}</PixelButton><PixelButton type="button" variant="secondary" onClick={() => void chooseModel()}>{t("chooseVoiceModel")}</PixelButton>{recording ? <PixelButton type="button" variant="danger" onClick={stop}>{t("stopRecording")}</PixelButton> : <PixelButton type="button" variant="primary" disabled={busy || !policy?.captureEnabled} onClick={() => void start()}>{busy ? t("transcribing") : t("startRecording")}</PixelButton>}</div><p className="empty">{status?.detail ?? t("voiceCaptureUnavailable")}</p>{transcript ? <label>{t("voiceTranscript")}<textarea aria-label={t("voiceTranscript")} value={transcript} maxLength={8192} disabled={busy} onChange={(event) => setTranscript(event.target.value)} /></label> : null}{transcript ? <div className="model-execution-form"><p className="mission-policy">{t("dispatchVoiceConfirm")}</p><select aria-label={t("voiceDestination")} value={destination} disabled={busy} onChange={(event) => setDestination(event.target.value)}><option value="">{t("selectRunningAgent")}</option>{agents.filter((agent) => agent.status === "running" && agent.workspace.sourcePath === projectPath).map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><PixelButton type="button" disabled={busy || !consent || !policy?.consent || !destination || !transcript.trim()} onClick={() => void dispatch()}>{t("dispatchTranscript")}</PixelButton></div> : null}</PixelPanel>;
}
function text(error: unknown): string { return error instanceof Error ? error.message : String(error); }
