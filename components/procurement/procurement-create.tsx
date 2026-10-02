"use client";

import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { SelectControl } from "@/components/select-control";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PackageSearch, Plus } from "lucide-react";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { validateProcurementDraft, type ProcurementRecord } from "@/lib/procurement";
import { useProcurement } from "./procurement-provider";
import { useStaff } from "@/components/staff/use-staff";
import { AccessPanel } from "@/components/staff/access-panel";

export function ProcurementCreate({ initialRepairId = "" }: { initialRepairId?: string }) {
  const staff=useStaff();const canEdit = staff.can("repairs.edit");const canCost=staff.can("financial.edit");
  const router = useRouter();
  const repairOrders = useRepairDirectory();
  const { dispatch, feedback } = useProcurement();
  const [pending, setPending] = useState("");
  useEffect(() => { if (canEdit && pending && feedback?.recordId === pending && !feedback.error) router.push(`/app/procurement/${pending}`); }, [canEdit, pending, feedback, router]);
  const [repairId, setRepairId] = useState(initialRepairId);
  const [item, setItem] = useState("");
  const [supplier, setSupplier] = useState("");
  const [required, setRequired] = useState(true);
  const [quantity, setQuantity] = useState("1");
  const [cost, setCost] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    if (pending && !feedback?.error) return;
    try {
      if (!repairOrders.some((row) => row.id === repairId)) throw new Error("请选择已有的关联工单。");
      if (cost.trim() && !/^\d+(\.\d{1,2})?$/.test(cost.trim())) throw new Error("单价须为非负金额，最多两位小数；未知时请留空。");
      const record: ProcurementRecord = { id: `PO-DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, repairId, required, item: item.trim(), supplier: supplier.trim(), quantity: quantity.trim() ? Number(quantity) : Number.NaN, unitCostCents: canCost && cost.trim() ? Math.round(Number(cost) * 100) : null, expectedAt, reference: "", events: [] };
      validateProcurementDraft(record);
      setPending(record.id);
      await dispatch({ type: "create", record });
    } catch (error) {
      setError(error instanceof Error ? error.message : "请核对采购资料。");
    }
  }

  const message = pending && feedback?.recordId === pending && feedback.error ? feedback.message : error;
  if (!canEdit) return <AccessPanel />;
  return <main className="module-page procurement-create"><header className="module-heading"><PageTitle title="新建工单采购" backHref="/app/procurement" backLabel="返回采购列表" /></header><form className="panel procurement-create-form" noValidate onSubmit={submit}><div className="detail-section__head"><div><span><PackageSearch size={18} /></span><div><h3>采购条目</h3></div></div><span className="status-pill status-pill--warning">草稿</span></div>{message ? <div className="procurement-feedback procurement-feedback--error" role="alert">{message}</div> : null}<div className="field-grid">
      <label className="field field--wide"><span>关联工单 *</span><SelectControl aria-label="关联工单" value={repairOrders.some(row => row.id === repairId) ? repairId : ""} onChange={(event) => setRepairId(event.target.value)}><option value="">请选择工单</option>{repairOrders.map((repair) => <option value={repair.id} key={repair.id}>{repair.id} · {repair.device.model}</option>)}</SelectControl></label>
      <label className="field"><span>配件名称 *</span><input aria-label="配件名称" value={item} maxLength={100} onChange={(event) => setItem(event.target.value)} placeholder="准确的配件名称与适配型号" /></label>
      <label className="field"><span>供应商 *</span><input aria-label="供应商" value={supplier} maxLength={100} onChange={(event) => setSupplier(event.target.value)} placeholder="例如 MobileParts SRL" /></label>
      <label className="field"><span>配件用途</span><SelectControl aria-label="配件用途" value={required ? "required" : "optional"} onChange={(event) => setRequired(event.target.value === "required")}><option value="required">本单必需配件</option><option value="optional">备选配件，不阻塞本单</option></SelectControl></label>
      <label className="field"><span>采购数量 *</span><input aria-label="采购数量" type="number" step="1" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
      {canCost ? <label className="field"><span>采购单价（€，选填）</span><input aria-label="采购单价" inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="未知请留空" /></label> : null}
      <label className="field"><span>预计到货日期（选填）</span><input aria-label="预计到货日期" type="date" value={expectedAt} onChange={(event) => setExpectedAt(event.target.value)} /></label>
    </div><div className="procurement-create-form__footer"><Link className="button button--secondary" href="/app/procurement">取消</Link><button className="button button--primary" type="submit"><Plus size={17} />创建采购草稿</button></div></form></main>;
}
