import type { OrderListItem } from "@/lib/repairdesk/types";
import { getOrderAmountAnomalyReasons } from "@/entities/order/model/order-calculations";

type OrderCancellationInput = {
  status: string;
  exception_status?: string | null;
  workflow_bucket?: OrderListItem["workflow_bucket"];
};

type OrderTerminalInput = OrderCancellationInput & {
  workflow_status?: string | null;
};

type OrderPaymentStateInput = Pick<OrderListItem, "status" | "balance_amount" | "is_paid"> &
  Partial<
    Pick<
      OrderListItem,
      "workflow_bucket" | "exception_status" | "record_state" | "deleted_at" | "payment_status"
    >
  >;

type OrderFinancialStateInput = OrderPaymentStateInput &
  Partial<
    Pick<
      OrderListItem,
      | "quotation_amount"
      | "deposit_amount"
      | "fault_prices"
      | "finance_redacted"
      | "approval_status"
      | "approval_flow_status"
    >
  >;

type OrderInitialDepositProtectionInput = Pick<
  OrderListItem,
  "quotation_amount" | "deposit_amount" | "balance_amount"
> &
  Partial<
    Pick<
      OrderListItem,
      "approval_status" | "approval_flow_status" | "approval_sent_at" | "approval_confirmed_at"
    >
  >;

export type OrderQuoteState =
  | "hidden"
  | "not_quoted"
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "zero_charge";

export type OrderSettlementState =
  | "hidden"
  | "cancelled"
  | "not_due"
  | "unpaid"
  | "partial"
  | "settled"
  | "zero_charge"
  | "refunded"
  | "review";

export type OrderFinancialState = {
  quote: OrderQuoteState;
  settlement: OrderSettlementState;
  label: string;
  collectible: boolean;
};

export function isOrderCancelled(order: OrderCancellationInput) {
  return order.status === "cancelled" || order.exception_status === "cancelled";
}

export function isOrderCancelledState(order: OrderCancellationInput) {
  return isOrderCancelled(order) || order.workflow_bucket === "cancelled";
}

export function isOrderTerminalState(order: OrderTerminalInput) {
  if (order.status === "completed" || isOrderCancelled(order)) return true;
  return order.workflow_bucket !== undefined
    ? order.workflow_bucket === "done" || order.workflow_bucket === "cancelled"
    : order.workflow_status === "closed";
}

export function isOrderCancelledForPayment(order: OrderPaymentStateInput) {
  return (
    isOrderCancelledState(order) || order.record_state === "voided" || Boolean(order.deleted_at)
  );
}

export function isOrderPaymentCollectible(order: OrderFinancialStateInput) {
  return deriveOrderFinancialState(order).collectible;
}

export function isOrderInitialDepositLocked(order: OrderInitialDepositProtectionInput) {
  const quotationCents = moneyToCents(order.quotation_amount);
  const depositCents = moneyToCents(order.deposit_amount);
  const balanceCents = moneyToCents(order.balance_amount);
  if (quotationCents === null || depositCents === null || balanceCents === null) return true;

  const derivedPaidCents = Math.max(quotationCents - depositCents - balanceCents, 0);
  const approvalTouched =
    order.approval_status === "approved" ||
    order.approval_status === "rejected" ||
    order.approval_flow_status === "waiting_customer" ||
    Boolean(order.approval_sent_at) ||
    Boolean(order.approval_confirmed_at);

  return derivedPaidCents > 0 || approvalTouched || balanceCents !== quotationCents - depositCents;
}

function moneyToCents(value: number) {
  if (!Number.isFinite(value) || value < 0) return null;
  const cents = value * 100;
  const rounded = Math.round(cents);
  return Math.abs(cents - rounded) <= 1e-7 ? rounded : null;
}

export function getOrderLiveOutstandingAmount(order: OrderPaymentStateInput) {
  return isOrderCancelledForPayment(order) ? 0 : Math.max(0, order.balance_amount);
}

