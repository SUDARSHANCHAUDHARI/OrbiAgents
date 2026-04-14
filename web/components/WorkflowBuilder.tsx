"use client";

import { useState, useEffect } from "react";
import { Workflow, WorkflowNode, WorkflowNodeType } from "@/lib/types";
import { listWorkflows, saveWorkflow, loadWorkflow, WorkflowMeta, getToken } from "@/lib/auth";
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

export default function WorkflowBuilder({
  workflow,
  onChange,
  onRun,
  running,
}: Props) {
  const [showPalette, setShowPalette] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedList, setSavedList] = useState<WorkflowMeta[]>([]);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const isLoggedIn = !!getToken();

  useEffect(() => {
    if (!isLoggedIn) return;
    listWorkflows().then(setSavedList).catch(() => {});
  }, [isLoggedIn]);

  async function handleSave(name: string) {
    await saveWorkflow(name, workflow);
    const updated = await listWorkflows();
    setSavedList(updated);
  }

  async function handleLoad(id: string) {
    const wf = await loadWorkflow(id);
    onChange(wf.data as Workflow);
    setShowLoadMenu(false);
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
    setShowPalette(false);
  }

  function removeNode(nodeId: string) {
    const idx = workflow.nodes.findIndex((n) => n.id === nodeId);
    if (idx === -1) return;

    // Rewire: if prev → removed → next, connect prev → next
    const prevEdge = workflow.edges.find((e) => e.to === nodeId);
    const nextEdge = workflow.edges.find((e) => e.from === nodeId);

    let edges = workflow.edges.filter(
      (e) => e.from !== nodeId && e.to !== nodeId
    );

    if (prevEdge && nextEdge) {
      edges = [...edges, { from: prevEdge.from, to: nextEdge.to }];
    }

    onChange({ nodes: workflow.nodes.filter((n) => n.id !== nodeId), edges });
  }

  const canRun = workflow.nodes.length > 0 && !running;

  return (
    <>
    {showSaveModal && (
      <SaveWorkflowModal
        onSave={handleSave}
        onClose={() => setShowSaveModal(false)}
      />
    )}
    <div className="bg-gray-900 border-t border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs uppercase tracking-wider">
            Workflow Builder
          </span>
          <span className="text-gray-600 text-xs">
            ({workflow.nodes.length} node{workflow.nodes.length !== 1 ? "s" : ""})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Load saved */}
          {isLoggedIn && savedList.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowLoadMenu((v) => !v)}
                disabled={running}
                className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-40"
              >
                ↓ Load
              </button>
              {showLoadMenu && (
                <div className="absolute bottom-full mb-2 left-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 min-w-[200px] max-h-48 overflow-y-auto">
                  {savedList.map((wf) => (
                    <button
                      key={wf.id}
                      onClick={() => handleLoad(wf.id)}
                      className="w-full px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 text-left truncate block"
                    >
                      {wf.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Save */}
          {isLoggedIn && (
            <button
              onClick={() => setShowSaveModal(true)}
              disabled={running || workflow.nodes.length === 0}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-40"
            >
              ↑ Save
            </button>
          )}

          {/* Add node */}
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

          {/* Run */}
          <button
            onClick={onRun}
            disabled={!canRun}
            className="px-4 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {running ? "Running…" : "▶ Run Workflow"}
          </button>
        </div>
      </div>

      {/* Node graph */}
      {workflow.nodes.length === 0 ? (
        <div className="flex items-center justify-center h-16 text-gray-600 text-xs border border-dashed border-gray-700 rounded-lg">
          Click "+ Add Node" to build your workflow
        </div>
      ) : (
        <div className="flex items-center gap-0 overflow-x-auto pb-1">
          {workflow.nodes.map((node, idx) => {
            const meta = NODE_META[node.type];
            const hasNext = idx < workflow.nodes.length - 1;

            return (
              <div key={node.id} className="flex items-center shrink-0">
                {/* Node box */}
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

                {/* Arrow to next node — animated when workflow is running */}
                {hasNext && (
                  <div className="flex items-center px-1">
                    <svg width="44" height="20" viewBox="0 0 44 20">
                      {/* Static base line */}
                      <line
                        x1="0" y1="10" x2="36" y2="10"
                        stroke="#374151" strokeWidth="1.5"
                      />
                      {/* Animated flow overlay */}
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
    </div>
    </>
  );
}
