"use client";
import { useDeviceDraft, DeviceDraftNotice } from "@/components/use-device-draft";
import { useRef, useState } from "react";
import { Check, ShoppingCart } from "lucide-react";
import { SelectControl } from "@/components/select-control";
import { SearchCombobox } from "@/components/search-combobox";
import { validateProcurementDraft, type ProcurementRecord } from "@/lib/procurement";
import type { RepairRequirement } from "@/lib/repair-requirements";
import { useStoreSettings } from "@/components/settings/settings-store";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { useRepairWorkflows } from "@/components/repairs/repair-workflow-store";
import { useProcurement } from "./procurement-provider";
import { useStaff } from "@/components/staff/use-staff";
export function RepairPartForm({ repairId, record, requirement, onSaved, onCancel }: { repairId:string; record?:ProcurementRecord; requirement?:RepairRequirement; onSaved:(id:string)=>void; onCancel:()=>void }) {
  const staff=useStaff();const canEdit=staff.can("repairs.edit");const canCost=staff.can("financial.edit");
  const {records,dispatch}=useProcurement();const {settings}=useStoreSettings();
  const order=useRepairDirectory().find(row=>row.id===repairId);const {workflows}=useRepairWorkflows();
  const [item,setItem]=useState(record?.item??"");const [supplier,setSupplier]=useState(record?.supplier??"");
  const [specification,setSpecification]=useState(record?.specification??"");
  const [quantity,setQuantity]=useState(String(record?.quantity??1));const [required,setRequired]=useState(record?.required!==false);
  const [cost,setCost]=useState(record?.unitCostCents==null?"":(record.unitCostCents/100).toFixed(2));
  const [error,setError]=useState("");const [pending,setPending]=useState(false);const busy=useRef(false);
  const [identity,setIdentity]=useState(()=>record?.id??`PO-LOCAL-${crypto.randomUUID().toUpperCase()}`);
  const [revision,setRevision]=useState(record?.events.length??0);
  const [workflowRevision,setWorkflowRevision]=useState(workflows[repairId]?.revision??0);
  const [intakeRevision,setIntakeRevision]=useState(order?.intakeRevision??1);
  const deviceDraft=useDeviceDraft(`part:${repairId}:${record?.id??requirement?.id??"new"}`,{item,supplier,quantity,required,cost,revision,identity,specification,workflowRevision,intakeRevision},value=>{setIdentity(value.identity);setItem(value.item);setSupplier(value.supplier);setQuantity(value.quantity);setRequired(value.required);setCost(value.cost);setRevision(value.revision);setSpecification(value.specification??"");setWorkflowRevision(value.workflowRevision??0);setIntakeRevision(value.intakeRevision??1);});
  const currentRevision=records.find(row=>row.id===record?.id)?.events.length??revision;
  const changed=revision!==currentRevision||workflowRevision!==(workflows[repairId]?.revision??0)||intakeRevision!==(order?.intakeRevision??1);
  async function submit(event:React.FormEvent){
    event.preventDefault();if(!canEdit||busy.current)return;busy.current=true;setPending(true);setError("");
    try {
      if(cost.trim()&&!/^\d+(\.\d{1,2})?$/.test(cost.trim()))throw new Error("单价最多两位小数，未知时留空。");
      const matches=settings.suppliers.filter(row=>row.active&&row.name.trim()===supplier.trim());
      if(matches.length!==1)throw new Error("请从门店供应商中选择；未登记的供应商请先在供应商页面添加。");
      const next:ProcurementRecord={id:identity,repairId,item:item.trim(),supplier:matches[0].name,supplierId:matches[0].id,specification:specification.trim(),quantity:Number(quantity),unitCostCents:canCost&&cost.trim()?Math.round(Number(cost)*100):null,required,expectedAt:record?.expectedAt??"",reference:record?.reference??"",events:[],...(requirement?{requirementId:requirement.id,requirementRevision:requirement.revision}:record?.requirementId?{requirementId:record.requirementId,requirementRevision:record.requirementRevision}:{})};
      validateProcurementDraft(next);
      if(record)await dispatch({type:"edit",record:next,revision});else await dispatch({type:"create-cart",record:next,workflowRevision,intakeRevision});
      await deviceDraft.clear();onSaved(next.id);
    }catch(reason){setError(reason instanceof Error?reason.message:"保存失败。");}
    finally {busy.current=false;setPending(false);}
  }
  if(!canEdit)return <div className="section-empty"><strong>当前账号没有配件操作权限</strong><button className="button button--secondary" type="button" onClick={onCancel}>返回配件详情</button></div>;
  return <form className="repair-part-form" noValidate onSubmit={submit}><DeviceDraftNotice draft={deviceDraft}/>
    {requirement?<p className="repair-stage-note"><strong>{requirement.title}</strong> · 接单要求：{requirement.request||"未指定，请核对"}</p>:null}
    {changed?<button type="button" className="button button--secondary" onClick={()=>{setRevision(currentRevision);setWorkflowRevision(workflows[repairId]?.revision??0);setIntakeRevision(order?.intakeRevision??1);}}>保留输入并核对最新版本</button>:null}
    <div className="field-grid"><label className="field field--wide"><span>配件名称 *</span><input aria-label="配件名称" value={item} maxLength={100} onChange={event=>setItem(event.target.value)} placeholder="配件与适配型号"/></label>
    <label className="field field--wide"><span>实际规格／约定更改说明</span><input aria-label="配件实际规格" value={specification} maxLength={1200} onChange={event=>setSpecification(event.target.value)} placeholder="核对质量、技术、容量与适配；和接单不同请记录原因"/></label>
    <SearchCombobox label="供应商 *" value={supplier} onChange={setSupplier} options={settings.suppliers.filter(row=>row.active).map(row=>({value:row.name,label:row.name}))} placeholder="搜索门店供应商" emptyText="未找到供应商，请先在供应商页面添加"/>
    <label className="field"><span>数量 *</span><input aria-label="配件数量" type="number" min="1" step="1" value={quantity} onChange={event=>setQuantity(event.target.value)}/></label><label className="field"><span>用途</span><SelectControl aria-label="配件用途" value={required?"required":"optional"} onChange={event=>setRequired(event.target.value==="required")}><option value="required">本单必需</option><option value="optional">备选</option></SelectControl></label>
    {canCost?<label className="field"><span>单价（€，选填）</span><input aria-label="配件单价" inputMode="decimal" value={cost} onChange={event=>setCost(event.target.value)} placeholder="未知留空"/></label>:null}</div>
    {error?<p role="alert" className="form-error">{error}</p>:null}<footer><button className="button button--secondary" type="button" disabled={pending} onClick={onCancel}>取消</button><button className="button button--primary" type="submit" disabled={pending}>{record?<Check size={17}/>:<ShoppingCart size={17}/>} {pending?"正在保存…":record?"保存配件":"加入采购车"}</button></footer></form>;
}
