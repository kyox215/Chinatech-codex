"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { History, PackageSearch, Pencil, X } from "lucide-react";
import { RepairProjectControls } from "./repair-project-controls";
import { RepairItemsForm } from "./repair-items-form";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { reconfirmRepairParts, useRepairWorkflows } from "@/components/repairs/repair-workflow-store";
import { currentRepairRequirements, type RepairRequirement } from "@/lib/repair-requirements";
import { procurementStatuses, procurementStatus, type ProcurementRecord } from "@/lib/procurement";
import { SelectControl } from "@/components/select-control";
import { useStaff } from "@/components/staff/use-staff";
import { isPreorder, procurementEventLabel } from "@/lib/procurement";
import { useProcurement } from "./procurement-provider";
import { ProcurementActions } from "./procurement-detail";
import type { RepairDirectoryEntry } from "@/lib/repair-intake-record";
import { RepairPartForm } from "./repair-part-form";
export function RepairProcurementShortcut({ repairId, onOpen }: { repairId: string; onOpen: (repairId: string) => void }) {
  const canEdit = useStaff().can("repairs.edit");
  return <button id={`repair-action-${repairId}`} className="button button--secondary" type="button" onClick={() => onOpen(repairId)} aria-label={`${repairId} 配件${canEdit ? "操作" : "详情"}`} title={canEdit ? "配件操作" : "配件详情"}><PackageSearch size={17} aria-hidden="true" /><span>配件</span></button>;
}
// Dialog lives outside groups; marking a part may move its work order into another group.
export function RepairProcurementDialog({ repairId, onClose, initialRecordId = "" }: { repairId: string | null; onClose: () => void; initialRecordId?: string; initialMode?: "view" | "add" }) {
  const canEdit = useStaff().can("repairs.edit");
  const { records, storageError } = useProcurement();
  const order = useRepairDirectory().find(row => row.id === repairId);
  const { workflows } = useRepairWorkflows();
  const rows = records.filter(row => row.repairId === repairId);
  const [selectedId, setSelectedId] = useState(initialRecordId);
  const [legacyEdit, setLegacyEdit] = useState(false);
  const [pending, setPending] = useState(false);
  const selected = rows.find(row => row.id === selectedId) ?? rows.find(isPreorder) ?? rows[0];
  const dialog = useRef<HTMLDialogElement>(null); const titleId = useId();
  useEffect(() => { if (repairId) dialog.current?.showModal(); }, [repairId]);
  if (!repairId) return null;
  const close = () => { if (!pending) onClose(); };
  return createPortal(<dialog className="repair-parts-dialog repair-part-dialog repair-items-dialog" ref={dialog} aria-labelledby={titleId} onClose={onClose} onCancel={event => { if (pending) event.preventDefault(); }}>
    <header><div><small>{repairId}</small><h2 id={titleId}>供应商与配件</h2></div><button className="icon-button" type="button" disabled={pending} onClick={close} aria-label="关闭配件操作"><X size={20} /></button></header>
    {storageError ? <p className="form-error" role="alert">{storageError}</p> : null}
    {order ? <RepairProjectControls order={order} records={records} onPendingChange={setPending}/> : null}
    <RepairItemsForm key={order ? currentRepairRequirements(order, workflows[order.id]).map(row => row.id).join("|") : repairId} repairId={repairId} onSaved={onClose} onCancel={close} onPendingChange={setPending} />
    {selected ? <details className="repair-workflow-history repair-existing-parts" open={initialRecordId ? true : undefined}>
      <summary><PackageSearch size={16} />配件记录 <small>{rows.length}</small></summary>
      {rows.length > 1 ? <label className="field"><span>查看配件记录</span><SelectControl aria-label="本次操作的配件" value={selected.id} onChange={event => { setSelectedId(event.target.value); setLegacyEdit(false); }}>{rows.map(row => <option key={row.id} value={row.id}>{row.item} · {row.supplier}{row.required === false ? " · 备选" : ""}</option>)}</SelectControl></label> : null}
      {legacyEdit ? <RepairPartForm key={selected.id} repairId={repairId} record={selected} onSaved={() => setLegacyEdit(false)} onCancel={() => setLegacyEdit(false)} /> : <>
        <div className="repair-parts-dialog__item"><strong>{selected.item}</strong><span>{procurementStatuses[procurementStatus(selected)].label}</span>{selected.specification ? <p>{selected.specification}</p> : null}<span>{selected.supplier} · {selected.quantity} 件{selected.required === false ? " · 备选" : ""}</span>{canEdit && !selected.requirementId ? <button className="button button--secondary button--tiny" type="button" onClick={() => setLegacyEdit(true)}><Pencil size={14} />编辑旧配件记录</button> : null}</div>
        {order && selected.requirementId ? <RepairPartReconfirmation key={`${selected.requirementId}:${workflows[order.id]?.revision ?? 0}`} order={order} requirement={currentRepairRequirements(order, workflows[order.id]).find(row => row.id === selected.requirementId)} rows={rows.filter(row => row.requirementId === selected.requirementId)} /> : null}
        <ProcurementActions key={selected.id} record={selected} embedded />
        {selected.events.length ? <details className="repair-workflow-history"><summary><History size={16} />配件历史 <small>{selected.events.length}</small></summary><ol className="detail-timeline">{selected.events.toReversed().map(event => <li key={event.id}><i className="timeline-dot timeline-dot--info" /><div><strong>{procurementEventLabel(event)}</strong><p>{event.note}</p><small>{event.time}</small></div></li>)}</ol></details> : null}
      </>}
    </details> : null}
  </dialog>, document.body);
}

function RepairPartReconfirmation({order,requirement,rows}:{order:RepairDirectoryEntry;requirement?:RepairRequirement;rows:ProcurementRecord[]}){
  const canEdit=useStaff().can("repairs.edit");const {workflows}=useRepairWorkflows();const [checked,setChecked]=useState(false);const [error,setError]=useState("");const [pending,setPending]=useState(false);const busy=useRef(false);
  const [openedVersion]=useState(()=>({intake:order.intakeRevision??1,workflow:workflows[order.id]?.revision??0,items:rows.map(row=>({id:row.id,revision:row.events.length}))}));
  if(!requirement||!canEdit||(requirement.mode==="parts"&&requirement.confirmed&&rows.every(row=>row.requirementRevision===requirement.revision)))return null;
  async function confirm(){if(!requirement||busy.current||!checked)return;busy.current=true;setPending(true);setError("");try{await reconfirmRepairParts(order,requirement.id,openedVersion.items,openedVersion.workflow,openedVersion.intake);}catch(reason){setError(reason instanceof Error?reason.message:"核对失败。");}finally{busy.current=false;setPending(false);}}
  return <details className="repair-workflow-history"><summary>配件要求待核对</summary><p>{requirement.title} · 当前要求：{requirement.request||"未指定"}</p><ul>{rows.map(row=><li key={row.id}>{row.item} · {row.supplier} · {row.specification||"规格未记录"}</li>)}</ul><label className="review-confirm"><input type="checkbox" checked={checked} disabled={pending} onChange={event=>setChecked(event.target.checked)}/><span>已核对上述全部配件符合当前维修要求</span></label>{error?<p role="alert" className="form-error">{error}</p>:null}<button className="button button--secondary" type="button" disabled={!checked||pending} onClick={()=>void confirm()}>{pending?"正在保存…":"确认当前配件关联"}</button></details>;
}
