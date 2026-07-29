import { describe, expect, it } from "vitest";

import { parseBarcodePayload } from "@/features/capture/model/barcode-parser";
import { resolveScanSearchActions } from "@/features/capture/model/scan-search-resolver";

describe("resolveScanSearchActions", () => {
  const legacyCustomerStatusToken = "A".repeat(43);

  it("opens existing order task QR links and still offers scoped order search", () => {
    const payload = parseBarcodePayload(
      "https://chinatech.in/orders/order_123/task",
      "https://chinatech.in",
    );

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
        href: "/orders",
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
        href: "/inventory",
        primary: true,
      }),
    ]);
  });

  it("offers global search routes for generic serial values", () => {
    const payload = parseBarcodePayload("serial:C39ZQ123N70M");

    expect(resolveScanSearchActions(payload, "global").actions).toEqual([
      expect.objectContaining({ label: "搜订单", href: "/orders", searchValue: "C39ZQ123N70M" }),
      expect.objectContaining({ label: "搜客户", href: "/customers", searchValue: "C39ZQ123N70M" }),
      expect.objectContaining({ label: "搜回收", href: "/buyback", searchValue: "C39ZQ123N70M" }),
      expect.objectContaining({ label: "搜库存", href: "/inventory", searchValue: "C39ZQ123N70M" }),
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
        parseBarcodePayload("https://chinatech.in/inventory?id=sku-43", "https://chinatech.in"),
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

  it("only offers the protected internal open action for official customer status QR links", () => {
    const payload = parseBarcodePayload(`https://www.chinatech.in/r#${legacyCustomerStatusToken}`);

    for (const scope of ["global", "orders", "customers", "buyback", "inventory"] as const) {
      expect(resolveScanSearchActions(payload, scope).actions).toEqual([
        {
          id: "open:customer_status_link",
          kind: "open",
          label: "查看此订单",
          href: `/r#${legacyCustomerStatusToken}`,
          primary: true,
        },
      ]);
    }
  });

  it("never creates search actions for malformed trusted customer status links", () => {
    for (const raw of [
      "https://www.chinatech.in/r#invalid",
      `//www.chinatech.in/r#${legacyCustomerStatusToken}`,
      `https://www.chinatech.in/r/extra#${legacyCustomerStatusToken}`,
      `https://www.chinatech.in.evil.example/r#${legacyCustomerStatusToken}`,
    ]) {
      const payload = parseBarcodePayload(raw);
      expect(resolveScanSearchActions(payload, "global")).toMatchObject({
        actions: [],
        hint: "二维码凭据无效或链接格式不受信任，请重新扫描工单二维码。",
      });
      expect(resolveScanSearchActions(payload, "orders").actions).toEqual([]);
    }

    const httpsSchemeRelativePayload = parseBarcodePayload(
      `//www.chinatech.in/r#${legacyCustomerStatusToken}`,
      "https://preview.example",
    );
    for (const scope of ["global", "orders", "customers", "buyback", "inventory"] as const) {
      expect(resolveScanSearchActions(httpsSchemeRelativePayload, scope).actions).toEqual([]);
    }
  });
});
