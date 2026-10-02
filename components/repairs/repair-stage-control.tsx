"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, ClipboardList, X } from "lucide-react";
import { repairStatusOptions, type RepairStatus } from "@/lib/repair-fixtures";
import { type RepairDirectoryEntry } from "@/lib/repair-intake-record";
import { repairStageTones, type WorkflowCommand } from "@/lib/repair-workflow";
import { useProcurement } from "@/components/procurement/procurement-provider";
import { useStaff } from "@/components/staff/use-staff";
import { useRepairWorkflows, updateRepairWorkflow } from "./repair-workflow-store";
export function RepairStageControl({ order }: { order: RepairDirectoryEntry }) {
  const canEdit = useStaff().can("repairs.edit");
  const [open, setOpen] = useState(false);
  return <><button type="button" className={`status-pill repair-stage-button status-pill--${repairStageTones[order.status]}`} disabled={!canEdit} aria-label={`${order.id} ${canEdit ? "更改维修阶段" : "维修阶段"}`} title={canEdit ? "更改维修阶段" : "当前账号仅可查看维修阶段"} onClick={() => setOpen(true)}><ClipboardList size={14} /><span>{repairStatusOptions.find(option => option.value === order.status)?.label}</span>{canEdit ? <ChevronDown size={13} /> : null}</button>{open && canEdit ? <StageDialog order={order} onClose={() => setOpen(false)} /> : null}</>;
}
function StageDialog({ order, onClose }: { order: RepairDirectoryEntry; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { workflows, error: storeError } = useRepairWorkflows();
  const { records } = useProcurement();
  const [revision] = useState(workflows[order.id]?.revision ?? 0);
  const [status, setStatus] = useState<RepairStatus>(order.status);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function save() {
    try { const command: WorkflowCommand = { type: "stage", status, note }; await updateRepairWorkflow(order, command, records, revision); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，请重试。"); }
  }
  return createPortal(<dialog ref={dialog} className="repair-parts-dialog repair-stage-dialog" aria-label="更改维修阶段" onClose={onClose}><header><div><small>{order.device.model}</small><h2>维修阶段</h2></div><button className="icon-button" aria-label="关闭维修阶段" type="button" onClick={onClose}><X size={18} /></button></header><div className="repair-stage-options">{repairStatusOptions.map(option => <button key={option.value} type="button" aria-pressed={status === option.value} className={`repair-stage-option${status === option.value ? " repair-stage-option--selected" : ""}`} onClick={() => setStatus(option.value)}><span className={`status-pill status-pill--${repairStageTones[option.value]}`}>{option.label}</span>{status === option.value ? <Check size={16} /> : null}</button>)}</div><label className="field"><span>{status === "cancelled" || ["completed", "cancelled"].includes(order.status) ? "变更原因 *" : "备注（选填）"}</span><input aria-label="维修阶段变更原因" maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></label><p className="repair-stage-note">阶段标记不代表已交机或已结清款项。</p>{error || storeError ? <p role="alert" className="form-error">{error || storeError}</p> : null}<footer><button className="button button--secondary" type="button" onClick={onClose}>取消</button><button className="button button--primary" type="button" disabled={status === order.status || Boolean(storeError)} onClick={save}><Check size={17} />保存阶段</button></footer></dialog>, document.body);
}
