"use client";
import { Toast } from "@/components/toast";
import { OperationRecoveryControls, useOperationReceipt } from "@/components/use-operation-receipt";
import { useLanguage } from "@/components/language-provider";
import { repairItemText } from "@/lib/i18n/repair-display";
import { InputControl } from "@/components/input-control";
import { NavigationLink as Link } from "@/components/navigation-link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { SelectControl } from "@/components/select-control";
import { useStaff } from "@/components/staff/use-staff";
import { useStoreSettings } from "@/components/settings/settings-store";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { arrivedQuantity, procurementStatus } from "@/lib/procurement";
import { resolveSupplierId } from "@/lib/procurement-batch";
import { useProcurement } from "./procurement-provider";
export function SupplierBatchDialog({action,onClose,repairId,onSaved}:{action:"arrival";onClose:()=>void;repairId?:string;onSaved?:(repairIds:string[])=>void}) {
  const { t, locale, systemText } = useLanguage();
  const staff=useStaff();const canEdit=staff.can("repairs.edit");const {records,dispatch}=useProcurement();const {settings}=useStoreSettings();const orders=useRepairDirectory();
  const [supplierId,setSupplierId]=useState("");const [selected,setSelected]=useState<Record<string,{revision:number;quantity:string}>>({});
  const [confirming,setConfirming]=useState(false);const [error,setError]=useState("");const receipt = useOperationReceipt();
  const [pendingBase, setPending] = useState(false);
  const pending = pendingBase || receipt.waiting;const [success,setSuccess]=useState("");const busy=useRef(false);
  const dialog=useRef<HTMLDialogElement>(null);const titleId=useId();
  useEffect(()=>{dialog.current?.showModal();},[]);
  const eligible=records.filter(row=>{
    if(repairId && row.repairId!==repairId)return false;
    return !['draft','cart','complete'].includes(procurementStatus(row));
  });
  const unresolved=eligible.filter(row=>!resolveSupplierId(row,settings.suppliers));
  const suppliers=settings.suppliers.filter(supplier=>eligible.some(row=>resolveSupplierId(row,settings.suppliers)===supplier.id));
  const rows=eligible.filter(row=>resolveSupplierId(row,settings.suppliers)===supplierId);
  const chosen=rows.filter(row=>selected[row.id]);const changed=chosen.some(row=>row.events.length!==selected[row.id].revision)||Object.keys(selected).some(id=>!chosen.some(row=>row.id===id));
  const supplier=settings.suppliers.find(row=>row.id===supplierId);
  function switchSupplier(id:string){setSupplierId(id);setSelected({});setConfirming(false);setError("");setSuccess("");}
  async function save(){const requestId=crypto.randomUUID();if(busy.current||receipt.isWaiting()||!canEdit)return;busy.current=true;setPending(true);setError("");setSuccess("");try{
    if(changed)throw new Error("采购条目已变化，请重新核对整批。");
    await dispatch({type:"batch",action,supplierId,items:chosen.map(row=>({id:row.id,revision:selected[row.id].revision,quantity:Number(selected[row.id].quantity)}))},{requestId});
    onSaved?.([...new Set(chosen.map(row=>row.repairId))]);
    setSelected({});setConfirming(false);setSuccess("本批实际到货已保存。");
  }catch(reason){receipt.watch(requestId,()=>{onSaved?.([...new Set(chosen.map(row=>row.repairId))]);setSelected({});setConfirming(false);setError("");setSuccess("本批实际到货已保存。");},()=>setError(""));setError(reason instanceof Error?reason.message:"保存失败，清单已保留。");}finally{busy.current=false;setPending(false);}}
  const total=chosen.reduce((sum,row)=>sum+(Number(selected[row.id].quantity)||0),0);
  return createPortal(<dialog className="repair-parts-dialog supplier-batch-dialog" ref={dialog} aria-labelledby={titleId} onCancel={event=>{if(busy.current || receipt.isWaiting())event.preventDefault();}} onClose={onClose}>
    <header><h2 id={titleId}>{t("按供应商登记实际到货")}</h2><button className="icon-button" type="button" aria-label={t("关闭供应商批量操作")} disabled={pending} onClick={onClose}><X size={20}/></button></header>
    <label className="field"><span>{t("本次供应商")}</span><SelectControl aria-label={t("批量操作供应商")} value={supplierId} disabled={pending||confirming} onChange={event=>switchSupplier(event.target.value)}><option value="">{t("请选择供应商")}</option>{suppliers.map(row=><option key={row.id} value={row.id}>{row.name} · {eligible.filter(record=>resolveSupplierId(record,settings.suppliers)===row.id).length}{t("条")}{!row.active?t("（已停用）"):""}</option>)}</SelectControl></label>
    {unresolved.length?<p className="repair-stage-note">{unresolved.length}{t("条供应商待核对，暂不进入批量清单。请打开对应配件核对供应商。")}</p>:null}
    {supplierId&&!rows.length?<p className="section-empty">{t("该供应商暂无可操作条目。")}</p>:null}
    {!eligible.length?<p className="section-empty">{t("暂无已下单且待到货的配件。")}</p>:null}
    {rows.length&&!confirming?<><div className="repair-batch-toolbar"><span>{Object.keys(selected).length}{t("条已选 · 每批最多100条")}</span><button type="button" className="button button--secondary button--tiny" disabled={pending||!canEdit} onClick={()=>{setSelected(Object.fromEntries(rows.slice(0,100).map(row=>[row.id,{revision:row.events.length,quantity:""}])));setError("");}}>{rows.length>100?t("选择前100条"):t("选择本供应商全部")}</button><button type="button" className="button button--secondary button--tiny" disabled={pending} onClick={()=>setSelected({})}>{t("取消选择")}</button></div>
      <div className="repair-batch-rows">{rows.map(row=>{const order=orders.find(order=>order.id===row.repairId);return <article className="repair-batch-row" key={row.id}><label className="repair-batch-selection"><input type="checkbox" aria-label={t("选择采购 {v0}", { v0: row.id })} checked={Boolean(selected[row.id])} disabled={pending||!canEdit} onChange={event=>{const checked=event.target.checked;setError("");setSelected(current=>{const next={...current};if(checked){if(Object.keys(next).length>=100){setError("每批最多100条，请分批确认。");return current;}next[row.id]={revision:row.events.length,quantity:""};}else delete next[row.id];return next;});}}/><span><strong>{repairItemText(row.item, locale)}</strong><small><Link href={`/app/repairs/${row.repairId}`}>{row.repairId}</Link> · {order?.device.model??t("工单待核对")}{order?.status==="cancelled"?t(" · 工单已作废"):""}</small>{row.specification?<small>{row.specification}</small>:null}</span></label><span>{t("采购 ")}{row.quantity} {t(" · 已到 ")}{arrivedQuantity(row)}</span>{action==="arrival"&&selected[row.id]?<label className="field"><span>{t("本批实际到货 *")}</span><InputControl required aria-label={t("{v0} 本批到货数量", { v0: row.id })} type="number" min="1" max={row.quantity-arrivedQuantity(row)} step="1" value={selected[row.id].quantity} onChange={event=>{const quantity=event.target.value;setSelected(current=>({...current,[row.id]:{...current[row.id],quantity}}));}}/></label>:null}</article>;})}</div></>:null}
    {confirming?<section className="repair-batch-confirm" aria-label={t("批量操作核对")}><h3>{supplier?.name}</h3><p>{chosen.length}{t("条配件 · ")}{new Set(chosen.map(row=>row.repairId)).size}{t("张工单 · ")}{total}{t("件")}</p><ul>{chosen.map(row=><li key={row.id}>{row.repairId} · {repairItemText(row.item, locale)} · {selected[row.id].quantity}{t("件")}</li>)}</ul><p className="repair-stage-note">{t("请确认逐条填写的是本批实际收到的数量。")}</p></section>:null}
    {changed?<p role="alert" className="form-error">{t("清单已变化，请返回重新选择，避免更新未核对的条目。")}</p>:null}
    {error?<p role="alert" className="form-error">{systemText(error)}</p>:null}{success?<Toast message={systemText(success)} onDismiss={()=>setSuccess("")}/>:null}
    <footer><button type="button" className="button button--secondary" disabled={pending} onClick={()=>confirming?setConfirming(false):onClose()}>{confirming?t("返回核对"):t("关闭")}</button>{canEdit?<button type="button" className="button button--primary" disabled={pending||!chosen.length||changed} onClick={()=>{if(confirming){void save();return;}if(action==="arrival"){const inputs=Array.from(dialog.current?.querySelectorAll<HTMLInputElement>('input[type="number"]')??[]);const invalid=inputs.filter(input=>!input.checkValidity());if(invalid.length){invalid[0].reportValidity();return;}}if(action==="arrival"&&chosen.some(row=>!/^\d+$/.test(selected[row.id].quantity)||Number(selected[row.id].quantity)<1||Number(selected[row.id].quantity)>row.quantity-arrivedQuantity(row))){setError("请逐条填写不超过待到货数量的正整数。");return;}setError("");setConfirming(true);}}>{pending?t("正在保存…"):confirming?t("确认保存实际事实"):t("核对所选清单")}</button>:null}</footer>
  <OperationRecoveryControls requestId={receipt.requestId}/></dialog>,document.body);
}
