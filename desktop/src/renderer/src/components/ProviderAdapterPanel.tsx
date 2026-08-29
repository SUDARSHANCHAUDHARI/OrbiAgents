import { useEffect, useState } from "react";
import type { RuntimeAdapterDescriptor } from "../../../shared/contracts";

export function ProviderAdapterPanel({ onChanged, onError }: { onChanged(adapters: RuntimeAdapterDescriptor[]): void; onError(message: string): void }) {
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
  return <section className="command-panel provider-panel" aria-label="Runtime adapters">
    <div className="section-title"><span>Runtime adapters</span><button type="button" onClick={() => void refresh()}>Refresh</button></div>
    <p className="mission-policy">Custom adapters are explicit local allowlist entries. Executables must use absolute paths; arguments are passed literally without a shell. Secrets and environment overrides are not supported.</p>
    <form className="mission-create" onSubmit={create}><input aria-label="Adapter identifier" value={id} onChange={(event) => setId(event.target.value)} placeholder="adapter-id" pattern="[a-z0-9][a-z0-9-]{0,47}" maxLength={48} required /><input aria-label="Adapter display name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Display name" maxLength={80} required /><input aria-label="Adapter executable path" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="/absolute/path/to/executable" required /><textarea aria-label="Adapter arguments, one per line" value={args} onChange={(event) => setArgs(event.target.value)} placeholder="One literal argument per line (optional)" /><button type="submit" disabled={busy}>Add allowlisted adapter</button></form>
    <ul>{adapters.map((adapter) => <li key={adapter.id}><strong>{adapter.name}</strong><small>{adapter.id} · {adapter.builtin ? "built-in" : "custom allowlisted"}</small><span>{adapter.command}{adapter.args.length ? ` ${adapter.args.join(" ")}` : ""}</span>{!adapter.builtin ? <span className="mission-actions"><button type="button" disabled={busy} onClick={() => void remove(adapter)}>Remove</button></span> : null}</li>)}</ul>
  </section>;
}

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
