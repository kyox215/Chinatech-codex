"use client";
import { isBackendClient, backendSnapshot, subscribeBackend, backendCommand } from "@/lib/backend/client";
import { requirePreviewPermission } from "@/lib/staff-client";
import { useSyncExternalStore } from "react";
import { intakeRecordTime, type RepairDirectoryEntry } from "@/lib/repair-intake-record";
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
