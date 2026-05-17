"use client";
import { useState } from "react";

const FRAMEWORKS = ["CrewAI", "AutoGen", "LangGraph", "Custom", "OpenAI Swarm"];

interface Agent { name: string; role: string; tools: string[]; responsibilities: string[]; }
interface AgentResult { systemName?: string; overview?: string; agents?: Agent[]; workflow?: string[]; implementationCode?: string; }

export default function OrbiAgentsPage() {
  const [goal, setGoal] = useState("");
  const [framework, setFramework] = useState("CrewAI");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState("");

  async function design() {
    if (!goal.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/design", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal, framework }) });
      const data = await res.json();
      if (data.error) setError(data.error); else setResult(data as AgentResult);
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-violet-400 mb-2">OrbiAgents</h1>
          <p className="text-slate-500">Design multi-agent systems — describe a goal, get a complete agent network blueprint</p>
        </div>
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-2">System Goal</label>
          <textarea className="w-full h-28 bg-[#111118] border border-violet-900 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-violet-600 resize-none" placeholder="e.g. Build a system that researches topics, writes articles, edits them, and publishes to a blog automatically..." value={goal} onChange={(e) => setGoal(e.target.value)} />
        </div>
        <div className="mb-6">
          <label className="block text-sm text-slate-400 mb-2">Framework</label>
          <div className="flex flex-wrap gap-2">{FRAMEWORKS.map((f) => <button key={f} onClick={() => setFramework(f)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${framework === f ? "bg-violet-800 text-violet-200 border border-violet-600" : "bg-[#111118] text-slate-400 border border-slate-700 hover:border-violet-900"}`}>{f}</button>)}</div>
        </div>
        <button onClick={design} disabled={loading || !goal.trim()} className="px-6 py-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors mb-6">{loading ? "Designing..." : "Design Agent System"}</button>
        {error && <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm mb-4">{error}</div>}
        {result && (
          <div className="space-y-5">
            {result.systemName && <h2 className="text-xl font-bold text-violet-300">{result.systemName}</h2>}
            {result.overview && <p className="text-slate-400 text-sm">{result.overview}</p>}
            {result.agents && (
              <div>
                <h3 className="text-slate-300 font-semibold text-sm mb-3">Agent Network</h3>
                <div className="grid grid-cols-2 gap-3">
                  {result.agents.map((a, i) => (
                    <div key={i} className="bg-[#111118] border border-violet-900/40 rounded-xl p-4">
                      <h4 className="text-violet-300 font-semibold mb-1">{a.name}</h4>
                      <p className="text-slate-400 text-xs mb-3">{a.role}</p>
                      <div className="mb-2">
                        <p className="text-xs text-slate-600 uppercase tracking-wider mb-1">Tools</p>
                        <div className="flex flex-wrap gap-1">{a.tools?.map((t, j) => <span key={j} className="px-1.5 py-0.5 bg-violet-900/30 text-violet-400 text-xs rounded">{t}</span>)}</div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 uppercase tracking-wider mb-1">Responsibilities</p>
                        <ul className="space-y-0.5">{a.responsibilities?.map((r, j) => <li key={j} className="text-slate-400 text-xs flex gap-1.5"><span className="text-violet-600">·</span>{r}</li>)}</ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.workflow && (
              <div className="bg-[#111118] border border-slate-700 rounded-xl p-4">
                <h3 className="text-slate-300 font-semibold text-sm mb-3">Workflow Steps</h3>
                <div className="space-y-2">
                  {result.workflow.map((step, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="w-6 h-6 rounded-full bg-violet-900/50 border border-violet-700 flex items-center justify-center text-violet-300 text-xs flex-shrink-0 mt-0.5">{i + 1}</div>
                      <p className="text-slate-300 text-sm">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.implementationCode && (
              <div className="bg-[#111118] border border-slate-700 rounded-xl overflow-hidden">
                <button onClick={() => setShowCode(!showCode)} className="w-full flex items-center justify-between p-4 text-left hover:bg-[#15151e] transition-colors">
                  <span className="text-slate-300 font-semibold text-sm">Implementation Code ({framework})</span>
                  <span className="text-slate-500 text-sm">{showCode ? "Hide" : "Show"}</span>
                </button>
                {showCode && <pre className="p-4 text-xs text-slate-300 font-mono overflow-x-auto border-t border-slate-700">{result.implementationCode}</pre>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
