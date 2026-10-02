"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Barcode, CalendarDays, ChevronDown, CircleEuro, ClipboardCheck, Copy, Cpu, FileClock, ShoppingBag } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { ColorSwatch } from "@/components/color-picker";
import { useStaff } from "@/components/staff/use-staff";
import { RetailGallery } from "./retail-gallery";
import { RetailSaleCard } from "./retail-commerce";
import { hasBattery, isComputer, currentRetailSale, retailGrossProfit, retailSaleState, retailMoney, retailStatuses, type RetailEditableField, type RetailUnit } from "@/lib/retail";
import { RetailEditScope, RetailFieldButton, RetailFieldEditor } from "./retail-field-editor";
import { RetailWarrantyPanel } from "./retail-warranty";
import styles from "./retail-detail.module.css";
import surface from "./retail-surface.module.css";

export function RetailDetailView({ unit, returnTo, children, storageError }: { unit: RetailUnit; returnTo: string; children: ReactNode; storageError: string }) {
  const staff=useStaff();
  const progress=Object.values(unit.inspection).filter(Boolean).length;
  const [editing, setEditing] = useState<{ field: RetailEditableField; unit: RetailUnit; candidate?: RetailUnit } | null>(null);
  const edit = (field: RetailEditableField) => setEditing(previous => previous ?? { field, unit });
  const editor = (...fields: RetailEditableField[]) => editing && fields.includes(editing.field) ? <RetailFieldEditor key={editing.unit.id + ":" + editing.field} unit={editing.unit} field={editing.field} initialCandidate={editing.candidate} onClose={() => setEditing(null)} /> : null;
  const field = (key: RetailEditableField) => <RetailFieldButton key={key} unit={unit} field={key} onEdit={edit} />;
  const status = retailStatuses[unit.status];
  const imeis = unit.category === "phone" || unit.category === "tablet" || Boolean(unit.imei1 || unit.imei2);
  const identifiers: RetailEditableField[] = ["code", "serial", "productCode", ...(imeis ? ["imei1", "imei2"] as const : [])];
  const specs: RetailEditableField[] = [];
  if (["phone", "tablet", "laptop", "desktop"].includes(unit.category) || unit.ramGb !== null) specs.push("ramGb");
  if (isComputer(unit.category) || unit.disks.length) specs.push("disks");
  if (["phone", "tablet", "console"].includes(unit.category) || unit.bodyStorage) specs.push("bodyStorage");
  if (isComputer(unit.category) || unit.cpu) specs.push("cpu");
  if (isComputer(unit.category) || unit.gpu) specs.push("gpu");
  if (unit.category === "laptop" || unit.keyboard) specs.push("keyboard");
  if (["phone", "tablet", "console"].includes(unit.category) || unit.edition) specs.push("edition");
  if (unit.category === "console" || unit.controllers !== null) specs.push("controllers");
  return <RetailEditScope field={editing?.field ?? null}><main className={"module-page retail-detail " + surface.page + " " + styles.detail}>
    <header className="module-heading"><PageTitle title="单机档案" backHref={returnTo} backLabel="返回商品列表" backScroll={false} badge={<span className={"status-pill status-pill--" + status.tone}>{status.label}</span>} />{staff.can("retail.edit")?<Link className="button button--secondary button--compact page-toolbar-action" href={"/app/retail/new?copy=" + unit.id} aria-label="同型号新建" title="同型号新建"><Copy size={17} /><span>同型号新建</span></Link>:null}</header>
    {storageError ? <p className="form-error" role="alert">{storageError}</p> : null}
    <section className={"panel " + styles.summary} aria-label="单机摘要"><div className={styles.hero}><RetailGallery unit={unit}/><div className={styles.deviceSummary}>
      <h2 aria-label={[unit.brand, unit.model].filter(Boolean).join(" ")}><RetailFieldButton unit={unit} field="brand" compact className={styles.titleField} onEdit={edit}>{unit.brand || "品牌未记录"}</RetailFieldButton><RetailFieldButton unit={unit} field="model" compact className={styles.titleField} onEdit={edit} /></h2>
    </div><RetailFieldButton unit={unit} field="priceCents" className={styles.price} onEdit={edit}><strong>{retailMoney(unit.priceCents)}</strong></RetailFieldButton></div>{editor("brand","model","priceCents")}<div className={styles.overview} aria-label="关键概览">
      {hasBattery(unit.category) || unit.batteryPercent !== null ? <RetailFieldButton compact unit={unit} field="batteryPercent" className={styles.metricButton} onEdit={edit}><Meter value={unit.batteryPercent} battery/><span><strong>{unit.batteryPercent===null?"未记录":unit.batteryPercent+"%"}</strong><small>电池健康</small></span></RetailFieldButton> : null}
      <div><Cpu size={24}/><span><strong>{unit.bodyStorage?`${unit.bodyStorage.capacity??"未记录"} ${unit.bodyStorage.unit}`:unit.disks.length?unit.disks.length+" 块磁盘":"容量未记录"}</strong><small>存储规格</small></span></div><div><Meter value={progress/3*100}/><span><strong>{progress}/3</strong><small>核验完成</small></span></div></div>{editor("batteryPercent")}</section>
    <div className={styles.layout}><div className={styles.column}>
      <section className="panel" aria-label="标识与规格"><div className={"detail-section__head " + surface.sectionHead}><div><span><Barcode size={18} /></span><h3>单机资料</h3></div><small className={styles.version}>v{unit.version}</small></div>
        <div className={styles.subsection}><h4><Barcode size={14} />识别码</h4><div className={styles.identityGrid}>{identifiers.map(field)}</div>{editor(...identifiers)}</div>
        <div className={styles.specs}><h4><Cpu size={14} />基本规格</h4><div className={styles.identityGrid}>{field("category")}<RetailFieldButton unit={unit} field="color" onEdit={edit}><ColorSwatch value={unit.color}/>{unit.color || "未记录"}</RetailFieldButton>{field("condition")}</div>{editor("category","color","condition")}</div>
        {specs.length ? <div className={styles.specs}><h4><Cpu size={14} />实测规格</h4><div className={styles.fieldGrid}>{specs.map(field)}</div>{editor(...specs)}</div> : null}
      </section>
      <section className="panel" aria-label="实物情况"><div className={"detail-section__head " + surface.sectionHead}><div><span><ClipboardCheck size={18} /></span><h3>实物情况</h3></div></div><div className={styles.fieldGrid}>{field("grade")}{field("accessories")}<div className={styles.wide}>{field("knownIssues")}</div></div>{editor("grade","accessories","knownIssues")}</section>
      <details className={"panel " + styles.timeline}><summary className={"detail-section__head " + surface.sectionHead}><div><span><FileClock size={18} /></span><h3>操作历史</h3></div><span className={styles.disclosureMeta}>{unit.events.length} 条<ChevronDown size={16} /></span></summary><ol className="detail-timeline">{unit.events.toReversed().map(event => <li key={event.id}><i className="timeline-dot timeline-dot--progress" /><div><strong>{event.title}</strong><p>{event.detail}</p><small>{event.time} · {event.actorName||"原记录"}</small></div></li>)}</ol></details>
    </div><aside className={styles.column} aria-label="金额入库与操作">
      <section className="panel" aria-label="金额与入库"><div className={"detail-section__head " + surface.sectionHead}><div><span><CircleEuro size={18} /></span><h3>{staff.can("financial.read")?"销售与成本":"来源与入库"}</h3></div></div><div className={styles.fieldGrid}>{staff.can("financial.read")?<>{field("costCents")}{field("refurbCents")}{unit.status!=="sold"?<div className={styles.profit}><small>预计毛利</small><strong>{retailMoney(retailGrossProfit(unit.priceCents,unit.costCents,unit.refurbCents))}</strong><small>标价 − 购入 − 整备；未知不按零计</small></div>:null}</>:null}{field("source")}{field("location")}</div>{editor("costCents","refurbCents","source","location")}<div className={styles.dateRow}><CalendarDays size={15} />{field("intakeDate")}</div>{editor("intakeDate")}</section>
      {unit.status !== "sold" ? <RetailWarrantyPanel key={unit.id+":"+unit.version+(editing?.field === "warrantyMonths" ? ":review" : ":saved")} unit={unit} blocked={!!editing && editing.field !== "warrantyMonths"} editor={editor("warrantyMonths")} onReview={candidate => setEditing({field:"warrantyMonths",unit,candidate})} /> : null}
      {children}
      {unit.sales.length ? <section className={"panel "+styles.sales}><div className={"detail-section__head " + surface.sectionHead}><div><span><ShoppingBag size={18}/></span><h3>销售结算与售后</h3></div></div>{unit.sales.toReversed().map(sale=>currentRetailSale(unit)?.id===sale.id?<RetailSaleCard key={sale.id} unit={unit} sale={sale}/>:<details className={styles.saleHistory} key={sale.id}><summary>历史销售 · {sale.time} · {retailMoney(sale.priceCents)}{retailSaleState(sale)==="returned"?" · 已退回结算":""}</summary><RetailSaleCard unit={unit} sale={sale}/></details>)}</section>:null}
    </aside></div>
  </main></RetailEditScope>;
}

function Meter({value,battery=false}:{value:number|null;battery?:boolean}){const amount=value??0;return <svg className={styles.meter} width="50" height="50" viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="20" fill="none" stroke="var(--border)" strokeWidth="5"/><circle cx="25" cy="25" r="20" fill="none" stroke={battery?"var(--success)":"var(--primary-600)"} strokeWidth="5" pathLength="100" strokeDasharray={`${amount} 100`} transform="rotate(-90 25 25)"/></svg>;}
