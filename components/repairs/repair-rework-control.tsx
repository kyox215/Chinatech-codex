"use client";
import { useLanguage } from "@/components/language-provider";
import { repairCustomerName } from "@/lib/i18n/repair-display";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { RotateCcw, X } from "lucide-react";
import { TextareaControl } from "@/components/input-control";
import { SelectControl } from "@/components/select-control";
import { useStaff } from "@/components/staff/use-staff";
import { backendSnapshot, isBackendClient } from "@/lib/backend/client";
import { repairListViewScope, readRepairListView, writeRepairListView } from "@/lib/repair-list-view-state";
import { canCreateRepairRework } from "@/lib/repair-rework";
import { initialRepairWorkflow } from "@/lib/repair-workflow";
import type { RepairDirectoryEntry } from "@/lib/repair-intake-record";
import { createRepairRework } from "./local-intake-store";
import { useRepairWorkflows } from "./repair-workflow-store";

export function RepairReworkControl({ order }: { order: RepairDirectoryEntry }) {
  const staff = useStaff();
  return <ScopedReworkControl key={`${staff.member?.id}:${staff.member?.revision}`} order={order} />;
}
function ScopedReworkControl({ order }: { order: RepairDirectoryEntry }) {
  const { t } = useLanguage();
  const staff = useStaff();
  const { workflows } = useRepairWorkflows();
  const [open, setOpen] = useState(false);
  const workflow = workflows[order.id] ?? initialRepairWorkflow(order);
  if (!staff.can("repairs.edit") || !canCreateRepairRework(workflow)) return null;
  return <><button type="button" aria-label={t("创建返修单")} title={t("创建返修单")} id={`repair-rework-${order.id}`} className="button button--secondary page-toolbar-action" onClick={() => setOpen(true)}><RotateCcw size={17}/><span>{t("创建返修单")}</span></button>{open ? <ReworkDialog order={order} onClose={() => { setOpen(false); requestAnimationFrame(() => document.getElementById(`repair-rework-${order.id}`)?.focus()); }} /> : null}</>;
}
function ReworkDialog({ order, onClose }: { order: RepairDirectoryEntry; onClose: () => void }) {
  const { t, locale , systemText } = useLanguage();
  const router = useRouter();
  const staff = useStaff();
  const { workflows, error: storageError } = useRepairWorkflows();
  const [opened] = useState(() => ({ sourceRevision: order.intakeRevision ?? 1, workflowRevision: workflows[order.id]?.revision ?? 0, repairId: `LOCAL-${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}` }));
  const [reason, setReason] = useState("");
  const [custody, setCustody] = useState<"store" | "customer">("store");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false), dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy.current || !reason.trim()) return;
    busy.current = true; setPending(true); setError("");
    try {
      const id = await createRepairRework({ ...opened, sourceId: order.id, reason, custody });
      const scope = repairListViewScope({ mode: isBackendClient() ? "backend" : "preview", storeId: backendSnapshot()?.storeId ?? "local-preview", member: staff.member });
      if (scope) { const previous = readRepairListView(scope); writeRepairListView(scope, { query: "", status: "all", partsFilter: "all", groupBy: "workflow", sort: previous?.sort ?? "updated", filtersOpen: false, openGroups: { ...previous?.openGroups, rework: true }, view: "active", noticeFilter: "all", scrollY: 0, scrollLeft: 0 }); }
      onClose(); router.push(`/app/repairs/${id}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "返修单未保存，请重试。"); }
    finally { busy.current = false; setPending(false); }
  }
  return createPortal(<dialog ref={dialog} className="repair-parts-dialog" aria-label={t("创建返修单")} onClose={onClose} onCancel={event => { if (busy.current) event.preventDefault(); }}><header><div><small>{t("原工单 ")}{order.id}</small><h2>{t("创建返修单")}</h2></div><button type="button" className="icon-button" aria-label={t("关闭返修窗口")} disabled={pending} onClick={onClose}><X size={20}/></button></header><form onSubmit={event => void save(event)}><p>{repairCustomerName(order, locale)} · {order.device.model}</p><label className="field"><span>{t("本次返修原因")}</span><TextareaControl autoFocus required disabled={pending} maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} placeholder={t("例如：更换屏幕后触摸再次失灵")} /></label><label className="field"><span>{t("本次设备保管")}</span><SelectControl disabled={pending} value={custody} onChange={event => setCustody(event.target.value as "store" | "customer")}><option value="store">{t("已留下设备")}</option><option value="customer">{t("尚未留下设备")}</option></SelectControl></label>{error || storageError ? <p role="alert" className="form-error">{systemText(error || storageError)}</p> : null}<footer><button type="button" className="button button--secondary" disabled={pending} onClick={onClose}>{t("取消")}</button><button className="button button--primary" type="submit" disabled={pending || !reason.trim() || Boolean(storageError)}>{pending ? t("正在创建…") : t("创建返修单")}</button></footer></form></dialog>, document.body);
}
