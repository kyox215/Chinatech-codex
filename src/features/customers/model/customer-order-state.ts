import { workflowStatusFromLegacyStatus } from "@/features/orders/model/canonical-order-status";
import { deriveOrderFinancialState } from "@/features/orders/model/order-payment-state";
import type { OrderListItem, OrderWorkflowStatusCode } from "@/lib/repairdesk/types";

type CustomerOrderStateInput = Pick<OrderListItem, "status"> &
  Partial<
    Pick<
      OrderListItem,
      "workflow_status" | "workflow_bucket" | "exception_status" | "record_state" | "deleted_at"
    >
  >;

type CustomerOrderFinanceInput = CustomerOrderStateInput &
  Pick<OrderListItem, "quotation_amount" | "balance_amount" | "created_at" | "is_paid"> &
  Partial<
    Pick<
      OrderListItem,
      | "deposit_amount"
      | "payment_status"
      | "fault_prices"
      | "finance_redacted"
      | "approval_status"
      | "approval_flow_status"
    >
  >;

export interface CustomerOrderFinanceSummary {
  historicalOrderCount: number;
  validOrderCount: number;
  activeOrderCount: number;
  lifetimeQuotedAmount: number;
  outstandingAmount: number;
  lastOrderAt?: string;
}

export function getCustomerOrderWorkflowStatus(
  order: CustomerOrderStateInput,
): OrderWorkflowStatusCode {
  return order.workflow_status ?? workflowStatusFromLegacyStatus(order.status);
}

export function isCustomerOrderCancelled(order: CustomerOrderStateInput) {
  return (
    order.status === "cancelled" ||
    order.workflow_bucket === "cancelled" ||
    order.exception_status === "cancelled" ||
    order.record_state === "voided" ||
    Boolean(order.deleted_at)
  );
}

export function isCustomerOrderClosed(order: CustomerOrderStateInput) {
  if (isCustomerOrderCancelled(order)) return true;
  if (order.status === "completed") return true;
  if (order.workflow_bucket !== undefined) return order.workflow_bucket === "done";
  return getCustomerOrderWorkflowStatus(order) === "closed";
}

export function isCustomerOrderBillable(order: CustomerOrderStateInput) {
  return !isCustomerOrderCancelled(order);
}

export function buildCustomerOrderFinanceSummary(
  orders: CustomerOrderFinanceInput[],
): CustomerOrderFinanceSummary {
  const validOrders = orders.filter(isCustomerOrderBillable);

  return {
    historicalOrderCount: orders.length,
    validOrderCount: validOrders.length,
    activeOrderCount: validOrders.filter((order) => !isCustomerOrderClosed(order)).length,
    lifetimeQuotedAmount: validOrders.reduce(
      (sum, order) => sum + safeNonNegativeMoney(order.quotation_amount),
      0,
    ),
    outstandingAmount: validOrders.reduce(
      (sum, order) =>
        sum +
        (deriveOrderFinancialState(order).collectible
          ? safeNonNegativeMoney(order.balance_amount)
          : 0),
      0,
    ),
    lastOrderAt: orders
      .map((order) => order.created_at)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0],
  };
}

function safeNonNegativeMoney(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
