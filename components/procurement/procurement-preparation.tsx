"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CheckCircle2, ShoppingCart, Truck } from "lucide-react";
import { isPreorder, procurementStatus, type ProcurementRecord } from "@/lib/procurement";
import { useProcurement } from "@/components/backend-domain-context";
import { useStaff } from "@/components/staff/use-staff";

export function ProcurementFeedback({ recordId }: { recordId: string }) {
  const { feedback } = useProcurement();
  if (feedback?.recordId !== recordId) return null;
  return <div className={`procurement-feedback${feedback.error ? " procurement-feedback--error" : ""}`} role={feedback.error ? "alert" : "status"}>{feedback.error ? null : <CheckCircle2 size={16} />}{feedback.message}</div>;
}

// Shared one-click markers for work orders and procurement detail.
export function ProcurementPreparation({ record }: { record: ProcurementRecord }) {
  const canEdit = useStaff().can("repairs.edit");
  const { dispatch } = useProcurement();
  const status = procurementStatus(record);
  const busy = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  async function append(type: "cart_added" | "cart_removed" | "ordered") {
    if (!canEdit || busy.current) return;
    busy.current = true;
    setSubmitting(true);
    const notes = { cart_added: "标记已加购物车，尚未下单。", cart_removed: "取消加车标记。", ordered: "标记实际已下单。" };
    try {await dispatch({ type: "append", id: record.id, revision: record.events.length, event: {
      id: crypto.randomUUID(), type, quantity: 0, note: notes[type],
      time: new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" }).format(new Date()),
    } });} catch { /* Provider retains operation failure feedback. */ }
    finally { busy.current = false; setSubmitting(false); }
  }

  if (!isPreorder(record)) return <div className="procurement-preparation"><ProcurementFeedback recordId={record.id} /><Link className="button button--secondary" href={`/app/procurement/${record.id}`}>{canEdit ? "查看采购与登记到货" : "查看采购详情"}</Link></div>;
  if (!canEdit) return <div className="procurement-preparation"><p className="procurement-action-hint"><ShoppingCart size={16} />{status === "cart" ? "已加购物车 · 未下单" : "未加购物车 · 未下单"}</p></div>;

  return <div className="procurement-preparation" aria-busy={submitting}>
    <ProcurementFeedback recordId={record.id} />
    <p className="procurement-action-hint"><ShoppingCart size={16} />{status === "cart" ? "已加购物车 · 未下单" : "未加购物车 · 未下单"}</p>
    <button className="button button--secondary" type="button" disabled={submitting} aria-pressed={status === "cart"} onClick={() => void append(status === "cart" ? "cart_removed" : "cart_added")}><ShoppingCart size={17} />{status === "cart" ? "取消加车标记" : "标记已加购物车"}</button>
    <p className="procurement-action-hint">加车后先做标记，真正下单后再标记已下单。</p>
    <button className="button button--primary" type="button" disabled={submitting} onClick={() => void append("ordered")}><Truck size={17} />标记已下单</button>
  </div>;
}
