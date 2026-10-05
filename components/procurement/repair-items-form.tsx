"use client";
import { controlError } from "@/components/control-feedback";

import { InputControl } from "@/components/input-control";
import { useRef, useState } from "react";
import { Battery, Check, Monitor, Plug, Wrench } from "lucide-react";
import { SearchCombobox } from "@/components/search-combobox";
import { DeviceDraftNotice, useDeviceDraft } from "@/components/use-device-draft";
import { useStaff } from "@/components/staff/use-staff";
import { useStoreSettings } from "@/components/settings/settings-store";
import { useLocalIntakes, useRepairDirectory } from "@/components/repairs/local-intake-store";
import { useRepairWorkflows } from "@/components/repairs/repair-workflow-store";
import { currentRepairRequirements } from "@/lib/repair-requirements";
import { initialRepairWorkflow, isRepairHistory, isRepairReady } from "@/lib/repair-workflow";
import { parseItemMoney } from "@/lib/repair-item-pricing";
import type { RepairItemEdit } from "@/lib/repair-item-editor";
import { formatCost, isPreorder, procurementStatus, procurementStatuses } from "@/lib/procurement";
import { useProcurement } from "./procurement-provider";

type ItemInput = {
  requirementId: string; requirementRevision: number; title: string; request: string;
  supplier: string; quote: string; cost: string;
  purchaseId: string; purchaseRevision: number;
  beforeSupplier: string; beforeQuote: string; beforeCost: string;
  linkedVersions: { id: string; revision: number }[];
};
type ItemsDraft = { rows: ItemInput[]; intakeRevision: number; workflowRevision: number };
const moneyInput = (value: number | null | undefined) => value == null ? "" : (value / 100).toFixed(2);

