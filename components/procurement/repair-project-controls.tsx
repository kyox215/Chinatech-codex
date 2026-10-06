"use client";
import { useLanguage } from "@/components/language-provider";
import { repairItemText } from "@/lib/i18n/repair-display";
import { useRef, useState } from "react";
import { InputControl } from "@/components/input-control";
import { useStaff } from "@/components/staff/use-staff";
import { useRepairWorkflows, updateRepairWorkflow } from "@/components/repairs/repair-workflow-store";
import { initialRepairWorkflow, isRepairHistory, isRepairReady } from "@/lib/repair-workflow";
import { currentRepairRequirements, type RepairRequirement } from "@/lib/repair-requirements";
import type { RepairDirectoryEntry } from "@/lib/repair-intake-record";
import type { ProcurementRecord } from "@/lib/procurement";

export function RepairProjectControls({ order, records, onPendingChange }: { order: RepairDirectoryEntry; records: ProcurementRecord[]; onPendingChange: (value: boolean) => void }) {
  const { t } = useLanguage();
  const staff = useStaff();
  const { workflows } = useRepairWorkflows();
  const workflow = workflows[order.id] ?? initialRepairWorkflow(order);
  const requirements = currentRepairRequirements(order, workflow);
  if (!staff.can("repairs.edit") || isRepairHistory(order, workflow) || isRepairReady(workflow)) return null;
  if (!requirements.length) return <AddProject key={`${staff.member?.id}:${staff.member?.revision}`} order={order} records={records} onPendingChange={onPendingChange}/>;
  const unresolved = requirements.filter(row => (row.mode === "pending" || !row.confirmed) && !records.some(record => record.repairId === order.id && record.requirementId === row.id && record.required !== false));
  return unresolved.length ? <details className="repair-workflow-history"><summary>{t("维修项目核对")}</summary>{unresolved.map(item => <NoPurchaseProject key={`${item.id}:${item.revision}:${staff.member?.revision}`} order={order} item={item} records={records} onPendingChange={onPendingChange}/>)}</details> : null;
}
function AddProject({ order, records, onPendingChange }: { order: RepairDirectoryEntry; records: ProcurementRecord[]; onPendingChange: (value: boolean) => void }) {
  const { t , systemText } = useLanguage();
  const { workflows, error: storageError } = useRepairWorkflows();
  const [opened] = useState(() => ({ revision: workflows[order.id]?.revision ?? 0, id: `project:${crypto.randomUUID()}` }));
  const [title, setTitle] = useState(""), [request, setRequest] = useState(""), [error, setError] = useState(""), [pending, setPending] = useState(false);
  const busy = useRef(false);
  async function save() {
    if (busy.current || !title.trim()) return; busy.current = true; setPending(true); onPendingChange(true); setError("");
    try { await updateRepairWorkflow(order, { type: "requirement", item: { id: opened.id, title: title.trim(), request, revision: 1, mode: "pending", confirmed: false, deviceFingerprint: order.deviceFingerprint }, note: "登记本次维修项目。" }, records, opened.revision); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "项目未保存。"); }
    finally { busy.current = false; setPending(false); onPendingChange(false); }
  }
  return <section className="repair-requirements" aria-label={t("添加维修项目")}><h3>{t("本次维修项目")}</h3><label className="field"><span>{t("维修项目")}</span><InputControl disabled={pending} value={title} maxLength={100} onChange={event => setTitle(event.target.value)} onClear={() => setTitle("")} placeholder={t("例如：屏幕")} /></label><label className="field"><span>{t("具体要求（选填）")}</span><InputControl disabled={pending} value={request} maxLength={1200} onChange={event => setRequest(event.target.value)} onClear={() => setRequest("")} /></label>{error || storageError ? <p role="alert" className="form-error">{systemText(error || storageError)}</p> : null}<button type="button" className="button button--secondary" disabled={pending || !title.trim() || Boolean(storageError)} onClick={() => void save()}>{pending ? t("正在保存…") : t("添加维修项目")}</button></section>;
}
function NoPurchaseProject({ order, item, records, onPendingChange }: { order: RepairDirectoryEntry; item: RepairRequirement; records: ProcurementRecord[]; onPendingChange: (value: boolean) => void }) {
  const { t, locale, systemText } = useLanguage();
  const { workflows, error: storageError } = useRepairWorkflows();
  const revision = useRef<number | null>(null);
  const [note, setNote] = useState(""), [pending, setPending] = useState(false), [error, setError] = useState("");
  const busy = useRef(false);
  async function save() {
    if (busy.current || !note.trim()) return; busy.current = true; setPending(true); onPendingChange(true); setError("");
    try { await updateRepairWorkflow(order, { type: "requirement", item: { ...item, mode: "none", confirmed: true }, note }, records, revision.current ?? workflows[order.id]?.revision ?? 0); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "核对未保存。"); }
    finally { busy.current = false; setPending(false); onPendingChange(false); }
  }
  return <div className="repair-requirement"><strong>{repairItemText(item.title, locale)}</strong><label className="field"><span>{t("无需采购说明")}</span><InputControl disabled={pending} value={note} maxLength={1200} onChange={event => { if (revision.current === null) revision.current = workflows[order.id]?.revision ?? 0; setNote(event.target.value); }} onClear={() => setNote("")} placeholder={t("仅人工处理时填写")} /></label><button type="button" className="button button--secondary" disabled={pending || !note.trim() || Boolean(storageError)} onClick={() => void save()}>{pending ? t("正在保存…") : t("确认无需采购")}</button>{error || storageError ? <p role="alert" className="form-error">{systemText(error || storageError)}</p> : null}</div>;
}
