"use client";

import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { SelectControl } from "@/components/select-control";
import { useRef, useState } from "react";
import { CheckCircle2, ClipboardList, FileClock, PackageCheck, PackageSearch, PencilLine, Truck } from "lucide-react";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { arrivalBalance, arrivedQuantity, formatCost, isPreorder, procurementEventLabel, procurementStatus, procurementStatuses, type ProcurementRecord } from "@/lib/procurement";
import { useProcurement } from "./procurement-provider";
import { ProcurementFeedback, ProcurementPreparation } from "./procurement-preparation";
import { useStaff } from "@/components/staff/use-staff";

function previewTime() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" }).format(new Date());
}

export function ProcurementActions({ record, embedded = false }: { record: ProcurementRecord; embedded?: boolean }) {
  const canEdit = useStaff().can("repairs.edit");
  const { dispatch } = useProcurement();
  const [mode, setMode] = useState<"arrival" | "correction">("arrival");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const arrivals = record.events.filter((event) => event.type === "arrival");
  const [arrivalId, setArrivalId] = useState(arrivals[0]?.id ?? "");
  const preorder = isPreorder(record);
  const remaining = record.quantity - arrivedQuantity(record);
  const busy = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  async function append(type: "arrival" | "correction") {
    if (!canEdit || busy.current) return;
    busy.current = true;
    setSubmitting(true);
    try {await dispatch({ type: "append", id: record.id, revision: record.events.length, event: { id: crypto.randomUUID(), type, time: previewTime(), quantity: quantity.trim() ? Number(quantity) : Number.NaN, note, arrivalId: type === "correction" ? arrivalId : undefined } });} catch { /* Provider retains operation failure feedback. */ }
    finally { busy.current = false; setSubmitting(false); }
  }

  if (!canEdit) return <section className={`panel procurement-actions${embedded ? " procurement-actions--embedded" : ""}`}><div className="detail-section__head"><div><span><PackageCheck size={18} /></span><h3>配件进度</h3></div></div><div className="procurement-actions__body"><p className="procurement-action-hint">{procurementStatuses[procurementStatus(record)].label} · {arrivedQuantity(record)} / {record.quantity} 件已到货</p></div></section>;
  return <section className={`panel procurement-actions${embedded ? " procurement-actions--embedded" : ""}`}>
    <div className="detail-section__head"><div><span><PackageCheck size={18} /></span><div><h3>{preorder ? "配件标记" : "登记到货"}</h3></div></div></div>
    {preorder ? <div className="procurement-actions__body"><ProcurementPreparation key={record.id} record={record} /></div> : <div className="procurement-actions__body">
      <ProcurementFeedback recordId={record.id} />
      <div className="segmented-control procurement-mode" aria-label="到货操作"><button type="button" disabled={submitting} className={mode === "arrival" ? "segmented-control__active" : ""} aria-pressed={mode === "arrival"} onClick={() => { setMode("arrival"); setQuantity(""); setNote(""); }}>本次到货</button><button type="button" className={mode === "correction" ? "segmented-control__active" : ""} aria-pressed={mode === "correction"} onClick={() => { setMode("correction"); setQuantity(""); setNote(""); setArrivalId(arrivals[0]?.id ?? ""); }} disabled={submitting || !arrivals.length}>更正历史</button></div>
      {mode === "arrival" && remaining === 0 ? <div className="section-empty"><CheckCircle2 size={24} /><div><strong>本条采购已到齐</strong><p>如有误记，使用“更正历史”追加调整。</p></div></div> : <form noValidate aria-busy={submitting} onSubmit={(event) => { event.preventDefault(); void append(mode); }}>
        {mode === "correction" ? <label className="field"><span>原到货批次</span><SelectControl disabled={submitting} aria-label="原到货批次" value={arrivalId} onChange={(event) => setArrivalId(event.target.value)}>{arrivals.map((event, index) => <option value={event.id} key={event.id}>第 {index + 1} 批 · {event.time} · 当前 {arrivalBalance(record, event.id)} 件</option>)}</SelectControl></label> : null}
        <label className="field"><span>{mode === "arrival" ? `本次到货数量（剩余 ${remaining} 件）` : "调整数量（增加填正数，减少填负数）"}</span><input disabled={submitting} aria-label={mode === "arrival" ? "本次到货数量" : "调整数量"} type="number" inputMode={mode === "arrival" ? "numeric" : undefined} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder={mode === "arrival" ? "例如 1" : "例如 -1"} /></label>
        <label className="field"><span>{mode === "correction" ? "更正原因（必填）" : "到货备注（选填）"}</span><textarea disabled={submitting} aria-label={mode === "correction" ? "更正原因" : "到货备注"} value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} placeholder={mode === "correction" ? "说明误记原因，原记录不会被删除" : "包裹、型号或核对情况"} /></label>
        <button className="button button--primary" type="submit" disabled={submitting}>{mode === "arrival" ? <PackageCheck size={17} /> : <PencilLine size={17} />}{submitting ? "正在保存…" : mode === "arrival" ? "追加本次到货" : "追加更正记录"}</button>
      </form>}
    </div>}
  </section>;
}