/** Intake projects are the rows: there is no second item picker or procurement wizard. */
export function RepairItemsForm({ repairId, onSaved, onCancel, onPendingChange }: {
  repairId: string; onSaved: () => void; onCancel: () => void; onPendingChange: (pending: boolean) => void;
}) {
  const staff = useStaff();
  const canEdit = staff.can("repairs.edit"), canReadCost = staff.can("financial.read"), canEditCost = canReadCost && staff.can("financial.edit");
  const { records, dispatch } = useProcurement();
  const { settings } = useStoreSettings();
  const order = useRepairDirectory().find(row => row.id === repairId);
  const intake = useLocalIntakes().records.find(row => row.id === repairId);
  const { workflows } = useRepairWorkflows();
  const requirements = order ? currentRepairRequirements(order, workflows[repairId]) : [];
  const workflow = order ? workflows[repairId] ?? initialRepairWorkflow(order) : undefined;
  const purchaseOpen = Boolean(order && workflow && !isRepairHistory(order, workflow) && !isRepairReady(workflow));
  const purchases = records.filter(row => row.repairId === repairId);
  function currentDraft(): ItemsDraft {
    return {
      intakeRevision: order?.intakeRevision ?? 1, workflowRevision: workflows[repairId]?.revision ?? 0,
      rows: requirements.map(requirement => {
        const linked = purchases.filter(row => row.requirementId === requirement.id);
        const record = linked.length === 1 ? linked[0] : undefined;
        const quote = moneyInput(intake?.itemQuotes?.find(row => row.item === requirement.title)?.amountCents);
        const supplier = record?.supplier ?? "", cost = canReadCost ? moneyInput(record?.unitCostCents) : "";
        return {
          requirementId: requirement.id, requirementRevision: requirement.revision, title: requirement.title, request: requirement.request,
          supplier, cost, quote, beforeSupplier: supplier, beforeCost: cost, beforeQuote: quote,
          purchaseId: record?.id ?? `PO-LOCAL-${crypto.randomUUID().toUpperCase()}`, purchaseRevision: record?.events.length ?? 0,
          linkedVersions: linked.map(row => ({ id: row.id, revision: row.events.length })),
        };
      }),
    };
  }
  const [draft, setDraft] = useState<ItemsDraft>(currentDraft);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const deviceDraft = useDeviceDraft(`repair-items:${repairId}`, {
    ...draft, rows: draft.rows.map(row => ({ ...row, cost: canReadCost ? row.cost : "", beforeCost: canReadCost ? row.beforeCost : "" })),
  }, value => {
    if (!value || !Array.isArray(value.rows) || value.rows.length > 100 || !Number.isSafeInteger(value.intakeRevision) || !Number.isSafeInteger(value.workflowRevision)
      || value.rows.some(row => !row || ![row.requirementId, row.title, row.request, row.supplier, row.quote, row.cost, row.beforeSupplier, row.beforeQuote, row.beforeCost, row.purchaseId].every(field => typeof field === "string") || !Number.isSafeInteger(row.requirementRevision) || !Number.isSafeInteger(row.purchaseRevision) || !Array.isArray(row.linkedVersions) || row.linkedVersions.some(link => typeof link.id !== "string" || !Number.isSafeInteger(link.revision)))) throw new Error("设备草稿格式无效。");
    setDraft({ ...value, rows: value.rows.map(row => ({ ...row, cost: canReadCost ? row.cost : "", beforeCost: canReadCost ? row.beforeCost : "" })) });
  }, canEdit);
  const changed = draft.intakeRevision !== (order?.intakeRevision ?? 1) || draft.workflowRevision !== (workflows[repairId]?.revision ?? 0)
    || requirements.length !== draft.rows.length || draft.rows.some(row => {
      const requirement = requirements.find(item => item.id === row.requirementId);
      const linked = purchases.filter(item => item.requirementId === row.requirementId);
      return !requirement || requirement.revision !== row.requirementRevision || linked.length !== row.linkedVersions.length
        || linked.some(item => !row.linkedVersions.some(link => link.id === item.id && link.revision === item.events.length));
    });
  const dirty = draft.rows.some(row => row.quote !== row.beforeQuote || row.supplier !== row.beforeSupplier || (canEditCost && row.cost !== row.beforeCost));
  function update(id: string, field: "supplier" | "quote" | "cost", value: string) {
    setDraft(previous => ({ ...previous, rows: previous.rows.map(row => row.requirementId === id ? {
      ...row, [field]: value,
      ...(field === "supplier" && !value.trim() && !row.beforeSupplier ? { cost: "" } : {}),
    } : row) }));
  }
  function reviewLatest() {
    const latest = currentDraft();
    let purchaseLocked = false;
    setDraft({ ...latest, rows: latest.rows.map(row => {
      const previous = draft.rows.find(item => item.requirementId === row.requirementId);
      const linked = purchases.filter(record => record.requirementId === row.requirementId);
      const locked = !purchaseOpen || linked.length > 1 || linked.some(record => !isPreorder(record));
      if (locked && previous && (previous.supplier !== previous.beforeSupplier || previous.cost !== previous.beforeCost)) purchaseLocked = true;
      return previous ? {
        ...row,
        quote: previous.quote !== previous.beforeQuote ? previous.quote : row.quote,
        supplier: !locked && previous.supplier !== previous.beforeSupplier ? previous.supplier : row.supplier,
        cost: !locked && canEditCost && previous.cost !== previous.beforeCost ? previous.cost : row.cost,
        purchaseId: row.linkedVersions.length ? row.purchaseId : previous.purchaseId,
      } : row;
    }) });
    setError(purchaseLocked ? "采购已下单或已有多条记录，供应商和进价按最新事实保留；报价输入已保留，可继续保存。" : "");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || !canEdit || !dirty) return;
    busy.current = true; setPending(true); onPendingChange(true); setError("");
    try {
      if (changed) throw new Error("工单或配件已变化，请核对最新资料；输入已保留。");
      const items: RepairItemEdit[] = [];
      for (const row of draft.rows) {
        const quoteChanged = row.quote !== row.beforeQuote;
        const purchaseChanged = row.supplier !== row.beforeSupplier || (canEditCost && row.cost !== row.beforeCost);
        if (!quoteChanged && !purchaseChanged) continue;
        const item: RepairItemEdit = { requirementId: row.requirementId, requirementRevision: row.requirementRevision, quoteCents: parseItemMoney(row.quote) };
        if (purchaseChanged) {
          const linked = purchases.filter(record => record.requirementId === row.requirementId);
          if (linked.length > 1 || (linked[0] && !isPreorder(linked[0]))) throw new Error(`${row.title}已有采购事实，供应商及进价不能在此改写；报价可独立保存。`);
          if (linked[0] && !row.supplier.trim()) throw new Error(`${row.title}已有采购记录，清空供应商不能取消采购。`);
          if (row.supplier.trim()) {
            const matches = settings.suppliers.filter(supplier => supplier.active && supplier.name.trim() === row.supplier.trim());
            if (matches.length !== 1) throw new Error(`${row.title}：请选择已登记的门店供应商，或留空只填报价。`);
            item.purchase = { id: row.purchaseId, revision: row.purchaseRevision, supplierId: matches[0].id, unitCostCents: canEditCost ? parseItemMoney(row.cost) : null };
          } else if (row.cost.trim()) throw new Error(`${row.title}：填写进价前请选择供应商。`);
        }
        items.push(item);
      }
      await dispatch({ type: "save-items", repairId, intakeRevision: draft.intakeRevision, workflowRevision: draft.workflowRevision, items });
      await deviceDraft.clear(); onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，输入已保留。"); }
    finally { busy.current = false; setPending(false); onPendingChange(false); }
  }
  return <form className="repair-item-editor" aria-busy={pending} onSubmit={submit}>
    <DeviceDraftNotice draft={deviceDraft} />
    <div className="repair-item-editor__cards">{draft.rows.map(row => {
      const linked = purchases.filter(record => record.requirementId === row.requirementId);
      const record = linked.length === 1 ? linked[0] : undefined;
      const editablePurchase = canEdit && purchaseOpen && linked.length <= 1 && (!record || isPreorder(record));
      const Icon = row.title.includes("屏幕") ? Monitor : row.title.includes("电池") ? Battery : row.title.includes("尾插") ? Plug : Wrench;
      const status = record ? procurementStatuses[procurementStatus(record)] : null;
      const supplierChanged = row.supplier !== row.beforeSupplier && Boolean(row.supplier.trim());
      const statusLabel = supplierChanged && editablePurchase ? "保存后加车" : record && procurementStatus(record) === "cart" ? "已加购物车" : status?.label ?? (linked.length > 1 ? `${linked.length}条配件记录` : row.beforeQuote ? "已报价" : "待填写");
      return <fieldset className="repair-item-card" key={row.requirementId} aria-label={row.title} disabled={pending}>
        <legend className="visually-hidden">{row.title}</legend>
        <div className="repair-item-card__head"><span className="repair-item-card__icon"><Icon size={18} aria-hidden="true" /></span><div><h3>{row.title}</h3>{row.request ? <small>{row.request}</small> : null}</div><span className={`status-pill status-pill--${supplierChanged ? "info" : status?.tone ?? "neutral"}`} role="status">{statusLabel}</span></div>
        <div className="repair-item-card__fields">
          {editablePurchase ? <SearchCombobox validate={value => { if (value === row.beforeSupplier && row.cost === row.beforeCost) return ""; if (!value.trim()) return record ? "已有采购记录，清空供应商不能取消采购。" : row.cost.trim() ? "填写进价前请选择供应商。" : ""; return settings.suppliers.filter(supplier => supplier.active && supplier.name.trim() === value.trim()).length === 1 ? "" : "请选择已登记的门店供应商，或留空只填报价。"; }} label="供应商（选填）" value={row.supplier} onChange={value => update(row.requirementId, "supplier", value)} options={settings.suppliers.filter(supplier => supplier.active).map(supplier => ({ value: supplier.name, label: supplier.name }))} placeholder="不采购可留空" emptyText="请先在门店设置登记供应商" /> : <div className="field"><span>供应商</span><strong>{linked.length ? linked.map(item => item.supplier).join("、") : "未选择"}</strong></div>}
          <label className="field"><span>报价（€）</span>{canEdit ? <InputControl validate={value => controlError(() => parseItemMoney(value))} aria-label={`${row.title}报价`} inputMode="decimal" maxLength={20} value={row.quote} onChange={event => update(row.requirementId, "quote", event.target.value)} placeholder="如 49.90，未知留空" /> : <strong>{formatCost(parseItemMoney(row.quote))}</strong>}</label>
          {canReadCost && (record || row.supplier.trim()) ? <label className="field"><span>进价（€）</span>{canEditCost && editablePurchase ? <InputControl validate={value => controlError(() => parseItemMoney(value))} aria-label={`${row.title}进价`} inputMode="decimal" maxLength={20} value={row.cost} onChange={event => update(row.requirementId, "cost", event.target.value)} placeholder="如 49.90，未知留空" /> : <strong>{record ? formatCost(record.unitCostCents) : "未记录"}</strong>}</label> : null}
        </div>
      </fieldset>;
    })}</div>
    {!draft.rows.length ? <div className="section-empty"><Wrench size={24} /><strong>工单尚未填写维修项目</strong></div> : null}
    {changed ? <p role="alert" className="form-error">工单或配件已变化，输入已保留。<button type="button" className="button button--secondary" disabled={pending} onClick={reviewLatest}>核对最新资料后重试</button></p> : null}
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {canEdit && draft.rows.length ? <footer><button className="button button--secondary" type="button" disabled={pending} onClick={onCancel}>取消</button><button className="button button--primary" type="submit" disabled={pending || changed || !dirty}><Check size={17} aria-hidden="true" />{pending ? "正在保存…" : "保存"}</button></footer> : null}
  </form>;
}
