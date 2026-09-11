import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { OrderListItem, OrderWorkflow } from "@/lib/repairdesk/types";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";
import { localizeWorkflowStatusLabel } from "./order-i18n";
import { getOrderTransitionReasonConfig } from "./order-transition-reasons";
import {
  getWorkflowStatus,
  getWorkflowStatuses,
  type getWorkflowTransitionActions,
} from "./order-workflow";

export type TransitionPickerAction = ReturnType<typeof getWorkflowTransitionActions>[number];
type Translate = (key: MessageKey, values?: MessageValues) => string;

/** Mirrors the existing manual-transition prerequisites; the server remains authoritative. */
export function getTransitionPickerRestriction(
  order: Pick<OrderListItem, "status"> &
    Partial<Pick<OrderListItem, "approval_status" | "approval_flow_status">>,
  to: RepairOrderStatus,
  workflow?: OrderWorkflow,
): MessageKey | undefined {
  if (
    to !== "waiting_approval" &&
    ((order.status === "waiting_approval" && order.approval_flow_status !== "approved") ||
      (order.status === "quoted" && order.approval_status === "pending"))
  )
    return "orders2b2.picker.approvalRequired";
  if (getWorkflowStatus(workflow, to)?.bucket === "custom")
    return "orders2b2.picker.configureBucket";
  return undefined;
}

const distinctLabels: Partial<Record<RepairOrderStatus, MessageKey>> = {
  quoted: "orders2b2.picker.quoted",
  waiting_approval: "orders2b2.picker.waitingApproval",
  parts_ordered: "orders2b2.picker.partsOrdered",
  parts_arrived: "orders2b2.picker.partsArrived",
  mail_in_progress: "orders2b2.picker.mailInProgress",
  notified: "orders2b2.picker.notified",
  waiting_pickup: "orders2b2.picker.waitingPickup",
  unfixed_pickup: "orders2b2.picker.unfixedPickup",
  cancelled: "orders2b2.picker.cancelled",
  rework: "orders.exceptionRework",
};

/** Local labels only. Configured custom labels and the submitted status code are untouched. */
export function getTransitionPickerLabel(
  workflow: OrderWorkflow | undefined,
  code: RepairOrderStatus,
  t: Translate,
) {
  const configured = workflow?.statuses.find((status) => status.code === code);
  const key = distinctLabels[code];
  return key && configured?.is_system !== false
    ? t(key)
    : localizeWorkflowStatusLabel(workflow, code, t);
}

export function getTransitionPickerReasonTarget(
  action: TransitionPickerAction,
  workflow?: OrderWorkflow,
): RepairOrderStatus | undefined {
  if (getOrderTransitionReasonConfig(action.to)) return action.to;
  return getWorkflowStatus(workflow, action.to)?.bucket === "cancelled" ? "cancelled" : undefined;
}

export function getTransitionPickerHintTarget(
  action: TransitionPickerAction,
  workflow?: OrderWorkflow,
): RepairOrderStatus {
  const bucket = getWorkflowStatus(workflow, action.to)?.bucket;
  return bucket === "done" ? "completed" : bucket === "cancelled" ? "cancelled" : action.to;
}

export type TransitionPickerSequenceEntry = {
  code: RepairOrderStatus;
  current: boolean;
  position: number | null;
  configured: boolean;
  enabled: boolean;
  action?: TransitionPickerAction;
};

/** Configuration order is presentation only, never a record of completed work. */
export function buildTransitionPickerSequence(
  actions: TransitionPickerAction[],
  workflow: OrderWorkflow | undefined,
  current: RepairOrderStatus,
): TransitionPickerSequenceEntry[] {
  const byCode = new Map(actions.map((action) => [action.to, action]));
  const configuredStatuses = getWorkflowStatuses(workflow);
  const knownCodes = new Set(configuredStatuses.map((status) => status.code));
  const entries: TransitionPickerSequenceEntry[] = configuredStatuses
    .filter((status) => status.enabled || status.code === current)
    .map((status, index) => ({
      code: status.code,
      current: status.code === current,
      position: index + 1,
      configured: true,
      enabled: status.enabled,
      action: status.code !== current && status.enabled ? byCode.get(status.code) : undefined,
    }));
  if (!entries.some((entry) => entry.current)) {
    entries.unshift({
      code: current,
      current: true,
      position: null,
      configured: false,
      enabled: false,
    });
  }
  // A stale/partial workflow must not erase a target already supplied by the
  // caller's authorization filter. Do not invent a configured position for it.
  const displayed = new Set(entries.map((entry) => entry.code));
  for (const action of actions) {
    if (displayed.has(action.to) || knownCodes.has(action.to)) continue;
    entries.push({
      code: action.to,
      current: false,
      position: null,
      configured: false,
      enabled: true,
      action,
    });
    displayed.add(action.to);
  }
  return entries;
}
