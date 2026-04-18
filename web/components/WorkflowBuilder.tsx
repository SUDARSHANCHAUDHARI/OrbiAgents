"use client";

import { useEffect, useState } from "react";
import { Workflow, WorkflowEdge, WorkflowNode, WorkflowNodeType } from "@/lib/types";
import {
  deleteWorkflow,
  getToken,
  listWorkflows,
  loadWorkflow,
  saveWorkflow,
  WorkflowMeta,
} from "@/lib/auth";
import SaveWorkflowModal from "./SaveWorkflowModal";

interface Props {
  workflow: Workflow;
  onChange: (wf: Workflow) => void;
  onRun: () => void;
  running: boolean;
}

const NODE_META: Record<
  WorkflowNodeType,
  { label: string; color: string; icon: string; agentName: string }
> = {
  planner: {
    label: "Planner",
    color: "border-violet-500 bg-violet-500/10 text-violet-300",
    icon: "🧠",
    agentName: "Orbi-Alpha",
  },
  coder: {
    label: "Coder",
    color: "border-blue-500 bg-blue-500/10 text-blue-300",
    icon: "💻",
    agentName: "Orbi-Beta",
  },
  tester: {
    label: "Tester",
    color: "border-emerald-500 bg-emerald-500/10 text-emerald-300",
    icon: "🧪",
    agentName: "Orbi-Gamma",
  },
  reviewer: {
    label: "Reviewer",
    color: "border-amber-500 bg-amber-500/10 text-amber-300",
    icon: "👁️",
    agentName: "Orbi-Delta",
  },
  debugger: {
    label: "Debugger",
    color: "border-rose-500 bg-rose-500/10 text-rose-300",
    icon: "🔍",
    agentName: "Orbi-Epsilon",
  },
};

const PALETTE: WorkflowNodeType[] = ["planner", "coder", "tester", "reviewer", "debugger"];

interface WorkflowTemplate {
  name: string;
  description: string;
  workflow: Workflow;
}

function makeChain(types: WorkflowNodeType[]): Workflow {
  const nodes: WorkflowNode[] = types.map((t, i) => ({ id: `${t}-${i}`, type: t, label: NODE_META[t].label }));
  const edges: WorkflowEdge[] = nodes.slice(0, -1).map((n, i) => ({ from: n.id, to: nodes[i + 1].id }));
  return { nodes, edges };
}

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  { name: "Plan + Code", description: "Planner then Coder", workflow: makeChain(["planner", "coder"]) },
  { name: "Plan + Code + Test", description: "Add testing step", workflow: makeChain(["planner", "coder", "tester"]) },
  { name: "Full Pipeline", description: "Plan → Code → Test → Review", workflow: makeChain(["planner", "coder", "tester", "reviewer"]) },
  { name: "Debug Pipeline", description: "Plan → Debug → Code → Test", workflow: makeChain(["planner", "debugger", "coder", "tester"]) },
  { name: "Review Only", description: "Reviewer then Debugger", workflow: makeChain(["reviewer", "debugger"]) },
];

function formatUpdatedAt(value?: string): string | null {
  if (!value) return null;
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function edgeKey(edge: WorkflowEdge): string {
  return `${edge.from}->${edge.to}`;
}

function createsCycle(workflow: Workflow, candidate: WorkflowEdge): boolean {
  const adjacency = new Map<string, string[]>();
  for (const node of workflow.nodes) adjacency.set(node.id, []);
  for (const edge of workflow.edges) {
    adjacency.get(edge.from)?.push(edge.to);
  }
  adjacency.get(candidate.from)?.push(candidate.to);

  const stack = [candidate.to];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === candidate.from) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      stack.push(next);
    }
  }

  return false;
}