export function deriveOrderFinancialState(order: OrderFinancialStateInput): OrderFinancialState {
  if (order.finance_redacted) {
    return { quote: "hidden", settlement: "hidden", label: "金额受限", collectible: false };
  }
  if (order.payment_status === "refunded") {
    return { quote: "hidden", settlement: "refunded", label: "已退款", collectible: false };
  }
  if (isOrderCancelledForPayment(order)) {
    return { quote: "hidden", settlement: "cancelled", label: "已取消", collectible: false };
  }

  const quotationAmount = Number(order.quotation_amount ?? 0);
  const depositAmount = Number(order.deposit_amount ?? 0);
  const balanceAmount = Number(order.balance_amount ?? 0);
  const amountAnomalyReasons = getOrderAmountAnomalyReasons({
    quotationAmount,
    depositAmount,
    balanceAmount,
    isPaid: order.is_paid,
    paymentStatus: order.payment_status,
  });
  if (amountAnomalyReasons.includes("invalid_amount")) {
    return { quote: "draft", settlement: "review", label: "金额待核对", collectible: false };
  }
  const hasQuoteLines = Boolean(order.fault_prices?.length);
  const hasQuote = hasQuoteLines || quotationAmount > 0;

  const hasRejectedQuote =
    order.approval_flow_status === "rejected" || order.approval_status === "rejected";
  const hasPendingQuote =
    order.approval_flow_status === "waiting_customer" || order.approval_status === "pending";
  const hasExplicitApprovedQuote =
    order.approval_flow_status === "approved" || order.approval_status === "approved";
  if (Number(hasRejectedQuote) + Number(hasPendingQuote) + Number(hasExplicitApprovedQuote) > 1) {
    return { quote: "draft", settlement: "review", label: "金额待核对", collectible: false };
  }

  const rejectedQuoteHasPaymentEvidence =
    hasRejectedQuote &&
    (depositAmount > 0 ||
      balanceAmount < quotationAmount ||
      order.payment_status === "partial" ||
      order.payment_status === "paid" ||
      order.is_paid);
  if (rejectedQuoteHasPaymentEvidence) {
    return {
      quote: "rejected",
      settlement: "review",
      label: "报价已拒绝 · 款项待核对",
      collectible: false,
    };
  }

  if (!hasQuote) {
    return balanceAmount > 0
      ? { quote: "not_quoted", settlement: "review", label: "金额待核对", collectible: false }
      : { quote: "not_quoted", settlement: "not_due", label: "待报价", collectible: false };
  }

  const quote: OrderQuoteState = hasRejectedQuote
    ? "rejected"
    : hasPendingQuote
      ? "awaiting_approval"
      : hasExplicitApprovedQuote || order.approval_flow_status === "not_required"
        ? "approved"
        : "draft";

  if (quotationAmount === 0) {
    if (quote === "awaiting_approval") {
      return { quote, settlement: "not_due", label: "待审批", collectible: false };
    }
    if (quote === "rejected") {
      return { quote, settlement: "not_due", label: "报价已拒绝", collectible: false };
    }
    if (quote !== "approved") {
      return { quote, settlement: "not_due", label: "待确认报价", collectible: false };
    }
    return {
      quote: "zero_charge",
      settlement: "zero_charge",
      label: "免收费",
      collectible: false,
    };
  }

  if (quote === "awaiting_approval") {
    return { quote, settlement: "not_due", label: "待审批", collectible: false };
  }
  if (quote === "draft") {
    return { quote, settlement: "not_due", label: "待确认报价", collectible: false };
  }
  if (quote === "rejected") {
    return { quote, settlement: "not_due", label: "报价已拒绝", collectible: false };
  }

  if (amountAnomalyReasons.length > 0) {
    return { quote, settlement: "review", label: "金额待核对", collectible: false };
  }

  if (balanceAmount <= 0) {
    const hasSettlementEvidence =
      order.payment_status === "paid" || order.is_paid || depositAmount >= quotationAmount;
    return hasSettlementEvidence
      ? { quote, settlement: "settled", label: "已结清", collectible: false }
      : { quote, settlement: "review", label: "金额待核对", collectible: false };
  }
  if (depositAmount > 0 || order.payment_status === "partial") {
    return { quote, settlement: "partial", label: "已付押金", collectible: true };
  }
  return { quote, settlement: "unpaid", label: "待收款", collectible: true };
}
