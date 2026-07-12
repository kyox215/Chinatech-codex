import { describe, expect, it } from "vitest";

import {
  getStoreSettingsValidationFieldErrors,
  storeSettingsSectionUpdateSchema,
  validateStoreSettingsSectionUpdateRequest,
} from "./store-settings-update-contract";

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";
const updatedAt = "2026-07-12T10:00:00.000Z";

describe("store settings update contract", () => {
  it("accepts one strict section and trims text without coercing numbers", () => {
    expect(
      storeSettingsSectionUpdateSchema.parse({
        section: "store",
        expectedStoreId: storeId,
        expectedUpdatedAt: updatedAt,
        input: {
          store_name: "  Ripara Subito  ",
          store_address: " Via Roma 1 ",
          store_phone: "+39 333 111 2222",
          store_whatsapp: "",
          store_email: "owner@example.com",
        },
      }),
    ).toMatchObject({ input: { store_name: "Ripara Subito", store_address: "Via Roma 1" } });

    expect(() =>
      storeSettingsSectionUpdateSchema.parse({
        section: "rules",
        expectedStoreId: storeId,
        expectedUpdatedAt: updatedAt,
        input: {
          default_order_warranty_months: "6",
          default_inventory_warranty_months: 12,
        },
      }),
    ).toThrow();
  });

  it("rejects unknown, cross-section, invalid contact, and unsupported warranty fields", () => {
    for (const invalid of [
      {
        section: "notifications",
        expectedStoreId: storeId,
        expectedUpdatedAt: updatedAt,
        input: { print_footer: "Footer", message_signature: "Firma", store_name: "Injected" },
      },
      {
        section: "store",
        expectedStoreId: storeId,
        expectedUpdatedAt: updatedAt,
        input: {
          store_name: "Ripara",
          store_address: "",
          store_phone: "call-me",
          store_whatsapp: "",
          store_email: "",
        },
      },
      {
        section: "rules",
        expectedStoreId: storeId,
        expectedUpdatedAt: updatedAt,
        input: { default_order_warranty_months: 18, default_inventory_warranty_months: 12 },
      },
    ]) {
      expect(() => storeSettingsSectionUpdateSchema.parse(invalid)).toThrow();
    }
  });

  it("returns stable field paths for the UI", () => {
    const parsed = storeSettingsSectionUpdateSchema.safeParse({
      section: "store",
      expectedStoreId: storeId,
      expectedUpdatedAt: updatedAt,
      input: {
        store_name: "",
        store_address: "",
        store_phone: "",
        store_whatsapp: "",
        store_email: "not-an-email",
      },
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(getStoreSettingsValidationFieldErrors(parsed.error)).toMatchObject({
      "input.store_name": ["店铺名不能为空"],
      "input.store_email": ["邮箱格式无效"],
    });
  });

  it("validates a client request with the same contract used by the API", () => {
    const result = validateStoreSettingsSectionUpdateRequest({
      section: "store",
      expectedStoreId: storeId,
      expectedUpdatedAt: updatedAt,
      input: {
        store_name: "Repair Lab",
        store_address: "Via Roma 12",
        store_phone: "invalid phone!",
        store_whatsapp: "",
        store_email: "invalid",
      },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors).toMatchObject({
      "input.store_phone": ["联系方式格式无效"],
      "input.store_email": ["邮箱格式无效"],
    });
  });
});
