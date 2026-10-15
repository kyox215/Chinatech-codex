"use client";

import { useId, useState, type ReactNode } from "react";
import { Wrench, PackageSearch, ImagePlus, History, Monitor, Battery, Cable, Phone, UserRound, Package } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useStaff } from "@/components/staff/use-staff";
import { SelectControl } from "@/components/select-control";
import { RepairProcurementDialog } from "@/components/procurement/repair-procurement-shortcut";
import { RepairProcurementSummary } from "@/components/procurement/procurement-summary";
import { useProcurement } from "@/components/procurement/procurement-provider";
import { procurementEventLabel, procurementStatus, procurementStatuses } from "@/lib/procurement";
import { repairProgress, initialRepairWorkflow } from "@/lib/repair-workflow";
import { currentRepairRequirements } from "@/lib/repair-requirements";
import { repairDetailProjects } from "@/lib/repair-detail-view";
import { itemQuoteTotal } from "@/lib/repair-item-pricing";
import { repairActivityLabel, repairItemText, repairKnownText } from "@/lib/i18n/repair-display";
import { printIssue } from "@/lib/print-language";
import type { IntakeReceiptData, RepairDirectoryEntry } from "@/lib/repair-intake-record";
import { useLocalIntakes } from "./local-intake-store";
import { useRepairWorkflows } from "./repair-workflow-store";
import { RepairWorkflowPanel } from "./repair-workflow-panel";
import { RepairContactControl } from "./repair-contact-control";
import { IntakeSignatureSection } from "./intake-signature";
import { IntakeReview } from "./intake-review";
import { RepairPhotoRegistry } from "./repair-photo-registry";
import type { IntakePhoto } from "./intake-photos";
import styles from "./repair-detail-workspace.module.css";

const tabs = [{id:"repair",label:"维修",icon:Wrench},{id:"suppliers",label:"供应商",icon:PackageSearch},{id:"photos",label:"照片",icon:ImagePlus},{id:"history",label:"历史",icon:History}] as const;
type Tab = typeof tabs[number]["id"];

