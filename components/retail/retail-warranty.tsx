"use client";

import { useRef, useState, type ReactNode } from "react";
import { Check, Printer, ShieldCheck } from "lucide-react";
import { canEditRetailField, retailWarrantyExpiry, retailWarrantyLabel, validateRetailFieldEdit, type RetailSale, type RetailUnit } from "@/lib/retail";
import { useStaff } from "@/components/staff/use-staff";
import { useRetail } from "./retail-provider";
import { RetailWarrantyControl } from "./retail-warranty-control";
import { RetailReceipt } from "./retail-receipt";
import { RetailWarrantyTerms } from "./retail-warranty-terms";
import surface from "./retail-surface.module.css";
import styles from "./retail-warranty.module.css";

export function RetailWarrantyPanel({ unit, onReview, editor, blocked = false }: { unit: RetailUnit; onReview: (candidate: RetailUnit) => void; editor?: ReactNode; blocked?: boolean }) {
  const [printing, setPrinting] = useState(false);
  const printTrigger = useRef<HTMLButtonElement>(null);
  const [months, setMonths] = useState(unit.warrantyMonths);
  const [reset, setReset] = useState(0);
  const [error, setError] = useState("");
  const { units, ready, error: storageError } = useRetail();
  const staff = useStaff();
  const editable = !blocked && canEditRetailField(unit, "warrantyMonths") && staff.can("retail.edit") && ready && !storageError;
  const changed = !Object.is(months, unit.warrantyMonths);
  function review() {
    try { const candidate = validateRetailFieldEdit(unit, { field: "warrantyMonths", value: months }, units); if (candidate === unit) return; setError(""); onReview(candidate); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "请核对保修期限。"); }
  }
  return <section className="panel" aria-label="商家保修"><div className={"detail-section__head " + surface.sectionHead}><div><span><ShieldCheck size={18} /></span><h3>商家保修</h3></div></div><div className={styles.body}>
    {editor ? null : <RetailWarrantyControl key={reset} value={months} onChange={value => { setMonths(value); setError(""); }} disabled={!editable} />}
    {!editor && changed ? <div className={styles.draftActions}><small>已保存：{retailWarrantyLabel(unit.warrantyMonths)}</small><button type="button" className="button button--primary button--compact" disabled={!editable} onClick={review}><Check size={16} />核对修改</button><button type="button" className="button button--secondary button--compact" onClick={() => { setMonths(unit.warrantyMonths); setError(""); setReset(value => value + 1); }}>取消修改</button></div> : null}
    {!editor && error ? <p className="form-error" role="alert">{error}</p> : null}{editor}<button type="button" className="button button--secondary button--compact" ref={printTrigger} onClick={() => setPrinting(true)}><Printer size={16} />保修单预览</button><RetailWarrantyTerms enabled={unit.warrantyMonths !== null} /></div>{printing ? <RetailReceipt unit={unit} restoreFocusRef={printTrigger} onClose={() => setPrinting(false)} /> : null}</section>;
}

export function RetailSaleWarranty({ sale }: { unit: RetailUnit; sale: RetailSale }) {
  const expiry=sale.deliveryDate&&sale.warranty?retailWarrantyExpiry(sale.deliveryDate,sale.warranty.months):null;
  return <div><p className={styles.note}><ShieldCheck size={14}/>商家保修：{sale.warranty?retailWarrantyLabel(sale.warranty.months):"未记录 · 核对原销售凭证"}{sale.warranty?.months!==null&&sale.warranty?" · "+(expiry?"届满日 "+expiry:"待确认实际交付日期"):""}</p></div>;
}
