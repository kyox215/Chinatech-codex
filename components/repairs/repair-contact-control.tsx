"use client";
import { InputControl } from "@/components/input-control";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Phone, X } from "lucide-react";
import { useStaff } from "@/components/staff/use-staff";
import { useProcurement } from "@/components/procurement/procurement-provider";
import { initialRepairWorkflow, arrivalNotice, pickupNotice, isRepairReady, workflowGroup, quoteContactLabels, type QuoteContactOutcome, type WorkflowCommand } from "@/lib/repair-workflow";
import { useLocalIntakes } from "./local-intake-store";
import { itemQuoteTotal } from "@/lib/repair-item-pricing";
import type { RepairDirectoryEntry } from "@/lib/repair-intake-record";
import { useRepairWorkflows, updateRepairWorkflow } from "./repair-workflow-store";
type RepairContactControlProps = { order: RepairDirectoryEntry; variant?: "default" | "list" };
export function RepairContactControl(props:RepairContactControlProps) {const staff=useStaff();return <ScopedContactControl key={`${staff.member?.id}:${staff.member?.revision}`} {...props}/>;}
function ScopedContactControl({order,variant="default"}:RepairContactControlProps) {
  const canEdit=useStaff().can("repairs.edit");const {workflows}=useRepairWorkflows();const {records}=useProcurement();const workflow=workflows[order.id]??initialRepairWorkflow(order);
  const [open,setOpen]=useState(false);const ready=isRepairReady(workflow);const group=workflowGroup(order,records,workflow);const legacy=["awaiting_reply","collected_unpaid"].includes(workflow.status)&&!ready;
  const notice=ready?pickupNotice(workflow):arrivalNotice(workflow,records,order.id,order);
  const followUp=Boolean(workflow.followUp?.awaitingReply || workflow.followUp?.collectedUnpaid);
  const quoteActive = !["completed", "cancelled"].includes(workflow.status);
  const operationalNotice = ready || group === "arrival" || legacy;
  if(!quoteActive&&!operationalNotice&&!followUp&&!workflow.handedOver&&!workflow.quoteContact)return null;
  const facts=<>{operationalNotice?<span className="repair-contact__notice">{legacy?"旧跟进记录 · 维修结果待核对":notice}</span>:null}{workflow.quoteContact?<span className="repair-contact__quote" title={`上次报价沟通 ${workflow.quoteContact.time}`}>{quoteContactLabels[workflow.quoteContact.outcome]}</span>:null}{workflow.followUp?.awaitingReply?<small className="repair-contact__flag">久等未答复</small>:null}{workflow.followUp?.collectedUnpaid?<small className="repair-contact__flag repair-contact__flag--debt">已交还 · 欠款待跟进</small>:null}{workflow.handedOver ? <small className="repair-contact__history">有实际交还记录{workflow.handedOver.unpaid ? "（当时未结清）" : ""}</small> : null}</>;
  const canContact = canEdit && (!legacy || followUp);
  return <div className={`repair-contact${variant==="list"?" repair-contact--list":""}`}>
    {variant === "list" && canContact ? <button id={`repair-contact-${order.id}`} className="button button--secondary repair-contact__button" type="button" aria-label={`${order.id} 联系与跟进`} onClick={()=>setOpen(true)}>
      <span className="repair-contact__action"><Phone size={14} aria-hidden="true"/><span>跟进</span></span>
      <span className="repair-contact__facts">{facts}</span>
    </button> : <>
      {variant === "list" ? <div className="repair-contact__facts">{facts}</div> : facts}
      {canContact ? <button id={`repair-contact-${order.id}`} className="button button--secondary button--tiny" type="button" aria-label={`${order.id} 联系与跟进`} onClick={()=>setOpen(true)}><Phone size={14} aria-hidden="true"/>联系／跟进</button> : null}
    </>}
    {open&&canEdit?<ContactDialog order={order} onClose={()=>{setOpen(false);requestAnimationFrame(()=>document.getElementById(`repair-contact-${order.id}`)?.focus({preventScroll:true}));}}/>:null}
  </div>;
}
function ContactDialog({order,onClose}:{order:RepairDirectoryEntry;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);const {workflows,error:storageError}=useRepairWorkflows();const {records}=useProcurement();const workflow=workflows[order.id]??initialRepairWorkflow(order);
  const [revision]=useState(workflow.revision);const [note,setNote]=useState("");const [delivered,setDelivered]=useState(false);const [unpaid,setUnpaid]=useState(false);const [error,setError]=useState("");const [pending,setPending]=useState(false);const busy=useRef(false);
  const ready=isRepairReady(workflow);const notice=ready?pickupNotice(workflow):arrivalNotice(workflow,records,order.id,order);
  const quotes=useLocalIntakes().records.find(row=>row.id===order.id)?.itemQuotes;
  const total=itemQuoteTotal(quotes??[]);
  const quoteActive=!["completed","cancelled"].includes(workflow.status);
  const quoteHistory=workflow.events.filter(event=>event.type==="quote_contact");
  const canNotify=ready||(workflowGroup(order,records,workflow)==="arrival"&&["未通知送机","已通知送机"].includes(notice));
  useEffect(()=>{dialog.current?.showModal();},[]);
  async function save(command:WorkflowCommand){if(busy.current)return;busy.current=true;setPending(true);setError("");try{await updateRepairWorkflow(order,command,records,revision);onClose();}catch(reason){setError(reason instanceof Error?reason.message:"保存失败。");}finally{busy.current=false;setPending(false);}}
  return createPortal(<dialog ref={dialog} className="repair-parts-dialog repair-contact-dialog" aria-label="工单联系与跟进" onCancel={event=>{if(busy.current)event.preventDefault();}} onClose={onClose}><header><div><small>{order.id} · {order.device.model}</small><h2>联系与跟进</h2></div><button className="icon-button" type="button" aria-label="关闭联系跟进" disabled={pending} onClick={onClose}><X size={20}/></button></header><p className="repair-contact-dialog__context">{canNotify?notice:quoteActive?"报价沟通":"历史跟进"}</p>{quoteActive?<div className="repair-quote-context"><span>当前报价</span><strong>{quotes?.length?(total===null?"报价待补全":`€${(total/100).toFixed(2)}`):"未填写报价"}</strong>{workflow.quoteContact?<small>上次：{quoteContactLabels[workflow.quoteContact.outcome]} · {workflow.quoteContact.time}</small>:null}</div>:null}<label className="field"><span>沟通／跟进说明</span><InputControl disabled={pending} placeholder="例如：已告知报价，客户稍后回复" onClear={() => setNote("")} clearLabel="清空联系跟进说明" aria-label="联系跟进说明" value={note} maxLength={500} onChange={event=>setNote(event.target.value)}/></label>
    {quoteActive?<section className="repair-quote-actions" aria-label="报价沟通"><h3>记录报价沟通</h3><div>{(["contacted","unreachable","awaiting_reply"] as QuoteContactOutcome[]).map(outcome=><button key={outcome} type="button" className="button button--secondary" disabled={pending||Boolean(storageError)||!note.trim()} onClick={()=>void save({type:"quote_contact",outcome,note})}>{quoteContactLabels[outcome]}</button>)}</div><small>填写说明后记录；沟通结果不代表客户已同意维修。</small></section>:null}
    {canNotify?<div className="repair-requirement__actions"><button type="button" className="button button--primary" disabled={pending||Boolean(storageError)} onClick={()=>void save({type:ready?"pickup_notice":"arrival_notice",outcome:"notified",note})}>已实际成功通知{ready?"取机":"送机"}</button><button type="button" className="button button--secondary" disabled={pending||Boolean(storageError)} onClick={()=>void save({type:ready?"pickup_notice":"arrival_notice",outcome:"unreachable",note:note||"本次联系未接通。"})}>本次未接通</button></div>:null}
    {ready||workflow.followUp?.awaitingReply||workflow.followUp?.collectedUnpaid?<section className="repair-requirements"><h3>跟进与待收尾事项</h3>{ready||workflow.followUp?.awaitingReply?<button type="button" className="button button--secondary" disabled={pending||!note.trim()} onClick={()=>void save({type:"followup",flag:"awaitingReply",value:!workflow.followUp?.awaitingReply,note})}>{workflow.followUp?.awaitingReply?"结束久等未答复跟进":"标记久等未答复"}</button>:null}
      {workflow.followUp?.collectedUnpaid?<button type="button" className="button button--secondary" disabled={pending||!note.trim()} onClick={()=>void save({type:"followup",flag:"collectedUnpaid",value:false,note})}>结束欠款跟进</button>:ready?<><label className="repair-fact-check"><input type="checkbox" disabled={pending} checked={delivered} onChange={event=>setDelivered(event.target.checked)}/>已核对设备实际交还客户</label><label className="repair-fact-check"><input type="checkbox" disabled={pending} checked={unpaid} onChange={event=>setUnpaid(event.target.checked)}/>已核对仍有未结清款项</label><button type="button" className="button button--secondary" disabled={pending||!note.trim()||!delivered||!unpaid} onClick={()=>void save({type:"followup",flag:"collectedUnpaid",value:true,note,delivered,unpaid})}>记录欠款已拿走</button></>:null}
    </section>:null}
    {quoteHistory.length?<details className="repair-workflow-history"><summary>报价沟通历史 · {quoteHistory.length}</summary><ol className="detail-timeline">{quoteHistory.toReversed().map(event=><li key={event.id}><div><strong>{event.label}</strong><p>{event.note}</p><small>{event.time}</small></div></li>)}</ol></details>:null}
    {error||storageError?<p className="form-error" role="alert">{error||storageError}</p>:null}<footer><button className="button button--secondary" type="button" disabled={pending} onClick={onClose}>关闭</button></footer></dialog>,document.body);
}
