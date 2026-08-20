"use client";

import React, { useEffect, useState } from "react";
import { getProposalHistory, getProposalSettings, proposeWorkflow, saveProposalSettings, setProposalStatus } from "@/lib/auth";
import { Workflow, WorkflowProposal, WorkflowProposalHistory, WorkflowProposalPolicy } from "@/lib/types";
import { workflowGraphDiff } from "@/lib/workflowDiff";

const POLICIES: WorkflowProposalPolicy[] = ["add-role", "remove-duplicate-role", "normalize-label"];

export default function WorkflowProposalPanel({ workflow, onApply, onClose }: { workflow: Workflow; onApply: (workflow: Workflow) => void; onClose: () => void }) {
  const [proposal, setProposal] = useState<WorkflowProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [policies, setPolicies] = useState<WorkflowProposalPolicy[]>(POLICIES); const [history, setHistory] = useState<WorkflowProposalHistory[]>([]);
  useEffect(() => { Promise.all([getProposalSettings(), getProposalHistory()]).then(([settings, records]) => { setPolicies(settings); setHistory(records); return proposeWorkflow(workflow); }).then(setProposal, (reason) => setError(reason instanceof Error ? reason.message : "Could not create proposal")); }, [workflow]);
  function apply() {
    if (!proposal?.changed || !window.confirm(`Apply this proposed workflow change?\n\n${proposal.summary}`)) return;
    onApply(proposal.workflow); if (proposal.id) void setProposalStatus(proposal.id, "applied"); onClose();
  }
  function dismiss() { if (proposal?.id) void setProposalStatus(proposal.id, "dismissed"); onClose(); }
  async function togglePolicy(policy: WorkflowProposalPolicy, checked: boolean) { const previous=policies;const next = checked ? [...policies, policy] : policies.filter((item) => item !== policy); setPolicies(next);setError(null);try{await saveProposalSettings(next);setProposal(await proposeWorkflow(workflow));}catch(reason){setPolicies(previous);setError(reason instanceof Error?reason.message:"Could not save proposal settings");} }
  const diff = proposal ? workflowGraphDiff(workflow, proposal.workflow) : null;
  return <aside aria-label="Orbi-Prime workflow proposal" style={{position:"absolute",inset:"16px 16px auto auto",zIndex:35,width:420,maxWidth:"calc(100% - 32px)",padding:16,border:"1px solid #7C3AED",borderRadius:12,background:"#0F172A",color:"#E5E7EB"}}>
    <header style={{display:"flex",justifyContent:"space-between"}}><strong>Orbi-Prime proposal</strong><button onClick={dismiss} aria-label="Close workflow proposal">✕</button></header>
    {error&&<p role="alert" style={{color:"#FCA5A5"}}>{error}</p>}{!proposal&&!error&&<p>Analyzing workflow…</p>}
    <fieldset style={{fontSize:11}}><legend>Enabled policies</legend>{POLICIES.map((policy)=><label key={policy} style={{display:"block"}}><input type="checkbox" checked={policies.includes(policy)} onChange={(event)=>void togglePolicy(policy,event.target.checked)}/> {policy}</label>)}</fieldset>
    {diff&&<details><summary style={{fontSize:11}}>Graph diff</summary>{Object.entries(diff).map(([key,values])=><div key={key} style={{fontSize:10}}><strong>{key}</strong>: {values.join(", ")||"none"}</div>)}</details>}
    {proposal&&<><h3 style={{fontSize:14}}>{proposal.summary}</h3><p style={{fontSize:12,color:"#CBD5E1"}}>{proposal.rationale}</p>{proposal.changes.length>0&&<ul style={{fontSize:12}}>{proposal.changes.map((change)=><li key={change}>{change}</li>)}</ul>}<p style={{fontSize:12}}>{proposal.workflow.nodes.length} nodes · {proposal.workflow.edges.length} edges</p><button onClick={apply} disabled={!proposal.changed} style={{padding:"8px 12px",background:proposal.changed?"#6D28D9":"#374151",color:"white",border:0,borderRadius:6}}>Review and apply…</button></>}
    <p style={{fontSize:11,color:"#94A3B8"}}>Nothing changes until you explicitly confirm.</p>
    {history.length>0&&<details><summary style={{fontSize:11}}>Recent proposal history</summary>{history.slice(0,5).map((item)=><div key={item.id} style={{fontSize:10,marginTop:6}}>{item.status} · {item.summary}{item.beforeWorkflow&&<><div>{item.beforeWorkflow.nodes.length}→{item.proposal.workflow.nodes.length} nodes · {item.beforeWorkflow.edges.length}→{item.proposal.workflow.edges.length} edges</div><button onClick={()=>{if(item.beforeWorkflow&&window.confirm(`Restore the workflow from before: ${item.summary}?`)){onApply(item.beforeWorkflow);onClose();}}}>Preview and restore…</button></>}</div>)}</details>}
  </aside>;
}
