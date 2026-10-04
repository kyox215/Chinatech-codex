"use client";
import { InputControl } from "@/components/input-control";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, ClipboardList, X, Search, MessageCircle, PackageSearch, Wrench, ShieldCheck, CheckCircle2, Ban, Send, ArrowRight } from "lucide-react";
import { repairStatusOptions, type RepairStatus } from "@/lib/repair-fixtures";
import { type RepairDirectoryEntry } from "@/lib/repair-intake-record";
import { repairStageTones, stageChangeNeedsNote, type WorkflowCommand } from "@/lib/repair-workflow";
import { useProcurement } from "@/components/procurement/procurement-provider";
import { useStaff } from "@/components/staff/use-staff";
import { useRepairWorkflows, updateRepairWorkflow } from "./repair-workflow-store";
type RepairStageControlProps = { order: RepairDirectoryEntry; variant?: "default" | "list"; onSaved?: (status: RepairStatus) => void };
const stageIcons = { diagnosis: Search, awaiting_quote: MessageCircle, awaiting_parts: PackageSearch, repairing: Wrench, testing: ShieldCheck, ready: CheckCircle2, completed: CheckCircle2, cancelled: Ban, outsourced: Send, awaiting_reply: MessageCircle, collected_unpaid: ClipboardList, ready_notified: CheckCircle2 };
export function RepairStageControl(props: RepairStageControlProps) { const staff = useStaff(); return <ScopedStageControl key={`${staff.member?.id}:${staff.member?.revision}`} {...props} />; }
function ScopedStageControl({ order, onSaved, variant = "default" }: RepairStageControlProps) {
  const canEdit = useStaff().can("repairs.edit");
  const [open, setOpen] = useState(false);
  const Icon = stageIcons[order.status];
  const label = <><Icon size={14} aria-hidden="true" /><span>{repairStatusOptions.find(option => option.value === order.status)?.label}</span>{canEdit ? <ChevronDown size={13} aria-hidden="true" /> : null}</>;
  return <><button id={`repair-stage-${order.id}`} type="button" className={variant === "list" ? "repair-stage-button repair-stage-button--list" : `status-pill repair-stage-button status-pill--${repairStageTones[order.status]}`} disabled={!canEdit} aria-label={`${order.id} ${canEdit ? "更改维修阶段" : "维修阶段"}`} title={canEdit ? "更改维修阶段" : "当前账号仅可查看维修阶段"} onClick={() => setOpen(true)}>{variant === "list" ? <span className={`status-pill status-pill--${repairStageTones[order.status]}`}>{label}</span> : label}</button>{open && canEdit ? <StageDialog order={order} onSaved={onSaved} onClose={() => { setOpen(false); requestAnimationFrame(() => document.getElementById(`repair-stage-${order.id}`)?.focus({preventScroll:true})); }} /> : null}</>;
}
function StageDialog({ order, onClose, onSaved }: { order: RepairDirectoryEntry; onClose: () => void; onSaved?: (status: RepairStatus) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { workflows, error: storeError } = useRepairWorkflows();
  const { records } = useProcurement();
  const [revision] = useState(workflows[order.id]?.revision ?? 0);
  const [status, setStatus] = useState<RepairStatus>(order.status);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false); const busy = useRef(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function save() {
    if (!dialog.current?.querySelector<HTMLInputElement>("input")?.reportValidity()) return;
    if (busy.current) return; busy.current = true; setPending(true);
    try { const command: WorkflowCommand = { type: "stage", status, note }; await updateRepairWorkflow(order, command, records, revision); onSaved?.(status); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，请重试。"); } finally { busy.current = false; setPending(false); }
  }
  const labelFor = (value: RepairStatus) => repairStatusOptions.find(option => option.value === value)?.label;
  const close = () => { if (!busy.current) onClose(); };
  return createPortal(<dialog ref={dialog} className="repair-parts-dialog repair-stage-dialog" aria-label="更改维修阶段" onCancel={event => {if(busy.current)event.preventDefault();}} onClose={onClose}><header><div><small>{order.device.model}</small><h2>维修阶段</h2></div><button className="icon-button" aria-label="关闭维修阶段" type="button" disabled={pending} onClick={close}><X size={18} /></button></header><div className="repair-stage-current"><span>当前</span><strong>{labelFor(order.status)}</strong>{status!==order.status?<><ArrowRight size={15}/><strong>{labelFor(status)}</strong></>:null}</div><div className="repair-stage-options">{repairStatusOptions.filter(option => !["ready_notified", "awaiting_reply", "collected_unpaid"].includes(option.value)).map(option => {const Icon=stageIcons[option.value];return <button key={option.value} type="button" aria-label={option.label} disabled={pending} aria-pressed={status === option.value} className={`repair-stage-option${status === option.value ? " repair-stage-option--selected" : ""}`} onClick={() => setStatus(option.value)}><span><Icon size={17} aria-hidden="true" />{option.label}</span>{status === option.value ? <Check size={16} aria-hidden="true" /> : null}</button>;})}</div><label className="field"><span>{stageChangeNeedsNote(order.status, status) ? "变更原因 *" : "备注（选填）"}</span><InputControl required={stageChangeNeedsNote(order.status, status)} validate={value => stageChangeNeedsNote(order.status, status) && !value.trim() ? "此阶段变更需要原因，请填写实际情况。" : ""} placeholder="例如：客户取消维修，设备待交还" onClear={() => setNote("")} clearLabel="清空维修阶段变更原因" aria-label="维修阶段变更原因" disabled={pending} maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></label>{error || storeError ? <p role="alert" className="form-error">{error || storeError}</p> : null}<footer><button className="button button--secondary" type="button" disabled={pending} onClick={close}>取消</button><button className="button button--primary" type="button" disabled={pending || status === order.status || Boolean(storeError)} onClick={save}><Check size={17} />保存阶段</button></footer></dialog>, document.body);
}
