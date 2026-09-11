import type { OrderListItem, OrderWorkflow, OrderWorkflowStatusCode } from "@/lib/repairdesk/types";
import type { StatusTone } from "@/lib/mock/enums";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";
import { isOrderArchivedForQueue } from "./order-list-visibility";
import { isOrderCancelledForPayment, isOrderTerminalState } from "./order-payment-state";
import {
  isDefaultRepairOrderStatus,
  orderExceptionMeta,
  workflowStatusFromLegacyStatus,
} from "./canonical-order-status";
import { getOrderTaskStage, getOrderWorkflowStatus } from "./order-task-flow";
import {
  localizeDeviceCustody,
  localizeOrderException,
  localizeOrderFlowStage,
  localizeWorkflowStatusLabel,
} from "./order-i18n";

type Translate = (key: MessageKey, values?: MessageValues) => string;
export type OrderListPresentationView = "list" | "cards" | "board";
export type OrderListBoardStage = "intake" | "quote" | "repair" | "pickup" | "closed";
export const orderListBoardStages: OrderListBoardStage[] = [
  "intake",
  "quote",
  "repair",
  "pickup",
  "closed",
];

/** Read-only list guidance, not a transition target or an authorization decision. */
export function getOrderListPresentation(
  order: OrderListItem,
  t: Translate,
  workflow?: OrderWorkflow,
) {
  const cancelled = isOrderCancelledForPayment(order);
  const terminal = cancelled || isOrderArchivedForQueue(order) || isOrderTerminalState(order);
  const readyForPickup =
    ["repaired", "notified", "waiting_pickup"].includes(order.status) &&
    order.device_custody_status !== "with_customer" &&
    order.exception_status !== "unrepairable" &&
    order.exception_status !== "returned_unfixed";
  const bucketWorkflow: Partial<
    Record<NonNullable<OrderListItem["workflow_bucket"]>, OrderWorkflowStatusCode>
  > = {
    intake: "intake",
    diagnosing: "diagnosis",
    quote: "quote",
    parts: "parts",
    repair: "repair",
    pickup: "pickup",
  };
  const workflowStatus: OrderWorkflowStatusCode = terminal
    ? "closed"
    : order.workflow_status === "closed" && order.workflow_bucket !== undefined
      ? (bucketWorkflow[order.workflow_bucket] ?? workflowStatusFromLegacyStatus(order.status))
      : getOrderWorkflowStatus(order);
  const stage = localizeOrderFlowStage(getOrderTaskStage(workflowStatus), t);
  let label = stage.label;
  let detail = localizeDeviceCustody(order.device_custody_status, order.delivered_at, t);
  let nextAction = stage.nextAction;
  let tone: StatusTone = getOrderTaskStage(workflowStatus).tone;
  const danger =
    !terminal &&
    Boolean(
      order.approval_overdue ||
      (order.pickup_overdue && order.device_custody_status !== "with_customer") ||
      ["unrepairable", "returned_unfixed"].includes(order.exception_status ?? ""),
    );
  const notified =
    order.notify_status === "sent" ||
    order.notify_status === "contacted" ||
    ["notified", "waiting_pickup"].includes(order.status);

  if (terminal) {
    label = t(cancelled ? "orders.financialCancelled" : "orders.completed");
    detail = t(cancelled ? "orders.excludedFromBalance" : "orders.queue.archivedRecord");
    nextAction = t(cancelled ? "dashboard.cancelledNextAction" : "dashboard.flowClosedNextAction");
    tone = cancelled ? "neutral" : "success";
  } else if (
    order.exception_status === "paused" ||
    order.exception_status === "unrepairable" ||
    order.exception_status === "returned_unfixed" ||
    order.status === "unfixed_pickup"
  ) {
    const exception = order.exception_status ?? "returned_unfixed";
    label = localizeOrderException(exception, t).label;
    tone = orderExceptionMeta[exception].tone;
    nextAction = t(
      exception === "paused" ? "orders.queue.reviewPause" : "orders.queue.reviewReturn",
    );
  } else {
    if (workflowStatus === "diagnosis" || workflowStatus === "quote")
      nextAction = t("orders.queue.reviewQuote");
    if (workflowStatus === "parts" || workflowStatus === "repair")
      nextAction = t("orders.queue.handleRepair");
    if (workflowStatus === "pickup" || readyForPickup) {
      label = t(notified ? "orders.queue.awaitingPickup" : "dashboard.flowPickupLabel");
      nextAction = t(notified ? "orders.queue.handlePickup" : "dashboard.flowPickupNextAction");
      tone = "success";
    }
    if (
      !isDefaultRepairOrderStatus(order.status) ||
      workflow?.statuses.some((status) => status.code === order.status && !status.is_system)
    )
      label = localizeWorkflowStatusLabel(workflow, order.status, t);
    if (order.status === "mail_in_progress") {
      detail = t("dashboard.mailInLabel");
      nextAction = t("dashboard.mailInNextAction");
    }
    if (workflowStatus === "parts" || workflowStatus === "repair") {
      if (order.parts_status === "ordered" || order.status === "parts_ordered")
        detail = t("orders2b2.badge.partsOrdered");
      if (order.parts_status === "arrived" || order.status === "parts_arrived")
        detail = t("orders2b2.badge.partsArrived");
      if (order.parts_status === "needed") detail = t("orders.queue.partsNeeded");
      if (order.parts_status === "out_of_stock") detail = t("orders.queue.partsUnavailable");
      if ((order.parts_status === "arrived" || order.status === "parts_arrived") && notified)
        detail = `${detail} · ${t("orders2b2.badge.notifySent")}`;
    }
    if (order.device_custody_status === "with_customer") {
      detail = t("dashboard.customerCustodyLabel");
      nextAction = t("dashboard.confirmIntake");
    }
    if (
      (workflowStatus === "quote" ||
        workflowStatus === "diagnosis" ||
        order.status === "waiting_approval") &&
      (order.approval_flow_status === "waiting_customer" || order.status === "waiting_approval")
    ) {
      detail = t("orders.queue.awaitingCustomer");
      nextAction = t("orders.queue.customerReply");
    }
    if (
      (workflowStatus === "quote" || workflowStatus === "diagnosis") &&
      (order.approval_flow_status === "rejected" || order.approval_status === "rejected")
    ) {
      detail = t("orders.quoteRejected");
      nextAction = t("orders.queue.customerReply");
    }
    if (order.exception_status === "waiting_customer") {
      detail = localizeOrderException(order.exception_status, t).label;
      nextAction = t("orders.queue.customerReply");
    }
    if (order.exception_status === "rework" || order.status === "rework")
      detail = localizeOrderException("rework", t).label;
    if (order.approval_overdue) {
      detail = t("orders.approvalOverdue");
      nextAction = t("dashboard.contactCustomer");
    } else if (order.pickup_overdue && order.device_custody_status !== "with_customer") {
      detail = t("orders.pickupOverdue");
      nextAction = t("dashboard.pickupOverdueNextAction");
    }
  }
  return {
    label,
    detail,
    nextAction,
    workflowStatus,
    boardStage: stage.key as OrderListBoardStage,
    tone,
    danger,
    terminal,
    cancelled,
  };
}

export function groupOrderListPresentation(items: OrderListItem[], t: Translate) {
  return orderListBoardStages.flatMap((stage) => {
    const orders = items.filter((order) => getOrderListPresentation(order, t).boardStage === stage);
    return orders.length ? [{ stage, orders }] : [];
  });
}
