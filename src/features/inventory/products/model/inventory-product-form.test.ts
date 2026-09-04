import { describe, expect, it } from "vitest";

import {
  createInventoryProductFormDraft,
  clearInventoryProductFormDependencies,
  formIdentifiers,
  inventoryProductEditDataToFormDraft,
  inventoryProductFormToCreateInput,
  inventoryProductFormToUpdateInput,
  isInventoryProductFormDraftDirty,
  mergeInventoryProductFormDraft,
  type InventoryProductFormDraft,
  validateInventoryProductFormDraft,
} from "./inventory-product-form";

describe("InventoryProductForm pure contract", () => {
  const approvedAppleColors = {
    "iPhone 15 Pro": [
      { id: "natural-titanium", name: "原色钛金属", swatches: ["#b8ad9e"] },
      { id: "blue-titanium", name: "蓝色钛金属", swatches: ["#4d5c6c"] },
    ],
  } as const;

  it("returns stable validation codes and field identities without parsing display copy", () => {
    const validate = (
      mutate: (draft: InventoryProductFormDraft) => void,
      options: Parameters<typeof validateInventoryProductFormDraft>[1] = {},
    ) => {
      const draft = createInventoryProductFormDraft("phone");
      draft.brand = "Samsung";
      draft.model = "Galaxy Synthetic";
      mutate(draft);
      return validateInventoryProductFormDraft(draft, options);
    };

    expect(validate((draft) => (draft.brand = ""))).toMatchObject({
      code: "brand_required",
      fieldId: "product-brand",
    });
    expect(validate((draft) => (draft.model = ""))).toMatchObject({
      code: "model_required",
      fieldId: "product-model",
    });
    expect(validate((draft) => (draft.notes = "x".repeat(2_001)))).toMatchObject({
      code: "notes_too_long",
      fieldId: "product-notes",
    });
    expect(
      validate((draft) => {
        draft.inspection_touched = true;
        draft.inspection_battery_health = "101";
      }),
    ).toMatchObject({ code: "battery_invalid", fieldId: "product-battery-health" });
    expect(validate((draft) => (draft.identifiers.imei2 = "490154203237518"))).toMatchObject({
      code: "imei2_requires_imei1",
      fieldId: "product-imei1",
    });
    expect(validate(() => undefined, { requireImei1: true })).toMatchObject({
      code: "imei1_required",
      fieldId: "product-imei1",
    });
    expect(validate((draft) => (draft.gtin = "12345678"))).toMatchObject({
      code: "gtin_invalid",
      fieldId: "product-gtin",
    });
    expect(validate((draft) => (draft.identifiers.imei1 = "123"))).toMatchObject({
      code: "imei_invalid",
      fieldId: "product-imei1",
    });
    expect(validate((draft) => (draft.identifiers.serial = "x"))).toMatchObject({
      code: "serial_invalid",
      fieldId: "product-serial",
    });
    expect(validate((draft) => (draft.identifiers.eid = "123"))).toMatchObject({
      code: "eid_invalid",
      fieldId: "product-eid",
    });
    expect(
      validate((draft) => {
        draft.identifiers.imei1 = "490154203237518";
        draft.identifiers.serial = "490154203237518";
      }),
    ).toMatchObject({ code: "identifier_duplicate", fieldId: "product-serial" });
    expect(
      validate((draft) => {
        draft.identifiers.eid = "12345678901234567890123456789012";
      }),
    ).toMatchObject({ code: "primary_identifier_required", fieldId: "product-imei1" });
    expect(
      validate((draft) => {
        draft.identifiers.eid = "12345678901234567890123456789012";
        draft.primary_identifier_kind = "eid";
      }),
    ).toMatchObject({ code: "eid_primary_forbidden", fieldId: "product-eid" });
    expect(validate((draft) => (draft.list_price = "1.234"))).toMatchObject({
      code: "list_price_invalid",
      fieldId: "product-price",
    });
    expect(
      validate((draft) => (draft.cost_amount = "1.234"), { canEnterCost: true }),
    ).toMatchObject({ code: "cost_amount_invalid", fieldId: "product-cost" });
    expect(validate((draft) => (draft.warranty_months = "121"))).toMatchObject({
      code: "warranty_invalid",
      fieldId: "product-warranty",
    });
    expect(validate((draft) => (draft.color = ""), { colorRequired: true })).toMatchObject({
      code: "color_required",
      fieldId: "product-color",
    });
    expect(
      validate(
        (draft) => {
          draft.brand = "Apple";
          draft.model = "iPhone 15 Pro";
          draft.color = "Unapproved Dynamic Color";
        },
        { approvedAppleColorOverlay: approvedAppleColors },
      ),
    ).toMatchObject({ code: "color_not_approved", fieldId: "product-color" });
  });

  it("omits a new Apple color from create while official mapping is pending", () => {
    const draft = createInventoryProductFormDraft("phone");
    draft.brand = "Apple";
    draft.model = "iPhone 15 Pro 手动型号";
    draft.color = "手输蓝色";

    expect(
      inventoryProductFormToCreateInput(draft, "00000000-0000-4000-8000-000000000010"),
    ).not.toHaveProperty("color");
  });

  it("preserves only the persisted Apple color on a pending edit", () => {
    const draft = createInventoryProductFormDraft("phone");
    draft.brand = "Apple";
    draft.model = "iPhone 15 Pro 手动型号";
    draft.color = "新手输颜色";

    expect(
      inventoryProductFormToUpdateInput(draft, "00000000-0000-4000-8000-000000000011", 2, {
        existingColor: "原色钛金属",
      }).color,
    ).toBe("原色钛金属");
  });

  it("serializes an exact approved Apple color and rejects required pending color", () => {
    const approvedDraft = createInventoryProductFormDraft("phone");
    approvedDraft.brand = "Apple";
    approvedDraft.model = "iPhone 15 Pro";
    approvedDraft.color = "蓝色钛金属";
    expect(
      inventoryProductFormToCreateInput(approvedDraft, "00000000-0000-4000-8000-000000000012", {
        approvedAppleColorOverlay: approvedAppleColors,
      }).color,
    ).toBe("蓝色钛金属");

    const pendingDraft = createInventoryProductFormDraft("phone");
    pendingDraft.brand = "Apple";
    pendingDraft.model = "iPhone 15 Pro 手动型号";
    expect(validateInventoryProductFormDraft(pendingDraft, { colorRequired: true })).toMatchObject({
      fieldId: "product-color",
    });
  });

  it("requires IMEI1 only for phone intake when the explicit option is enabled", () => {
    const phoneDraft = createInventoryProductFormDraft("phone");
    phoneDraft.brand = "Apple";
    phoneDraft.model = "iPhone 15";
    expect(validateInventoryProductFormDraft(phoneDraft, { requireImei1: true })).toMatchObject({
      fieldId: "product-imei1",
    });

    const computerDraft = createInventoryProductFormDraft("computer");
    computerDraft.brand = "Apple";
    computerDraft.model = "MacBook Air";
    expect(
      validateInventoryProductFormDraft(computerDraft, { requireImei1: true }),
    ).toBeUndefined();
  });

  it("never promotes EID to primary", () => {
    const draft = createInventoryProductFormDraft("phone");
    draft.brand = "Apple";
    draft.model = "iPhone 15";
    draft.identifiers.eid = "12345678901234567890123456789012";
    expect(formIdentifiers(draft)).toEqual([
      {
        kind: "eid",
        value: "12345678901234567890123456789012",
        source: "manual",
      },
    ]);
    expect(validateInventoryProductFormDraft(draft)?.message).toContain("主要");
  });

  it("chooses the first eligible identifier and preserves sources", () => {
    const draft = createInventoryProductFormDraft("phone");
    draft.brand = "Apple";
    draft.model = "iPhone 15";
    draft.identifiers.eid = "12345678901234567890123456789012";
    draft.identifiers.imei1 = "490154203237518";
    draft.identifier_sources.imei1 = "scan";
    expect(formIdentifiers(draft)).toEqual([
      { kind: "imei1", value: "490154203237518", source: "scan", primary: true },
      { kind: "eid", value: "12345678901234567890123456789012", source: "manual" },
    ]);
  });

  it("serializes notes and omits blank optional values", () => {
    const draft = createInventoryProductFormDraft("computer");
    draft.brand = "Apple";
    draft.model = "MacBook Air";
    draft.notes = "内部备注";
    const input = inventoryProductFormToCreateInput(draft, "00000000-0000-4000-8000-000000000000");
    expect(input.notes).toBe("内部备注");
    expect(input.color).toBeUndefined();
    expect(isInventoryProductFormDraftDirty(draft)).toBe(true);
  });

  it("keeps inspection persistence opt-in and serializes only touched fields", () => {
    const draft = createInventoryProductFormDraft("phone");
    draft.brand = "Apple";
    draft.model = "iPhone 15";
    const untouched = inventoryProductFormToCreateInput(
      draft,
      "00000000-0000-4000-8000-000000000000",
    );
    expect(untouched.inspection).toBeUndefined();

    draft.inspection_touched = true;
    draft.inspection_battery_health = "91";
    draft.inspection_face_id_status = "normal";
    const touched = inventoryProductFormToCreateInput(
      draft,
      "00000000-0000-4000-8000-000000000001",
    );
    expect(touched.inspection).toEqual({ battery_health: 91, face_id_status: "normal" });
  });

  it("preserves an explicit unknown battery value when an inspection is touched", () => {
    const draft = createInventoryProductFormDraft("phone");
    draft.brand = "Apple";
    draft.model = "iPhone 15";
    draft.inspection_touched = true;
    expect(
      inventoryProductFormToCreateInput(draft, "00000000-0000-4000-8000-000000000003").inspection,
    ).toEqual({ battery_health: null });
  });

  it.each([
    ["0", 0],
    ["100", 100],
    ["", null],
  ] as const)("serializes battery health %s as an explicit inspection value", (value, expected) => {
    const draft = createInventoryProductFormDraft("phone");
    draft.brand = "Apple";
    draft.model = "iPhone 15";
    draft.inspection_touched = true;
    draft.inspection_battery_health = value;
    expect(
      inventoryProductFormToCreateInput(draft, "00000000-0000-4000-8000-000000000004").inspection,
    ).toMatchObject({ battery_health: expected });
  });

  it.each([
    ["not_tested", undefined],
    ["normal", "normal"],
    ["abnormal", "abnormal"],
    ["not_applicable", "not_applicable"],
  ] as const)("keeps Face ID state %s explicit", (status, expected) => {
    const draft = createInventoryProductFormDraft("phone");
    draft.brand = "Apple";
    draft.model = "iPhone 15";
    draft.inspection_touched = true;
    draft.inspection_face_id_status = status;
    const inspection = inventoryProductFormToCreateInput(
      draft,
      "00000000-0000-4000-8000-000000000005",
    ).inspection;
    if (expected) expect(inspection).toMatchObject({ face_id_status: expected });
    else expect(inspection).not.toHaveProperty("face_id_status");
  });

  it("rejects invalid touched battery health before submission", () => {
    const draft = createInventoryProductFormDraft("phone");
    draft.brand = "Apple";
    draft.model = "iPhone 15";
    draft.inspection_touched = true;
    draft.inspection_battery_health = "101";
    expect(validateInventoryProductFormDraft(draft)).toMatchObject({
      fieldId: "product-battery-health",
    });
  });

  it("keeps the historical primary identifier when loading edit data", () => {
    const draft = inventoryProductEditDataToFormDraft({
      id: "00000000-0000-0000-0000-000000000001",
      sku: "SKU-1",
      category: "phone",
      brand: "Apple",
      model: "iPhone 15",
      status: "in_stock",
      currency_code: "EUR",
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      version: 3,
      identifiers: [
        {
          kind: "eid",
          value: "12345678901234567890123456789012",
          source: "manual",
          primary: false,
        },
        { kind: "serial", value: "C02ABC123", source: "scan", primary: true },
      ],
    });
    expect(draft.primary_identifier_kind).toBe("serial");
    expect(draft.identifier_sources.serial).toBe("scan");
  });

  it("loads the latest inspection into edit state without scheduling a write", () => {
    const draft = inventoryProductEditDataToFormDraft({
      id: "00000000-0000-0000-0000-000000000001",
      sku: "SKU-1",
      category: "phone",
      brand: "Apple",
      model: "iPhone 15",
      status: "in_stock",
      currency_code: "EUR",
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      version: 3,
      inspection: {
        id: "00000000-0000-0000-0000-000000000010",
        battery_health: 88,
        face_id_status: "abnormal",
        inspected_at: new Date().toISOString(),
      },
      identifiers: [],
    });
    expect(draft.inspection_battery_health).toBe("88");
    expect(draft.inspection_face_id_status).toBe("abnormal");
    expect(draft.inspection_touched).toBe(false);
    expect(
      inventoryProductFormToCreateInput(draft, "00000000-0000-4000-8000-000000000002").inspection,
    ).toBeUndefined();
  });

  it("fails closed instead of rewriting an anomalous EID primary", () => {
    const draft = createInventoryProductFormDraft("phone");
    draft.brand = "Apple";
    draft.model = "iPhone 15";
    draft.identifiers.eid = "12345678901234567890123456789012";
    draft.primary_identifier_kind = "eid";
    expect(validateInventoryProductFormDraft(draft)?.message).toContain("EID");
  });

  it("clears catalog-dependent values without touching identifiers or commercial fields", () => {
    const draft = createInventoryProductFormDraft("phone");
    draft.brand = "Apple";
    draft.model = "iPhone 15";
    draft.ram_capacity = "8 GB";
    draft.storage_capacity = "256 GB";
    draft.color = "Blue";
    draft.specifications = { network: "EU" };
    draft.identifiers.imei1 = "490154203237518";
    draft.list_price = "699";
    draft.notes = "保留";

    const cleared = clearInventoryProductFormDependencies(draft, "brand");
    expect(cleared.model).toBe("");
    expect(cleared.ram_capacity).toBe("");
    expect(cleared.storage_capacity).toBe("");
    expect(cleared.color).toBe("");
    expect(cleared.specifications).toEqual({});
    expect(cleared.identifiers.imei1).toBe("490154203237518");
    expect(cleared.list_price).toBe("699");
    expect(cleared.notes).toBe("保留");
  });

  it("merges local identifier primary and field changes over a newer server draft", () => {
    const base = createInventoryProductFormDraft("phone");
    base.brand = "Apple";
    base.model = "iPhone 15";
    base.identifiers.imei1 = "490154203237518";
    base.primary_identifier_kind = "imei1";
    const local: InventoryProductFormDraft = {
      ...base,
      model: "iPhone 15 Pro",
      primary_identifier_kind: "serial",
    };
    local.identifiers = { ...base.identifiers, serial: "C02ABC123" };
    const latest = { ...base, color: "Black", model: "iPhone 15" };

    const merged = mergeInventoryProductFormDraft(base, local, latest);
    expect(merged.model).toBe("iPhone 15 Pro");
    expect(merged.color).toBe("Black");
    expect(merged.primary_identifier_kind).toBe("serial");
    expect(merged.identifiers.serial).toBe("C02ABC123");
  });
});
