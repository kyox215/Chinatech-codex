import { describe, expect, it } from "vitest";

import { buildLocalInventoryRecognition } from "@/features/ai-assistant/model/inventory-recognition";
import {
  applyInventoryRecognitionReview,
  createEmptyInventoryIntakeDraft,
  createInventoryRecognitionReview,
  inventoryIntakeDraftToInput,
} from "./inventory-intake-draft";

describe("inventory intake draft", () => {
  it("preserves manual values until overwrite is explicitly selected", () => {
    const draft = { ...createEmptyInventoryIntakeDraft(), brand: "Xiaomi" };
    const recognition = buildLocalInventoryRecognition({
      ocrText: "REDMI A7 Pro Black 4GB RAM 64GB ROM",
    });
    const review = createInventoryRecognitionReview(recognition);
    review.fields.brand.decision = "accepted";
    review.fields.model.decision = "accepted";

    const first = applyInventoryRecognitionReview(draft, review);
    expect(first.draft.brand).toBe("Xiaomi");
    expect(first.draft.model).toBe("A7 Pro");
    expect(first.preservedManualFields).toEqual(["brand"]);

    review.fields.brand.overwriteManual = true;
    const overwritten = applyInventoryRecognitionReview(draft, review);
    expect(overwritten.draft.brand).toBe("Redmi");
  });

  it("keeps RAM and extra identifiers unmapped instead of hiding them in notes", () => {
    const recognition = buildLocalInventoryRecognition({
      ocrText: "REDMI A7 Pro Black 4GB RAM 64GB ROM IMEI: 990000000000002",
      barcodeValues: ["9900000000004"],
    });
    const review = createInventoryRecognitionReview(recognition);
    review.fields.ram_capacity.decision = "accepted";
    for (const item of review.identifiers) item.decision = "accepted";

    const result = applyInventoryRecognitionReview(createEmptyInventoryIntakeDraft(), review);
    expect(result.unmappedFields).toEqual(
      expect.arrayContaining(["ram_capacity", "identifier:imei1", "identifier:ean"]),
    );
    expect(result.draft.notes).toBe("");
    expect(result.draft.serial_or_imei).toBe("");
  });

  it("applies only an explicitly accepted primary valid identifier", () => {
    const recognition = buildLocalInventoryRecognition({
      ocrText: "IMEI: 990000000000002",
    });
    const review = createInventoryRecognitionReview(recognition);
    review.identifiers[0].decision = "accepted";
    review.identifiers[0].isPrimary = true;

    const result = applyInventoryRecognitionReview(createEmptyInventoryIntakeDraft(), review);
    expect(result.draft.serial_or_imei).toBe("990000000000002");
  });

  it("converts controlled string fields only at the existing save boundary", () => {
    const draft = {
      ...createEmptyInventoryIntakeDraft(),
      brand: " Redmi ",
      model: " A7 Pro ",
      buyback_price: "99.90",
      list_price: "",
      warranty_months: "12",
    };

    expect(inventoryIntakeDraftToInput(draft)).toMatchObject({
      brand: "Redmi",
      model: "A7 Pro",
      buyback_price: 99.9,
      list_price: undefined,
      warranty_months: 12,
    });
  });
});
