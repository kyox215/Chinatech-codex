import { describe, expect, it } from "vitest";

import { parseBarcodePayload } from "./barcode-parser";

describe("parseBarcodePayload", () => {
  it("recognizes internal order links", () => {
    expect(parseBarcodePayload("https://example.com/orders/order_123").targetHref).toBe(
      "/orders/order_123",
    );
  });

  it("recognizes internal order task links", () => {
    expect(parseBarcodePayload("https://example.com/orders/order_123/task")).toMatchObject({
      kind: "order_link",
      label: "工单任务",
      targetHref: "/orders/order_123/task",
      value: "order_123",
    });
  });

  it("recognizes prefixed inventory payloads", () => {
    expect(parseBarcodePayload("inventory:sku-42")).toMatchObject({
      kind: "inventory_link",
      targetHref: "/inventory?id=sku-42",
    });
  });

  it("recognizes buyback links and prefixed buyback records", () => {
    expect(parseBarcodePayload("https://example.com/buyback?id=I001001")).toMatchObject({
      kind: "buyback_link",
      value: "I001001",
      targetHref: "/buyback?id=I001001",
    });
    expect(parseBarcodePayload("buyback:I001002")).toMatchObject({
      kind: "buyback_link",
      targetHref: "/buyback?id=I001002",
    });
  });

  it("normalizes IMEI-like values", () => {
    expect(parseBarcodePayload("35 123456 789012 3")).toMatchObject({
      kind: "imei",
      value: "351234567890123",
    });
  });

  it("extracts IMEI values from OCR-like labeled text", () => {
    expect(parseBarcodePayload("IMEI 35 123456 789012 3")).toMatchObject({
      kind: "imei",
      value: "351234567890123",
    });
    expect(parseBarcodePayload("IMEI2：35-987654-321098-7")).toMatchObject({
      kind: "imei",
      value: "359876543210987",
    });
  });

  it("extracts serial numbers from OCR-like labeled text", () => {
    expect(parseBarcodePayload("S/N C39ZQ123N70M")).toMatchObject({
      kind: "serial",
      value: "C39ZQ123N70M",
    });
    expect(parseBarcodePayload("Serial Number F2LXL0ABCDEF")).toMatchObject({
      kind: "serial",
      value: "F2LXL0ABCDEF",
    });
  });

  it("keeps generic external URLs", () => {
    expect(parseBarcodePayload("https://repair.example/path")).toMatchObject({
      kind: "url",
      targetHref: "https://repair.example/path",
    });
  });
});
