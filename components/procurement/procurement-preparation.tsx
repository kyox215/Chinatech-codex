"use client";
import { OperationRecoveryControls, useOperationReceipt } from "@/components/use-operation-receipt";

import { useLanguage } from "@/components/language-provider";
import { NavigationLink as Link } from "@/components/navigation-link";
import { useRef, useState } from "react";
import { CheckCircle2, PackageSearch, Truck } from "lucide-react";
import { isPreorder, type ProcurementRecord } from "@/lib/procurement";
import { useProcurement } from "./procurement-provider";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { useRepairWorkflows } from "@/components/repairs/repair-workflow-store";
import { initialRepairWorkflow, isRepairHistory, isRepairReady } from "@/lib/repair-workflow";
import { useStaff } from "@/components/staff/use-staff";

export function ProcurementFeedback({ recordId }: { recordId: string }) {
  const { systemText } = useLanguage();
  const { feedback } = useProcurement();
  if (feedback?.recordId !== recordId) return null;
  return <div className={`procurement-feedback${feedback.error ? " procurement-feedback--error" : ""}`} role={feedback.error ? "alert" : "status"}>{feedback.error ? null : <CheckCircle2 size={16} />}{systemText(feedback.message)}</div>;
}

// Shared one-click markers for work orders and procurement detail.
export function ProcurementPreparation({ record, onPendingChange }: { record: ProcurementRecord; onPendingChange?: (pending: boolean, requestId?: string) => boolean | void }) {
  const { t } = useLanguage();
  const canEdit = useStaff().can("repairs.edit");
  const { dispatch } = useProcurement();
  const order = useRepairDirectory().find(row => row.id === record.repairId);
  const { workflows } = useRepairWorkflows();
  const workflow = order ? workflows[order.id] ?? initialRepairWorkflow(order) : undefined;
  const purchaseOpen = Boolean(order && workflow && !isRepairHistory(order, workflow) && !isRepairReady(workflow));
  const receipt = useOperationReceipt();
  const busy = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ id: string; revision: number; supplierId: string | undefined; supplier: string } | null>(null);
  const confirmed = confirmation?.id === record.id && confirmation.revision === record.events.length && confirmation.supplierId === record.supplierId && confirmation.supplier === record.supplier;

  async function append() {
    if (!canEdit || busy.current || receipt.isWaiting() || !purchaseOpen || !confirmed || !confirmation) return;
    const requestId=crypto.randomUUID();
    if(onPendingChange?.(true,requestId)===false)return;
    busy.current = true;
    setSubmitting(true);
    const release=()=>{busy.current=false;onPendingChange?.(false,requestId);};
    try {await dispatch({ type: "append", id: confirmation.id, revision: confirmation.revision, event: {
      id: crypto.randomUUID(), type: "ordered", quantity: 0, note: "标记实际已下单。",
      time: new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" }).format(new Date()),
    } },{requestId});} catch {receipt.watch(requestId,release,release);}
    finally {if(!receipt.isWaiting())release();setSubmitting(false);}
  }

  if (!isPreorder(record)) return <div className="procurement-preparation"><ProcurementFeedback recordId={record.id} /><Link className="button button--secondary" href={`/app/procurement/${record.id}`}>{canEdit ? t("查看采购与登记到货") : t("查看采购详情")}</Link></div>;
  if (canEdit && !purchaseOpen) return <div className="procurement-preparation"><p className="procurement-action-hint">{t("请先恢复维修，再新增配件或下单。")}</p><Link className="button button--secondary" href={`/app/repairs/${record.repairId}`}>{t("打开工单")}</Link></div>;
  if (!canEdit) return <div className="procurement-preparation"><p className="procurement-action-hint"><PackageSearch size={16} />{t("待采购 · 未下单")}</p></div>;

  return <div className="procurement-preparation" aria-busy={submitting}>
    <ProcurementFeedback recordId={record.id} />
    <OperationRecoveryControls requestId={onPendingChange?null:receipt.requestId}/>
    {submitting||receipt.waiting ? <p role="status">{t(submitting?"正在保存…":"提交结果待核对，请处理原提交，勿重复新建。")}</p> : null}
    <p className="procurement-action-hint"><PackageSearch size={16} />{t("待采购 · 未下单")}</p>
    <label className="review-confirm"><input type="checkbox" checked={confirmed} disabled={submitting||receipt.waiting} onChange={event=>setConfirmation(event.target.checked ? { id: record.id, revision: record.events.length, supplierId: record.supplierId, supplier: record.supplier } : null)}/><span>{t("确认已向该供应商实际下单")}</span></label>
    <button className="button button--primary" type="button" aria-busy={submitting} disabled={!confirmed||submitting||receipt.waiting} onClick={() => void append()}><Truck size={17} />{submitting?t("正在保存…"):receipt.waiting?t("待核对"):t("记录已实际下单")}</button>
  </div>;
}
