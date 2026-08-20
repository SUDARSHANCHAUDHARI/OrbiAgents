"use client";

import React, { useEffect, useState } from "react";
import { proposeWorkflow } from "@/lib/auth";
import { Workflow, WorkflowProposal } from "@/lib/types";

export default function WorkflowProposalPanel({ workflow, onApply, onClose }: { workflow: Workflow; onApply: (workflow: Workflow) => void; onClose: () => void }) {
  const [proposal, setProposal] = useState<WorkflowProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { proposeWorkflow(workflow).then(setProposal, (reason) => setError(reason instanceof Error ? reason.message : "Could not create proposal")); }, [workflow]);
  function apply() {
    if (!proposal?.changed || !window.confirm(`Apply this proposed workflow change?\n\n${proposal.summary}`)) return;
    onApply(proposal.workflow); onClose();
  }
  return <aside aria-label="Orbi-Prime workflow proposal" style={{position:"absolute",inset:"16px 16px auto auto",zIndex:35,width:420,maxWidth:"calc(100% - 32px)",padding:16,border:"1px solid #7C3AED",borderRadius:12,background:"#0F172A",color:"#E5E7EB"}}>
    <header style={{display:"flex",justifyContent:"space-between"}}><strong>Orbi-Prime proposal</strong><button onClick={onClose} aria-label="Close workflow proposal">✕</button></header>
    {error&&<p role="alert" style={{color:"#FCA5A5"}}>{error}</p>}{!proposal&&!error&&<p>Analyzing workflow…</p>}
    {proposal&&<><h3 style={{fontSize:14}}>{proposal.summary}</h3><p style={{fontSize:12,color:"#CBD5E1"}}>{proposal.rationale}</p>{proposal.changes.length>0&&<ul style={{fontSize:12}}>{proposal.changes.map((change)=><li key={change}>{change}</li>)}</ul>}<p style={{fontSize:12}}>{proposal.workflow.nodes.length} nodes · {proposal.workflow.edges.length} edges</p><button onClick={apply} disabled={!proposal.changed} style={{padding:"8px 12px",background:proposal.changed?"#6D28D9":"#374151",color:"white",border:0,borderRadius:6}}>Review and apply…</button></>}
    <p style={{fontSize:11,color:"#94A3B8"}}>Nothing changes until you explicitly confirm.</p>
  </aside>;
}