export function RepairDetailWorkspace({data,order,photos,metadata}:{data:IntakeReceiptData;order:RepairDirectoryEntry;photos:IntakePhoto[];metadata:ReactNode}) {
  const {t,locale}=useLanguage(); const canEdit=useStaff().can("repairs.edit");
  const {records}=useProcurement(); const {workflows}=useRepairWorkflows(); const {signatures}=useLocalIntakes();
  const workflow=workflows[data.id];
  const progress=repairProgress(order,records,workflow??initialRepairWorkflow(order));
  const purchases=records.filter(row=>row.repairId===data.id);
  const requirements=currentRepairRequirements(order,workflow);
  const projects=repairDetailProjects(data,requirements,purchases);
  const [tab,setTab]=useState<Tab>("repair");
  const [active,setActive]=useState<{requirementId?:string;recordId?:string}|null>(null);
  const prefix=useId();
  const issue=printIssue(data,locale==="zh-CN"?"zh":locale);
  const issueText=locale==="zh-CN"?data.issue:[...issue.faults,issue.note].filter(Boolean).join("; ");
  const total=itemQuoteTotal(data.itemQuotes,requirements.map(row=>row.title));
  const money=(amount:number|null|undefined)=>amount==null?t("未报价"):`€${(amount/100).toFixed(2)}`;
  const ownSignatures=signatures.filter(row=>row.orderId===data.id);
  const historyCount=(workflow?.events.length??0)+(data.itemQuoteHistory?.length??0)+purchases.reduce((n,p)=>n+p.events.length,0)+ownSignatures.length+1;
  const counts={repair:requirements.length,suppliers:purchases.length,photos:data.photoCount,history:historyCount};
  const customer=<section className={`panel ${styles.facts}`}><h3><UserRound size={18}/>{t("客户联系")}</h3><strong>{data.customerName||t("未填写姓名")}</strong>{data.phone?<a href={`tel:${data.phone.replace(/[^+\d]/g,"")}`}><Phone size={16}/>{data.phone}</a>:null}{data.email?<span>{data.email}</span>:null}<p>{t("接收时间")} · {data.createdAt}</p><p>{t("负责人")} · {order.technician&&order.technician!=="未分配"?order.technician:t("未分配")}</p><h4><Package size={16}/>{t("随件")}</h4><p>{data.accessories.length?data.accessories.map(v=>repairKnownText(v,locale)).join(" · "):t("无随件")}</p></section>;
  const sections=<div className={styles.workspace}>
    <nav role="tablist" className={`segmented-control ${styles.tabs}`} aria-label={t("工单详情分组")}>{tabs.map((item,index)=><button key={item.id} type="button" role="tab" id={`${prefix}-${item.id}`} aria-controls={`${prefix}-panel-${item.id}`} aria-selected={tab===item.id} tabIndex={tab===item.id?0:-1} className={tab===item.id?"segmented-control__active":""} onClick={()=>setTab(item.id)} onKeyDown={event=>{const next=event.key==="ArrowRight"?(index+1)%4:event.key==="ArrowLeft"?(index+3)%4:event.key==="Home"?0:event.key==="End"?3:-1;if(next>=0){event.preventDefault();setTab(tabs[next].id);document.getElementById(`${prefix}-${tabs[next].id}`)?.focus();}}}><item.icon size={17}/><span>{t(item.label)}</span><small>{counts[item.id]}</small></button>)}</nav>
    <div role="tabpanel" id={`${prefix}-panel-repair`} aria-labelledby={`${prefix}-repair`} hidden={tab!=="repair"} className={styles.repairPanel}>
      <div className={styles.main} data-repair-main>
        <section className={`panel ${styles.section}`} aria-label={t("故障与维修需求")}>
          <header className={styles.sectionHead}><h3><Wrench size={18}/>{t("故障与维修需求")}</h3><RepairContactControl order={order}/></header>
          <p className={styles.issue}><small>{t("故障报告")}</small>{issueText}</p>
          <div className={styles.projectScroll}><div className={styles.tableHead}><span>{t("项目及要求")}</span><span>{t("客户报价")}</span><span>{t("供应商")}</span><span>{t("采购进度")}</span></div>
          {projects.rows.map(row=>{const Icon=row.title==="屏幕"?Monitor:row.title==="电池"?Battery:row.title==="尾插"?Cable:Wrench;const stale=row.purchases.some(p=>p.requirementRevision!==row.requirement.revision||row.requirement.mode!=="parts");return <article key={row.id} className={styles.project} data-repair-project={row.id}>
            <div className={styles.projectName}><Icon size={20}/><div><strong>{repairItemText(row.title,locale)}</strong>{row.request?<small>{repairItemText(row.request,locale)}</small>:null}{row.requirement.mode==="none"?<small>{t("无需采购")}</small>:null}{stale||row.ambiguous?<small className="form-error">{t("项目关联待核对")}</small>:null}</div></div>
            <button className={styles.quote} type="button" disabled={!canEdit||row.ambiguous} onClick={()=>setActive({requirementId:row.id})} aria-label={t("修改{v0}报价",{v0:repairItemText(row.title,locale)})}><small>{t("客户报价")}</small><strong>{money(row.quote?.amountCents)}</strong></button>
            <button className={styles.supplier} type="button" disabled={!canEdit} onClick={()=>setActive({requirementId:row.id,recordId:row.purchases.length===1?row.purchases[0].id:undefined})} aria-label={t("选择{v0}供应商",{v0:repairItemText(row.title,locale)})}><small>{t("供应商")}</small><strong>{row.purchases.length?row.purchases.map(p=>p.supplier).join(" · "):t(row.requirement.mode==="none"?"无需采购":"选择供应商")}</strong></button>
            <div className={styles.projectState}>{row.purchases.length?row.purchases.map(p=><span key={p.id} className={`status-pill status-pill--${procurementStatuses[procurementStatus(p)].tone}`}>{t(procurementStatuses[procurementStatus(p)].label)}{row.purchases.length>1?<small> · {p.id}</small>:null}</span>):<span className="status-pill status-pill--neutral">{t(row.requirement.mode==="none"?"无需采购":"未下单")}</span>}</div>
          </article>;})}</div>
          {!projects.rows.length?<div className="section-empty"><strong>{t("工单尚未填写维修项目")}</strong>{canEdit?<button className="button button--secondary" type="button" onClick={()=>setActive({})}>{t("添加维修项目")}</button>:null}</div>:null}
          {projects.unmatchedQuotes.length?<div className={styles.unmatched}><h4>{t("历史报价待核对")}</h4>{projects.unmatchedQuotes.map(row=><p key={row.item}><span>{repairItemText(row.item,locale)}</span><strong>{money(row.amountCents)}</strong></p>)}</div>:null}
          {projects.unmatchedPurchases.length?<p className={styles.note}>{t("有未关联当前项目的采购，请在供应商分组核对。")}</p>:null}
          <div className={styles.total} aria-label={t("维修报价")}><strong>{t("报价合计")}</strong><strong>{total===null?t("待补全报价"):money(total)}</strong></div>
        </section>
        <details className={`panel ${styles.mobileFacts}`}><summary>{t("工单概况与客户资料")}</summary><RepairWorkflowPanel repairId={data.id} showContact={false} showHistory={false}/>{customer}</details>
        <IntakeSignatureSection data={data} embedded/>
      </div>
      <aside className={styles.desktopFacts}><RepairWorkflowPanel repairId={data.id} showContact={false} showHistory={false}/>{customer}</aside>
    </div>
    <div role="tabpanel" id={`${prefix}-panel-suppliers`} aria-labelledby={`${prefix}-suppliers`} hidden={tab!=="suppliers"}><RepairProcurementSummary repairId={data.id}/></div>
    <div role="tabpanel" id={`${prefix}-panel-photos`} aria-labelledby={`${prefix}-photos`} hidden={tab!=="photos"}><RepairPhotoRegistry data={data} photos={photos} active={tab==="photos"}/></div>
    <div role="tabpanel" id={`${prefix}-panel-history`} aria-labelledby={`${prefix}-history`} hidden={tab!=="history"}><RepairDetailHistory data={data}/></div>
    {active?<RepairProcurementDialog repairId={data.id} initialRequirementId={active.requirementId} initialRecordId={active.recordId} onClose={()=>setActive(null)}/>:null}
  </div>;
  return <IntakeReview data={data} photos={[]} layout="detail" metadata={metadata} statusContent={<span className={`status-pill status-pill--${progress.tone}`}>{t(progress.label)}</span>} detailContent={sections}/>;
}

