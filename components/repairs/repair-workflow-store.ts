"use client";
import { isBackendClient, backendSnapshot, subscribeBackend, backendCommand } from "@/lib/backend/client";
import { requirePreviewPermission } from "@/lib/staff-client";
import { useSyncExternalStore } from "react";
import { parseLocalIntakes, intakeRecordTime, type RepairDirectoryEntry } from "@/lib/repair-intake-record";
import { appendProcurementEvent } from "@/lib/procurement";
import { parseProcurementState } from "@/lib/procurement-storage";
import { currentRepairRequirements } from "@/lib/repair-requirements";
import { recordRepairUpdate } from "@/lib/repair-list-order";
import type { ProcurementRecord } from "@/lib/procurement";
import { applyWorkflowCommand, initialRepairWorkflow, validateWorkflowExtensions, type RepairWorkflow, type WorkflowCommand } from "@/lib/repair-workflow";
import { repairStatusOptions } from "@/lib/repair-fixtures";
const key = "chinatech.m1.repair-workflow.v1";
const change = "chinatech-repair-workflow-change";
const server = { workflows: {} as Record<string, RepairWorkflow>, ready: false, error: "" };
let remoteSource:ReturnType<typeof backendSnapshot>;let remoteSnapshot=server;
let snapshot = server;
let cachedRaw: string | null | undefined;
function parse(raw: string | null): Record<string, RepairWorkflow> {
  if (!raw) return {};
  const data = JSON.parse(raw);
  if (data.version !== 1 || !data.workflows || typeof data.workflows !== "object" || Array.isArray(data.workflows)) throw new Error("本地维修状态格式异常，未覆盖原记录。");
  for (const value of Object.values(data.workflows) as RepairWorkflow[]) {
    if (!value) throw new Error("本地维修状态格式异常。"); validateWorkflowExtensions(value);
    if (!value || !repairStatusOptions.some(option => option.value === value.status) || !["unknown", "store", "customer"].includes(value.custody) || !Array.isArray(value.events) || value.revision !== value.events.length || typeof value.updatedAt !== "string"
      || value.events.some(event => !event || typeof event.id !== "string" || typeof event.label !== "string" || typeof event.time !== "string" || typeof event.note !== "string")
      || (value.notice !== null && (!value.notice || typeof value.notice.signature !== "string" || !["notified", "unreachable"].includes(value.notice.outcome)))) throw new Error("本地维修状态格式异常，未覆盖原记录。");
  }
  return data.workflows;
}
function read() {if(isBackendClient()){const current=backendSnapshot();if(current!==remoteSource){remoteSource=current;remoteSnapshot={workflows:current?.workflows??{},ready:true,error:current?"":"后台资料暂不可用。"};}return remoteSnapshot;}
  try { const raw = window.localStorage.getItem(key); if (raw !== cachedRaw || !snapshot.ready || snapshot.error) { const workflows = parse(raw); cachedRaw = raw; snapshot = { workflows, ready: true, error: "" }; } }
  catch { if (!snapshot.error || !snapshot.ready) snapshot = { ...snapshot, ready: true, error: "本地维修状态无法读取，请检查浏览器存储。" }; }
  return snapshot;
}
function subscribe(listener: () => void) {const stop=subscribeBackend(listener); const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) listener(); }; window.addEventListener("storage", storage); window.addEventListener(change, listener); return () => {stop(); window.removeEventListener("storage", storage); window.removeEventListener(change, listener); }; }
export function useRepairWorkflows() { return useSyncExternalStore(subscribe, read, () => server); }
export function updateRepairWorkflow(order: RepairDirectoryEntry, command: WorkflowCommand, records: ProcurementRecord[], revision: number) {
  if(isBackendClient()) return backendCommand("repair.workflow",{id:order.id,command,revision});
  requirePreviewPermission("repairs.edit");
  const workflows = parse(window.localStorage.getItem(key));
  const current = workflows[order.id] ?? initialRepairWorkflow(order);
  const actor = requirePreviewPermission("repairs.edit");
  const next = applyWorkflowCommand(current, command, { id: crypto.randomUUID(), time: intakeRecordTime(), actorId: actor.id }, records, order.id, revision, order);
  try { window.localStorage.setItem(key, JSON.stringify({ version: 1, workflows: { ...workflows, [order.id]: next } })); }
  catch { throw new Error("本地保存失败，维修状态未改变。"); }
  window.dispatchEvent(new Event(change));
}

