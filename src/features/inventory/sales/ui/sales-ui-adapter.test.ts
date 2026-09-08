import { describe, expect, it } from "vitest";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import { inventorySalesListBodySchema } from "../model/contracts";
import {
  commandIdentity,
  isSalesDormant,
  moneyToCents,
  romeDateTime,
  romeDateTimeToIso,
  salesErrorKey,
  salesReceiptDocument,
  salesStatusKey,
} from "./sales-ui-adapter";
import { salesCopy, salesLanguage } from "./sales-copy";
import { syntheticSalesReceipt, syntheticSalesStore } from "./sales-ui.fixture";
import { syntheticSalesSummary } from "./sales-ui.fixture";
describe("sales UI exact money, retry and historical output", () => {
  it.each([
    ["reserved", "legacyReserved"],
    ["returned", "returned"],
    ["cancelled", "removed"],
  ])("preserves historical %s without inventing a sale order", (item_status, expected) => {
    expect(salesStatusKey({ ...syntheticSalesSummary(), item_status })).toBe(expected);
  });
  it.each([
    ["0.01", 1],
    ["10,29", 1029],
    ["100000000.00", 10000000000],
    ["10.999", null],
    ["1e3", null],
    ["-1", null],
    ["", null],
  ])("parses %s as integer cents", (input, expected) =>
    expect(moneyToCents(String(input))).toBe(expected),
  );
  it("preserves idempotency identity for unchanged retries only", () => {
    const first = commandIdentity(null, { amount: 1001 });
    expect(commandIdentity(first, { amount: 1001 })).toBe(first);
    expect(commandIdentity(first, { amount: 1002 }).key).not.toBe(first.key);
  });
  it("falls back only for explicitly disabled sales", () => {
    expect(isSalesDormant(new RepairDeskApiError("off", 503, "feature_disabled"))).toBe(true);
    for (const status of [401, 403, 404, 500])
      expect(isSalesDormant(new RepairDeskApiError("error", status))).toBe(false);
  });
  it("uses historical seller and ledger snapshots", () => {
    const doc = salesReceiptDocument(syntheticSalesReceipt(), syntheticSalesStore)!;
    expect(doc.source.store.storeName).toBe("HISTORICAL Synthetic Lab");
    expect(doc.balanceCents).toBe(7000);
    expect(doc.source.coverage).toBeUndefined();
    expect(doc.source.product.specification).toBe("256 GB · 8 GB · Silver");
  });
  it("rejects mixed balances, tenant mismatch and incomplete historical seller", () => {
    const receipt = syntheticSalesReceipt();
    expect(salesReceiptDocument(receipt, "another-store")).toBeNull();
    receipt.output_identity.canOutput = false;
    expect(salesReceiptDocument(receipt, syntheticSalesStore)).toBeNull();
    receipt.output_identity.canOutput = true;
    receipt.document!.order.balance_cents = 0;
    expect(() => salesReceiptDocument(receipt, syntheticSalesStore)).toThrow(
      "invalid-document-balance",
    );
    receipt.document!.store.address = "";
    expect(() => salesReceiptDocument(receipt, syntheticSalesStore)).toThrow("historical");
    expect(
      salesErrorKey(new RepairDeskApiError("history", 409, "historical_store_identity_incomplete")),
    ).toBe("historical");
  });
  it("converts Rome dates independently of browser timezone and rejects skipped DST time", () => {
    expect(romeDateTimeToIso("2026-09-01T12:30")).toBe("2026-09-01T10:30:00.000Z");
    expect(romeDateTimeToIso("2026-01-01T12:30")).toBe("2026-01-01T11:30:00.000Z");
    expect(romeDateTime(new Date("2026-09-01T10:30Z"))).toBe("2026-09-01T12:30");
    expect(() => romeDateTimeToIso("2026-03-29T02:30")).toThrow();
  });
  it("uses actual application locale tags", () => {
    expect(salesCopy("it-IT", "save")).toBe("Conferma");
    expect(salesLanguage("zh-CN")).toBe("zh");
  });
  it("accepts bounded existing filters and rejects invalid/injected filters", () => {
    expect(
      inventorySalesListBodySchema.parse({
        categories: ["other"],
        statuses: [],
        brands: [" Alpha "],
        locations: [],
      }),
    ).toMatchObject({ categories: ["other"], brands: ["Alpha"] });
    for (const value of [
      { categories: ["invalid"] },
      { brands: [""] },
      { locations: Array(21).fill("A") },
      { store_id: "injected" },
    ])
      expect(inventorySalesListBodySchema.safeParse(value).success).toBe(false);
  });
});
