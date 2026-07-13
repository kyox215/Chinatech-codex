import { describe, expect, it } from "vitest";

import { supplierInputSchema, validateSupplierInput } from "./supplier-input-contract";

describe("supplier input contract", () => {
  it("normalizes optional empty strings and trims safe values", () => {
    expect(
      supplierInputSchema.parse({
        name: "  Mobilax  ",
        short_name: " ",
        email: "",
        website: " ",
      }),
    ).toEqual({ name: "Mobilax", short_name: undefined, email: undefined, website: undefined });
  });

  it("rejects malformed contact fields and unknown over-posted keys", () => {
    expect(validateSupplierInput({ name: "A", email: "not-email" }).errors.email).toMatch(
      /邮箱格式/,
    );
    expect(
      supplierInputSchema.safeParse({ name: "A", website: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(supplierInputSchema.safeParse({ name: "A", store_id: "other-store" }).success).toBe(
      false,
    );
  });

  it("enforces field length limits", () => {
    expect(validateSupplierInput({ name: "A".repeat(121) }).errors.name).toMatch(/120/);
    expect(
      validateSupplierInput({ name: "A", short_name: "S".repeat(33) }).errors.short_name,
    ).toMatch(/32/);
    expect(validateSupplierInput({ name: "A", notes: "N".repeat(2001) }).errors.notes).toMatch(
      /2000/,
    );
  });
});
