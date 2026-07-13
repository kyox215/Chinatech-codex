import { describe, expect, it } from "vitest";

import {
  buildInventorySaleReceiptData,
  buildInventorySaleReceiptSnapshot,
  getInventoryWarrantyState,
  readInventorySaleReceiptSnapshot,
} from "./inventory-sale-receipt";
import type { InventoryListItem } from "@/lib/repairdesk/types";

describe("inventory sale receipt", () => {
  it("builds and reads a stable sale receipt snapshot", () => {
    const snapshot = buildInventorySaleReceiptSnapshot({
      publicNo: "I001299",
      soldAt: "2026-07-09T10:00:00.000Z",
      warrantyMonths: 12,
      warrantyUntil: "2027-07-09T10:00:00.000Z",
      terms: ["custom term"],
    });

    expect(snapshot).toMatchObject({
      receipt_no: "I001299-20260709",
      warranty_months: 12,
      warranty_until: "2027-07-09T10:00:00.000Z",
      terms: ["custom term"],
    });
    expect(readInventorySaleReceiptSnapshot({ sale_receipt: snapshot })).toEqual(snapshot);
  });

  it("builds printable receipt data and warranty state from a sold item", () => {
    const item = inventoryItem({
      warranty_until: "2027-01-09T10:00:00.000Z",
      legacy_payload: {
        sale_receipt: buildInventorySaleReceiptSnapshot({
          publicNo: "I001300",
          soldAt: "2026-07-09T10:00:00.000Z",
          warrantyMonths: 6,
          warrantyUntil: "2027-01-09T10:00:00.000Z",
        }),
      },
    });

    const receipt = buildInventorySaleReceiptData(item, {
      storeIdentity: {
        storeName: "Ripara Subito",
        storeAddress: "Via Roma 12, Siracusa",
      },
      buyerName: "Luca Rossi",
      buyerPhone: "+393330001111",
    });

    expect(receipt.receipt_no).toBe("I001300-20260709");
    expect(receipt.item_label).toBe("Apple iPhone 13");
    expect(receipt.buyer_name).toBe("Luca Rossi");
    expect(receipt.terms.length).toBeGreaterThan(0);
    expect(receipt.store_name).toBe("Ripara Subito");
    expect(receipt.store_address).toBe("Via Roma 12, Siracusa");
    expect(JSON.stringify(receipt)).not.toMatch(/ChinaTech|Floridia|Viale Vittorio Veneto/i);
    expect(getInventoryWarrantyState(item, new Date("2026-08-01T00:00:00.000Z"))).toMatchObject({
      key: "active",
    });
  });

  it("represents an explicit zero-month sale as no warranty without an expiry", () => {
    const item = inventoryItem({
      warranty_months: 0,
      warranty_until: undefined,
      legacy_payload: {
        sale_receipt: buildInventorySaleReceiptSnapshot({
          publicNo: "I001301",
          soldAt: "2026-07-09T10:00:00.000Z",
          warrantyMonths: 0,
        }),
      },
    });

    const receipt = buildInventorySaleReceiptData(item, {
      storeIdentity: { storeName: "Repair Lab", storeAddress: "Via Roma 12" },
    });

    expect(receipt.warranty_months).toBe(0);
    expect(receipt.warranty_until).toBeUndefined();
    expect(getInventoryWarrantyState(item)).toEqual({ key: "none", label: "无保修" });
  });
});

function inventoryItem(overrides: Partial<InventoryListItem> = {}): InventoryListItem {
  return {
    id: "inv_receipt",
    public_no: "I001300",
    status: "sold",
    source_type: "manual_stock",
    category: "phone",
    brand: "Apple",
    model: "iPhone 13",
    color: "Blue",
    storage_capacity: "128GB",
    serial_or_imei: "356789000000001",
    imei_check_status: "pass",
    activation_lock_status: "pass",
    data_wipe_status: "pass",
    cosmetic_grade: "good",
    functional_grade: "passed",
    buyback_price: 320,
    list_price: 459,
    sale_price: 449,
    deposit_amount: 0,
    repair_cost_amount: 0,
    fees_amount: 0,
    currency_code: "EUR",
    payment_method: "contanti",
    sale_channel: "store",
    warranty_months: 6,
    sold_at: "2026-07-09T10:00:00.000Z",
    legacy_payload: {},
    created_at: "2026-07-09T09:00:00.000Z",
    updated_at: "2026-07-09T10:00:00.000Z",
    item_label: "Apple iPhone 13",
    profit: 129,
    ...overrides,
  };
}
