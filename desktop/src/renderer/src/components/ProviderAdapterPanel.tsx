import { useEffect, useState } from "react";
import type { RuntimeAdapterDescriptor } from "../../../shared/contracts";
import { useI18n } from "../i18n";

export function ProviderAdapterPanel({ onChanged, onError }: { onChanged(adapters: RuntimeAdapterDescriptor[]): void; onError(message: string): void }) {
  const { t } = useI18n();
  const [adapters, setAdapters] = useState<RuntimeAdapterDescriptor[]>([]);
  const [id, setId] = useState(""); const [name, setName] = useState(""); const [command, setCommand] = useState(""); const [args, setArgs] = useState(""); const [busy, setBusy] = useState(false);
  function update(next: RuntimeAdapterDescriptor[]) { setAdapters(next); onChanged(next); }
  async function refresh() { try { update(await window.orbi.runtimeAdapters.list()); } catch (error) { onError(message(error)); } }
  useEffect(() => { void refresh(); }, []);
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try { update(await window.orbi.runtimeAdapters.create({ id, name, command, args: args.split("\n").filter((argument) => argument.length > 0) })); setId(""); setName(""); setCommand(""); setArgs(""); onError(""); }
    catch (error) { onError(message(error)); } finally { setBusy(false); }
  }
  async function remove(adapter: RuntimeAdapterDescriptor) {
    setBusy(true); try { update(await window.orbi.runtimeAdapters.remove({ id: adapter.id })); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); }
  }
  return <section className="command-panel provider-panel" aria-label={t("runtimeAdapters")}>
    <div className="section-title"><span>{t("runtimeAdapters")}</span><button type="button" onClick={() => void refresh()}>{t("refresh")}</button></div>
    <p className="mission-policy">{t("adapterPolicy")}</p>
    <form className="mission-create" onSubmit={create}><input aria-label={t("adapterId")} value={id} onChange={(event) => setId(event.target.value)} placeholder="adapter-id" pattern="[a-z0-9][a-z0-9-]{0,47}" maxLength={48} required /><input aria-label={t("adapterName")} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("displayName")} maxLength={80} required /><input aria-label={t("adapterPath")} value={command} onChange={(event) => setCommand(event.target.value)} placeholder={t("executablePlaceholder")} required /><textarea aria-label={t("adapterArguments")} value={args} onChange={(event) => setArgs(event.target.value)} placeholder={t("argumentsPlaceholder")} /><button type="submit" disabled={busy}>{t("addAdapter")}</button></form>
    <ul>{adapters.map((adapter) => <li key={adapter.id}><strong>{adapter.name}</strong><small>{adapter.id} · {adapter.builtin ? t("builtIn") : t("customAllowlisted")}</small><span>{adapter.command}{adapter.args.length ? ` ${adapter.args.join(" ")}` : ""}</span>{!adapter.builtin ? <span className="mission-actions"><button type="button" disabled={busy} onClick={() => void remove(adapter)}>{t("remove")}</button></span> : null}</li>)}</ul>
  </section>;
}

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