function RepairDetailHistory({data}:{data:IntakeReceiptData}) {
  const {t,locale}=useLanguage(); const {records}=useProcurement(); const {workflows}=useRepairWorkflows(); const {signatures}=useLocalIntakes();
  const [filter,setFilter]=useState("all");
  const events=[
    {id:"intake",kind:"intake",time:data.createdAt,title:t("接机资料已登记"),note:""},
    ...(data.itemQuoteHistory??[]).map(e=>({id:`quote:${e.id}`,kind:"quote",time:e.time,title:`${repairItemText(e.item,locale)} · ${t("报价")} ${e.previousCents===null?t("未报价"):`€${(e.previousCents/100).toFixed(2)}`} → ${e.amountCents===null?t("未报价"):`€${(e.amountCents/100).toFixed(2)}`}`,note:""})),
    ...(workflows[data.id]?.events??[]).map(e=>({id:`workflow:${e.id}`,kind:e.type==="quote_contact"||e.type==="followup"||e.type==="arrival_notice"||e.type==="pickup_notice"?"contact":"workflow",time:e.time,title:repairActivityLabel(e,locale),note:e.note??""})),
    ...records.filter(p=>p.repairId===data.id).flatMap(p=>p.events.map(e=>({id:`purchase:${p.id}:${e.id}`,kind:"purchase",time:e.time,title:`${repairItemText(p.item,locale)} · ${t(procurementEventLabel(e))}`,note:e.note??""}))),
    ...signatures.filter(e=>e.orderId===data.id).map(e=>({id:`signature:${e.id}`,kind:"intake",time:e.signedAt,title:t("客户签名"),note:""})),
  ].sort((a,b)=>b.time.localeCompare(a.time)||a.id.localeCompare(b.id));
  return <section className={`panel ${styles.section}`}><header className={styles.sectionHead}><h3><History size={18}/>{t("操作历史")}</h3><SelectControl aria-label={t("历史来源筛选")} value={filter} onChange={e=>setFilter(e.target.value)}>{[["all","全部"],["quote","项目与报价"],["purchase","采购与到货"],["contact","联系与跟进"],["workflow","维修状态"],["intake","登记与签名"]].map(([id,label])=><option key={id} value={id}>{t(label)}</option>)}</SelectControl></header><ol className={`detail-timeline ${styles.timeline}`}>{events.filter(e=>filter==="all"||e.kind===filter).map(e=><li key={e.id}><i className="timeline-dot timeline-dot--info"/><div><strong>{e.title}</strong>{e.note?<p>{e.note}</p>:null}<small>{e.time}</small></div></li>)}</ol>{!events.some(e=>filter==="all"||e.kind===filter)?<p className={styles.note}>{t("暂无此类历史")}</p>:null}</section>;
}
