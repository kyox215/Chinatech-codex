"use client";

import Link from "next/link";
import { useState } from "react";
import { RepairProcurementDialog } from "./repair-procurement-shortcut";
import { PackageSearch, Plus } from "lucide-react";
import { arrivedQuantity, procurementStatus, procurementStatuses } from "@/lib/procurement";
import { useProcurement } from "@/components/backend-domain-context";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { useRepairWorkflows } from "@/components/repairs/repair-workflow-store";
import { currentRepairRequirements } from "@/lib/repair-requirements";
import { repairPartsSummary } from "@/lib/procurement";
import { useStaff } from "@/components/staff/use-staff";

export function RepairProcurementSummary({ repairId }: { repairId: string }) {
  const staff = useStaff(); const canEdit = staff.can("repairs.edit");
  const { records } = useProcurement();
  const order = useRepairDirectory().find(row => row.id === repairId);
  const { workflows } = useRepairWorkflows();
  const requirements = order ? currentRepairRequirements(order, workflows[repairId]) : [];
  const summary = repairPartsSummary(records, repairId, requirements);
  const rows = records.filter(row => row.repairId === repairId);
  const [active, setActive] = useState<{ id: string; mode: "view" | "add" } | null>(null);
  return <section className="panel detail-section repair-parts-summary"><div className="detail-section__head"><div><span><PackageSearch size={18} /></span><h3>供应商与配件</h3></div>{canEdit ? <button type="button" className="button button--secondary button--tiny" onClick={() => setActive({ id: "", mode: "add" })}><Plus size={15} />添加配件</button> : null}</div>{summary.unresolvedRequirements ? <p className="repair-stage-note">{summary.unresolvedRequirements}个维修项目待选件／重新核对</p> : null}{requirements.length ? <button type="button" className="button button--secondary button--tiny" onClick={() => setActive({ id: "", mode: "view" })}>核对维修项目</button> : null}{rows.length ? <div className="repair-parts-entries">{rows.map(row => <article className="repair-parts-entry" key={row.id}><button type="button" className="procurement-summary-link repair-part-summary-button" onClick={() => setActive({ id: row.id, mode: "view" })} aria-label={`${canEdit ? "操作" : "查看"} ${row.item}`}><span className="procurement-icon"><PackageSearch size={17} /></span><div><strong>{row.item}</strong><small>{row.supplier} · {row.quantity} 件{row.required === false ? " · 备选" : ""}</small>{row.specification ? <small>{row.specification}</small> : null}{row.requirementId && !requirements.some(item => item.id === row.requirementId && item.revision === row.requirementRevision && item.mode === "parts") ? <small className="form-error">维修项目关联待重新核对</small> : null}</div><div><span className={`status-pill status-pill--${procurementStatuses[procurementStatus(row)].tone}`}>{procurementStatuses[procurementStatus(row)].label}</span><small>{arrivedQuantity(row)} / {row.quantity} 已到货</small></div></button></article>)}</div> : <div className="section-empty"><PackageSearch size={24} /><strong>尚未登记配件</strong></div>}{active ? <RepairProcurementDialog key={`${staff.member?.id}:${staff.member?.revision}:${active.id}-${active.mode}`} repairId={repairId} initialRecordId={active.id} initialMode={active.mode} onClose={() => setActive(null)} /> : null}</section>;
}

export function DashboardProcurementSummary() {
  const { records } = useProcurement();
  const pending = records.filter((row) => procurementStatus(row) !== "complete").slice(0, 3);
  return <article className="panel arrivals-panel"><div className="panel__header"><div><h2>采购与到货</h2></div><Link className="button button--secondary button--tiny" href="/app/repairs">查看全部</Link></div><div className="arrival-list">{pending.map((row) => <Link className="arrival-row procurement-dashboard-link" href={`/app/repairs/${row.repairId}`} key={row.id}><span className="arrival-row__icon"><PackageSearch size={18} /></span><div><strong>{row.item}</strong><small>{row.supplier}</small></div><div><strong>{arrivedQuantity(row)} / {row.quantity} · {procurementStatuses[procurementStatus(row)].label}</strong><small>{row.expectedAt ? `预计 ${row.expectedAt.slice(5)}` : "到货日期待确认"}</small></div></Link>)}{!pending.length ? <div className="section-empty"><strong>当前采购全部到齐</strong></div> : null}</div></article>;
}
