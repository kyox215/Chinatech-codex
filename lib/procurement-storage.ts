import { appendProcurementEvent, validateProcurementDraft, type ProcurementRecord } from "./procurement";
export function parseProcurementState(raw: string | null): { records: ProcurementRecord[]; repairUpdates: Record<string, string> } | null {
  if (!raw) return null;
  const data = JSON.parse(raw);
  if (data.version !== 1 || !Array.isArray(data.records) || data.records.length > 1000 || !data.repairUpdates || typeof data.repairUpdates !== "object" || Array.isArray(data.repairUpdates)) throw new Error("本地配件记录格式异常，未覆盖原记录。");
  const ids = new Set<string>();
  for (const row of data.records as ProcurementRecord[]) {
    if (!row || [row.id, row.repairId, row.item, row.supplier, row.expectedAt, row.reference].some(value => typeof value !== "string") || !Array.isArray(row.events) || row.events.length > 1000 || (row.required !== undefined && typeof row.required !== "boolean") || ids.has(row.id)) throw new Error("本地配件记录格式异常。");
    ids.add(row.id);
    let replay = validateProcurementDraft({ ...row, events: [] });
    for (const event of row.events) {
      if (!event || typeof event.id !== "string" || typeof event.time !== "string" || typeof event.note !== "string" || (event.reference !== undefined && typeof event.reference !== "string")) throw new Error("本地配件历史格式异常。");
      replay = appendProcurementEvent(replay, event);
    }
  }
  if (Object.values(data.repairUpdates).some(value => typeof value !== "string")) throw new Error("本地工单更新时间格式异常。");
  return { records: data.records, repairUpdates: data.repairUpdates };
}