export function ProcurementDetail({ id }: { id: string }) {
  const canCost=useStaff().can("financial.read");
  const { records } = useProcurement();
  const repairOrders = useRepairDirectory();
  const record = records.find((row) => row.id === id);
  if (!record) return <main className="module-page"><header className="module-heading"><PageTitle title="采购记录" backHref="/app/procurement" backLabel="返回采购列表" /></header><div className="panel module-empty"><PackageSearch size={28} /><strong>没有找到采购记录</strong><p>请在创建记录的浏览器查看，或返回关联工单核对。</p><Link className="button button--primary" href="/app/procurement">返回采购列表</Link></div></main>;
  const repair = repairOrders.find(repair => repair.id === record.repairId);
  const arrived = arrivedQuantity(record);
  const status = procurementStatuses[procurementStatus(record)];
  return <main className="module-page procurement-detail">
    <header className="module-heading module-heading--compact"><PageTitle title={record.id} backHref="/app/procurement" backLabel="返回采购列表" badge={<span className={`status-pill status-pill--${status.tone}`}>{status.label}</span>} subtitle={`${record.item} · ${record.supplier}`} /><Link className="button button--secondary button--compact page-toolbar-action" href={`/app/repairs/${record.repairId}`} aria-label="关联工单" title="关联工单"><ClipboardList size={17} /><span>关联工单</span></Link></header>
    
    <section className="detail-metrics procurement-metrics" aria-label="采购摘要"><article><span><PackageSearch size={18} /></span><div><small>采购数量</small><strong>{record.quantity} 件</strong></div></article><article><span><PackageCheck size={18} /></span><div><small>已到货 / 待到货</small><strong data-testid="arrival-summary">{arrived} / {record.quantity - arrived} 件</strong></div></article><article><span><Truck size={18} /></span><div><small>预计到货</small><strong>{record.expectedAt || "待确认"}</strong></div></article>{canCost?<article><span><FileClock size={18} /></span><div><small>采购总额</small><strong>{formatCost(record.unitCostCents === null ? null : record.unitCostCents * record.quantity)}</strong></div></article>:null}</section>
    <div className="procurement-detail-grid"><div className="repair-detail-main">
      <section className="panel detail-section"><div className="detail-section__head"><div><span><PackageSearch size={18} /></span><div><h3>采购资料</h3></div></div></div><div className="device-facts"><span className="device-facts__wide"><small>配件名称</small><strong>{record.item}</strong></span><span><small>用途</small><strong>{record.required === false ? "备选，不阻塞本单" : "本单必需配件"}</strong></span><span><small>供应商</small><strong>{record.supplier}</strong></span>{record.reference ? <span><small>历史订单号</small><strong>{record.reference}</strong></span> : null}{canCost?<span><small>采购单价</small><strong>{formatCost(record.unitCostCents)}</strong></span>:null}<span><small>关联设备 / 工单</small><Link href={`/app/repairs/${record.repairId}`}>{repair?.device.model} · {record.repairId}</Link></span></div></section>
      <section className="panel detail-section"><div className="detail-section__head"><div><span><FileClock size={18} /></span><div><h3>采购与到货历史</h3></div></div><span className="demo-badge">{record.events.length} 条</span></div>{record.events.length ? <ol className="detail-timeline procurement-timeline">{[...record.events].reverse().map((event) => <li key={event.id}><i className={`timeline-dot timeline-dot--${event.type === "correction" ? "warning" : event.type === "arrival" ? "success" : "info"}`} /><div><strong>{procurementEventLabel(event)}</strong><p>{event.note || "未填写备注"}</p>{event.reference ? <p>供应商订单号：{event.reference}</p> : null}{event.type === "correction" ? <p>关联原批次：{record.events.find((row) => row.id === event.arrivalId)?.time}</p> : null}<small>{event.time} · 演示操作</small></div></li>)}</ol> : <div className="section-empty"><FileClock size={24} /><div><strong>草稿尚未下单</strong><p>选好配件后可标记加车；实际下单后另行记录。</p></div></div>}</section>
    </div><ProcurementActions record={record} /></div>
  </main>;
}
