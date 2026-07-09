import { describe, expect, it } from "vitest";

import {
  decimalKeyboardProps,
  imeiKeyboardProps,
  moneyDraftValue,
  parseMoneyDraft,
  phoneKeyboardProps,
} from "./mobile-input";

describe("mobile input helpers", () => {
  it("uses stable mobile keyboard hints for common order inputs", () => {
    expect(decimalKeyboardProps).toMatchObject({ type: "text", inputMode: "decimal" });
    expect(phoneKeyboardProps).toMatchObject({ type: "text", inputMode: "tel" });
    expect(imeiKeyboardProps).toMatchObject({ type: "text", inputMode: "numeric" });
  });

  it("normalizes money drafts without forcing empty values to show zero", () => {
    expect(moneyDraftValue(0)).toBe("");
    expect(moneyDraftValue(35)).toBe("35");
    expect(parseMoneyDraft("")).toBe(0);
    expect(parseMoneyDraft("€ 25,50")).toBe(25.5);
    expect(parseMoneyDraft(" 35.75 ")).toBe(35.75);
    expect(parseMoneyDraft("-5")).toBe(0);
  });
});
