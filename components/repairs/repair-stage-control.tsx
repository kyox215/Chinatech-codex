"use client";
import { useLanguage } from "@/components/language-provider";
import { InputControl } from "@/components/input-control";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, ClipboardList, X, Search, MessageCircle, PackageSearch, Wrench, ShieldCheck, CheckCircle2, Ban, Send, ArrowRight } from "lucide-react";
import { repairStatusOptions, type RepairStatus } from "@/lib/repair-fixtures";
import { type RepairDirectoryEntry } from "@/lib/repair-intake-record";
import { initialRepairWorkflow, repairStageStatus, repairProgress, isRepairHistory, hasCurrentRepairHandover, isRepairReady, stageChangeNeedsNote, type WorkflowCommand } from "@/lib/repair-workflow";
import { SupplierBatchDialog } from "@/components/procurement/supplier-batch-dialog";
import { useProcurement } from "@/components/procurement/procurement-provider";
import { useStaff } from "@/components/staff/use-staff";
import { useRepairWorkflows, updateRepairWorkflow } from "./repair-workflow-store";
type RepairStageControlProps = { order: RepairDirectoryEntry; variant?: "default" | "list"; onSaved?: (status: RepairStatus) => void };
const stageIcons = { diagnosis: Search, awaiting_quote: MessageCircle, awaiting_parts: PackageSearch, repairing: Wrench, testing: ShieldCheck, ready: CheckCircle2, completed: CheckCircle2, cancelled: Ban, outsourced: Send, awaiting_reply: MessageCircle, collected_unpaid: ClipboardList, ready_notified: CheckCircle2 };
export function RepairStageControl(props: RepairStageControlProps) { const staff = useStaff(); return <ScopedStageControl key={`${staff.member?.id}:${staff.member?.revision}`} {...props} />; }
function ScopedStageControl({ order, onSaved, variant = "default" }: RepairStageControlProps) {
  const { t } = useLanguage();
  const canEdit = useStaff().can("repairs.edit");
  const { workflows } = useRepairWorkflows();
  const { records } = useProcurement();
  const current=workflows[order.id] ?? initialRepairWorkflow(order);
  const progress=repairProgress(order,records,current);
  const stage = repairStageStatus(workflows[order.id] ?? initialRepairWorkflow(order));
  const [open, setOpen] = useState(false);
  const [ordering,setOrdering]=useState(false);
  const Icon = stageIcons[stage];
  const label = <><Icon size={14} aria-hidden="true" /><span>{t(progress.label)}</span>{canEdit ? <ChevronDown size={13} aria-hidden="true" /> : null}</>;
  return <><button id={`repair-stage-${order.id}`} type="button" className={variant === "list" ? "repair-stage-button repair-stage-button--list" : `status-pill repair-stage-button status-pill--${progress.tone}`} disabled={!canEdit} aria-label={`${order.id} ${canEdit ? t("更改维修阶段") : t("维修阶段")}`} title={t(progress.note || (canEdit ? "更改维修阶段" : "当前账号仅可查看维修阶段"))} onClick={() => setOpen(true)}>{variant === "list" ? <span className={`status-pill status-pill--${progress.tone}`}>{label}</span> : label}</button>{open && canEdit ? <StageDialog order={order} onSaved={onSaved} onOrder={()=>{setOpen(false);setOrdering(true);}} onClose={() => { setOpen(false); requestAnimationFrame(() => document.getElementById(`repair-stage-${order.id}`)?.focus({preventScroll:true})); }} /> : null}{ordering && canEdit ? <SupplierBatchDialog action="ordered" repairId={order.id} onSaved={()=>{onSaved?.(stage);setOrdering(false);requestAnimationFrame(()=>document.getElementById(`repair-stage-${order.id}`)?.focus({preventScroll:true}));}} onClose={()=>{setOrdering(false);requestAnimationFrame(()=>document.getElementById(`repair-stage-${order.id}`)?.focus({preventScroll:true}));}}/> : null}</>;
}
function StageDialog({ order, onClose, onSaved, onOrder }: { order: RepairDirectoryEntry; onClose: () => void; onSaved?: (status: RepairStatus) => void; onOrder:()=>void }) {
  const { t , systemText } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const { workflows, error: storeError } = useRepairWorkflows();
  const { records } = useProcurement();
  const [revision] = useState(workflows[order.id]?.revision ?? 0);
  const currentStage = repairStageStatus(workflows[order.id] ?? initialRepairWorkflow(order));
  const [status, setStatus] = useState<RepairStatus>(currentStage);
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
  const labelFor = (value: RepairStatus) => value === "awaiting_parts" ? "待选配件" : value === "ready" ? "修好，等取机" : repairStatusOptions.find(option => option.value === value)?.label ?? value;
  const workflow=workflows[order.id] ?? initialRepairWorkflow(order);
  const canOrder=!isRepairHistory(order,workflow)&&!isRepairReady(workflow);
  const noteRequired = stageChangeNeedsNote(order.status,status) || hasCurrentRepairHandover(workflow) && !["completed","cancelled"].includes(status);
  const close = () => { if (!busy.current) onClose(); };
  return createPortal(<dialog ref={dialog} className="repair-parts-dialog repair-stage-dialog" aria-label={t("更改维修阶段")} onCancel={event => {if(busy.current)event.preventDefault();}} onClose={onClose}><header><div><small>{order.device.model}</small><h2>{t("维修阶段")}</h2></div><button className="icon-button" aria-label={t("关闭维修阶段")} type="button" disabled={pending} onClick={close}><X size={18} /></button></header><div className="repair-stage-current"><span>{t("当前")}</span><strong>{t(repairProgress(order,records,workflow).label)}</strong>{repairProgress(order,records,workflow).note ? <small>{t(repairProgress(order,records,workflow).note)}</small> : null}{status!==currentStage?<><ArrowRight size={15}/><strong>{t(labelFor(status))}</strong></>:null}</div><div className="repair-stage-options">{repairStatusOptions.filter(option => !["ready_notified", "awaiting_reply", "collected_unpaid"].includes(option.value)).map(option => {const Icon=stageIcons[option.value];return <button key={option.value} type="button" aria-label={t(labelFor(option.value))} disabled={pending} aria-pressed={status === option.value} className={`repair-stage-option${status === option.value ? " repair-stage-option--selected" : ""}`} onClick={() => setStatus(option.value)}><span><Icon size={17} aria-hidden="true" />{t(labelFor(option.value))}</span>{status === option.value ? <Check size={16} aria-hidden="true" /> : null}</button>;})}{canOrder ? <button type="button" className="repair-stage-option" disabled={pending} aria-label={t("下单")} onClick={onOrder}><span><PackageSearch size={17} aria-hidden="true"/>{t("下单")}</span></button> : null}</div><label className="field"><span>{noteRequired ? t("变更原因 *") : t("备注（选填）")}</span><InputControl required={noteRequired} validate={value => noteRequired && !value.trim() ? "此阶段变更需要原因，请填写实际情况。" : ""} placeholder={t("例如：客户取消维修，设备待交还")} onClear={() => setNote("")} clearLabel={t("清空维修阶段变更原因")} aria-label={t("维修阶段变更原因")} disabled={pending} maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></label>{error || storeError ? <p role="alert" className="form-error">{systemText(error || storeError)}</p> : null}<footer><button className="button button--secondary" type="button" disabled={pending} onClick={close}>{t("取消")}</button><button className="button button--primary" type="button" disabled={pending || status === currentStage || Boolean(storeError)} onClick={save}><Check size={17} />{t("保存阶段")}</button></footer></dialog>, document.body);
}
