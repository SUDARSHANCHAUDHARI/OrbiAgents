"use client";

import React, { useEffect, useState } from "react";
import { applyWorkspaceFiles, discardPreservedWorkspace, inspectPreservedWorkspace, listPreservedWorkspaces } from "@/lib/auth";
import { PreservedWorkspace, WorkspaceChanges } from "@/lib/types";

export default function WorkspaceReviewPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<PreservedWorkspace[]>([]);
  const [selected, setSelected] = useState<PreservedWorkspace | null>(null);
  const [changes, setChanges] = useState<WorkspaceChanges | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    setBusy(true);
    setError(null);
    try { setItems(await listPreservedWorkspaces()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load workspaces"); }
    finally { setBusy(false); }
  }

  async function inspect(item: PreservedWorkspace) {
    setSelected(item);
    setChanges(null);
    setError(null);
    try {
      const next = await inspectPreservedWorkspace(item.id);
      setChanges(next);
      setSelectedFiles(next.files);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not inspect workspace"); }
  }

  async function applySelected() {
    if (!selected || selectedFiles.length === 0) return;
    if (!window.confirm(`Apply ${selectedFiles.length} selected file(s) to the main workspace? The target must be clean.`)) return;
    setBusy(true);
    setError(null);
    try {
      await applyWorkspaceFiles(selected.id, selectedFiles);
      setChanges(await inspectPreservedWorkspace(selected.id));
      setSelectedFiles([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not apply workspace files");
    } finally { setBusy(false); }
  }

  async function discard(item: PreservedWorkspace) {
    if (!window.confirm(`Permanently discard the agent changes in ${item.path}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await discardPreservedWorkspace(item.id);
      setSelected(null);
      setChanges(null);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not discard workspace");
    } finally { setBusy(false); }
  }

  return (
    <aside aria-label="Preserved agent workspaces" style={{ position: "absolute", inset: "16px 16px 16px auto", zIndex: 30, width: 420, maxWidth: "calc(100% - 32px)", overflow: "auto", padding: 16, borderRadius: 12, border: "1px solid #374151", background: "#0F172A", boxShadow: "0 18px 40px rgba(0,0,0,.45)" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div><strong>Agent workspaces</strong><div style={{ color: "#9CA3AF", fontSize: 12 }}>Review local changes before deciding what to keep.</div></div>
        <button onClick={onClose} aria-label="Close workspace review" style={{ color: "#E5E7EB", background: "transparent", border: 0, cursor: "pointer" }}>✕</button>
      </header>
      {error && <p role="alert" style={{ color: "#FCA5A5", fontSize: 12 }}>{error}</p>}
      {busy && items.length === 0 ? <p style={{ color: "#9CA3AF" }}>Loading…</p> : items.length === 0 ? <p style={{ color: "#9CA3AF" }}>No preserved agent workspaces.</p> : (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((item) => (
            <section key={item.id} style={{ padding: 10, border: "1px solid #374151", borderRadius: 8, background: "#111827" }}>
              <strong style={{ fontSize: 13 }}>{item.nodeId}</strong>
              <code style={{ display: "block", margin: "5px 0", color: "#FDE68A", fontSize: 10, overflowWrap: "anywhere" }}>{item.path}</code>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => void inspect(item)} disabled={busy} style={{ padding: "6px 9px", borderRadius: 6, border: "1px solid #3B82F6", background: "#1E3A8A", color: "white", cursor: "pointer" }}>Inspect</button>
                <button onClick={() => void discard(item)} disabled={busy} style={{ padding: "6px 9px", borderRadius: 6, border: "1px solid #DC2626", background: "#7F1D1D", color: "white", cursor: "pointer" }}>Discard…</button>
              </div>
            </section>
          ))}
        </div>
      )}
      {selected && changes && (
        <section style={{ marginTop: 12, padding: 10, border: "1px solid #4B5563", borderRadius: 8 }}>
          <strong style={{ fontSize: 12 }}>Changed files</strong>
          <pre style={{ whiteSpace: "pre-wrap", color: "#D1D5DB", fontSize: 11 }}>{changes.status || "No current changes"}</pre>
          {changes.diffStat && <pre style={{ whiteSpace: "pre-wrap", color: "#93C5FD", fontSize: 11 }}>{changes.diffStat}</pre>}
          {changes.files.map((file) => (
            <label key={file} style={{ display: "block", margin: "6px 0", fontSize: 12 }}>
              <input type="checkbox" checked={selectedFiles.includes(file)} onChange={(event) => setSelectedFiles((current) => event.target.checked ? [...current, file] : current.filter((value) => value !== file))} /> {file}
            </label>
          ))}
          <button onClick={() => void applySelected()} disabled={busy || selectedFiles.length === 0} style={{ marginTop: 8, padding: "7px 10px", borderRadius: 6, border: "1px solid #16A34A", background: "#166534", color: "white" }}>Apply selected…</button>
          {changes.patch && <details style={{ marginTop: 10 }}><summary style={{ cursor: "pointer", fontSize: 12 }}>Review patch</summary><pre style={{ whiteSpace: "pre-wrap", color: "#D1D5DB", fontSize: 10, overflowWrap: "anywhere" }}>{changes.patch}</pre></details>}
        </section>
      )}
    </aside>
  );
}
