"use client";
import { PageControls, QueryNotice, useTemporaryPageQuery } from "@/components/backend-query";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { SelectControl } from "@/components/select-control";
import { useStaff } from "@/components/staff/use-staff";
import { useStoreSettings } from "@/components/settings/settings-store";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { arrivedQuantity, procurementStatus, type ProcurementRecord } from "@/lib/procurement";
import { resolveSupplierId } from "@/lib/procurement-batch";
import { useProcurement } from "@/components/backend-domain-context";
type BatchSelection = Record<string, { revision: number; quantity: string; record: ProcurementRecord }>;
export function mergeBatchPageSelection(current: BatchSelection, rows: ProcurementRecord[]): BatchSelection {
  const next = { ...current };
  for (const row of rows) if (!next[row.id]) next[row.id] = { revision: row.events.length, quantity: "", record: row };
  if (Object.keys(next).length > 100) throw new Error("每批最多100条，请分批确认。");
  return next;
}
export function SupplierBatchDialog({action,onClose}:{action:"ordered"|"arrival";onClose:()=>void}) {
  const staff=useStaff();const canEdit=staff.can("repairs.edit");const {records,dispatch}=useProcurement();const {settings}=useStoreSettings();const orders=useRepairDirectory();
  const [supplierId,setSupplierId]=useState("");const [page,setPage]=useState(1);const [selected,setSelected]=useState<Record<string,{revision:number;quantity:string;record:ProcurementRecord}>>({});
  const [confirming,setConfirming]=useState(false);const [error,setError]=useState("");const [pending,setPending]=useState(false);const [success,setSuccess]=useState("");const busy=useRef(false);
  const dialog=useRef<HTMLDialogElement>(null);const titleId=useId();
  const scope=`/app/procurement-batch?${new URLSearchParams({action,...(supplierId?{supplier:supplierId}:{}),...(page>1?{page:String(page)}:{})})}`;
  const query=useTemporaryPageQuery(scope);const available=!query.backend || query.state?.scope===scope;const remote=available?query.state?.views?.procurementBatch:undefined;
  useEffect(()=>{dialog.current?.showModal();},[]);
  const eligible=(available?records:[]).filter(row=>action==="ordered"?procurementStatus(row)==="cart":!['draft','cart','complete'].includes(procurementStatus(row)));
  const unresolved=eligible.filter(row=>!resolveSupplierId(row,settings.suppliers));
  const suppliers=settings.suppliers.filter(supplier=>remote?(remote.counts[supplier.id]??0)>0:eligible.some(row=>resolveSupplierId(row,settings.suppliers)===supplier.id));
  const rows=eligible.filter(row=>resolveSupplierId(row,settings.suppliers)===supplierId);
  const pageCount=remote?.pageCount??Math.max(1,Math.ceil(rows.length/50));const currentPage=remote?.page??Math.min(page,pageCount);const visibleRows=query.backend?rows:rows.slice((currentPage-1)*50,currentPage*50);
  const chosen=Object.values(selected).map(item=>item.record);const changed=rows.some(row=>selected[row.id]&&row.events.length!==selected[row.id].revision);
  const supplier=settings.suppliers.find(row=>row.id===supplierId);
  function switchSupplier(id:string){setSupplierId(id);setPage(1);setSelected({});setConfirming(false);setError("");setSuccess("");}
  async function save(){if(busy.current||!canEdit||!available||query.loading||query.error)return;busy.current=true;setPending(true);setError("");try{
    if(changed)throw new Error("采购条目已变化，请重新核对整批。");
    await dispatch({type:"batch",action,supplierId,items:chosen.map(row=>({id:row.id,revision:selected[row.id].revision,...(action==="arrival"?{quantity:Number(selected[row.id].quantity)}:{})}))});
    setSelected({});setConfirming(false);setSuccess(action==="ordered"?"本供应商所选条目已记录实际下单。":"本批实际到货已保存。");
  }catch(reason){setError(reason instanceof Error?reason.message:"保存失败，清单已保留。");}finally{busy.current=false;setPending(false);}}
  const total=chosen.reduce((sum,row)=>sum+(action==="ordered"?row.quantity:Number(selected[row.id].quantity)||0),0);
  return createPortal(<dialog className="repair-parts-dialog supplier-batch-dialog" ref={dialog} aria-labelledby={titleId} onCancel={event=>{if(busy.current)event.preventDefault();}} onClose={onClose}>
    <header><h2 id={titleId}>{action==="ordered"?"采购车 · 按供应商下单":"按供应商登记实际到货"}</h2><button className="icon-button" type="button" aria-label="关闭供应商批量操作" disabled={pending} onClick={onClose}><X size={20}/></button></header>
    <QueryNotice query={query}/>
    <label className="field"><span>本次供应商</span><SelectControl aria-label="批量操作供应商" value={supplierId} disabled={pending||confirming||!available||query.loading} onChange={event=>switchSupplier(event.target.value)}><option value="">请选择供应商</option>{suppliers.map(row=><option key={row.id} value={row.id}>{row.name} · {remote?.counts[row.id]??eligible.filter(record=>resolveSupplierId(record,settings.suppliers)===row.id).length}条{!row.active?"（已停用）":""}</option>)}</SelectControl></label>
    {(remote?.unresolved??unresolved.length)?<p className="repair-stage-note">{remote?.unresolved??unresolved.length}条供应商待核对，暂不进入批量清单。请打开对应配件核对供应商。</p>:null}
    {supplierId&&!rows.length?<p className="section-empty">该供应商暂无可操作条目。</p>:null}
    {available&&!query.loading&&!query.error&&!eligible.length?<p className="section-empty">{action==="ordered"?"采购车为空。":"暂无已下单且待到货的配件。"}</p>:null}
    {rows.length&&!confirming?<><div className="repair-batch-toolbar"><span>{Object.keys(selected).length}条已选 · 每批最多100条</span><button type="button" className="button button--secondary button--tiny" disabled={pending||!canEdit} onClick={()=>{try{setSelected(mergeBatchPageSelection(selected,visibleRows));setError("");}catch(reason){setError(reason instanceof Error?reason.message:"每批最多100条，请分批确认。");}}}>{query.backend || rows.length>50?"选择本页":"选择本供应商全部"}</button><button type="button" className="button button--secondary button--tiny" disabled={pending} onClick={()=>setSelected({})}>取消选择</button></div>
      <div className="repair-batch-rows">{visibleRows.map(row=>{const order=orders.find(order=>order.id===row.repairId);return <article className="repair-batch-row" key={row.id}><label className="repair-batch-selection"><input type="checkbox" aria-label={`选择采购 ${row.id}`} checked={Boolean(selected[row.id])} disabled={pending||!canEdit} onChange={event=>{const checked=event.target.checked;setError("");setSelected(current=>{const next={...current};if(checked){if(Object.keys(next).length>=100){setError("每批最多100条，请分批确认。");return current;}next[row.id]={revision:row.events.length,quantity:"",record:row};}else delete next[row.id];return next;});}}/><span><strong>{row.item}</strong><small><Link href={`/app/repairs/${row.repairId}`}>{row.repairId}</Link> · {order?.device.model??"工单待核对"}{order?.status==="cancelled"?" · 工单已作废":""}</small>{row.specification?<small>{row.specification}</small>:null}</span></label><span>采购 {row.quantity} · 已到 {arrivedQuantity(row)}</span>{action==="arrival"&&selected[row.id]?<label className="field"><span>本批实际到货 *</span><input aria-label={`${row.id} 本批到货数量`} type="number" min="1" max={row.quantity-arrivedQuantity(row)} step="1" value={selected[row.id].quantity} onChange={event=>{const quantity=event.target.value;setSelected(current=>({...current,[row.id]:{...current[row.id],quantity}}));}}/></label>:null}</article>;})}</div>{!query.backend&&pageCount>1?<nav className="query-pagination" aria-label="供应商采购候选分页"><span>{currentPage} / {pageCount} · 共{rows.length}条</span><button type="button" className="button button--secondary" disabled={pending||currentPage===1} onClick={()=>setPage(currentPage-1)}>上一页</button><button type="button" className="button button--secondary" disabled={pending||currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>下一页</button></nav>:null}</>:null}
    {!confirming&&remote?<PageControls page={remote.page} pageCount={remote.pageCount} onPage={setPage}/>:null}
    {confirming?<section className="repair-batch-confirm" aria-label="批量操作核对"><h3>{supplier?.name}</h3><p>{chosen.length}条配件 · {new Set(chosen.map(row=>row.repairId)).size}张工单 · {total}件</p><ul>{chosen.map(row=><li key={row.id}>{row.repairId} · {row.item} · {action==="ordered"?row.quantity:selected[row.id].quantity}件</li>)}</ul><p className="repair-stage-note">{action==="ordered"?"请确认这份清单已经实际向供应商下单。":"请确认逐条填写的是本批实际收到的数量。"}</p></section>:null}
    {changed?<p role="alert" className="form-error">清单已变化，请返回重新选择，避免更新未核对的条目。</p>:null}
    {error?<p role="alert" className="form-error">{error}</p>:null}{success?<p role="status">{success}</p>:null}
    <footer><button type="button" className="button button--secondary" disabled={pending} onClick={()=>confirming?setConfirming(false):onClose()}>{confirming?"返回核对":"关闭"}</button>{canEdit?<button type="button" className="button button--primary" disabled={pending||!available||query.loading||Boolean(query.error)||!chosen.length||changed||(action==="ordered"&&!supplier?.active)} onClick={()=>{if(confirming){void save();return;}if(action==="arrival"&&chosen.some(row=>!/^\d+$/.test(selected[row.id].quantity)||Number(selected[row.id].quantity)<1||Number(selected[row.id].quantity)>row.quantity-arrivedQuantity(row))){setError("请逐条填写不超过待到货数量的正整数。");return;}setError("");setConfirming(true);}}>{pending?"正在保存…":confirming?"确认保存实际事实":"核对所选清单"}</button>:null}</footer>
  </dialog>,document.body);
}
