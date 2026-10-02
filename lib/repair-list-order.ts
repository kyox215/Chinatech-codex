import type { RepairOrder } from "./repair-fixtures";

type OrderTime = Pick<RepairOrder, "id" | "createdAt" | "updatedAt">;
export type RepairUpdates = Readonly<Record<string, string>>;

export function repairUpdatedAt(repair: OrderTime, updates: RepairUpdates) {
  const procurementTime = updates[repair.id];
  return procurementTime && procurementTime > repair.updatedAt ? procurementTime : repair.updatedAt;
}

// Canonical local timestamps share the same store timezone and sort lexically.
export function compareRepairUpdates(left: OrderTime, right: OrderTime, updates: RepairUpdates) {
  return repairUpdatedAt(left, updates).localeCompare(repairUpdatedAt(right, updates))
    || left.createdAt.localeCompare(right.createdAt)
    || left.id.localeCompare(right.id);
}

export function recordRepairUpdate(updates: RepairUpdates, repairId: string, modifiedAt: string): RepairUpdates {
  return { ...updates, [repairId]: modifiedAt };
}
