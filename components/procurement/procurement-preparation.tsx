"use client";

import { useLanguage } from "@/components/language-provider";
import Link from "next/link";
import { useRef, useState } from "react";
import { CheckCircle2, ShoppingCart, Truck } from "lucide-react";
import { isPreorder, procurementStatus, type ProcurementRecord } from "@/lib/procurement";
import { useProcurement } from "./procurement-provider";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { useRepairWorkflows } from "@/components/repairs/repair-workflow-store";
import { initialRepairWorkflow, isRepairHistory, isRepairReady } from "@/lib/repair-workflow";
import { useStaff } from "@/components/staff/use-staff";

export function ProcurementFeedback({ recordId }: { recordId: string }) {
  const { t } = useLanguage();
  const { feedback } = useProcurement();
  if (feedback?.recordId !== recordId) return null;
  return <div className={`procurement-feedback${feedback.error ? " procurement-feedback--error" : ""}`} role={feedback.error ? "alert" : "status"}>{feedback.error ? null : <CheckCircle2 size={16} />}{t(feedback.message)}</div>;
}

// Shared one-click markers for work orders and procurement detail.
export function ProcurementPreparation({ record }: { record: ProcurementRecord }) {
  const { t } = useLanguage();
  const canEdit = useStaff().can("repairs.edit");
  const { dispatch } = useProcurement();
  const order = useRepairDirectory().find(row => row.id === record.repairId);
  const { workflows } = useRepairWorkflows();
  const workflow = order ? workflows[order.id] ?? initialRepairWorkflow(order) : undefined;
  const purchaseOpen = Boolean(order && workflow && !isRepairHistory(order, workflow) && !isRepairReady(workflow));
  const status = procurementStatus(record);
  const busy = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  async function append(type: "cart_added" | "cart_removed" | "ordered") {
    if (!canEdit || busy.current || (type !== "cart_removed" && !purchaseOpen)) return;
    busy.current = true;
    setSubmitting(true);
    const notes = { cart_added: "标记已加购物车，尚未下单。", cart_removed: "取消加车标记。", ordered: "标记实际已下单。" };
    try {await dispatch({ type: "append", id: record.id, revision: record.events.length, event: {
      id: crypto.randomUUID(), type, quantity: 0, note: notes[type],
      time: new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" }).format(new Date()),
    } });} catch { /* Provider retains operation failure feedback. */ }
    finally { busy.current = false; setSubmitting(false); }
  }

  if (!isPreorder(record)) return <div className="procurement-preparation"><ProcurementFeedback recordId={record.id} /><Link className="button button--secondary" href={`/app/procurement/${record.id}`}>{canEdit ? t("查看采购与登记到货") : t("查看采购详情")}</Link></div>;
  if (canEdit && !purchaseOpen) return <div className="procurement-preparation"><p className="procurement-action-hint">{t("请先恢复维修，再新增配件或下单。")}</p><Link className="button button--secondary" href={`/app/repairs/${record.repairId}`}>{t("打开工单")}</Link></div>;
  if (!canEdit) return <div className="procurement-preparation"><p className="procurement-action-hint"><ShoppingCart size={16} />{status === "cart" ? t("已加购物车 · 未下单") : t("未加购物车 · 未下单")}</p></div>;

  return <div className="procurement-preparation" aria-busy={submitting}>
    <ProcurementFeedback recordId={record.id} />
    <p className="procurement-action-hint"><ShoppingCart size={16} />{status === "cart" ? t("已加购物车 · 未下单") : t("未加购物车 · 未下单")}</p>
    <button className="button button--secondary" type="button" disabled={submitting} aria-pressed={status === "cart"} onClick={() => void append(status === "cart" ? "cart_removed" : "cart_added")}><ShoppingCart size={17} />{status === "cart" ? t("取消加车标记") : t("标记已加购物车")}</button>
    <p className="procurement-action-hint">{t("加车后先做标记，真正下单后再标记已下单。")}</p>
    <button className="button button--primary" type="button" disabled={submitting} onClick={() => void append("ordered")}><Truck size={17} />{t("标记已下单")}</button>
  </div>;
}
