"use client";

import { useLanguage } from "@/components/language-provider";
import { InputControl, TextareaControl } from "@/components/input-control";
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
  const { t } = useLanguage();
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

  if (!canEdit) return <section className={`panel procurement-actions${embedded ? " procurement-actions--embedded" : ""}`}><div className="detail-section__head"><div><span><PackageCheck size={18} /></span><h3>{t("配件进度")}</h3></div></div><div className="procurement-actions__body"><p className="procurement-action-hint">{t(procurementStatuses[procurementStatus(record)].label)} · {arrivedQuantity(record)} / {record.quantity} {t(" 件已到货")}</p></div></section>;
  return <section className={`panel procurement-actions${embedded ? " procurement-actions--embedded" : ""}`}>
    <div className="detail-section__head"><div><span><PackageCheck size={18} /></span><div><h3>{preorder ? t("配件标记") : t("登记到货")}</h3></div></div></div>
    {preorder ? <div className="procurement-actions__body"><ProcurementPreparation key={record.id} record={record} /></div> : <div className="procurement-actions__body">
      <ProcurementFeedback recordId={record.id} />
      <div className="segmented-control procurement-mode" aria-label={t("到货操作")}><button type="button" disabled={submitting} className={mode === "arrival" ? "segmented-control__active" : ""} aria-pressed={mode === "arrival"} onClick={() => { setMode("arrival"); setQuantity(""); setNote(""); }}>{t("本次到货")}</button><button type="button" className={mode === "correction" ? "segmented-control__active" : ""} aria-pressed={mode === "correction"} onClick={() => { setMode("correction"); setQuantity(""); setNote(""); setArrivalId(arrivals[0]?.id ?? ""); }} disabled={submitting || !arrivals.length}>{t("更正历史")}</button></div>
      {mode === "arrival" && remaining === 0 ? <div className="section-empty"><CheckCircle2 size={24} /><div><strong>{t("本条采购已到齐")}</strong><p>{t("如有误记，使用“更正历史”追加调整。")}</p></div></div> : <form aria-busy={submitting} onSubmit={(event) => { event.preventDefault(); void append(mode); }}>
        {mode === "correction" ? <label className="field"><span>{t("原到货批次")}</span><SelectControl disabled={submitting} aria-label={t("原到货批次")} value={arrivalId} onChange={(event) => setArrivalId(event.target.value)}>{arrivals.map((event, index) => <option value={event.id} key={event.id}>{t("第 ")}{index + 1} {t(" 批 · ")}{event.time} {t(" · 当前 ")}{arrivalBalance(record, event.id)} {t(" 件")}</option>)}</SelectControl></label> : null}
        <label className="field"><span>{mode === "arrival" ? t("本次到货数量（剩余 {v0} 件）", { v0: remaining }) : t("调整数量（增加填正数，减少填负数）")}</span><InputControl required min={mode === "arrival" ? 1 : -arrivalBalance(record, arrivalId)} max={remaining} validate={value => mode === "correction" && value.trim() && Number(value) === 0 ? "更正数量不能为零，请填写实际增加或减少的数量。" : ""} disabled={submitting} aria-label={mode === "arrival" ? t("本次到货数量") : t("调整数量")} type="number" inputMode={mode === "arrival" ? "numeric" : undefined} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder={mode === "arrival" ? t("例如 1") : t("例如 -1")} /></label>
        <label className="field"><span>{mode === "correction" ? t("更正原因（必填）") : t("到货备注（选填）")}</span><TextareaControl required={mode === "correction"} validate={value => mode === "correction" && !value.trim() ? "请说明更正原因，例如误记了到货数量。" : ""} disabled={submitting} aria-label={mode === "correction" ? t("更正原因") : t("到货备注")} value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} placeholder={mode === "correction" ? t("说明误记原因，原记录不会被删除") : t("包裹、型号或核对情况")} /></label>
        <button className="button button--primary" type="submit" disabled={submitting}>{mode === "arrival" ? <PackageCheck size={17} /> : <PencilLine size={17} />}{submitting ? t("正在保存…") : mode === "arrival" ? t("追加本次到货") : t("追加更正记录")}</button>
      </form>}
    </div>}
  </section>;
}

