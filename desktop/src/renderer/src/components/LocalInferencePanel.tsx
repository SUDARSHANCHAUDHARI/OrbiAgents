import { useEffect, useRef, useState } from "react";
import type { LocalModelEndpoint } from "../../../shared/contracts";
import { useI18n } from "../i18n";

export function LocalInferencePanel({ endpoint, onError }: { endpoint: LocalModelEndpoint; onError(message: string): void }) {
  const { t } = useI18n();
  const [model, setModel] = useState(endpoint.defaultModel ?? "");
  const [prompt, setPrompt] = useState(""); const [result, setResult] = useState(""); const [busy, setBusy] = useState(false);
  const requestId = useRef<string | null>(null);
  useEffect(() => () => { const id = requestId.current; requestId.current = null; if (id) void window.orbi.localModels.cancel({ requestId: id }).catch(() => undefined); }, []);
  async function run(event: React.FormEvent) {
    event.preventDefault(); if (requestId.current) return;
    const id = crypto.randomUUID(); requestId.current = id; setBusy(true); setResult(""); onError("");
    try { const response = await window.orbi.localModels.complete({ id: endpoint.id, requestId: id, model, prompt }); if (requestId.current === id) setResult(response.text); }
    catch (error) { if (requestId.current === id) onError(error instanceof Error ? error.message : String(error)); }
    finally { if (requestId.current === id) { requestId.current = null; setBusy(false); } }
  }
  async function cancel() { const id = requestId.current; if (!id) return; try { await window.orbi.localModels.cancel({ requestId: id }); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } }
  return <details className="inference-panel"><summary>{t("testInference")} · {endpoint.name}</summary><form className="model-execution-form" onSubmit={(event) => void run(event)}>
    <label>{t("defaultModel")}<input aria-label={t("defaultModel")} value={model} maxLength={200} disabled={busy} onChange={(event) => setModel(event.target.value)} required /></label>
    <label>{t("inferencePrompt")}<textarea aria-label={t("inferencePrompt")} value={prompt} maxLength={20000} disabled={busy} onChange={(event) => setPrompt(event.target.value)} required /></label>
    <div className="mission-actions"><button type="submit" disabled={busy || !prompt.trim() || !model.trim()}>{t("runInference")}</button><button type="button" disabled={!busy} onClick={() => void cancel()}>{t("cancelInference")}</button></div>
    {result ? <label>{t("inferenceResult")}<textarea aria-label={t("inferenceResult")} value={result} readOnly /></label> : null}
  </form></details>;
}
