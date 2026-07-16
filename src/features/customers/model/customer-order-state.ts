import { workflowStatusFromLegacyStatus } from "@/features/orders/model/canonical-order-status";
import type { OrderListItem, OrderWorkflowStatusCode } from "@/lib/repairdesk/types";

type CustomerOrderStateInput = Pick<OrderListItem, "status"> &
  Partial<Pick<OrderListItem, "workflow_status" | "exception_status">>;

type CustomerOrderFinanceInput = CustomerOrderStateInput &
  Pick<OrderListItem, "quotation_amount" | "balance_amount" | "created_at">;

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
  return order.status === "cancelled" || order.exception_status === "cancelled";
}

export function isCustomerOrderClosed(order: CustomerOrderStateInput) {
  if (isCustomerOrderCancelled(order)) return true;
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
      (sum, order) => sum + safeNonNegativeMoney(order.balance_amount),
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