export function ProcurementDetail({ id }: { id: string }) {
  const { t } = useLanguage();
  const canCost=useStaff().can("financial.read");
  const { records } = useProcurement();
  const repairOrders = useRepairDirectory();
  const record = records.find((row) => row.id === id);
  if (!record) return <main className="module-page"><header className="module-heading"><PageTitle title={t("采购记录")} backHref="/app/procurement" backLabel={t("返回采购列表")} /></header><div className="panel module-empty"><PackageSearch size={28} /><strong>{t("没有找到采购记录")}</strong><p>{t("请在创建记录的浏览器查看，或返回关联工单核对。")}</p><Link className="button button--primary" href="/app/procurement">{t("返回采购列表")}</Link></div></main>;
  const repair = repairOrders.find(repair => repair.id === record.repairId);
  const arrived = arrivedQuantity(record);
  const status = procurementStatuses[procurementStatus(record)];
  return <main className="module-page procurement-detail">
    <header className="module-heading module-heading--compact"><PageTitle title={record.id} backHref="/app/procurement" backLabel={t("返回采购列表")} badge={<span className={`status-pill status-pill--${status.tone}`}>{t(status.label)}</span>} subtitle={`${record.item} · ${record.supplier}`} /><Link className="button button--secondary button--compact page-toolbar-action" href={`/app/repairs/${record.repairId}`} aria-label={t("关联工单")} title={t("关联工单")}><ClipboardList size={17} /><span>{t("关联工单")}</span></Link></header>
    
    <section className="detail-metrics procurement-metrics" aria-label={t("采购摘要")}><article><span><PackageSearch size={18} /></span><div><small>{t("采购数量")}</small><strong>{record.quantity} {t(" 件")}</strong></div></article><article><span><PackageCheck size={18} /></span><div><small>{t("已到货 / 待到货")}</small><strong data-testid="arrival-summary">{arrived} / {record.quantity - arrived} {t(" 件")}</strong></div></article><article><span><Truck size={18} /></span><div><small>{t("预计到货")}</small><strong>{record.expectedAt || t("待确认")}</strong></div></article>{canCost?<article><span><FileClock size={18} /></span><div><small>{t("采购总额")}</small><strong>{formatCost(record.unitCostCents === null ? null : record.unitCostCents * record.quantity)}</strong></div></article>:null}</section>
    <div className="procurement-detail-grid"><div className="repair-detail-main">
      <section className="panel detail-section"><div className="detail-section__head"><div><span><PackageSearch size={18} /></span><div><h3>{t("采购资料")}</h3></div></div></div><div className="device-facts"><span className="device-facts__wide"><small>{t("配件名称")}</small><strong>{record.item}</strong></span><span><small>{t("用途")}</small><strong>{record.required === false ? t("备选，不阻塞本单") : t("本单必需配件")}</strong></span><span><small>{t("供应商")}</small><strong>{record.supplier}</strong></span>{record.reference ? <span><small>{t("历史订单号")}</small><strong>{record.reference}</strong></span> : null}{canCost?<span><small>{t("采购单价")}</small><strong>{formatCost(record.unitCostCents)}</strong></span>:null}<span><small>{t("关联设备 / 工单")}</small><Link href={`/app/repairs/${record.repairId}`}>{repair?.device.model} · {record.repairId}</Link></span></div></section>
      <section className="panel detail-section"><div className="detail-section__head"><div><span><FileClock size={18} /></span><div><h3>{t("采购与到货历史")}</h3></div></div><span className="demo-badge">{record.events.length} {t(" 条")}</span></div>{record.events.length ? <ol className="detail-timeline procurement-timeline">{[...record.events].reverse().map((event) => <li key={event.id}><i className={`timeline-dot timeline-dot--${event.type === "correction" ? "warning" : event.type === "arrival" ? "success" : "info"}`} /><div><strong>{procurementEventLabel(event)}</strong><p>{event.note || t("未填写备注")}</p>{event.reference ? <p>{t("供应商订单号：")}{event.reference}</p> : null}{event.type === "correction" ? <p>{t("关联原批次：")}{record.events.find((row) => row.id === event.arrivalId)?.time}</p> : null}<small>{event.time} {t(" · 演示操作")}</small></div></li>)}</ol> : <div className="section-empty"><FileClock size={24} /><div><strong>{t("草稿尚未下单")}</strong><p>{t("选好配件后可标记加车；实际下单后另行记录。")}</p></div></div>}</section>
    </div><ProcurementActions record={record} /></div>
  </main>;
}
