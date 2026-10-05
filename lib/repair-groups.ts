import { workflowGroups, retiredWorkflowGroups, type WorkflowGroup } from "./repair-workflow";
import { repairPartsGroups, type RepairPartsGroup } from "./procurement";

export type RepairGroupItem<K extends string = string> = { key: K; label: string };
export type RepairGroupSettings = { workflow: RepairGroupItem<WorkflowGroup>[]; parts: RepairGroupItem<RepairPartsGroup>[] };
export type RepairGroupKind = keyof RepairGroupSettings;
const partsOrder: RepairPartsGroup[] = ["draft", "cart", "mixed", "ordered", "complete", "unrecorded"];
const addedStageGroups: WorkflowGroup[] = ["diagnosis", "awaiting_quote", "awaiting_parts", "testing"];
export function defaultRepairGroups(): RepairGroupSettings {
  return {
    workflow: (Object.entries(workflowGroups) as [WorkflowGroup, string][]).map(([key, label]) => ({ key, label })),
    parts: partsOrder.map(key => ({ key, label: repairPartsGroups[key] })),
  };
}
/** Four daily group names are fixed; old complete ID sets remain readable without writes. */
export function parseRepairGroups(value: unknown): RepairGroupSettings {
  const defaults = defaultRepairGroups();
  if (value === undefined) return defaults;
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "parts,workflow") throw new Error("分组设置格式无效。");
  const result = {} as Record<RepairGroupKind, RepairGroupItem[]>;
  for (const kind of ["workflow", "parts"] as const) {
    const rows = (value as Record<string, unknown>)[kind];
    const legacy = kind === "workflow" && Array.isArray(rows) && rows.length === 11 && rows.every(row => row?.key !== "rework" && !addedStageGroups.includes(row?.key));
    const stageGroups = kind === "workflow" && Array.isArray(rows) && rows.length === 15 && rows.every(row => row?.key !== "rework");
    if (!Array.isArray(rows) || (!legacy && !stageGroups && rows.length !== defaults[kind].length)) throw new Error("分组必须完整保留，不能新增或删除。");
    const ids = new Set<string>(); const names = new Set<string>();
    result[kind] = rows.map(row => {
      if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).sort().join(",") !== "key,label" || !defaults[kind].some(item => item.key === row.key) || ids.has(row.key)) throw new Error("分组标识无效或重复。");
      if (typeof row.label !== "string" || !row.label.trim() || row.label.trim().length > 40 || /[\u0000-\u001f\u007f]/.test(row.label)) throw new Error("分组名称须为 1–40 个字符，不能包含换行。");
      const label = row.label.trim(); const normalized = label.normalize("NFKC").toLocaleLowerCase();
      if (names.has(normalized)) throw new Error("同类分组名称不能重复。");
      ids.add(row.key); names.add(normalized);
      return { key: row.key, label: kind === "workflow" ? workflowGroups[row.key as WorkflowGroup] : label };
    });
    if (legacy) {
      const processing = result.workflow.findIndex(row => row.key === "processing");
      result.workflow.splice(processing, 0, ...addedStageGroups.filter(key => key !== "testing").map(key => ({ key, label: workflowGroups[key] })));
      result.workflow.splice(result.workflow.findIndex(row => row.key === "processing") + 1, 0, { key: "testing", label: workflowGroups.testing });
    }
    if (kind === "workflow" && (legacy || stageGroups)) {
      const daily: WorkflowGroup[] = ["rework", "processing", "purchase", "ready"];
      result.workflow = [...daily.map(key => ({ key, label: workflowGroups[key] })), ...result.workflow.filter(row => !daily.includes(row.key as WorkflowGroup))];
    }
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
export function visibleRepairGroups(settings: RepairGroupSettings, kind: RepairGroupKind): RepairGroupItem[] { const current = parseRepairGroups(settings); return kind === "workflow" ? current.workflow.filter(row => !retiredWorkflowGroups.includes(row.key)) : current.parts; }
export function mergeVisibleRepairGroups(settings: RepairGroupSettings, kind: RepairGroupKind, rows: RepairGroupItem[]): RepairGroupSettings {
  const current = parseRepairGroups(settings);
  let index = 0; const oldVisible = new Set(visibleRepairGroups(current, kind).map(row => row.key));
  return parseRepairGroups({ ...current, [kind]: current[kind].map(row => oldVisible.has(row.key) ? rows[index++] : row) });
}
