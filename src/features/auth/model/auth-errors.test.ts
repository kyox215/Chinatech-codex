import { describe, expect, it } from "vitest";

import {
  authErrorMessage,
  normalizeAuthEmail,
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

  it("validates password reset confirmation locally", () => {
    expect(validateNewPassword("1234567", "1234567")).toBe("新密码至少需要 8 位");
    expect(validateNewPassword("12345678", "87654321")).toBe("两次输入的新密码不一致");
    expect(validateNewPassword("12345678", "12345678")).toBeUndefined();
  });
});
