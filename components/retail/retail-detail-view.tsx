"use client";

import { retailHistoryStatus, type RetailHistoryRecord } from "@/lib/retail-history";
import { RetailRecordSourceFacts } from "./retail-record-preparation";
import { useLanguage } from "@/components/language-provider";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { BadgeCheck, Barcode, CalendarDays, ChevronDown, CircleEuro, CircleAlert, Copy, Cpu, FileClock, HardDrive, MapPin, Package, Plug, ShoppingBag, Tag, TrendingUp, UserRound, Wrench } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { ColorSwatch } from "@/components/color-picker";
import { useStaff } from "@/components/staff/use-staff";
import { RetailGallery } from "./retail-gallery";
import { RetailSaleCard } from "./retail-commerce";
import { UnitIcon } from "./unit-icon";
import { hasBattery, isComputer, currentRetailSale, retailGrossProfit, retailSaleState, retailMoney, retailStatuses, retailCategories, type RetailEditableField, type RetailUnit } from "@/lib/retail";
import { RetailEditScope, RetailFieldButton, RetailFieldEditor } from "./retail-field-editor";
import { RetailWarrantyPanel } from "./retail-warranty";
import styles from "./retail-detail.module.css";
import surface from "./retail-surface.module.css";

const RetailGroups = createContext<{ open: string | null; toggle: (id: string) => void }>({ open: null, toggle: () => {} });

function RetailDetailGroup({ id, title, icon, meta, embedded = false, children }: { id: string; title: string; icon: ReactNode; meta?: ReactNode; embedded?: boolean; children: ReactNode }) {
  const group = useContext(RetailGroups);
  const bodyId = useId();
  const expanded = group.open === id;
  const heading = <><div><span>{icon}</span><h3>{title}</h3></div><span className={styles.disclosureMeta}>{meta}<ChevronDown size={16} /></span></>;
  return <section className={`panel ${styles.group}${embedded ? ` ${styles.embeddedGroup}` : ""}`} aria-label={title} tabIndex={id === "source" ? -1 : undefined} data-retail-group={id} data-open={expanded}>
    <button type="button" className={`detail-section__head ${surface.sectionHead} ${styles.groupToggle}`} aria-expanded={expanded} aria-controls={bodyId} onClick={() => group.toggle(id)}>{heading}</button>
    {!embedded ? <div className={`detail-section__head ${surface.sectionHead} ${styles.groupDesktopHead}`}>{heading}</div> : null}
    <div id={bodyId} className={styles.groupBody}>{children}</div>
  </section>;
}

