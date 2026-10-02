"use client";
import { useEffect, useRef, useState } from "react";
import { backendSnapshot, isBackendClient } from "@/lib/backend/client";
import { draftScope, listDeviceDrafts, removeDeviceDraft, saveDeviceDraft, type DeviceDraft } from "@/lib/backend/recovery-store";
import { SelectControl } from "./select-control";

// Each mounted editor owns an independent draft. Restoring copies input, never
// replays commands or replaces another tab's draft. Account + capabilities scope
// must match the currently authenticated server snapshot.
export function useDeviceDraft<T>(form:string,data:T,restore:(data:T)=>void,active=true) {
  const [id]=useState(()=>crypto.randomUUID());
  const [scope]=useState(()=>{const state=backendSnapshot();return isBackendClient()&&state?draftScope(state):null;});
  const signature=JSON.stringify(data);
  const [initial]=useState(signature);
  const [candidates,setCandidates]=useState<DeviceDraft<T>[]>([]);
  const [status,setStatus]=useState("");
  const queue=useRef(Promise.resolve());
  const suppressed=useRef<string|null>(null);
  const queued=useRef(`${active}:${initial}`);
  const sequence=useRef(0);
  const pending=useRef(false);
  const latest=useRef({data,restore,signature});
  useEffect(()=>{latest.current={data,restore,signature};});
  useEffect(()=>{
    if(!scope)return;
    let live=true;
    void listDeviceDrafts<T>(scope,form).then(rows=>{if(live)setCandidates(rows.filter(row=>row.id!==id));}).catch(error=>{if(live)setStatus(error.message);});
    return()=>{live=false;};
  },[scope,form,id]);
  useEffect(()=>{
    const key=`${active}:${signature}`;
    if(!scope || key===queued.current)return;
    queued.current=key;
    const ticket=++sequence.current;
    pending.current=true;
    const value=latest.current.data;
    queueMicrotask(()=>setStatus("正在保存设备草稿…"));
    // Serialize writes: a slow earlier save cannot replace more recent input.
    queue.current=queue.current.catch(()=>{}).then(async()=>{
      if(ticket!==sequence.current)return;
      const state=backendSnapshot();if(!state || draftScope(state)!==scope)return;
      if(signature===initial || signature===suppressed.current || !active)await removeDeviceDraft(id);
      else await saveDeviceDraft({id,scope,form,version:1,updatedAt:Date.now(),data:value});
      if(ticket===sequence.current){pending.current=false;setStatus(signature===initial || signature===suppressed.current || !active?"":"草稿已保存在此设备，尚未提交门店。");}
    }).catch(()=>{if(ticket===sequence.current)setStatus("草稿未能保存到设备，请保持页面打开并检查存储空间。");});
  },[signature,scope,form,id,initial,active]);
  useEffect(()=>{
    const leave=(event:BeforeUnloadEvent)=>{if(pending.current){event.preventDefault();event.returnValue="";}};
    window.addEventListener("beforeunload",leave);return()=>window.removeEventListener("beforeunload",leave);
  },[]);
  async function clear(next?:T){
    const signature=next===undefined?latest.current.signature:JSON.stringify(next);
    suppressed.current=signature;
    const ticket=++sequence.current;pending.current=true;
    // Removal joins the same queue. Later input must be written AFTER this clear.
    queue.current=queue.current.catch(()=>{}).then(async()=>{
      if(scope)await removeDeviceDraft(id);
      if(ticket===sequence.current){pending.current=false;setStatus("");}
    }).catch(()=>{if(ticket===sequence.current){pending.current=false;setStatus("业务已保存，设备草稿清理失败；恢复旧草稿仍需核对版本。");}});
    await queue.current;
  }
  function recover(draftId:string){
    const state=backendSnapshot();if(!state || draftScope(state)!==scope)return;
    const draft=candidates.find(row=>row.id===draftId);if(!draft)return;
    try{latest.current.restore(structuredClone(draft.data));setStatus("已恢复输入，请核对最新资料后确认提交。");}
    catch{setStatus("此草稿格式无法恢复，原资料已保留。");}
  }
  async function discard(draftId:string){await removeDeviceDraft(draftId);setCandidates(rows=>rows.filter(row=>row.id!==draftId));}
  return {enabled:!!scope,status,candidates,recover,discard,clear};
}
export function DeviceDraftNotice({draft}:{draft:Omit<ReturnType<typeof useDeviceDraft>,"clear">}) {
  const [selected,setSelected]=useState("");
  const [error,setError]=useState("");
  if(!draft.enabled)return null;
  const chosen=selected||draft.candidates[0]?.id||"";
  return <section className="device-draft" aria-label="设备草稿">
    {draft.status?<p role="status">{draft.status}</p>:null}
    {draft.candidates.length?<div className="sync-recovery__actions"><label className="field"><span>此账号在本设备的草稿</span><SelectControl aria-label="选择设备草稿" value={chosen} onChange={event=>setSelected(event.target.value)}>{draft.candidates.map(row=><option key={row.id} value={row.id}>{new Date(row.updatedAt).toLocaleString()} · {row.id.slice(0,6)}</option>)}</SelectControl></label><button type="button" className="button button--secondary" onClick={()=>draft.recover(chosen)}>恢复草稿</button><button type="button" className="button button--secondary" onClick={()=>{void draft.discard(chosen).then(()=>setSelected("")).catch(()=>setError("草稿删除失败，原资料仍保留。"));}}>删除所选草稿</button></div>:null}
    {error?<p className="form-error" role="alert">{error}</p>:null}
  </section>;
}
