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

function safeAmount(value: number) {
  return Number.isFinite(value) ? value : 0;
}
