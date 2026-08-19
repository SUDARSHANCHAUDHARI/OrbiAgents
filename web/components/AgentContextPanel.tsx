"use client";
import { useEffect, useState } from "react";
import { createMemory, listInbox, listMemory, markMailboxMessageRead, sendMailboxMessage } from "@/lib/auth";
import { MailboxMessage, MemoryEntry, MemoryScope, MessageKind } from "@/lib/types";

export default function AgentContextPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"memory" | "mailbox">("memory");
  const [agentId, setAgentId] = useState("1");
  const [scope, setScope] = useState<MemoryScope>("agent");
  const [content, setContent] = useState("");
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [messages, setMessages] = useState<MailboxMessage[]>([]);
  const [recipient, setRecipient] = useState("2");
  const [kind, setKind] = useState<MessageKind>("inform");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void refresh(); }, [tab, scope, agentId]);
  async function refresh() { setError(null); try { tab === "memory" ? setMemories(await listMemory(scope, scope === "agent" ? agentId : undefined)) : setMessages(await listInbox(agentId)); } catch (e) { setError(e instanceof Error ? e.message : "Could not load context"); } }
  async function save() { if (!content.trim()) return; setBusy(true); setError(null); try { if (tab === "memory") await createMemory(scope, content, agentId); else await sendMailboxMessage({ senderAgentId: agentId, recipientAgentId: recipient, kind, body: content }); setContent(""); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Operation failed"); } finally { setBusy(false); } }
  return <aside aria-label="Agent memory and mailbox" style={{ position:"absolute", inset:"16px 16px 16px auto", zIndex:31, width:420, maxWidth:"calc(100% - 32px)", overflow:"auto", padding:16, borderRadius:12, border:"1px solid #374151", background:"#0F172A", boxShadow:"0 18px 40px rgba(0,0,0,.45)" }}>
    <header style={{display:"flex",justifyContent:"space-between"}}><strong>Agent context</strong><button onClick={onClose} aria-label="Close agent context" style={{background:"transparent",border:0,color:"white"}}>✕</button></header>
    <div style={{display:"flex",gap:8,margin:"12px 0"}}>{(["memory","mailbox"] as const).map(value=><button key={value} onClick={()=>setTab(value)} style={{padding:"7px 10px",borderRadius:6,border:"1px solid #475569",background:tab===value?"#1D4ED8":"#111827",color:"white"}}>{value.toUpperCase()}</button>)}</div>
    <label style={{fontSize:12}}>Agent <input value={agentId} onChange={e=>setAgentId(e.target.value)} style={{marginLeft:8,width:70,background:"#111827",color:"white",border:"1px solid #475569",padding:6}} /></label>
    {tab === "memory" ? <select value={scope} onChange={e=>setScope(e.target.value as MemoryScope)} style={{marginLeft:8,padding:6}}><option value="agent">Agent memory</option><option value="shared">Shared memory</option></select> : <><label style={{marginLeft:8,fontSize:12}}>To <input value={recipient} onChange={e=>setRecipient(e.target.value)} style={{width:60,padding:6}} /></label><select value={kind} onChange={e=>setKind(e.target.value as MessageKind)} style={{marginLeft:8,padding:6}}>{["request","inform","propose","query","agree","refuse","done"].map(v=><option key={v}>{v}</option>)}</select></>}
    <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder={tab === "memory" ? "Add a durable memory…" : "Send a message…"} style={{display:"block",width:"100%",minHeight:80,boxSizing:"border-box",margin:"12px 0",padding:10,background:"#111827",color:"white",border:"1px solid #475569",borderRadius:8}} />
    <button onClick={()=>void save()} disabled={busy||!content.trim()} style={{padding:"8px 12px",background:"#2563EB",color:"white",border:0,borderRadius:6}}>{busy?"SAVING…":tab==="memory"?"SAVE MEMORY":"SEND MESSAGE"}</button>
    {error&&<p role="alert" style={{color:"#FCA5A5"}}>{error}</p>}
    <div style={{display:"grid",gap:8,marginTop:14}}>{tab==="memory"?memories.map(item=><article key={item.id} style={{padding:9,background:"#111827",border:"1px solid #374151",borderRadius:7,fontSize:12}}>{item.content}</article>):messages.map(item=><article key={item.id} style={{padding:9,background:"#111827",border:"1px solid #374151",borderRadius:7,fontSize:12}}><strong>{item.senderAgentId} → {item.recipientAgentId} · {item.kind}</strong><p>{item.body}</p>{item.status!=="read"&&<button onClick={async()=>{await markMailboxMessageRead(item.id);await refresh();}}>Mark read</button>}</article>)}</div>
  </aside>;
}
