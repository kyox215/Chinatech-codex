"use client";
import { useDeviceDraft, DeviceDraftNotice } from "@/components/use-device-draft";
import { useRef, useState } from "react";
import { Check, ShoppingCart } from "lucide-react";
import { SearchCombobox } from "@/components/search-combobox";
import { isPreorder, formatCost, validateProcurementDraft, type ProcurementRecord } from "@/lib/procurement";
import { currentRepairRequirements, type RepairRequirement } from "@/lib/repair-requirements";
import { parseItemMoney } from "@/lib/repair-item-pricing";
import { useStoreSettings } from "@/components/settings/settings-store";
import { saveRepairItemQuote, useLocalIntakes, useRepairDirectory } from "@/components/repairs/local-intake-store";
import { useRepairWorkflows } from "@/components/repairs/repair-workflow-store";
import { useProcurement } from "./procurement-provider";
import { useStaff } from "@/components/staff/use-staff";
export function RepairPartForm({repairId,record,requirement,onSaved,onCancel}:{repairId:string;record?:ProcurementRecord;requirement?:RepairRequirement;onSaved:(id:string)=>void;onCancel:()=>void}) {
  const staff=useStaff();const canEdit=staff.can("repairs.edit");const canCost=staff.can("financial.read")&&staff.can("financial.edit");
  const {records,dispatch}=useProcurement();const {settings}=useStoreSettings();
  const order=useRepairDirectory().find(row=>row.id===repairId);const intake=useLocalIntakes().records.find(row=>row.id===repairId);const {workflows}=useRepairWorkflows();
  const requirements=order?currentRepairRequirements(order,workflows[repairId]):[];
  const linked=requirements.find(row=>row.id===record?.requirementId)??requirement;
  const [item,setItem]=useState(linked?.title??record?.item??"");const [supplier,setSupplier]=useState(record?.supplier??(linked?.mode==="none"?"无需采购":""));
  const [cost,setCost]=useState(canCost&&record?.unitCostCents!=null?(record.unitCostCents/100).toFixed(2):"");
  const [quote,setQuote]=useState(()=>{const amount=intake?.itemQuotes?.find(row=>row.item===(linked?.title??record?.item))?.amountCents;return amount==null?"":(amount/100).toFixed(2);});
  const [error,setError]=useState("");const [pending,setPending]=useState(false);const busy=useRef(false);
  const [identity,setIdentity]=useState(()=>record?.id??`PO-LOCAL-${crypto.randomUUID().toUpperCase()}`);
  const [revision,setRevision]=useState(record?.events.length??0);const [workflowRevision,setWorkflowRevision]=useState(workflows[repairId]?.revision??0);const [intakeRevision,setIntakeRevision]=useState(order?.intakeRevision??1);
  const deviceDraft=useDeviceDraft(`part:${repairId}:${record?.id??requirement?.id??"new"}`,{item,supplier,cost:canCost?cost:"",quote,revision,identity,workflowRevision,intakeRevision},value=>{setIdentity(value.identity);setItem(value.item);setSupplier(value.supplier);setCost(canCost?value.cost:"");setQuote(value.quote??"");setRevision(value.revision);setWorkflowRevision(value.workflowRevision??0);setIntakeRevision(value.intakeRevision??1);});
  const currentRevision=records.find(row=>row.id===record?.id)?.events.length??revision;
  const changed=revision!==currentRevision||workflowRevision!==(workflows[repairId]?.revision??0)||intakeRevision!==(order?.intakeRevision??1);
  const selectedRequirement=record?linked:requirements.find(row=>row.title===item.trim());
  const noProcurement=supplier==="无需采购";const quoteOnly=!!record&&!isPreorder(record);
  async function submit(event:React.FormEvent){
    event.preventDefault();if(!canEdit||busy.current)return;busy.current=true;setPending(true);setError("");
    try{
      if(changed)throw new Error("工单或配件已变化，请重新打开并核对；输入已保留。");
      if(quoteOnly){await saveRepairItemQuote(repairId,linked?.title??record!.item,parseItemMoney(quote),intakeRevision);await deviceDraft.clear();onSaved(record!.id);return;}
      if(!item.trim())throw new Error("请选择或填写维修项。");
      const matches=settings.suppliers.filter(row=>row.active&&row.name.trim()===supplier.trim());
      if(!noProcurement&&matches.length!==1)throw new Error("请选择已登记的门店供应商。");
      const next:ProcurementRecord={id:identity,repairId,item:record?.item??item.trim(),supplier:noProcurement?"":matches[0].name,...(!noProcurement?{supplierId:matches[0].id}:{}),specification:record?.specification??selectedRequirement?.request??"",quantity:record?.quantity??1,unitCostCents:canCost&&!noProcurement?parseItemMoney(cost):null,required:record?.required??true,expectedAt:record?.expectedAt??"",reference:record?.reference??"",events:[],...(selectedRequirement?{requirementId:selectedRequirement.id,requirementRevision:selectedRequirement.revision}:record?.requirementId?{requirementId:record.requirementId,requirementRevision:record.requirementRevision}:{})};
      if(!noProcurement)validateProcurementDraft(next);
      await dispatch({type:"save-item",record:next,revision,workflowRevision,intakeRevision,quoteCents:parseItemMoney(quote),noProcurement});
      await deviceDraft.clear();onSaved(noProcurement?"":next.id);
    }catch(reason){setError(reason instanceof Error?reason.message:"保存失败。");}finally{busy.current=false;setPending(false);}
  }
  if(!canEdit)return <div className="section-empty"><strong>当前账号没有配件操作权限</strong></div>;
  return <form className="repair-part-form" noValidate onSubmit={submit}><DeviceDraftNotice draft={deviceDraft}/><div className="field-grid">
    {record?<div className="field"><span>维修项</span><strong>{linked?.title??record.item}{record.quantity!==1?` · ${record.quantity} 件`:""}</strong></div>:<SearchCombobox label="维修项" required value={item} onChange={value=>{setItem(value);const amount=intake?.itemQuotes?.find(row=>row.item===value)?.amountCents;setQuote(amount==null?"":(amount/100).toFixed(2));}} options={[...new Set([...requirements.map(row=>row.title),"屏幕","电池","尾插","摄像头","主板","清洁","软件处理"])].map(value=>({value,label:value}))} placeholder="选择或填写其他项目"/>}
    {quoteOnly?<div className="field"><span>供应商</span><strong>{record?.supplier}</strong></div>:<SearchCombobox label="供应商" required value={supplier} onChange={setSupplier} options={[...settings.suppliers.filter(row=>row.active).map(row=>({value:row.name,label:row.name})),...(!record?[{value:"无需采购",label:"无需采购"}]:[])]} placeholder="选择供应商" emptyText="未登记的供应商请先添加"/>}
    <label className="field"><span>报价（€，选填）</span><input aria-label="维修项报价" inputMode="decimal" maxLength={20} value={quote} onChange={event=>setQuote(event.target.value)} placeholder="未知留空"/></label>
    {canCost&&!noProcurement&&!quoteOnly?<label className="field"><span>进价（€，选填）</span><input aria-label="配件进价" inputMode="decimal" maxLength={20} value={cost} onChange={event=>setCost(event.target.value)} placeholder="未知留空"/></label>:null}
    {quoteOnly&&staff.can("financial.read")?<div className="field"><span>进价</span><strong>{formatCost(record!.unitCostCents)}</strong></div>:null}
  </div>{selectedRequirement?.request?<p className="repair-stage-note">{selectedRequirement.request}</p>:null}{changed?<p role="alert" className="form-error">工单或配件已变化，请核对最新资料；输入已保留。<button type="button" className="button button--secondary" onClick={()=>{setRevision(currentRevision);setWorkflowRevision(workflows[repairId]?.revision??0);setIntakeRevision(order?.intakeRevision??1);setError("");}}>核对最新资料后重试</button></p>:null}{error?<p role="alert" className="form-error">{error}</p>:null}
  <footer><button className="button button--secondary" type="button" disabled={pending} onClick={onCancel}>返回</button><button className="button button--primary" type="submit" disabled={pending||changed}>{noProcurement||quoteOnly?<Check size={17}/>:<ShoppingCart size={17}/>} {pending?"正在保存…":noProcurement||quoteOnly?"保存报价":record?"保存并加入采购车":"加入采购车"}</button></footer></form>;
}
