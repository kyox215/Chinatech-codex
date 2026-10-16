"use client";
import { useLanguage } from "@/components/language-provider";
import { useOperationReceipt } from "@/components/use-operation-receipt";
import { repairItemText } from "@/lib/i18n/repair-display";
import { useRef, useState } from "react";
import { InputControl } from "@/components/input-control";
import { useStaff } from "@/components/staff/use-staff";
import { useRepairWorkflows, updateRepairWorkflow } from "@/components/repairs/repair-workflow-store";
import { initialRepairWorkflow, isRepairHistory, isRepairReady } from "@/lib/repair-workflow";
import { currentRepairRequirements, type RepairRequirement } from "@/lib/repair-requirements";
import type { RepairDirectoryEntry } from "@/lib/repair-intake-record";
import type { ProcurementRecord } from "@/lib/procurement";

export type RepairProjectConfirmation = Readonly<{ requestId: string; repairId: string; requirementId: string; intakeRevision: number; beforeWorkflowRevision: number; workflowRevision: number }>;
type ProjectPendingChange = (value: boolean, requestId?: string, project?: RepairProjectConfirmation) => boolean | void;

export function RepairProjectControls({ order, records, onPendingChange, requirementId }: { order: RepairDirectoryEntry; records: ProcurementRecord[]; onPendingChange: ProjectPendingChange; requirementId?: string }) {
  const staff = useStaff();
  const { workflows } = useRepairWorkflows();
  const workflow = workflows[order.id] ?? initialRepairWorkflow(order);
  const requirements = currentRepairRequirements(order, workflow);
  if (!staff.can("repairs.edit") || isRepairHistory(order, workflow) || isRepairReady(workflow)) return null;
  if (!requirements.length) return requirementId ? null : <AddProject key={`${staff.member?.id}:${staff.member?.revision}`} order={order} records={records} onPendingChange={onPendingChange}/>;
  const unresolved = requirements.filter(row => (!requirementId || row.id === requirementId) && (row.mode === "pending" || !row.confirmed) && !records.some(record => record.repairId === order.id && record.requirementId === row.id && record.required !== false));
  return unresolved.length ? <div className="repair-project-review">{unresolved.map(item => <NoPurchaseProject key={`${item.id}:${staff.member?.id}:${staff.member?.revision}`} order={order} item={item} records={records} onPendingChange={onPendingChange}/>)}</div> : null;
}
function AddProject({ order, records, onPendingChange }: { order: RepairDirectoryEntry; records: ProcurementRecord[]; onPendingChange: ProjectPendingChange }) {
  const { t , systemText } = useLanguage();
  const { workflows, error: storageError } = useRepairWorkflows();
  const [opened] = useState(() => ({ revision: workflows[order.id]?.revision ?? 0, id: `project:${crypto.randomUUID()}` }));
  const receipt = useOperationReceipt();
  const [title, setTitle] = useState(""), [request, setRequest] = useState(""), [error, setError] = useState(""), [submitting, setPending] = useState(false);
  const pending = submitting || receipt.waiting;
  const busy = useRef(false);
  async function save() {
    if (busy.current || receipt.isWaiting() || !title.trim()) return;
    const requestId = crypto.randomUUID();
    const project: RepairProjectConfirmation = { requestId, repairId: order.id, requirementId: opened.id, intakeRevision: order.intakeRevision ?? 1, beforeWorkflowRevision: opened.revision, workflowRevision: opened.revision + 1 };
    if (onPendingChange(true, requestId, project) === false) return;
    busy.current = true; setPending(true); setError("");
    const release = () => { busy.current = false; setError(""); onPendingChange(false, requestId); };
    try { await updateRepairWorkflow(order, { type: "requirement", item: { id: opened.id, title: title.trim(), request, revision: 1, mode: "pending", confirmed: false, deviceFingerprint: order.deviceFingerprint }, note: "登记本次维修项目。" }, records, opened.revision, { requestId }); onPendingChange(false, requestId, project); }
    catch (failure) { if (!receipt.watch(requestId, release, release)) setError(failure instanceof Error ? failure.message : "项目未保存。"); }
    finally { if (!receipt.isWaiting()) { busy.current = false; onPendingChange(false, requestId); } setPending(false); }
  }
  return <section className="repair-requirements" aria-label={t("添加维修项目")}><h3>{t("本次维修项目")}</h3><label className="field"><span>{t("维修项目")}</span><InputControl disabled={pending} value={title} maxLength={100} onChange={event => setTitle(event.target.value)} onClear={() => setTitle("")} placeholder={t("例如：屏幕")} /></label><label className="field"><span>{t("具体要求（选填）")}</span><InputControl disabled={pending} value={request} maxLength={1200} onChange={event => setRequest(event.target.value)} onClear={() => setRequest("")} /></label>{error || storageError ? <p role="alert" className="form-error">{systemText(error || storageError)}</p> : null}<button type="button" className="button button--secondary" disabled={pending || !title.trim() || Boolean(storageError)} onClick={() => void save()}>{submitting ? t("正在保存…") : receipt.waiting ? t("待核对") : t("添加维修项目")}</button></section>;
}
function NoPurchaseProject({ order, item, records, onPendingChange }: { order: RepairDirectoryEntry; item: RepairRequirement; records: ProcurementRecord[]; onPendingChange: (value: boolean, requestId?: string) => boolean | void }) {
  const { t, locale, systemText } = useLanguage();
  const { workflows, error: storageError } = useRepairWorkflows();
  const revision = useRef<number | null>(null);
  const receipt = useOperationReceipt();
  const [note, setNote] = useState(""), [submitting, setPending] = useState(false), [error, setError] = useState("");
  const pending = submitting || receipt.waiting;
  const busy = useRef(false);
  async function save() {
    if (busy.current || receipt.isWaiting() || !note.trim()) return;
    const requestId = crypto.randomUUID();
    if (onPendingChange(true, requestId) === false) return;
    busy.current = true; setPending(true); setError("");
    const release = () => { busy.current = false; setError(""); onPendingChange(false, requestId); };
    try { await updateRepairWorkflow(order, { type: "requirement", item: { ...item, mode: "none", confirmed: true }, note }, records, revision.current ?? workflows[order.id]?.revision ?? 0, { requestId }); }
    catch (failure) { if (!receipt.watch(requestId, release, release)) setError(failure instanceof Error ? failure.message : "核对未保存。"); }
    finally { if (!receipt.isWaiting()) { busy.current = false; onPendingChange(false, requestId); } setPending(false); }
  }
  return <div className="repair-requirement"><strong>{repairItemText(item.title, locale)}</strong><label className="field"><span>{t("无需采购说明")}</span><InputControl form="" disabled={pending} value={note} maxLength={1200} onChange={event => { if (revision.current === null) revision.current = workflows[order.id]?.revision ?? 0; setNote(event.target.value); }} onClear={() => setNote("")} placeholder={t("仅人工处理时填写")} /></label><button type="button" className="button button--secondary" disabled={pending || !note.trim() || Boolean(storageError)} onClick={() => void save()}>{submitting ? t("正在保存…") : receipt.waiting ? t("待核对") : t("确认无需采购")}</button>{error || storageError ? <p role="alert" className="form-error">{systemText(error || storageError)}</p> : null}</div>;
}
