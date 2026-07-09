import { describe, expect, it } from "vitest";

import { parseBarcodePayload } from "@/features/capture/model/barcode-parser";
import { resolveScanSearchActions } from "@/features/capture/model/scan-search-resolver";

describe("resolveScanSearchActions", () => {
  it("opens existing order task QR links and still offers scoped order search", () => {
    const payload = parseBarcodePayload("https://chinatech.in/orders/order_123/task");

    expect(resolveScanSearchActions(payload, "orders").actions).toEqual([
      expect.objectContaining({
        kind: "open",
        label: "打开工单",
        href: "/orders/order_123/task",
        primary: true,
      }),
      expect.objectContaining({
        kind: "search",
        label: "在订单搜索",
        searchValue: "order_123",
        href: "/orders?q=order_123",
      }),
    ]);
  });

  it("uses current-page search for IMEI values", () => {
    const payload = parseBarcodePayload("490154203237518");

    expect(resolveScanSearchActions(payload, "inventory").actions).toEqual([
      expect.objectContaining({
        kind: "search",
        label: "在库存搜索",
        searchValue: "490154203237518",
        href: "/inventory?q=490154203237518",
        primary: true,
      }),
    ]);
  });

  it("offers global search routes for generic serial values", () => {
    const payload = parseBarcodePayload("serial:C39ZQ123N70M");

    expect(resolveScanSearchActions(payload, "global").actions).toEqual([
      expect.objectContaining({ label: "搜订单", href: "/orders?q=C39ZQ123N70M" }),
      expect.objectContaining({ label: "搜客户", href: "/customers?q=C39ZQ123N70M" }),
      expect.objectContaining({ label: "搜回收", href: "/buyback?q=C39ZQ123N70M" }),
      expect.objectContaining({ label: "搜库存", href: "/inventory?q=C39ZQ123N70M" }),
    ]);
  });

  it("normalizes inventory payloads to the inventory item focus parameter", () => {
    expect(
      resolveScanSearchActions(parseBarcodePayload("inventory:sku-42"), "global").actions[0],
    ).toEqual(
      expect.objectContaining({
        kind: "open",
        label: "打开库存",
        href: "/inventory?item=sku-42",
      }),
    );

    expect(
      resolveScanSearchActions(
        parseBarcodePayload("https://chinatech.in/inventory?id=sku-43"),
        "inventory",
      ).actions[0],
    ).toEqual(
      expect.objectContaining({
        kind: "open",
        href: "/inventory?item=sku-43",
      }),
    );
  });

  it("does not create an external open action for arbitrary URLs", () => {
    const payload = parseBarcodePayload("https://example.com/not-internal");

    expect(resolveScanSearchActions(payload, "global").actions).toEqual([
      expect.objectContaining({ kind: "search", label: "搜订单" }),
      expect.objectContaining({ kind: "search", label: "搜客户" }),
      expect.objectContaining({ kind: "search", label: "搜回收" }),
      expect.objectContaining({ kind: "search", label: "搜库存" }),
    ]);
  });
});