export default function WorkflowBuilder({
  workflow,
  onChange,
  onRun,
  running,
}: Props) {
  const [showPalette, setShowPalette] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedList, setSavedList] = useState<WorkflowMeta[]>([]);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
  const [currentWorkflowName, setCurrentWorkflowName] = useState("Untitled workflow");
  const [loadingList, setLoadingList] = useState(false);
  const [busyWorkflowId, setBusyWorkflowId] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [newEdgeFrom, setNewEdgeFrom] = useState<string>("");
  const [newEdgeTo, setNewEdgeTo] = useState<string>("");
  const [graphError, setGraphError] = useState<string | null>(null);
  const isLoggedIn = !!getToken();

  useEffect(() => {
    if (!isLoggedIn) return;
    void refreshSavedList();
  }, [isLoggedIn]);

  async function refreshSavedList() {
    setLoadingList(true);
    setLibraryError(null);
    try {
      const workflows = await listWorkflows();
      setSavedList(workflows);
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : "Could not load workflows");
    } finally {
      setLoadingList(false);
    }
  }

  async function handleSave(name: string) {
    const saved = await saveWorkflow(name, workflow);
    setCurrentWorkflowId(saved.id);
    setCurrentWorkflowName(saved.name);
    await refreshSavedList();
  }

  async function handleUpdateCurrent() {
    if (!currentWorkflowId || !currentWorkflowName || workflow.nodes.length === 0) return;
    const saved = await saveWorkflow(currentWorkflowName, workflow, currentWorkflowId);
    setCurrentWorkflowId(saved.id);
    setCurrentWorkflowName(saved.name);
    await refreshSavedList();
  }

  async function handleLoad(id: string) {
    setBusyWorkflowId(id);
    setLibraryError(null);
    try {
      const wf = await loadWorkflow(id);
      onChange(wf.data as Workflow);
      setCurrentWorkflowId(wf.id);
      setCurrentWorkflowName(wf.name);
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : "Could not load workflow");
    } finally {
      setBusyWorkflowId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyWorkflowId(id);
    setLibraryError(null);
    try {
      await deleteWorkflow(id);
      if (currentWorkflowId === id) {
        setCurrentWorkflowId(null);
        setCurrentWorkflowName("Untitled workflow");
      }
      await refreshSavedList();
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : "Could not delete workflow");
    } finally {
      setBusyWorkflowId(null);
    }
  }

  function handleReset() {
    onChange({ nodes: [], edges: [] });
    setCurrentWorkflowId(null);
    setCurrentWorkflowName("Untitled workflow");
    setGraphError(null);
  }

  function addNode(type: WorkflowNodeType) {
    const id = `${type}-${Date.now()}`;
    const prevNode =
      workflow.nodes.length > 0
        ? workflow.nodes[workflow.nodes.length - 1]
        : null;

    const newNode: WorkflowNode = { id, type, label: NODE_META[type].label };
    const newEdge = prevNode ? [{ from: prevNode.id, to: id }] : [];

    onChange({
      nodes: [...workflow.nodes, newNode],
      edges: [...workflow.edges, ...newEdge],
    });
    setGraphError(null);
    setShowPalette(false);
  }

  function removeNode(nodeId: string) {
    const idx = workflow.nodes.findIndex((n) => n.id === nodeId);
    if (idx === -1) return;

    const prevEdge = workflow.edges.find((e) => e.to === nodeId);
    const nextEdge = workflow.edges.find((e) => e.from === nodeId);

    let edges = workflow.edges.filter(
      (e) => e.from !== nodeId && e.to !== nodeId
    );

    if (prevEdge && nextEdge) {
      edges = [...edges, { from: prevEdge.from, to: nextEdge.to }];
    }

    onChange({ nodes: workflow.nodes.filter((n) => n.id !== nodeId), edges });
    setGraphError(null);
  }

  function addEdge() {
    if (!newEdgeFrom || !newEdgeTo) return;
    if (newEdgeFrom === newEdgeTo) {
      setGraphError("Edges must connect two different nodes.");
      return;
    }

    const edge = { from: newEdgeFrom, to: newEdgeTo };
    const exists = workflow.edges.some((current) => current.from === edge.from && current.to === edge.to);
    if (exists) {
      setGraphError("That edge already exists.");
      return;
    }

    if (createsCycle(workflow, edge)) {
      setGraphError("That connection would create a cycle.");
      return;
    }

    onChange({
      ...workflow,
      edges: [...workflow.edges, edge],
    });
    setGraphError(null);
    setNewEdgeFrom("");
    setNewEdgeTo("");
  }

  function removeEdge(edge: WorkflowEdge) {
    onChange({
      ...workflow,
      edges: workflow.edges.filter((current) => edgeKey(current) !== edgeKey(edge)),
    });
    setGraphError(null);
  }

  const canRun = workflow.nodes.length > 0 && !running;
  const edgeCount = workflow.edges.length;
  const currentMeta = currentWorkflowId
    ? savedList.find((item) => item.id === currentWorkflowId) ?? null
    : null;

  return (
    <>
      {showSaveModal && (
        <SaveWorkflowModal
          onSave={handleSave}
          onClose={() => setShowSaveModal(false)}
          initialName={currentWorkflowId ? currentWorkflowName : ""}
          title={currentWorkflowId ? "Save Workflow Copy" : "Save Workflow"}
          confirmLabel={currentWorkflowId ? "Save Copy" : "Save"}
        />
      )}

      <div className="bg-gray-900 border-t border-gray-700 px-6 py-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-xs uppercase tracking-wider">
                Workflow Builder
              </span>
              <span className="text-gray-600 text-xs">
                ({workflow.nodes.length} node{workflow.nodes.length !== 1 ? "s" : ""} / {edgeCount} edge{edgeCount !== 1 ? "s" : ""})
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-violet-300">
                {currentWorkflowName}
              </span>
              {currentMeta?.updatedAt && (
                <span className="text-gray-500">
                  Updated {formatUpdatedAt(currentMeta.updatedAt)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Template picker */}
            <div className="relative">
              <button
                onClick={() => setShowTemplates((v) => !v)}
                disabled={running}
                className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-40"
              >
                ⬡ Templates
              </button>
              {showTemplates && (
                <div className="absolute bottom-full mb-2 left-0 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl z-20 min-w-[200px]">
                  {WORKFLOW_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      onClick={() => {
                        onChange(tpl.workflow);
                        setCurrentWorkflowId(null);
                        setCurrentWorkflowName(tpl.name);
                        setGraphError(null);
                        setShowTemplates(false);
                      }}
                      className="w-full flex flex-col px-3 py-2 text-xs hover:bg-gray-700 transition-colors text-left"
                    >
                      <span className="text-gray-200 font-medium">{tpl.name}</span>
                      <span className="text-gray-500 text-[10px]">{tpl.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isLoggedIn && (
              <button
                onClick={handleReset}
                disabled={running}
                className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-40"
              >
                New
              </button>
            )}

            {isLoggedIn && currentWorkflowId && (
              <button
                onClick={() => void handleUpdateCurrent()}
                disabled={running || workflow.nodes.length === 0}
                className="px-3 py-1 text-xs bg-violet-700 hover:bg-violet-600 text-violet-50 rounded-lg transition-colors disabled:opacity-40"
              >
                Update
              </button>
            )}

            {isLoggedIn && (
              <button
                onClick={() => setShowSaveModal(true)}
                disabled={running || workflow.nodes.length === 0}
                className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-40"
              >
                Save As
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setShowPalette((v) => !v)}
                disabled={running}
                className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-40"
              >
                + Add Node
              </button>

              {showPalette && (
                <div className="absolute bottom-full mb-2 left-0 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl z-20 min-w-[140px]">
                  {PALETTE.map((type) => (
                    <button
                      key={type}
                      onClick={() => addNode(type)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors text-left"
                    >
                      <span>{NODE_META[type].icon}</span>
                      <div>
                        <div className="font-medium">{NODE_META[type].label}</div>
                        <div className="text-gray-500 text-[10px]">
                          {NODE_META[type].agentName}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={onRun}
              disabled={!canRun}
              className="px-4 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {running ? "Running…" : "▶ Run Workflow"}
            </button>
          </div>
        </div>

        {libraryError && (
          <div className="mb-3 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-[11px] text-red-300">
            {libraryError}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            {workflow.nodes.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-gray-600 text-xs border border-dashed border-gray-700 rounded-lg">
                Click "+ Add Node" to build your workflow
              </div>
            ) : (
              <div className="flex items-center gap-0 overflow-x-auto pb-1">
                {workflow.nodes.map((node, idx) => {
                  const meta = NODE_META[node.type];
                  const hasNext = idx < workflow.nodes.length - 1;

                  return (
                    <div key={node.id} className="flex items-center shrink-0">
                      <div
                        className={`relative border rounded-lg px-4 py-2.5 min-w-[110px] ${meta.color}`}
                      >
                        <button
                          onClick={() => removeNode(node.id)}
                          disabled={running}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-700 hover:bg-red-700 rounded-full text-[9px] text-gray-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-0"
                        >
                          ✕
                        </button>
                        <div className="text-base leading-none mb-1">{meta.icon}</div>
                        <div className="text-xs font-medium">{meta.label}</div>
                        <div className="text-[10px] opacity-60 mt-0.5">
                          {meta.agentName}
                        </div>
                      </div>

                      {hasNext && (
                        <div className="flex items-center px-1">
                          <svg width="44" height="20" viewBox="0 0 44 20">
                            <line
                              x1="0" y1="10" x2="36" y2="10"
                              stroke="#374151" strokeWidth="1.5"
                            />
                            {running && (
                              <line
                                x1="0" y1="10" x2="36" y2="10"
                                stroke="#818cf8"
                                strokeWidth="1.5"
                                strokeDasharray="8 6"
                                className="orbi-flow-line"
                              />
                            )}
                            <polygon
                              points="31,6 44,10 31,14"
                              fill={running ? "#818cf8" : "#374151"}
                              className="transition-colors duration-300"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-gray-500">
              <span className="rounded-full border border-gray-800 px-2 py-1">
                Save reusable flows now
              </span>
              <span className="rounded-full border border-gray-800 px-2 py-1">
                Editable edges enabled
              </span>
            </div>

            <div className="mt-4 rounded-xl border border-gray-800 bg-gray-950/60 p-3">
              <div className="mb-2 text-xs font-medium text-gray-200">Graph Connections</div>
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <select
                  value={newEdgeFrom}
                  onChange={(e) => setNewEdgeFrom(e.target.value)}
                  disabled={running || workflow.nodes.length < 2}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-200 outline-none"
                >
                  <option value="">From node</option>
                  {workflow.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label ?? node.type}
                    </option>
                  ))}
                </select>
                <select
                  value={newEdgeTo}
                  onChange={(e) => setNewEdgeTo(e.target.value)}
                  disabled={running || workflow.nodes.length < 2}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-200 outline-none"
                >
                  <option value="">To node</option>
                  {workflow.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label ?? node.type}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addEdge}
                  disabled={running || workflow.nodes.length < 2}
                  className="rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-100 transition-colors hover:bg-gray-700 disabled:opacity-40"
                >
                  Add Edge
                </button>
              </div>

              {graphError && (
                <div className="mt-2 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-[11px] text-red-300">
                  {graphError}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {workflow.edges.length === 0 ? (
                  <span className="text-[11px] text-gray-500">
                    No custom edges yet. New nodes still auto-chain by default.
                  </span>
                ) : (
                  workflow.edges.map((edge) => {
                    const fromLabel = workflow.nodes.find((node) => node.id === edge.from)?.label ?? edge.from;
                    const toLabel = workflow.nodes.find((node) => node.id === edge.to)?.label ?? edge.to;
                    return (
                      <button
                        key={edgeKey(edge)}
                        onClick={() => removeEdge(edge)}
                        disabled={running}
                        className="rounded-full border border-indigo-800 bg-indigo-950/30 px-3 py-1 text-[10px] text-indigo-200 transition-colors hover:bg-red-950/40 hover:text-red-200 disabled:opacity-40"
                      >
                        {fromLabel} {"->"} {toLabel} x
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <aside className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-gray-200">Workflow Library</div>
                <div className="text-[10px] text-gray-500">
                  Load and manage saved flows
                </div>
              </div>
              {isLoggedIn && (
                <button
                  onClick={() => void refreshSavedList()}
                  disabled={loadingList}
                  className="rounded-md border border-gray-700 px-2 py-1 text-[10px] text-gray-300 transition-colors hover:bg-gray-800 disabled:opacity-40"
                >
                  {loadingList ? "..." : "Refresh"}
                </button>
              )}
            </div>

            {!isLoggedIn ? (
              <div className="rounded-lg border border-dashed border-gray-800 px-3 py-4 text-[11px] text-gray-500">
                Sign in to save and reuse workflows.
              </div>
            ) : savedList.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-800 px-3 py-4 text-[11px] text-gray-500">
                No saved workflows yet. Build one and save it here.
              </div>
            ) : (
              <div className="space-y-2">
                {savedList.map((wf) => {
                  const active = wf.id === currentWorkflowId;
                  const busy = wf.id === busyWorkflowId;
                  return (
                    <div
                      key={wf.id}
                      className={`rounded-lg border px-3 py-2 ${
                        active ? "border-violet-500/50 bg-violet-500/10" : "border-gray-800 bg-gray-900/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[11px] font-medium text-gray-200">
                            {wf.name}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {formatUpdatedAt(wf.updatedAt)}
                          </div>
                        </div>
                        {active && (
                          <span className="rounded-full border border-violet-500/40 px-1.5 py-0.5 text-[9px] text-violet-300">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => void handleLoad(wf.id)}
                          disabled={busy}
                          className="flex-1 rounded-md bg-gray-800 px-2 py-1 text-[10px] text-gray-200 transition-colors hover:bg-gray-700 disabled:opacity-40"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => void handleDelete(wf.id)}
                          disabled={busy}
                          className="rounded-md border border-red-900 px-2 py-1 text-[10px] text-red-300 transition-colors hover:bg-red-950/50 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