export function previewRepairWorkflow(order: RepairDirectoryEntry) { return parse(window.localStorage.getItem(key))[order.id] ?? initialRepairWorkflow(order); }

export async function reconfirmRepairParts(order:RepairDirectoryEntry,requirementId:string,items:{id:string;revision:number}[],workflowRevision:number,intakeRevision:number){
  if(isBackendClient()){await backendCommand("procurement.reconfirm",{repairId:order.id,requirementId,items,workflowRevision,intakeRevision});return;}
  const actor=requirePreviewPermission("repairs.edit");const workflows=parse(window.localStorage.getItem(key));const workflow=workflows[order.id]??initialRepairWorkflow(order);
  const intakeKey="chinatech.m1.local-intakes.v1",procurementKey="chinatech.m1.procurement.v1";
  const saved=parseLocalIntakes(window.localStorage.getItem(intakeKey)).find(row=>row.id===order.id);
  if((saved?.revision??order.intakeRevision??1)!==intakeRevision||workflow.revision!==workflowRevision)throw new Error("工单或项目已变化，请重新核对。");
  const ledger=parseProcurementState(window.localStorage.getItem(procurementKey));if(!ledger)throw new Error("配件记录不可用。");
  const rows=ledger.records.filter(row=>row.repairId===order.id&&row.requirementId===requirementId);
  if(!rows.length||rows.length>100||items.length!==rows.length||new Set(items.map(row=>row.id)).size!==rows.length||rows.some(row=>!items.some(item=>item.id===row.id&&item.revision===row.events.length)))throw new Error("项目配件已变化，请核对全部条目。");
  const requirements=currentRepairRequirements(order,workflow);const requirement=requirements.find(row=>row.id===requirementId);if(!requirement)throw new Error("维修项目不存在。");
  const time=intakeRecordTime();if(workflow.events.length>=1000||time<workflow.updatedAt)throw new Error("维修历史已达上限或时间无效。");const records=ledger.records.map(row=>rows.includes(row)&&row.requirementRevision!==requirement.revision?appendProcurementEvent({...row,requirementRevision:requirement.revision},{id:crypto.randomUUID(),type:"requirement_linked",quantity:0,time,actorId:actor.id,note:"已明确核对本项目全部配件符合当前要求。"}):row);
  const next={...workflow,revision:workflow.revision+1,updatedAt:time,requirements:requirements.map(row=>row.id===requirementId?{...row,mode:"parts" as const,confirmed:true,sourceFingerprint:order.requirements?.find(source=>source.id===row.id)?.sourceFingerprint,deviceFingerprint:order.deviceFingerprint}:row),events:[...workflow.events,{id:crypto.randomUUID(),time,actorId:actor.id,type:"requirement" as const,label:`${requirement.title}：已按当前需求核对全部配件`,note:"保留原采购及到货事实。"}]};validateWorkflowExtensions(next);
  const keys=[procurementKey,key,intakeKey],before=keys.map(key=>window.localStorage.getItem(key));
  const envelope=JSON.parse(before[2]??'{"version":1,"records":[]}');envelope.records=envelope.records.map((row:{id:string})=>row.id===order.id?{...row,updatedAt:time}:row);
  const values=[JSON.stringify({version:1,records,repairUpdates:recordRepairUpdate(ledger.repairUpdates??{},order.id,time)}),JSON.stringify({version:1,workflows:{...workflows,[order.id]:next}}),JSON.stringify(envelope)];parseProcurementState(values[0]);parse(values[1]);parseLocalIntakes(values[2]);
  try{keys.forEach((key,index)=>window.localStorage.setItem(key,values[index]));}catch(reason){keys.forEach((key,index)=>{try{if(before[index]===null)window.localStorage.removeItem(key);else window.localStorage.setItem(key,before[index]!);}catch{}});throw reason;}
  window.dispatchEvent(new Event(change));window.dispatchEvent(new Event("chinatech-local-intake-change"));window.dispatchEvent(new Event("chinatech-procurement-change"));
}
