import { describe, expect, it } from "vitest";

import { normalizePhoneRaw, samePhoneRaw } from "./phone";

describe("phone helpers", () => {
  it("keeps only digits for phone identity checks", () => {
    expect(normalizePhoneRaw("+39 333-015 223")).toBe("39333015223");
  });

  it("compares normalized phone numbers", () => {
    expect(samePhoneRaw("+39 333-015 223", "39 333 015 223")).toBe(true);
    expect(samePhoneRaw("+39 333-015 223", "+39 333 015 224")).toBe(false);
  });
});
