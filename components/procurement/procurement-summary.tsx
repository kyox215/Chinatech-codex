"use client";

import { useLanguage } from "@/components/language-provider";
import Link from "next/link";
import { useState } from "react";
import { RepairProcurementDialog } from "./repair-procurement-shortcut";
import { PackageSearch, Pencil } from "lucide-react";
import { arrivedQuantity, procurementStatus, procurementStatuses } from "@/lib/procurement";
import { useProcurement } from "./procurement-provider";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { useRepairWorkflows } from "@/components/repairs/repair-workflow-store";
import { currentRepairRequirements } from "@/lib/repair-requirements";
import { repairPartsSummary } from "@/lib/procurement";
import { useStaff } from "@/components/staff/use-staff";

export function RepairProcurementSummary({ repairId }: { repairId: string }) {
  const { t } = useLanguage();
  const staff = useStaff(); const canEdit = staff.can("repairs.edit");
  const { records } = useProcurement();
  const order = useRepairDirectory().find(row => row.id === repairId);
  const { workflows } = useRepairWorkflows();
  const requirements = order ? currentRepairRequirements(order, workflows[repairId]) : [];
  const summary = repairPartsSummary(records, repairId, requirements);
  const rows = records.filter(row => row.repairId === repairId);
  const [active, setActive] = useState<{ id: string; mode: "view" | "add" } | null>(null);
  return <section className="panel detail-section repair-parts-summary"><div className="detail-section__head"><div><span><PackageSearch size={18} /></span><h3>{t("供应商与配件")}</h3></div>{canEdit ? <button type="button" className="button button--secondary button--tiny" onClick={() => setActive({ id: "", mode: "add" })}><Pencil size={15} />{t("供应商 / 报价")}</button> : null}</div>{summary.unresolvedRequirements ? <p className="repair-stage-note">{summary.unresolvedRequirements}{t("个维修项目待选件／重新核对")}</p> : null}{rows.length ? <div className="repair-parts-entries">{rows.map(row => <article className="repair-parts-entry" key={row.id}><button type="button" className="procurement-summary-link repair-part-summary-button" onClick={() => setActive({ id: row.id, mode: "view" })} aria-label={`${canEdit ? t("操作") : t("查看")} ${row.item}`}><span className="procurement-icon"><PackageSearch size={17} /></span><div><strong>{row.item}</strong><small>{row.supplier} · {row.quantity} {t(" 件")}{row.required === false ? t(" · 备选") : ""}</small>{row.specification ? <small>{row.specification}</small> : null}{row.requirementId && !requirements.some(item => item.id === row.requirementId && item.revision === row.requirementRevision && item.mode === "parts") ? <small className="form-error">{t("维修项目关联待重新核对")}</small> : null}</div><div><span className={`status-pill status-pill--${procurementStatuses[procurementStatus(row)].tone}`}>{t(procurementStatuses[procurementStatus(row)].label)}</span><small>{arrivedQuantity(row)} / {row.quantity} {t(" 已到货")}</small></div></button></article>)}</div> : <div className="section-empty"><PackageSearch size={24} /><strong>{t("尚未选择供应商")}</strong></div>}{active ? <RepairProcurementDialog key={`${staff.member?.id}:${staff.member?.revision}:${active.id}-${active.mode}`} repairId={repairId} initialRecordId={active.id} initialMode={active.mode} onClose={() => setActive(null)} /> : null}</section>;
}

export function DashboardProcurementSummary() {
  const { t } = useLanguage();
  const { records } = useProcurement();
  const pending = records.filter((row) => procurementStatus(row) !== "complete").slice(0, 3);
  return <article className="panel arrivals-panel"><div className="panel__header"><div><h2>{t("采购与到货")}</h2></div><Link className="button button--secondary button--tiny" href="/app/repairs">{t("查看全部")}</Link></div><div className="arrival-list">{pending.map((row) => <Link className="arrival-row procurement-dashboard-link" href={`/app/repairs/${row.repairId}`} key={row.id}><span className="arrival-row__icon"><PackageSearch size={18} /></span><div><strong>{row.item}</strong><small>{row.supplier}</small></div><div><strong>{arrivedQuantity(row)} / {row.quantity} · {t(procurementStatuses[procurementStatus(row)].label)}</strong><small>{row.expectedAt ? t("预计 {v0}", { v0: row.expectedAt.slice(5) }) : t("到货日期待确认")}</small></div></Link>)}{!pending.length ? <div className="section-empty"><strong>{t("当前采购全部到齐")}</strong></div> : null}</div></article>;
}
