import { repairPartsSummary, type ProcurementRecord, type RepairPartsGroup } from "./procurement";
import type { RepairStatus } from "./repair-fixtures";
import { visibleRepairGroups, type RepairGroupSettings } from "./repair-groups";
import type { RepairDirectoryEntry } from "./repair-intake-record";
import { compareRepairUpdates, repairUpdatedAt, type RepairUpdates } from "./repair-list-order";
import { arrivalNotice, pickupNotice, isRepairReady, initialRepairWorkflow, workflowGroup, type RepairWorkflow, type WorkflowGroup } from "./repair-workflow";

import { currentRepairRequirements } from "./repair-requirements";

export type RepairListStatusFilter = "all" | "including_cancelled" | RepairStatus;
export type RepairListGroupBy = "workflow" | "parts" | "none";
export type RepairListSort = "updated" | "created" | "priority";
export type RepairListParts = {
  records: ProcurementRecord[];
  summary: ReturnType<typeof repairPartsSummary>;
  suppliers: string;
  title: string;
};
export type RepairListRow = {
  repair: RepairDirectoryEntry;
  parts: RepairListParts;
  workflowGroup: WorkflowGroup;
  searchable: string;
  id: string;
  createdAt: string;
  updatedAt: string;
};
export type RepairListGroup = { key: string; label: string; rows: RepairListRow[] };

const emptyParts: RepairListParts = { records: [], summary: repairPartsSummary([], ""), suppliers: "", title: "" };
const noUpdates: RepairUpdates = {};
const priorityScore = { 紧急: 0, 优先: 1, 普通: 2 };

/** Keep optional parts for display; the domain summary still counts only required parts. */
export function buildRepairPartsIndex(records: readonly ProcurementRecord[]) {
  const linked = new Map<string, ProcurementRecord[]>();
  for (const record of records) {
    const rows = linked.get(record.repairId);
    if (rows) rows.push(record);
    else linked.set(record.repairId, [record]);
  }
  const index = new Map<string, RepairListParts>();
  for (const [repairId, rows] of linked) {
    index.set(repairId, {
      records: rows,
      summary: repairPartsSummary(rows, repairId),
      suppliers: [...new Set(rows.map(row => row.supplier))].join("、"),
      title: rows.map(row => `${row.supplier} · ${row.item}`).join("\n"),
    });
  }
  return index;
}

export function buildRepairListRows(
  repairs: readonly RepairDirectoryEntry[],
  partsIndex: ReadonlyMap<string, RepairListParts>,
  workflows: Readonly<Record<string, RepairWorkflow>>,
  updates: RepairUpdates,
) {
  const byId = new Map<string, RepairListRow>();
  const rows = repairs.map(repair => {
    const indexed = partsIndex.get(repair.id) ?? emptyParts;
    const parts = { ...indexed, summary: repairPartsSummary(indexed.records, repair.id, currentRepairRequirements(repair, workflows[repair.id])) };
    const row: RepairListRow = {
      repair,
      parts,
      // Reuse the domain rule with this repair's indexed records, never the whole ledger.
      workflowGroup: workflowGroup(repair, parts.records, workflows[repair.id]),
      searchable: [repair.id, repair.customer.name, repair.customer.phone, repair.device.brand, repair.device.model, repair.device.serial, repair.issue].join(" ").toLocaleLowerCase(),
      id: repair.id,
      createdAt: repair.createdAt,
      updatedAt: repairUpdatedAt(repair, updates),
    };
    byId.set(repair.id, row);
    return row;
  });
  return { rows, byId };
}

export function selectRepairListGroups(
  rows: readonly RepairListRow[],
  settings: RepairGroupSettings,
  options: { query: string; status: RepairListStatusFilter; partsFilter: "all" | RepairPartsGroup; groupBy: RepairListGroupBy; sort: RepairListSort },
) {
  const query = options.query.trim().toLocaleLowerCase();
  const filteredRows = rows.filter(row => (
    options.status === "including_cancelled" || (options.status === "all" ? row.repair.status !== "cancelled" : row.repair.status === options.status)
  ) && (options.partsFilter === "all" || row.parts.summary.group === options.partsFilter) && row.searchable.includes(query));
  filteredRows.sort((left, right) => {
    if (options.sort === "created") return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
    if (options.sort === "priority") {
      const priority = priorityScore[left.repair.priority] - priorityScore[right.repair.priority];
      if (priority) return priority;
    }
    return compareRepairUpdates(left, right, noUpdates);
  });
  const definitions = options.groupBy === "parts" ? settings.parts
    : options.groupBy === "workflow" ? visibleRepairGroups(settings, "workflow")
    : [{ key: "all", label: "全部工单" }];
  const groups: RepairListGroup[] = definitions.map(group => ({ ...group, rows: [] }));
  const buckets = new Map(groups.map(group => [group.key, group.rows]));
  for (const row of filteredRows) {
    const key = options.groupBy === "parts" ? row.parts.summary.group : options.groupBy === "workflow" ? row.workflowGroup : "all";
    buckets.get(key)?.push(row);
  }
  return { filteredRows, groups };
}

/** Apply contact filters before server pagination and with the same indexed facts in preview. */
export function filterRepairContactGroups(groups: readonly RepairListGroup[], workflows: Readonly<Record<string, RepairWorkflow>>, filters: Readonly<Record<string, string>>) {
  return groups.map(group => ({ ...group, rows: group.rows.filter(row => {
    const filter = filters[group.key] ?? "all";
    if (!["arrival", "ready"].includes(group.key) || filter === "all") return true;
    const workflow = workflows[row.id] ?? initialRepairWorkflow(row.repair);
    if (filter === "awaiting") return Boolean(workflow.followUp?.awaitingReply);
    if (filter === "debt") return Boolean(workflow.followUp?.collectedUnpaid);
    const notice = isRepairReady(workflow) ? pickupNotice(workflow) : arrivalNotice(workflow, row.parts.records, row.id, row.repair);
    return filter === "notified" ? notice.startsWith("已通知") : filter === "unnotified" ? notice.startsWith("未通知") : true;
  }) }));
}
