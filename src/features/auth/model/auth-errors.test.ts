import { describe, expect, it } from "vitest";

import {
  authErrorMessage,
  normalizeAuthEmail,
  validateEmailAddress,
  validateEmailChange,
  validateNewPassword,
} from "@/features/auth/model/auth-errors";

describe("auth error helpers", () => {
  it("normalizes auth emails before calling Supabase", () => {
    expect(normalizeAuthEmail("  Xujiexiang0202@Gmail.COM ")).toBe("xujiexiang0202@gmail.com");
  });

  it("localizes invalid credentials without exposing whether the email exists", () => {
    expect(authErrorMessage({ message: "Invalid login credentials" })).toBe(
      "邮箱或密码不正确，请检查邮箱，或使用忘记密码重置。",
    );
  });

  it("replaces unknown provider text with the generic safe error", () => {
    expect(authErrorMessage({ message: "provider tenant secret failure" })).toBe(
      "操作失败，请稍后再试",
    );
    expect(authErrorMessage({ message: "provider tenant secret failure" })).not.toContain(
      "provider tenant secret failure",
    );
  });

  it("validates password reset confirmation locally", () => {
    expect(validateNewPassword("1234567", "1234567")).toBe("新密码至少需要 8 位");
    expect(validateNewPassword("12345678", "87654321")).toBe("两次输入的新密码不一致");
    expect(validateNewPassword("12345678", "12345678")).toBeUndefined();
  });

  it("validates auth email addresses", () => {
    expect(validateEmailAddress("wrong")).toBe("邮箱格式不正确");
    expect(validateEmailAddress("staff@example.com")).toBeUndefined();
  });

  it("validates email change requests", () => {
    expect(
      validateEmailChange({
        currentEmail: "",
        nextEmail: "new@example.com",
        confirmation: "new@example.com",
        currentPassword: "secret",
      }),
    ).toBe("未读取当前登录邮箱");
    expect(
      validateEmailChange({
        currentEmail: "staff@example.com",
        nextEmail: "staff@example.com",
        confirmation: "staff@example.com",
        currentPassword: "secret",
      }),
    ).toBe("新邮箱不能和当前登录邮箱相同");
    expect(
      validateEmailChange({
        currentEmail: "staff@example.com",
        nextEmail: "new@example.com",
        confirmation: "other@example.com",
        currentPassword: "secret",
      }),
    ).toBe("两次输入的新邮箱不一致");
    expect(
      validateEmailChange({
        currentEmail: "staff@example.com",
        nextEmail: "new@example.com",
        confirmation: "new@example.com",
        currentPassword: "",
      }),
    ).toBe("请输入当前密码后再更改邮箱");
  });
});
