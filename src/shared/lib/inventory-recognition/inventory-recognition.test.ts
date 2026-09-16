import { describe, expect, it } from "vitest";

import { INVENTORY_RECOGNITION_CONTRACT_VERSION, type InventoryRecognition } from "./contracts";
import { buildLocalInventoryRecognition } from "./inventory-recognition";

describe("inventory recognition merge", () => {
  it("extracts the sample-shaped Redmi label conservatively", () => {
    const recognition = buildLocalInventoryRecognition({
      ocrText: [
        "REDMI A7 Pro Black",
        "4GB RAM 64GB ROM",
        "IMEI1: 990000000000002",
        "IMEI2: 990000000000010",
      ].join("\n"),
    });

    expect(recognition.fields).toMatchObject({
      brand: { value: "Redmi", confidence: "review", source: "ocr" },
      model: { value: "A7 Pro", confidence: "review", source: "ocr" },
      color: { value: "Black", confidence: "review", source: "ocr" },
      ram_capacity: { value: "4 GB", confidence: "review", source: "ocr" },
      storage_capacity: { value: "64 GB", confidence: "review", source: "ocr" },
    });
    expect(recognition.identifiers).toHaveLength(2);
    expect(recognition.identifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "imei1", value: "990000000000002" }),
        expect.objectContaining({ type: "imei2", value: "990000000000010" }),
      ]),
    );
    expect(recognition.identifiers.every((candidate) => candidate.validation === "valid")).toBe(
      true,
    );
    expect(recognition.label_claim_only).toBe(true);
  });

  it("preserves explicit IMEI1 and IMEI2 labels even when OCR order is reversed", () => {
    const recognition = buildLocalInventoryRecognition({
      ocrText: "IMEI2: 990000000000010\nIMEI1: 990000000000002",
      barcodeValues: ["990000000000010", "990000000000002"],
    });

    expect(recognition.identifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "imei1", value: "990000000000002" }),
        expect.objectContaining({ type: "imei2", value: "990000000000010" }),
      ]),
    );
    expect(recognition.conflicts).toEqual([]);
  });

  it("marks invalid IMEI candidates and keeps valid GTIN evidence separate", () => {
    const recognition = buildLocalInventoryRecognition({
      ocrText: "IMEI: 123456789012345",
      barcodeValues: ["9900000000004"],
    });

    expect(recognition.identifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "unknown", validation: "invalid" }),
        expect.objectContaining({ type: "ean", validation: "valid", source: "barcode" }),
      ]),
    );
    expect(recognition.warnings.join(" ")).toMatch(/Luhn/);
  });
});

function recognition({ brand, storage }: { brand: string; storage: string }): InventoryRecognition {
  const field = (value: string | null) => ({
    value,
    confidence: value ? ("high" as const) : ("unknown" as const),
    evidence: value ? "视觉标签" : null,
    source: value ? ("vision" as const) : ("unknown" as const),
  });
  return {
    schema_version: INVENTORY_RECOGNITION_CONTRACT_VERSION,
    fields: {
      brand: field(brand),
      model: field(null),
      color: field(null),
      ram_capacity: field(null),
      storage_capacity: field(storage),
    },
    identifiers: [],
    conflicts: [],
    warnings: [],
    label_claim_only: true,
  };
}
