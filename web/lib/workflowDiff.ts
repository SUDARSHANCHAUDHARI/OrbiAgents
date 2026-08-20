import { Workflow } from "./types";
export function workflowGraphDiff(before: Workflow, after: Workflow) {
  const bn=new Set(before.nodes.map(n=>n.id)), an=new Set(after.nodes.map(n=>n.id)); const key=(e:{from:string;to:string})=>`${e.from} → ${e.to}`; const be=new Set(before.edges.map(key)), ae=new Set(after.edges.map(key));
  return { addedNodes:Array.from(an).filter(id=>!bn.has(id)), removedNodes:Array.from(bn).filter(id=>!an.has(id)), addedEdges:Array.from(ae).filter(id=>!be.has(id)), removedEdges:Array.from(be).filter(id=>!ae.has(id)) };
}
