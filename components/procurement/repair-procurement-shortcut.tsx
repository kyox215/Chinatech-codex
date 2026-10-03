"use client";
import { QueryNotice, useTemporaryPageQuery } from "@/components/backend-query";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { History, PackageSearch, Plus, Pencil, X } from "lucide-react";
import { RepairRequirementsPanel } from "./repair-requirements-panel";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { useRepairWorkflows } from "@/components/repairs/repair-workflow-store";
import { currentRepairRequirements } from "@/lib/repair-requirements";
import { procurementStatuses, procurementStatus } from "@/lib/procurement";
import { SelectControl } from "@/components/select-control";
import { useStaff } from "@/components/staff/use-staff";
import { isPreorder, procurementEventLabel } from "@/lib/procurement";
import { useProcurement } from "@/components/backend-domain-context";
import { ProcurementActions } from "./procurement-detail";
import { RepairPartForm } from "./repair-part-form";
export function RepairProcurementShortcut({ repairId, onOpen }: { repairId: string; onOpen: (repairId: string) => void }) {
  const canEdit = useStaff().can("repairs.edit");
  return <button id={`repair-action-${repairId}`} className="button button--secondary" type="button" onClick={() => onOpen(repairId)} aria-label={`${repairId} 配件${canEdit ? "操作" : "详情"}`} title={canEdit ? "配件操作" : "配件详情"}><PackageSearch size={17} aria-hidden="true" /><span>配件</span></button>;
}
// Dialog lives outside groups; marking a part may move its work order into another group.
export function RepairProcurementDialog({ repairId, onClose, initialRecordId = "", initialMode = "view" }: { repairId: string | null; onClose: () => void; initialRecordId?: string; initialMode?: "view" | "add" }) {
  const query=useTemporaryPageQuery(repairId?`/app/repairs/${encodeURIComponent(repairId)}`:null);
  const loaded=!query.backend || query.state?.scope===`/app/repairs/${encodeURIComponent(repairId??"")}`;
  const canEdit = useStaff().can("repairs.edit");
  const { records, storageError } = useProcurement();
  const order = useRepairDirectory().find(row => row.id === repairId);
  const { workflows } = useRepairWorkflows();
  const [requirementId, setRequirementId] = useState("");
  const requirement = order ? currentRepairRequirements(order, workflows[order.id]).find(row => row.id === requirementId) : undefined;
  const rows = records.filter(row => row.repairId === repairId);
  const [selectedId, setSelectedId] = useState(initialRecordId);
  const [mode, setMode] = useState<"view" | "add" | "edit">(initialMode);
  const selected = rows.find(row => row.id === selectedId) ?? rows.find(isPreorder) ?? rows[0];
  const dialog = useRef<HTMLDialogElement>(null); const titleId = useId();
  useEffect(() => { if (repairId) dialog.current?.showModal(); }, [repairId]);
  if (!repairId) return null;
  return createPortal(<dialog className="repair-parts-dialog repair-part-dialog" ref={dialog} aria-labelledby={titleId} onClose={onClose}><header><div><small>{repairId}</small><h2 id={titleId}>供应商与配件</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="关闭配件操作"><X size={20} /></button></header>{storageError ? <p className="form-error" role="alert">{storageError}</p> : null}
    <QueryNotice query={query}/>
    {loaded ? <>
    {order && mode === "view" ? <RepairRequirementsPanel order={order} onChoose={id => { setRequirementId(id); setMode("add"); }} /> : null}
    {canEdit && (mode === "add" || mode === "edit") ? <RepairPartForm key={mode === "edit" ? selected?.id : "new"} repairId={repairId} record={mode === "edit" ? selected : undefined} requirement={mode === "add" ? requirement : undefined} onSaved={id => { setSelectedId(id); setMode("view"); }} onCancel={() => setMode("view")} /> : selected ? <>
      <div className="repair-part-dialog__toolbar">{rows.length > 1 ? <label className="field"><span>配件</span><SelectControl aria-label="本次操作的配件" value={selected.id} onChange={event => setSelectedId(event.target.value)}>{rows.map(row => <option key={row.id} value={row.id}>{row.item}{row.required === false ? " · 备选" : ""}</option>)}</SelectControl></label> : null}{canEdit ? <button className="button button--secondary button--tiny" type="button" onClick={() => { setRequirementId(""); setMode("add"); }}><Plus size={16} />添加配件</button> : null}</div>
      <div className="repair-parts-dialog__item"><strong>{selected.item}</strong><span>{procurementStatuses[procurementStatus(selected)].label}</span>{selected.specification ? <p>{selected.specification}</p> : null}<span>{selected.supplier} · {selected.quantity} 件{selected.required === false ? " · 备选" : ""}</span>{canEdit && isPreorder(selected) ? <button className="button button--secondary button--tiny" type="button" onClick={() => setMode("edit")}><Pencil size={14} />编辑配件资料</button> : null}</div>
      <ProcurementActions key={selected.id} record={selected} embedded />
      {selected.events.length ? <details className="repair-workflow-history"><summary><History size={16} />配件历史 <small>{selected.events.length}</small></summary><ol className="detail-timeline">{selected.events.toReversed().map(event => <li key={event.id}><i className="timeline-dot timeline-dot--info" /><div><strong>{procurementEventLabel(event)}</strong><p>{event.note}</p><small>{event.time}</small></div></li>)}</ol></details> : null}
    </> : <div className="section-empty"><PackageSearch size={24} /><strong>尚未登记配件</strong>{canEdit ? <button type="button" className="button button--secondary" onClick={() => { setRequirementId(""); setMode("add"); }}>添加其他配件</button> : null}</div>}
    </> : null}
  </dialog>, document.body);
}
