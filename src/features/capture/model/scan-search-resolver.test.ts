import { describe, expect, it } from "vitest";

import { parseBarcodePayload } from "@/features/capture/model/barcode-parser";
import { resolveScanSearchActions } from "@/features/capture/model/scan-search-resolver";

describe("resolveScanSearchActions", () => {
  const legacyCustomerStatusToken = "A".repeat(43);
  const stableCustomerStatusToken = `v2.1.${"B".repeat(22)}.1.${"C".repeat(43)}`;

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
    for (const tokenOrLink of [
      legacyCustomerStatusToken,
      stableCustomerStatusToken,
      `https://www.chinatech.in/r#${legacyCustomerStatusToken}`,
    ]) {
      const payload = parseBarcodePayload(tokenOrLink);
      const expectedToken = tokenOrLink.includes("#")
        ? (tokenOrLink.split("#").at(-1) ?? "")
        : tokenOrLink;

      for (const scope of ["global", "orders", "customers", "buyback", "inventory"] as const) {
        expect(resolveScanSearchActions(payload, scope).actions).toEqual([
          {
            id: "open:customer_status_link",
            kind: "open",
            label: "查看此订单",
            href: `/r#${expectedToken}`,
            primary: true,
          },
        ]);
      }
    }
  });

  it("never creates search actions for malformed trusted customer status links", () => {
    for (const raw of [
      "https://www.chinatech.in/r#invalid",
      `//www.chinatech.in/r#${legacyCustomerStatusToken}`,
      `https://www.chinatech.in/r/extra#${legacyCustomerStatusToken}`,
      `https://www.chinatech.in.evil.example/r#${legacyCustomerStatusToken}`,
      `https://[invalid/r#${legacyCustomerStatusToken}.trailing`,
      `https://[invalid/r#prefix.${stableCustomerStatusToken}`,
      `order:${legacyCustomerStatusToken}`,
      `order:${stableCustomerStatusToken}`,
    ]) {
      const payload = parseBarcodePayload(raw);
      expect(payload).toMatchObject({
        kind: "customer_status_link",
        raw: "",
        value: "",
        sensitive: true,
      });
      expect(payload.targetHref).toBeUndefined();
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

  it("localizes presentation labels while keeping action routing invariant", () => {
    const payload = parseBarcodePayload("serial:C39ZQ123N70M");
    const zh = resolveScanSearchActions(payload, "global", "zh-CN");
    const it = resolveScanSearchActions(payload, "global", "it-IT");

    expect(it.title).toBe("Numero di serie");
    const routingShape = (action: (typeof zh.actions)[number]) => ({
      id: action.id,
      kind: action.kind,
      href: action.href,
      searchValue: action.kind === "search" ? action.searchValue : undefined,
      primary: action.primary,
    });
    expect(it.actions.map(routingShape)).toEqual(zh.actions.map(routingShape));
  });

  it.each(
    (["zh-CN", "it-IT", "en"] as const).flatMap((locale) =>
      (["global", "orders", "customers", "buyback", "inventory"] as const).map(
        (scope) => [locale, scope] as const,
      ),
    ),
  )("keeps %s %s action routing stable with localized labels", (locale, scope) => {
    const payload = parseBarcodePayload("serial:C39ZQ123N70M");
    const resolution = resolveScanSearchActions(payload, scope, locale);
    const routingShape = (action: (typeof resolution.actions)[number]) => ({
      id: action.id,
      kind: action.kind,
      href: action.href,
      searchValue: action.kind === "search" ? action.searchValue : undefined,
      primary: action.primary,
    });
    const expectedLabels = {
      "zh-CN": {
        global: ["搜订单", "搜客户", "搜回收", "搜库存"],
        orders: ["在订单搜索"],
        customers: ["在客户搜索"],
        buyback: ["在回收搜索"],
        inventory: ["在库存搜索"],
      },
      "it-IT": {
        global: ["Cerca Ordini", "Cerca Clienti", "Cerca Ritiro usato", "Cerca Magazzino"],
        orders: ["Cerca in Ordini"],
        customers: ["Cerca in Clienti"],
        buyback: ["Cerca in Ritiro usato"],
        inventory: ["Cerca in Magazzino"],
      },
      en: {
        global: ["Search Orders", "Search Customers", "Search Buyback", "Search Inventory"],
        orders: ["Search Orders"],
        customers: ["Search Customers"],
        buyback: ["Search Buyback"],
        inventory: ["Search Inventory"],
      },
    } as const;
    const zhRouting = resolveScanSearchActions(payload, scope, "zh-CN").actions.map(routingShape);

    expect(resolution.actions.map(routingShape)).toEqual(zhRouting);
    expect(resolution.actions.map((action) => action.label)).toEqual(expectedLabels[locale][scope]);
  });
});
