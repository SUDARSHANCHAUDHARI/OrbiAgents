import { useEffect, useState } from "react";
import type { LocalModelEndpoint } from "../../../shared/contracts";
import { useI18n } from "../i18n";

export function LocalModelPanel({ onError }: { onError(message: string): void }) {
  const { t } = useI18n();
  const [endpoints, setEndpoints] = useState<LocalModelEndpoint[]>([]); const [id, setId] = useState(""); const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:11434/v1"); const [defaultModel, setDefaultModel] = useState(""); const [busy, setBusy] = useState(false); const [probe, setProbe] = useState<Record<string, string>>({});
  async function refresh() { try { setEndpoints(await window.orbi.localModels.list()); } catch (error) { onError(message(error)); } }
  useEffect(() => { void refresh(); }, []);
  async function create(event: React.FormEvent) { event.preventDefault(); setBusy(true); try { setEndpoints(await window.orbi.localModels.create({ id, name, baseUrl, defaultModel: defaultModel || undefined })); setId(""); setName(""); setDefaultModel(""); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  async function saveCredential(endpoint: LocalModelEndpoint) { setBusy(true); try { setEndpoints(await window.orbi.localModels.saveCredentialFromClipboard({ id: endpoint.id })); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  async function clearCredential(endpoint: LocalModelEndpoint) { setBusy(true); try { setEndpoints(await window.orbi.localModels.clearCredential({ id: endpoint.id })); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  async function remove(endpoint: LocalModelEndpoint) { setBusy(true); try { setEndpoints(await window.orbi.localModels.remove({ id: endpoint.id })); setProbe((current) => { const next = { ...current }; delete next[endpoint.id]; return next; }); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  async function runProbe(endpoint: LocalModelEndpoint) { setBusy(true); try { const result = await window.orbi.localModels.probe({ id: endpoint.id }); setProbe((current) => ({ ...current, [endpoint.id]: result.models.length ? `${result.models.join(", ")}${result.truncated ? " …" : ""}` : t("connectedNoModels") })); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  return <section className="command-panel local-model-panel" aria-label={t("localEndpointsLabel")}>
    <div className="section-title"><span>{t("localEndpoints")}</span><button type="button" onClick={() => void refresh()}>{t("refresh")}</button></div>
    <p className="mission-policy">{t("localEndpointPolicy")}</p>
    <form className="mission-create" onSubmit={create}><input aria-label={t("endpointId")} value={id} onChange={(event) => setId(event.target.value)} placeholder="endpoint-id" pattern="[a-z0-9][a-z0-9-]{0,47}" maxLength={48} required /><input aria-label={t("endpointName")} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("displayName")} maxLength={80} required /><input aria-label={t("endpointUrl")} type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="http://127.0.0.1:11434/v1" required /><input aria-label={t("defaultModel")} value={defaultModel} onChange={(event) => setDefaultModel(event.target.value)} placeholder={t("optionalDefaultModel")} maxLength={200} /><button type="submit" disabled={busy}>{t("addEndpoint")}</button></form>
    {endpoints.length ? <ul>{endpoints.map((endpoint) => <li key={endpoint.id}><strong>{endpoint.name}</strong><small>{endpoint.baseUrl} · {endpoint.hasApiKey ? t("encryptedKey") : t("noKey")}{endpoint.defaultModel ? ` · ${endpoint.defaultModel}` : ""}</small>{probe[endpoint.id] ? <span>{probe[endpoint.id]}</span> : null}<span className="mission-actions"><button type="button" disabled={busy} onClick={() => void runProbe(endpoint)}>{t("probeModels")}</button><button type="button" disabled={busy} onClick={() => void saveCredential(endpoint)}>{t("saveClipboardKey")}</button>{endpoint.hasApiKey ? <button type="button" disabled={busy} onClick={() => void clearCredential(endpoint)}>{t("clearKey")}</button> : null}<button type="button" disabled={busy} onClick={() => void remove(endpoint)}>{t("remove")}</button></span></li>)}</ul> : <p className="empty">{t("noEndpoints")}</p>}
  </section>;
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
