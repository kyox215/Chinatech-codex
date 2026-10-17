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
import { SearchCombobox } from "@/components/search-combobox";
import {backendScopeKey} from "@/lib/backend/read-plan";
import {useBackendState} from "@/components/backend-snapshot";
import {ReadFailure,ReadPending} from "@/components/page-recovery";
import {ListPagination,useListWindow} from "@/components/list-pagination";
import {WindowedListRows} from "@/components/windowed-list-rows";
import {useActivityFeedback} from "@/components/operation-feedback";
import {useFormalProcurementBatchData,type ProcurementBatchData} from "./use-procurement-batch-data";
import type {ProcurementBatchRow} from "@/lib/backend/procurement-batch-contract";
import { useStaff } from "@/components/staff/use-staff";
import { useStoreSettings } from "@/components/settings/settings-store";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { arrivedQuantity, procurementStatus } from "@/lib/procurement";
import { resolveSupplierId } from "@/lib/procurement-batch";
import { useProcurement } from "./procurement-provider";
type Props={action:"arrival";onClose:()=>void;repairId?:string;onSaved?:(repairIds:string[])=>void};
export function SupplierBatchDialog(props:Props) {
 const backend=useBackendState();
 return backend.formal&&backend.snapshot?.procurementListEnabled?<FormalSupplierBatchDialog key={backend.snapshot?.read?backendScopeKey(backend.snapshot.read.scope):"unloaded"} {...props}/>:<LegacySupplierBatchDialog {...props}/>;
}
function FormalSupplierBatchDialog(props:Props){const data=useFormalProcurementBatchData(props.repairId);return <SupplierBatchView {...props} data={data}/>;}
function LegacySupplierBatchDialog(props:Props) {
 const {records}=useProcurement(),{settings}=useStoreSettings(),orders=useRepairDirectory(),[supplierId,setSupplierId]=useState(""),[supplierQuery,setSupplierQuery]=useState("");
 const eligible=records.filter(row=>(!props.repairId||row.repairId===props.repairId)&&['ordered','partial'].includes(procurementStatus(row)));
 const unresolved=eligible.filter(row=>!resolveSupplierId(row,settings.suppliers)),rows=eligible.filter(row=>resolveSupplierId(row,settings.suppliers)===supplierId).map(row=>{const order=orders.find(order=>order.id===row.repairId);return {id:row.id,repairId:row.repairId,repairModel:order?.device.model??null,repairCancelled:order?.status==="cancelled",item:row.item,specification:row.specification??null,quantity:row.quantity,arrived:arrivedQuantity(row),ledgerRevision:row.events.length,supplierId};});
 const window=useListWindow(rows.length,supplierId),suppliers=settings.suppliers.map(row=>({...row,count:eligible.filter(record=>resolveSupplierId(record,settings.suppliers)===row.id).length})).filter(row=>row.count);
 const data:ProcurementBatchData={supplierId,setSupplierId,setSupplierQuery,suppliers:suppliers.filter(row=>(row.id+" "+row.name).toLowerCase().includes(supplierQuery.trim().toLowerCase())).slice(0,12),supplier:suppliers.find(row=>row.id===supplierId)??null,rows:rows.slice(0,window.limit),startIndex:0,total:rows.length,eligible:eligible.length,unresolved:unresolved.length,pending:false,ready:true,error:"",hasMore:window.limit<rows.length,loadMore:window.loadMore,seek:()=>{},retry:()=>{},resetKey:window.resetKey,selectFirst:async()=>rows.slice(0,100),readChosen:async ids=>rows.filter(row=>ids.includes(row.id))};
 return <SupplierBatchView {...props} data={data}/>;
}
function SupplierBatchView({action,onClose,onSaved,data}:{action:"arrival";onClose:()=>void;onSaved?:(repairIds:string[])=>void;data:ProcurementBatchData}) {
  const { t, locale, systemText } = useLanguage();
  const staff=useStaff(),canEdit=staff.can("repairs.edit"),{dispatch}=useProcurement(),{supplierId,rows,suppliers,supplier}=data;
  const [selected,setSelected]=useState<Record<string,{revision:number;quantity:string;row:ProcurementBatchRow}>>({});
  const [confirming,setConfirming]=useState(false);const [error,setError]=useState("");const receipt = useOperationReceipt();
  const [pendingBase, setPending] = useState(false);
  const pending = pendingBase || receipt.waiting;const [success,setSuccess]=useState("");const busy=useRef(false);
  const dialog=useRef<HTMLDialogElement>(null);const titleId=useId();
  useEffect(()=>{dialog.current?.showModal();},[]);
  const chosen=Object.values(selected).map(value=>value.row),changed=rows.some(row=>selected[row.id]&&row.ledgerRevision!==selected[row.id].revision);
  const [reading,setReading]=useState(false);
  useActivityFeedback(reading||data.pending,{kind:"read"});
  function switchSupplier(id:string){data.setSupplierId(id);setSelected({});setConfirming(false);setError("");setSuccess("");}
  async function selectFirst(){if(reading||pending)return;setReading(true);setError("");try{const rows=await data.selectFirst();setSelected(Object.fromEntries(rows.map(row=>[row.id,{revision:row.ledgerRevision,quantity:"",row}])));}catch(reason){setError(reason instanceof Error?reason.message:"后台资料暂不可用。");}finally{setReading(false);}}
  async function confirm(){
   if(reading||pending)return;
   if(chosen.some(row=>!/^\d+$/.test(selected[row.id].quantity)||Number(selected[row.id].quantity)<1||Number(selected[row.id].quantity)>row.quantity-row.arrived)){setError("请逐条填写不超过待到货数量的正整数。");return;}
   setReading(true);setError("");try{const current=await data.readChosen(chosen.map(row=>row.id));if(current.length!==chosen.length||current.some(row=>!selected[row.id]||row.ledgerRevision!==selected[row.id].revision||row.supplierId!==supplierId))throw new Error("采购条目已变化，请重新核对整批。");setConfirming(true);}catch(reason){setError(reason instanceof Error?reason.message:"后台资料暂不可用。");}finally{setReading(false);}
  }
  async function save(){const requestId=crypto.randomUUID();if(busy.current||receipt.isWaiting()||!canEdit)return;busy.current=true;setPending(true);setError("");setSuccess("");try{
    if(changed)throw new Error("采购条目已变化，请重新核对整批。");
    await dispatch({type:"batch",action,supplierId,items:chosen.map(row=>({id:row.id,revision:selected[row.id].revision,quantity:Number(selected[row.id].quantity)}))},{requestId});
    onSaved?.([...new Set(chosen.map(row=>row.repairId))]);
    setSelected({});setConfirming(false);setSuccess("本批实际到货已保存。");
  }catch(reason){receipt.watch(requestId,()=>{onSaved?.([...new Set(chosen.map(row=>row.repairId))]);setSelected({});setConfirming(false);setError("");setSuccess("本批实际到货已保存。");},()=>setError(""));setError(reason instanceof Error?reason.message:"保存失败，清单已保留。");}finally{busy.current=false;setPending(false);}}
  const total=chosen.reduce((sum,row)=>sum+(Number(selected[row.id].quantity)||0),0);
  return createPortal(<dialog className="repair-parts-dialog supplier-batch-dialog" ref={dialog} aria-labelledby={titleId} onCancel={event=>{if(busy.current || receipt.isWaiting() || reading)event.preventDefault();}} onClose={onClose}>
    <header><h2 id={titleId}>{t("按供应商登记实际到货")}</h2><button className="icon-button" type="button" aria-label={t("关闭供应商批量操作")} disabled={pending||reading} onClick={onClose}><X size={20}/></button></header>
    <SearchCombobox maxLength={160} label={t("本次供应商")} inputLabel={t("批量操作供应商")} value={supplierId} disabled={pending||reading||confirming} displaySelectedLabel filterOptions={false} loading={data.pending} loadingLabel="正在处理…" commitOnBlur showAllOnOpen onQueryChange={data.setSupplierQuery} onChange={id=>{if(!id||suppliers.some(row=>row.id===id))switchSupplier(id);}} options={[...(supplier&&!suppliers.some(row=>row.id===supplier.id)?[supplier]:[]),...suppliers].map(row=>({value:row.id,label:row.name,detail:`${row.count}${t("条")}${!row.active?t("（已停用）"):""}`}))} emptyText="该供应商暂无可操作条目。"/>
    {data.error?<ReadFailure message={data.error} onRetry={data.retry} pending={data.pending}/>:null}{data.pending?<ReadPending label="正在处理…"/>:null}
    {data.unresolved?<p className="repair-stage-note">{data.unresolved}{t("条供应商待核对，暂不进入批量清单。请打开对应配件核对供应商。")}</p>:null}
    {supplierId&&data.ready&&!data.pending&&!rows.length?<p className="section-empty">{t("该供应商暂无可操作条目。")}</p>:null}
    {data.ready&&!data.pending&&!data.eligible?<p className="section-empty">{t("暂无已下单且待到货的配件。")}</p>:null}
    {(rows.length||chosen.length)&&!confirming?<><div className="repair-batch-toolbar"><span>{Object.keys(selected).length}{t("条已选 · 每批最多100条")}</span><button type="button" className="button button--secondary button--tiny" disabled={pending||reading||!canEdit} onClick={()=>void selectFirst()}>{data.total>100?t("选择前100条"):t("选择本供应商全部")}</button><button type="button" className="button button--secondary button--tiny" disabled={pending||reading} onClick={()=>setSelected({})}>{t("取消选择")}</button></div>
      <div className="repair-batch-rows"><WindowedListRows scrollRoot={dialog} version={data.version} key={data.resetKey} items={rows} total={data.total} startIndex={data.startIndex} pending={data.pending} onSeek={data.seek} rowKey={row=>row.id} render={(row,rowProps)=><article {...rowProps} tabIndex={-1} className="repair-batch-row" key={row.id}><label className="repair-batch-selection"><input type="checkbox" aria-label={t("选择采购 {v0}", { v0: row.id })} checked={Boolean(selected[row.id])} disabled={pending||reading||!canEdit} onChange={event=>{const checked=event.target.checked;setError("");setSelected(current=>{const next={...current};if(checked){if(Object.keys(next).length>=100){setError("每批最多100条，请分批确认。");return current;}next[row.id]={revision:row.ledgerRevision,quantity:"",row};}else delete next[row.id];return next;});}}/><span><strong>{repairItemText(row.item, locale)}</strong><small><Link href={`/app/repairs/${row.repairId}`}>{row.repairId}</Link> · {row.repairModel??t("工单待核对")}{row.repairCancelled?t(" · 工单已作废"):""}</small>{row.specification?<small>{row.specification}</small>:null}</span></label><span>{t("采购 ")}{row.quantity} {t(" · 已到 ")}{row.arrived}</span>{action==="arrival"&&selected[row.id]?<label className="field"><span>{t("本批实际到货 *")}</span><InputControl required disabled={pending||reading||confirming} aria-label={t("{v0} 本批到货数量", { v0: row.id })} type="number" min="1" max={row.quantity-row.arrived} step="1" value={selected[row.id].quantity} onChange={event=>{const quantity=event.target.value;setSelected(current=>({...current,[row.id]:{...current[row.id],quantity}}));}}/></label>:null}</article>}/><ListPagination start={data.startIndex} shown={data.startIndex+rows.length} total={data.total} hasMore={data.hasMore} loading={data.pending} error={Boolean(data.error)} onLoadMore={data.loadMore} resetKey={data.resetKey}/></div></>:null}
    {confirming?<section className="repair-batch-confirm" aria-label={t("批量操作核对")}><h3>{supplier?.name}</h3><p>{chosen.length}{t("条配件 · ")}{new Set(chosen.map(row=>row.repairId)).size}{t("张工单 · ")}{total}{t("件")}</p><ul>{chosen.map(row=><li key={row.id}>{row.repairId} · {repairItemText(row.item, locale)} · {selected[row.id].quantity}{t("件")}</li>)}</ul><p className="repair-stage-note">{t("请确认逐条填写的是本批实际收到的数量。")}</p></section>:null}
    {changed?<p role="alert" className="form-error">{t("清单已变化，请返回重新选择，避免更新未核对的条目。")}</p>:null}
    {error?<p role="alert" className="form-error">{systemText(error)}</p>:null}{success?<Toast message={systemText(success)} onDismiss={()=>setSuccess("")}/>:null}
    <footer><button type="button" className="button button--secondary" disabled={pending||reading} onClick={()=>confirming?setConfirming(false):onClose()}>{confirming?t("返回核对"):t("关闭")}</button>{canEdit?<button type="button" className="button button--primary" aria-busy={pending||reading} disabled={pending||reading||!chosen.length||changed} onClick={()=>{if(confirming){void save();return;}void confirm();}}>{pending?t("正在保存…"):confirming?t("确认保存实际事实"):t("核对所选清单")}</button>:null}</footer>
  <OperationRecoveryControls requestId={receipt.requestId}/></dialog>,document.body);
}
