import { describe, expect, it } from "vitest";

import { AI_ASSISTANT_CONTRACT_VERSION, type AiInventoryRecognition } from "./contracts";
import {
  buildLocalInventoryRecognition,
  isLocalInventoryRecognitionSufficient,
  mergeInventoryRecognitions,
  normalizeProviderInventoryRecognition,
} from "./inventory-recognition";

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

  it("raises a structured conflict instead of silently picking local evidence", () => {
    const vision = recognition({ brand: "Xiaomi", storage: "128 GB" });
    const local = buildLocalInventoryRecognition({
      ocrText: "REDMI A7 Pro Black 4GB RAM 64GB ROM",
    });
    const merged = mergeInventoryRecognitions(vision, local);

    expect(merged.fields.brand).toMatchObject({ value: "Xiaomi", confidence: "review" });
    expect(merged.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "brand", values: ["Xiaomi", "Redmi"] }),
        expect.objectContaining({ target: "storage_capacity", values: ["128 GB", "64 GB"] }),
      ]),
    );
  });

  it("skips cloud fallback only for a complete, conflict-free local label", () => {
    const complete = buildLocalInventoryRecognition({
      ocrText: "REDMI A7 Pro Black 4GB RAM 64GB ROM",
    });
    const incomplete = buildLocalInventoryRecognition({ ocrText: "REDMI A7 Pro Black" });
    const invalid = buildLocalInventoryRecognition({
      ocrText: "REDMI A7 Pro Black 4GB RAM 64GB ROM IMEI 123456789012345",
    });

    expect(isLocalInventoryRecognitionSufficient(complete)).toBe(true);
    expect(isLocalInventoryRecognitionSufficient(incomplete)).toBe(false);
    expect(isLocalInventoryRecognitionSufficient(invalid)).toBe(false);
  });

  it("rejects an invalid 15-digit IMEI even when the provider disguises it as a serial", () => {
    const provider = recognition({ brand: "Redmi", storage: "64 GB" });
    provider.identifiers = [
      {
        type: "serial",
        value: "123456789012345",
        confidence: "high",
        evidence: "visible label",
        source: "vision",
        validation: "not_applicable",
      },
    ];

    const normalized = normalizeProviderInventoryRecognition(provider);
    expect(normalized.identifiers).toEqual([
      expect.objectContaining({
        type: "unknown",
        value: "123456789012345",
        confidence: "review",
        validation: "invalid",
      }),
    ]);
    expect(normalized.fields.brand).toMatchObject({ confidence: "review", source: "vision" });
  });

  it("lets deterministic invalid evidence override a same-value not-applicable claim", () => {
    const vision = recognition({ brand: "Redmi", storage: "64 GB" });
    vision.identifiers = [
      {
        type: "serial",
        value: "123456789012345",
        confidence: "review",
        evidence: "AI serial claim",
        source: "vision",
        validation: "not_applicable",
      },
    ];
    const local = buildLocalInventoryRecognition({ ocrText: "IMEI 123456789012345" });
    const merged = mergeInventoryRecognitions(vision, local);

    expect(merged.identifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "123456789012345",
          type: "unknown",
          validation: "invalid",
        }),
      ]),
    );
  });
});

function recognition({
  brand,
  storage,
}: {
  brand: string;
  storage: string;
}): AiInventoryRecognition {
  const field = (value: string | null) => ({
    value,
    confidence: value ? ("high" as const) : ("unknown" as const),
    evidence: value ? "视觉标签" : null,
    source: value ? ("vision" as const) : ("unknown" as const),
  });
  return {
    schema_version: AI_ASSISTANT_CONTRACT_VERSION,
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
