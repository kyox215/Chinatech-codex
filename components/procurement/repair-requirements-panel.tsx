"use client";
import { useStaff } from "@/components/staff/use-staff";
import { useRepairWorkflows } from "@/components/repairs/repair-workflow-store";
import { currentRepairRequirements } from "@/lib/repair-requirements";
import type { RepairDirectoryEntry } from "@/lib/repair-intake-record";
import { useProcurement } from "./procurement-provider";
export function RepairRequirementsPanel({order,onChoose}:{order:RepairDirectoryEntry;onChoose:(id:string)=>void}) {
  const canEdit=useStaff().can("repairs.edit");const {workflows}=useRepairWorkflows();const {records}=useProcurement();
  const items=currentRepairRequirements(order,workflows[order.id]);
  if(!items.length)return null;
  return <section className="repair-requirements" aria-label="维修项目"><div className="repair-requirement__actions">{items.map(item=>{
    const rows=records.filter(row=>row.repairId===order.id&&row.requirementId===item.id);
    return <button key={item.id} type="button" className="button button--secondary" disabled={!canEdit} onClick={()=>onChoose(item.id)}>{item.title}<small>{item.mode==="none"?"无需采购":rows.length?"已选供应商":"选择供应商"}</small></button>;
  })}</div></section>;
}