export function RetailDetailView({ unit, returnTo, children, storageError, selectedSale, original, sourcePreview = false, showOriginal = false }: { unit: RetailUnit; returnTo: string; children: ReactNode; storageError: string; selectedSale?: string; original?: RetailHistoryRecord; sourcePreview?: boolean; showOriginal?: boolean }) {
  const { t } = useLanguage();
  const staff = useStaff();
  const progress = Object.values(unit.inspection).filter(Boolean).length;
  const [editing, setEditing] = useState<{ field: RetailEditableField; unit: RetailUnit; candidate?: RetailUnit } | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(selectedSale && unit.sales.some(sale => sale.id === selectedSale) ? "sales" : showOriginal && original ? "source" : null);
  const previousStatus = useRef(unit.status);
  const hasOriginal = Boolean(original);
  useEffect(() => {
    if (!showOriginal || selectedSale || !hasOriginal) return;
    const handle = requestAnimationFrame(() => { setOpenGroup("source"); const target = document.querySelector<HTMLElement>('[data-retail-group="source"]'); target?.scrollIntoView({ block: "start", behavior: "instant" }); target?.focus({ preventScroll: true }); });
    return () => cancelAnimationFrame(handle);
  }, [showOriginal, selectedSale, hasOriginal]);
  useEffect(() => {
    if (selectedSale) {
      const target = document.getElementById(`sale-${selectedSale}`);
      if (target) { target.scrollIntoView({ block: "start" }); target.focus({ preventScroll: true }); }
    }
  }, [selectedSale]);
  useEffect(() => {
    const justSold = previousStatus.current !== "sold" && unit.status === "sold";
    previousStatus.current = unit.status;
    if (justSold) { const handle = requestAnimationFrame(() => setOpenGroup("sales")); return () => cancelAnimationFrame(handle); }
  }, [unit.status]);
  const edit = (field: RetailEditableField) => setEditing(previous => previous ?? { field, unit });
  const editor = (...fields: RetailEditableField[]) => editing && fields.includes(editing.field) ? <RetailFieldEditor key={editing.unit.id + ":" + editing.field} unit={editing.unit} field={editing.field} initialCandidate={editing.candidate} onClose={() => setEditing(null)} /> : null;
  const field = (key: RetailEditableField, className = "") => <RetailFieldButton key={key} unit={unit} field={key} className={className} onEdit={edit} />;
  const status = sourcePreview && original ? { label: retailHistoryStatus(original), tone: original.sourceStatus === "在售" ? "success" : unit.status === "sold" ? "info" : "warning" } : retailStatuses[unit.status];
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
  const profit = staff.can("financial.read") ? retailGrossProfit(unit.priceCents, unit.costCents, unit.refurbCents) : null;
  const originalStorage = !unit.bodyStorage && !unit.disks.length ? original?.memory : null;

  return <RetailGroups.Provider value={{ open: openGroup, toggle: id => setOpenGroup(current => current === id ? null : id) }}><RetailEditScope field={editing?.field ?? null} readOnly={sourcePreview}><main className={"module-page retail-detail " + surface.page + " " + styles.detail}>
    <header className="module-heading"><PageTitle title={t("商品档案")} backHref={returnTo} backLabel={t("返回商品列表")} backScroll={false} badge={<span className={"status-pill status-pill--" + status.tone}>{t(status.label)}</span>} />{staff.can("retail.edit") && !sourcePreview ? <Link className="button button--secondary button--compact page-toolbar-action" href={"/app/retail/new?copy=" + unit.id} aria-label={t("同型号新建")} title={t("同型号新建")}><Copy size={17} /><span>{t("同型号新建")}</span></Link> : null}</header>
    {storageError ? <p className="form-error" role="alert">{t(storageError)}</p> : null}
    <section className={"panel " + styles.summary} aria-label={t("单机摘要")}>
      <div className={styles.hero}>
        <RetailGallery unit={unit} readOnly={sourcePreview} />
        <div className={styles.heroContent}>
          <div className={styles.heroHeading}>
            <div className={styles.deviceSummary}><h2 aria-label={[unit.brand, unit.model].filter(Boolean).join(" ")}><RetailFieldButton unit={unit} field="brand" compact className={styles.titleField} onEdit={edit}>{unit.brand || t("品牌未记录")}</RetailFieldButton><RetailFieldButton unit={unit} field="model" compact className={styles.titleField} onEdit={edit} /></h2></div>
            <div className={styles.priceCard}><Tag size={23} aria-hidden="true" />{field("priceCents", styles.price)}</div>
          </div>
          {editor("brand", "model", "priceCents")}
          <div className={styles.tags} aria-label={t("商品基本规格")}>
            <RetailFieldButton unit={unit} field="category" compact className={styles.tag} onEdit={edit}><UnitIcon category={unit.category} size={17} />{sourcePreview && original ? t(original.category || "未记录") : t(retailCategories[unit.category])}</RetailFieldButton>
            <RetailFieldButton unit={unit} field="color" compact className={styles.tag} onEdit={edit}><ColorSwatch value={unit.color} />{unit.color ? t(unit.color) : t("颜色未记录")}</RetailFieldButton>
            <RetailFieldButton unit={unit} field="condition" compact className={styles.tag} onEdit={edit}><Package size={17} />{t(unit.condition)}</RetailFieldButton>
            <RetailFieldButton unit={unit} field="grade" compact className={styles.tag} onEdit={edit}><BadgeCheck size={17} />{unit.grade ? t("成色 {v0}", { v0: unit.grade }) : t("成色未记录")}</RetailFieldButton>
          </div>
          {editor("category", "color", "condition", "grade")}
          <div className={styles.overview} aria-label={t("关键概览")}>
            {hasBattery(unit.category) || unit.batteryPercent !== null ? <RetailFieldButton compact unit={unit} field="batteryPercent" className={styles.metricButton} onEdit={edit}><Meter value={unit.batteryPercent} label={unit.batteryPercent === null ? "—" : `${unit.batteryPercent}%`} battery /><span><strong>{t("电池健康")}</strong><small className={styles.batteryMetaDesktop}>{unit.batteryPercent === null ? t("未记录") : t("实测 {v0}%", { v0: unit.batteryPercent })}</small><small className={styles.batteryMetaMobile}>{t("电池健康")}</small></span></RetailFieldButton> : null}
            <div className={styles.metric}><span className={styles.metricIcon}><HardDrive size={25} aria-hidden="true" /></span><span><strong>{originalStorage || (unit.bodyStorage ? `${unit.bodyStorage.capacity ?? "未记录"} ${unit.bodyStorage.unit}` : unit.disks.length ? unit.disks.length + t(" 块磁盘") : t("未记录"))}</strong><small>{originalStorage ? t("容量原文") : unit.bodyStorage ? t("机身存储") : t("存储规格")}</small></span></div>
            <div className={styles.metric}><Meter value={progress / 3 * 100} label={`${progress}/3`} /><span><strong>{t("检测进度")}</strong><small>{t("已保存 ")} {progress}/3</small></span></div>
          </div>
          {editor("batteryPercent")}
        </div>
      </div>
    </section>
    <div className={styles.mobileQuickActions}>
      {unit.knownIssues ? <p className={styles.knownIssue}><CircleAlert size={17} /><span><strong>{t("已知问题")}</strong> {unit.knownIssues}</span></p> : null}
      <button type="button" className="button button--primary" aria-expanded={openGroup === (!sourcePreview && unit.status === "sold" ? "sales" : "actions")} onClick={() => setOpenGroup(!sourcePreview && unit.status === "sold" ? "sales" : "actions")}>{unit.status === "sold" ? <ShoppingBag size={17} /> : <BadgeCheck size={17} />}{sourcePreview ? t(unit.status === "sold" ? "查看原销售记录" : "核对商品资料") : unit.status === "sold" ? t("收款、交付与打印") : ["available", "reserved"].includes(unit.status) ? t("办理售卖") : unit.status === "hold" ? t("查看检测与销售") : t("继续检测")}</button>
    </div>
    <div className={styles.layout}><div className={styles.column}>
      <RetailDetailGroup id="identity" title={t("基础信息")} icon={<Barcode size={18} />} meta={sourcePreview ? undefined : <small className={styles.version}>v{unit.version}</small>}>
        <div className={styles.factRows}>{identifiers.map(key => <div className={styles.factRow} key={key}><span className={styles.rowIcon}>{key.startsWith("imei") ? <UnitIcon category="phone" size={17} /> : <Barcode size={17} />}</span>{field(key, styles.rowField)}</div>)}<div className={styles.factRow}><span className={styles.rowIcon}><UserRound size={17} /></span>{field("source", styles.rowField)}</div><div className={styles.factRow}><span className={styles.rowIcon}><CalendarDays size={17} /></span>{field("intakeDate", styles.rowField)}</div><div className={styles.factRow}><span className={styles.rowIcon}><MapPin size={17} /></span>{field("location", styles.rowField)}</div></div>
        {editor(...identifiers, "source", "intakeDate", "location")}
      </RetailDetailGroup>
      <RetailDetailGroup id="physical" title={t("实物与规格")} icon={<Package size={18} />}>
        <div className={styles.physicalGrid}><div className={styles.physicalCard}><span className={styles.physicalIcon}><Plug size={23} /></span>{field("accessories", styles.physicalField)}</div><div className={styles.physicalCard}><span className={styles.issueIcon}><CircleAlert size={23} /></span>{field("knownIssues", styles.physicalField)}</div></div>
        {editor("accessories", "knownIssues")}
        {specs.length ? <div className={styles.specs}><h4><Cpu size={17} />{t("其他规格")}</h4><div className={styles.fieldGrid}>{specs.map(key => field(key))}</div>{editor(...specs)}</div> : null}
      </RetailDetailGroup>
      {original ? <RetailDetailGroup id="source" title={t("原商品资料")} icon={<FileClock size={18} />}><details className={styles.sourceDetails} open={openGroup === "source"}><summary>{t("查看原商品资料")}</summary><RetailRecordSourceFacts record={original} /></details></RetailDetailGroup> : null}
      <RetailDetailGroup id="history" title={t("操作历史")} icon={<FileClock size={18} />} meta={t("{count} 条", { count: unit.events.length })}><details className={styles.timeline} open={openGroup === "history"}><summary>{t("查看操作历史 · ")}{unit.events.length} {t(" 条")}</summary><ol className="detail-timeline">{unit.events.toReversed().map(event => <li key={event.id}><i className="timeline-dot timeline-dot--progress" /><div><strong>{t(event.title)}</strong><p>{event.detail}</p><small>{event.time} · {event.actorName || t("原记录")}</small></div></li>)}</ol></details></RetailDetailGroup>
    </div><aside className={styles.column} aria-label={t("金额与操作")}>
      {staff.can("financial.read") ? <RetailDetailGroup id="finance" title={t("销售与成本")} icon={<CircleEuro size={18} />}><div className={styles.financeGrid}>
        <div className={styles.financeTile}><span className={styles.financeIcon}><Tag size={23} /></span><div><small>{t("售价")}</small><strong className={styles.priceValue}>{t(retailMoney(unit.priceCents))}</strong></div></div>
        <div className={styles.financeTile}><span className={styles.financeIcon}><HardDrive size={23} /></span>{field("costCents", styles.moneyField)}</div>
        <div className={styles.financeTile}><span className={styles.financeIcon}><Wrench size={23} /></span>{field("refurbCents", styles.moneyField)}</div>
        {unit.status !== "sold" ? <div className={`${styles.financeTile} ${styles.profit}`}><span className={styles.financeIcon}><TrendingUp size={23} /></span><div><small>{t("预计毛利")}</small><strong className={profit === null ? styles.unknownProfit : profit < 0 ? styles.lossValue : styles.profitValue}>{t(retailMoney(profit))}</strong></div></div> : null}
      </div>{editor("costCents", "refurbCents")}{unit.status !== "sold" ? <p className={styles.financeNote}>{t("售价 − 入库成本 − 整备成本；未知成本时毛利待确认")}</p> : null}</RetailDetailGroup> : null}
      {unit.status !== "sold" || sourcePreview ? <RetailDetailGroup id="actions" title={t(sourcePreview ? unit.status === "sold" ? "原销售记录" : "核对商品资料" : "检测与销售")} icon={<BadgeCheck size={18} />} meta={t("已保存 {count}/3", { count: progress })} embedded>{children}</RetailDetailGroup> : null}
      {unit.status !== "sold" && !sourcePreview ? <RetailDetailGroup id="warranty" title={t("保修与打印")} icon={<BadgeCheck size={18} />} embedded><RetailWarrantyPanel key={unit.id + ":" + unit.version + (editing?.field === "warrantyMonths" ? ":review" : ":saved")} unit={unit} blocked={!!editing && editing.field !== "warrantyMonths"} editor={editor("warrantyMonths")} onReview={candidate => setEditing({ field: "warrantyMonths", unit, candidate })} /></RetailDetailGroup> : null}
      {unit.sales.length ? <RetailDetailGroup id="sales" title={t("销售结算与售后")} icon={<ShoppingBag size={18} />} meta={t("{count} 单", { count: unit.sales.length })}>{unit.sales.toReversed().map(sale => currentRetailSale(unit)?.id === sale.id ? <RetailSaleCard key={sale.id} unit={unit} sale={sale} /> : <details className={styles.saleHistory} key={sale.id} open={selectedSale === sale.id}><summary>{t("历史销售 · ")}{sale.time} · {retailMoney(sale.priceCents)}{retailSaleState(sale) === "returned" ? t(" · 已退回结算") : ""}</summary><RetailSaleCard unit={unit} sale={sale} /></details>)}</RetailDetailGroup> : null}
    </aside></div>
  </main></RetailEditScope></RetailGroups.Provider>;
}

function Meter({ value, label, battery = false }: { value: number | null; label: string; battery?: boolean }) {
  return <span className={styles.meter} aria-hidden="true"><svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="none" stroke="var(--border)" strokeWidth="6" /><circle cx="32" cy="32" r="27" fill="none" stroke={battery ? "var(--success)" : "var(--primary-600)"} strokeWidth="6" strokeLinecap="round" pathLength="100" strokeDasharray={`${value ?? 0} 100`} transform="rotate(-90 32 32)" /></svg><b>{label}</b></span>;
}
