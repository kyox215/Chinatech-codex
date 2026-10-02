import { workflowGroups, retiredWorkflowGroups, type WorkflowGroup } from "./repair-workflow";
import { repairPartsGroups, type RepairPartsGroup } from "./procurement";

export type RepairGroupItem<K extends string = string> = { key: K; label: string };
export type RepairGroupSettings = { workflow: RepairGroupItem<WorkflowGroup>[]; parts: RepairGroupItem<RepairPartsGroup>[] };
export type RepairGroupKind = keyof RepairGroupSettings;
const partsOrder: RepairPartsGroup[] = ["draft", "cart", "mixed", "ordered", "complete", "unrecorded"];
export function defaultRepairGroups(): RepairGroupSettings {
  return {
    workflow: (Object.entries(workflowGroups) as [WorkflowGroup, string][]).map(([key, label]) => ({ key, label })),
    parts: partsOrder.map(key => ({ key, label: repairPartsGroups[key] })),
  };
}
/** IDs retain business meaning; only the displayed names and their order are editable. */
export function parseRepairGroups(value: unknown): RepairGroupSettings {
  const defaults = defaultRepairGroups();
  if (value === undefined) return defaults;
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "parts,workflow") throw new Error("分组设置格式无效。");
  const result = {} as Record<RepairGroupKind, RepairGroupItem[]>;
  for (const kind of ["workflow", "parts"] as const) {
    const rows = (value as Record<string, unknown>)[kind];
    if (!Array.isArray(rows) || rows.length !== defaults[kind].length) throw new Error("分组必须完整保留，不能新增或删除。");
    const ids = new Set<string>(); const names = new Set<string>();
    result[kind] = rows.map(row => {
      if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).sort().join(",") !== "key,label" || !defaults[kind].some(item => item.key === row.key) || ids.has(row.key)) throw new Error("分组标识无效或重复。");
      if (typeof row.label !== "string" || !row.label.trim() || row.label.trim().length > 40 || /[\u0000-\u001f\u007f]/.test(row.label)) throw new Error("分组名称须为 1–40 个字符，不能包含换行。");
      const label = row.label.trim(); const normalized = label.normalize("NFKC").toLocaleLowerCase();
      if (names.has(normalized)) throw new Error("同类分组名称不能重复。");
      ids.add(row.key); names.add(normalized);
      return { key: row.key, label };
    });
  }
  return result as RepairGroupSettings;
}

export function moveRepairGroup<T extends RepairGroupItem>(rows: T[], key: string, target: string): T[] {
  const from = rows.findIndex(row => row.key === key); const to = rows.findIndex(row => row.key === target);
  if (from < 0 || to < 0 || from === to) return rows;
  const next = [...rows]; const [item] = next.splice(from, 1); next.splice(to, 0, item);
  return next;
}

export function visibleRepairGroups(settings: RepairGroupSettings, kind: "workflow"): RepairGroupItem<WorkflowGroup>[];
export function visibleRepairGroups(settings: RepairGroupSettings, kind: "parts"): RepairGroupItem<RepairPartsGroup>[];
export function visibleRepairGroups(settings: RepairGroupSettings, kind: RepairGroupKind): RepairGroupItem[];
export function visibleRepairGroups(settings: RepairGroupSettings, kind: RepairGroupKind): RepairGroupItem[] { return kind === "workflow" ? settings.workflow.filter(row => !retiredWorkflowGroups.includes(row.key)) : settings.parts; }
export function mergeVisibleRepairGroups(settings: RepairGroupSettings, kind: RepairGroupKind, rows: RepairGroupItem[]): RepairGroupSettings {
  let index = 0; const oldVisible = new Set(visibleRepairGroups(settings, kind).map(row => row.key));
  return parseRepairGroups({ ...settings, [kind]: settings[kind].map(row => oldVisible.has(row.key) ? rows[index++] : row) });
}
