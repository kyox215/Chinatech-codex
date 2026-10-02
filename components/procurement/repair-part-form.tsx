"use client";
import { useRef, useState } from "react";
import { Check, PackagePlus } from "lucide-react";
import { SelectControl } from "@/components/select-control";
import { SearchCombobox } from "@/components/search-combobox";
import { validateProcurementDraft, type ProcurementRecord } from "@/lib/procurement";
import { useStoreSettings } from "@/components/settings/settings-store";
import { useProcurement } from "./procurement-provider";
import { useStaff } from "@/components/staff/use-staff";
export function RepairPartForm({ repairId, record, onSaved, onCancel }: { repairId: string; record?: ProcurementRecord; onSaved: (id: string) => void; onCancel: () => void }) {
  const staff=useStaff();const canEdit = staff.can("repairs.edit");const canCost=staff.can("financial.edit");
  const { records, dispatch, feedback } = useProcurement();
  const [item, setItem] = useState(record?.item ?? ""); const [supplier, setSupplier] = useState(record?.supplier ?? "");
  const [quantity, setQuantity] = useState(String(record?.quantity ?? 1)); const [required, setRequired] = useState(record?.required !== false);
  const [cost, setCost] = useState(record?.unitCostCents == null ? "" : (record.unitCostCents / 100).toFixed(2));
  const [error, setError] = useState(""); const [pending, setPending] = useState("");
  const identity = useRef(record?.id ?? "");
  const [revision] = useState(record?.events.length ?? 0);
  const { settings } = useStoreSettings();
  const suppliers = [...new Set([...settings.suppliers.filter(row => row.active).map(row => row.name), ...records.map(row => row.supplier).filter(name => !settings.suppliers.some(row => row.name === name && !row.active))])];
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    if (pending && !(feedback?.recordId === pending && feedback.error)) return;
    try {
      if (cost.trim() && !/^\d+(\.\d{1,2})?$/.test(cost.trim())) throw new Error("单价最多两位小数，未知时留空。");
      if (!identity.current) identity.current = `PO-LOCAL-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
      const next: ProcurementRecord = { id: identity.current, repairId, item: item.trim(), supplier: supplier.trim(), quantity: Number(quantity), unitCostCents: canCost && cost.trim() ? Math.round(Number(cost) * 100) : null, required, expectedAt: record?.expectedAt ?? "", reference: record?.reference ?? "", events: [] };
      validateProcurementDraft(next); setError(""); setPending(next.id);
      if (record) await dispatch({ type: "edit", record: next, revision }); else await dispatch({ type: "create", record: next });
      onSaved(next.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败。"); }
  }
  const failed = feedback?.recordId === pending && feedback.error;
  if (!canEdit) return <div className="section-empty"><strong>当前账号没有配件操作权限</strong><button className="button button--secondary" type="button" onClick={onCancel}>返回配件详情</button></div>;
  return <form className="repair-part-form" noValidate onSubmit={submit}><div className="field-grid"><label className="field field--wide"><span>配件名称 *</span><input aria-label="配件名称" value={item} maxLength={100} onChange={event => setItem(event.target.value)} placeholder="配件与适配型号" /></label><SearchCombobox label="供应商 *" value={supplier} onChange={setSupplier} options={suppliers.map(name => ({ value: name, label: name }))} placeholder="搜索或手动填写" /><label className="field"><span>数量 *</span><input aria-label="配件数量" type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} /></label><label className="field"><span>用途</span><SelectControl aria-label="配件用途" value={required ? "required" : "optional"} onChange={event => setRequired(event.target.value === "required")}><option value="required">本单必需</option><option value="optional">备选</option></SelectControl></label>{canCost ? <label className="field"><span>单价（€，选填）</span><input aria-label="配件单价" inputMode="decimal" value={cost} onChange={event => setCost(event.target.value)} placeholder="未知留空" /></label> : null}</div>{error || failed ? <p role="alert" className="form-error">{error || feedback?.message}</p> : null}<footer><button className="button button--secondary" type="button" onClick={onCancel}>取消</button><button className="button button--primary" type="submit" disabled={Boolean(pending) && !failed}>{record ? <Check size={17} /> : <PackagePlus size={17} />}{record ? "保存配件" : "添加配件"}</button></footer></form>;
}
