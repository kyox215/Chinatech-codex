import { describe, expect, it } from "vitest";

import { buildWhatsappUrl, resolveWhatsappPhone } from "./whatsapp-phone";

describe("WhatsApp phone resolution", () => {
  it.each([
    ["380 151 2196", "IT", "+393801512196"],
    ["+39 380 151 2196", "IT", "+393801512196"],
    ["0039 380 151 2196", "IT", "+393801512196"],
    ["0931 123456", "IT", "+390931123456"],
    ["+380 50 123 4567", "IT", "+380501234567"],
    ["00380 50 123 4567", "IT", "+380501234567"],
  ] as const)("normalizes %s with %s defaults", (input, country, expected) => {
    const result = resolveWhatsappPhone(input, country);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.e164).toBe(expected);
  });

  it.each(["", "abc", "+39 123", "+380 1512196", "+999 123456789", "+39 +39 3801512196"])(
    "rejects invalid input %s",
    (input) => {
      expect(resolveWhatsappPhone(input).valid).toBe(false);
      expect(buildWhatsappUrl(input)).toBe("");
    },
  );

  it("builds a digits-only click-to-chat URL", () => {
    expect(buildWhatsappUrl("380 151 2196", "Ciao")).toBe("https://wa.me/393801512196?text=Ciao");
  });
});
