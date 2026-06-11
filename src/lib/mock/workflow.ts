// Order status workflow helpers — mirrors lib/domain/order-status.ts in production.
// All helpers are pure & UI-bounded; safe to share between list / detail / bulk actions.

import { getStatusMeta, repairOrderStatus, type RepairOrderStatus } from "./enums";
import type { RepairOrder } from "./fixtures";

// Display order on lists — workflow-first then by updated_at desc.
const STATUS_SORT_INDEX: Record<string, number> = (() => {
  const map = {} as Record<string, number>;
  repairOrderStatus.forEach((s, i) => (map[s] = i));
  return map;
})();

export function getStatusListSortIndex(status: RepairOrderStatus) {
  return STATUS_SORT_INDEX[status] ?? 999;
}

// Statuses allowed when creating a new order.
export const ORDER_STATUS_ALLOWED_FOR_CREATE: RepairOrderStatus[] = [
  "new",
  "diagnosing",
  "mail_in_progress",
];

export function normalizeInitialOrderStatus(s?: string): RepairOrderStatus {
  return ORDER_STATUS_ALLOWED_FOR_CREATE.includes(s as RepairOrderStatus)
    ? (s as RepairOrderStatus)
    : "new";
}

// ---- Transition graph ------------------------------------------------------
// Keys = current status. Value = ordered list of plausible next statuses.
// Order matters: the FIRST entry is treated as the "primary / recommended" next step.
export const DEFAULT_ORDER_WORKFLOW_TRANSITIONS: Record<string, RepairOrderStatus[]> = {
  new: ["diagnosing", "quoted", "repairing", "cancelled"],
  rework: ["diagnosing", "repairing", "cancelled"],
  mail_in_progress: ["diagnosing", "cancelled"],
  diagnosing: ["quoted", "repairing", "unfixed_pickup", "cancelled"],
  quoted: ["waiting_approval", "repairing", "cancelled"],
  waiting_approval: ["repairing", "parts_ordered", "cancelled"],
  parts_ordered: ["parts_arrived", "cancelled"],
  parts_arrived: ["repairing", "cancelled"],
  repairing: ["repaired", "parts_ordered", "unfixed_pickup", "cancelled"],
  repaired: ["notified", "completed", "waiting_pickup"],
  notified: ["completed", "waiting_pickup", "unfixed_pickup"],
  unfixed_pickup: ["completed", "rework"],
  waiting_pickup: ["completed", "notified"],
  completed: ["rework"],
  cancelled: ["new", "rework"],
};

export interface NextAction {
  to: RepairOrderStatus;
  label: string;
  tone: ReturnType<typeof getStatusMeta>["tone"];
  isPrimary: boolean;
}

export function getNextActions(current: RepairOrderStatus): {
  primary?: NextAction;
  secondary: NextAction[];
} {
  const targets = DEFAULT_ORDER_WORKFLOW_TRANSITIONS[current] ?? [];
  const all: NextAction[] = targets.map((to, i) => ({
    to,
    label: getStatusMeta(to).label,
    tone: getStatusMeta(to).tone,
    isPrimary: i === 0,
  }));
  return { primary: all[0], secondary: all.slice(1) };
}

export function validateOrderTransition(
  from: RepairOrderStatus,
  to: RepairOrderStatus,
): { ok: boolean; reason?: string } {
  if (from === to) return { ok: false, reason: "目标状态与当前一致" };
  const allowed = DEFAULT_ORDER_WORKFLOW_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to))
    return {
      ok: false,
      reason: `「${getStatusMeta(from).label}」不能直接流转到「${getStatusMeta(to).label}」`,
    };
  return { ok: true };
}

// Targets that are valid for ALL given current statuses — used by bulk action.
export function getCommonValidTargets(currents: RepairOrderStatus[]): RepairOrderStatus[] {
  if (!currents.length) return [];
  const sets = currents.map((c) => new Set(DEFAULT_ORDER_WORKFLOW_TRANSITIONS[c] ?? []));
  return repairOrderStatus.filter((t) => sets.every((s) => s.has(t)) && !currents.includes(t));
}

// ---- Overdue helpers -------------------------------------------------------
const APPROVAL_OVERDUE_HOURS = 48;
const PICKUP_OVERDUE_DAYS = 5;

export function isApprovalOverdue(o: RepairOrder, now = Date.now()): boolean {
  if (o.status !== "waiting_approval" || !o.approval_sent_at) return false;
  return now - new Date(o.approval_sent_at).getTime() > APPROVAL_OVERDUE_HOURS * 3600 * 1000;
}

export function isPickupOverdue(o: RepairOrder, now = Date.now()): boolean {
  if (!["repaired", "notified", "unfixed_pickup", "waiting_pickup"].includes(o.status))
    return false;
  const ref = o.completed_at ?? o.updated_at;
  if (!ref) return false;
  return now - new Date(ref).getTime() > PICKUP_OVERDUE_DAYS * 86400 * 1000;
}
