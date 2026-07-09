import { describe, expect, it } from "vitest";

import {
  applyPhoneKeypadKey,
  applyMoneyKeypadKey,
  decimalKeyboardProps,
  imeiKeyboardProps,
  moneyDraftValue,
  normalizeMoneyKeypadDraft,
  normalizePhoneKeypadDraft,
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

  it("normalizes virtual money keypad drafts", () => {
    expect(normalizeMoneyKeypadDraft("€ 025,555")).toBe("25.55");
    expect(normalizeMoneyKeypadDraft("00.5.8")).toBe("0.58");
    expect(normalizeMoneyKeypadDraft("abc")).toBe("");
  });

  it("applies virtual money keypad keys without cursor-dependent edits", () => {
    expect(applyMoneyKeypadKey("", "1")).toBe("1");
    expect(applyMoneyKeypadKey("1", "00")).toBe("100");
    expect(applyMoneyKeypadKey("", ".")).toBe("0.");
    expect(applyMoneyKeypadKey("0.", "5")).toBe("0.5");
    expect(applyMoneyKeypadKey("0.50", "9")).toBe("0.50");
    expect(applyMoneyKeypadKey("12.3", "backspace")).toBe("12.");
    expect(applyMoneyKeypadKey("12.", "backspace")).toBe("12");
    expect(applyMoneyKeypadKey("12", "clear")).toBe("");
  });

  it("normalizes and edits phone keypad drafts", () => {
    expect(normalizePhoneKeypadDraft(" +39 333-123 ")).toBe("+39333123");
    expect(normalizePhoneKeypadDraft("abc333")).toBe("333");
    expect(applyPhoneKeypadKey("", "+39")).toBe("+39");
    expect(applyPhoneKeypadKey("+39", "3")).toBe("+393");
    expect(applyPhoneKeypadKey("+393", "backspace")).toBe("+39");
    expect(applyPhoneKeypadKey("333", "+39")).toBe("+39333");
    expect(applyPhoneKeypadKey("+39333", "clear")).toBe("");
  });
});
