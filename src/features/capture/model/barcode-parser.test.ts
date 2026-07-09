import { describe, expect, it } from "vitest";

import {
  extractImeiCandidates,
  getPreferredImeiCandidate,
  isValidImei,
  parseBarcodePayload,
} from "./barcode-parser";

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
      targetHref: "/inventory?item=sku-42",
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

describe("extractImeiCandidates", () => {
  it("validates standard 15 digit IMEI values with Luhn", () => {
    expect(isValidImei("490154203237518")).toBe(true);
    expect(isValidImei("49 015420 323751 8")).toBe(true);
    expect(isValidImei("351234567890123")).toBe(false);
    expect(isValidImei("49015420323751")).toBe(false);
  });

  it("extracts multiple IMEI candidates from OCR-like text", () => {
    const candidates = extractImeiCandidates("IMEI1: 490154203237518 IMEI2: 356938035643809", {
      source: "ocr",
    });

    expect(candidates).toMatchObject([
      {
        kind: "imei",
        label: "IMEI1",
        value: "490154203237518",
        source: "ocr",
        isValidImei: true,
      },
      {
        kind: "imei",
        label: "IMEI2",
        value: "356938035643809",
        source: "ocr",
        isValidImei: true,
      },
    ]);
  });

  it("keeps invalid numeric values as suspect candidates instead of confirmed IMEI", () => {
    const candidates = extractImeiCandidates("IMEI: 351234567890123");

    expect(candidates).toMatchObject([
      {
        kind: "suspect_imei",
        value: "351234567890123",
        isValidImei: false,
        reason: "15 位数字未通过 IMEI 校验位。",
      },
    ]);
  });

  it("extracts pure digit OCR values with common separators", () => {
    const candidates = extractImeiCandidates("机身数字 49 015420 323751 8 包装标签");

    expect(candidates).toMatchObject([
      {
        kind: "imei",
        value: "490154203237518",
      },
    ]);
  });

  it("extracts multiple plain numeric OCR IMEI chunks separated by whitespace", () => {
    const candidates = extractImeiCandidates("490154203237518 356938035643809", {
      source: "ocr",
    });

    expect(candidates).toMatchObject([
      {
        kind: "imei",
        value: "490154203237518",
      },
      {
        kind: "imei",
        value: "356938035643809",
      },
    ]);
  });

  it("extracts labeled serial numbers without treating every OCR word as a serial", () => {
    expect(extractImeiCandidates("Serial Number F2LXL0ABCDEF")).toMatchObject([
      {
        kind: "serial",
        label: "SN",
        value: "F2LXL0ABCDEF",
      },
    ]);

    expect(extractImeiCandidates("Device label without useful number")).toEqual([]);
  });

  it("keeps candidate labels from multi-barcode device screens", () => {
    const candidates = extractImeiCandidates(
      "EC-890480512036007823800799141943\nIMEI1:356734205071822\nIMEI2:356734205074023\nSN:AUNWE02SB05002790",
      {
        source: "ocr",
        includeGenericSerial: true,
      },
    );

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "serial",
          label: "ECID",
          value: "890480512036007823800799141943",
        }),
        expect.objectContaining({
          kind: "suspect_imei",
          label: "IMEI1（疑似）",
          value: "356734205071822",
        }),
        expect.objectContaining({
          kind: "suspect_imei",
          label: "IMEI2（疑似）",
          value: "356734205074023",
        }),
        expect.objectContaining({
          kind: "serial",
          label: "SN",
          value: "AUNWE02SB05002790",
        }),
      ]),
    );
    expect(candidates).toHaveLength(4);
  });

  it("can include a generic serial for direct barcode payloads", () => {
    expect(
      extractImeiCandidates("C39ZQ123N70M", {
        source: "barcode",
        includeGenericSerial: true,
      }),
    ).toMatchObject([
      {
        kind: "serial",
        value: "C39ZQ123N70M",
        source: "barcode",
      },
    ]);
  });

  it("does not add a generic serial when a labeled serial already exists", () => {
    const candidates = extractImeiCandidates("SN:AUNWE02SB05002790", {
      source: "barcode",
      includeGenericSerial: true,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      kind: "serial",
      label: "SN",
      value: "AUNWE02SB05002790",
    });
  });

  it("does not duplicate a valid IMEI as a generic serial candidate", () => {
    const candidates = extractImeiCandidates("490154203237518", {
      source: "barcode",
      includeGenericSerial: true,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      kind: "imei",
      value: "490154203237518",
    });
  });

  it("prefers valid IMEI values over serial and suspect candidates", () => {
    const candidates = extractImeiCandidates(
      "IMEI: 351234567890123 S/N C39ZQ123N70M IMEI2 490154203237518",
    );

    expect(getPreferredImeiCandidate(candidates)).toMatchObject({
      kind: "imei",
      value: "490154203237518",
    });
  });
});
