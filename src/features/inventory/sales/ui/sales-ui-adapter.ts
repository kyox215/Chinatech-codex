import { RepairDeskApiError } from "@/lib/repairdesk/api";
import type { InventorySalesReceipt, InventorySalesSummary } from "../model/contracts";
import { buildSalesDocument } from "../model/sales-document";
import type { SalesCopyKey } from "./sales-copy";

export function moneyToCents(value: string): number | null {
  const match = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= 10_000_000_000 ? cents : null;
}
export function isSalesDormant(error: unknown) {
  return error instanceof RepairDeskApiError && error.code === "feature_disabled";
}
export function salesErrorKey(error: unknown): SalesCopyKey {
  if (!(error instanceof RepairDeskApiError)) return "error";
  if (error.code === "historical_store_identity_incomplete") return "historical";
  if (error.status === 401 || error.status === 403) return "permission";
  if (error.code === "inspection_blocked") return "blocked";
  if (error.code === "overpayment" || error.code === "invalid_amount") return "overpayment";
  if (error.code?.includes("date") || error.code?.includes("time")) return "invalidDate";
  if (error.status === 409) return "conflict";
  return "error";
}
/** A changed payload gets a new operation; an uncertain retry retains exactly the same operation. */
export function commandIdentity<T>(prior: { fingerprint: string; key: string } | null, payload: T) {
  const fingerprint = JSON.stringify(payload);
  return prior?.fingerprint === fingerprint ? prior : { fingerprint, key: crypto.randomUUID() };
}
export function romeDateTime(value = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const read = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${read("year")}-${read("month")}-${read("day")}T${read("hour")}:${read("minute")}`;
}
export function romeDateTimeToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("invalidDate");
  const base = Date.parse(`${value}:00Z`);
  // Rome is UTC+1 or UTC+2. Reject nonexistent calendar times rather than silently shifting them.
  for (const offset of [2, 1]) {
    const date = new Date(base - offset * 3_600_000);
    if (romeDateTime(date) === value) return date.toISOString();
  }
  throw new Error("invalidDate");
}
export function salesReceiptDocument(receipt: InventorySalesReceipt, storeId: string) {
  if (receipt.store_id !== storeId || !receipt.output_identity.canOutput || !receipt.document)
    return null;
  const { order, product, customer, payments, warranty, store } = receipt.document;
  const contact = [store.phone, store.email].filter(Boolean).join(" · ");
  if (!store.name.trim() || !store.address.trim() || !contact.trim()) throw new Error("historical");
  const document = buildSalesDocument(
    {
      saleNumber: order.sale_number,
      agreedAt: order.agreed_at,
      priceCents: order.price_cents,
      product: {
        name: product.name,
        sku: product.sku,
        identifier: product.identifier,
        identifierLabel: product.identifier_label,
        specification: [product.storage, product.ram, product.color].filter(Boolean).join(" · "),
      },
      customer,
      payments: payments.map((p) => ({
        id: p.id,
        receiptNumber: p.receipt_number,
        sequence: p.sequence,
        amountCents: p.amount_cents,
        occurredAt: p.occurred_at,
        method: p.method,
      })),
      ...(order.delivered_at ? { deliveredAt: order.delivered_at } : {}),
      warrantyAgreement: {
        months: order.warranty_months,
        usedDevice: order.used_device,
        shorteningAgreed: order.shortening_agreed,
        termsVersion: order.terms_version,
      },
      ...(warranty ? { coverage: { startsAt: warranty.starts_at, endsOn: warranty.ends_on } } : {}),
      store: {
        storeName: store.name,
        storeAddress: store.address,
        storeContactLine: contact,
        storeSummaryLine: [store.address, contact].join(" · "),
        printFooter: store.footer,
        privacyNote: "",
        canOutput: true,
        warnings: receipt.output_identity.warnings,
      },
    },
    receipt.kind,
    receipt.document.payment_id,
  );
  // Refuse a mixed/as-of projection; never replace the persisted ledger snapshot with a current balance.
  if (document.paidCents !== order.paid_cents || document.balanceCents !== order.balance_cents)
    throw new Error("invalid-document-balance");
  return document;
}

export function salesStatusKey(summary: InventorySalesSummary): SalesCopyKey {
  if (summary.order) return summary.order.status;
  if (summary.item_status === "reserved") return "legacyReserved";
  if (summary.item_status === "sold") return "delivered";
  if (summary.item_status === "returned") return "returned";
  if (["cancelled", "recycled"].includes(summary.item_status)) return "removed";
  return "available";
}
