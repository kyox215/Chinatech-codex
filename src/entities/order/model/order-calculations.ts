import type { FaultPriceItem } from "@/lib/repairdesk/api";

export function sumFaultPrices(items: Pick<FaultPriceItem, "price">[]) {
  return items.reduce((total, item) => total + safeAmount(item.price), 0);
}

export function calculateBalance(quotation: number, deposit = 0, paidAmount = 0) {
  return Math.max(0, safeAmount(quotation) - safeAmount(deposit) - safeAmount(paidAmount));
}

export function inferPaidAmount(quotation: number, deposit: number, balance: number) {
  return Math.max(0, safeAmount(quotation) - safeAmount(deposit) - safeAmount(balance));
}

export type OrderAmountAnomalyReason =
  | "invalid_amount"
  | "received_exceeds_quote"
  | "paid_balance_mismatch"
  | "payment_status_mismatch";

type OrderAmountConsistencyInput = {
  quotationAmount: number;
  depositAmount: number;
  balanceAmount: number;
  isPaid: boolean;
  paymentStatus?: "unpaid" | "partial" | "paid" | "refunded";
};

/**
 * Finds amount relationships that cannot be reconciled with RepairDesk's
 * canonical quote/deposit/balance state. A match means "needs human review",
 * never an automatic accounting or fraud conclusion.
 */
export function getOrderAmountAnomalyReasons(
  input: OrderAmountConsistencyInput,
): OrderAmountAnomalyReason[] {
  const values = [input.quotationAmount, input.depositAmount, input.balanceAmount];
  if (values.some((value) => !isCentAmount(value))) return ["invalid_amount"];

  const quotationCents = toCents(input.quotationAmount);
  const depositCents = toCents(input.depositAmount);
  const balanceCents = toCents(input.balanceAmount);
  const reasons: OrderAmountAnomalyReason[] = [];

  if (depositCents + balanceCents > quotationCents) {
    reasons.push("received_exceeds_quote");
  }

  const shouldBePaid = balanceCents === 0;
  if (input.isPaid !== shouldBePaid) reasons.push("paid_balance_mismatch");

  const expectedPaymentStatus =
    input.isPaid || shouldBePaid ? "paid" : depositCents > 0 ? "partial" : "unpaid";
  if (
    input.paymentStatus &&
    input.paymentStatus !== "refunded" &&
    input.paymentStatus !== expectedPaymentStatus
  ) {
    reasons.push("payment_status_mismatch");
  }

  return reasons;
}

export function hasOrderAmountAnomaly(input: OrderAmountConsistencyInput) {
  return getOrderAmountAnomalyReasons(input).length > 0;
}

function safeAmount(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function isCentAmount(value: number) {
  return (
    Number.isFinite(value) && value >= 0 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7
  );
}

function toCents(value: number) {
  return Math.round(value * 100);
}
