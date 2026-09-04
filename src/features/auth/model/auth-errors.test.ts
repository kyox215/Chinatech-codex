import { describe, expect, it } from "vitest";

import {
  authErrorMessage,
  emailChangeRequestedMessage,
  normalizeAuthEmail,
  validateEmailAddress,
  validateEmailChange,
  validateNewPassword,
} from "@/features/auth/model/auth-errors";
import type { AppLocale } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

const translator = (locale: AppLocale) =>
  ((key, values) => translateMessage(locale, key, values)) satisfies Parameters<
    typeof authErrorMessage
  >[1];

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

  it.each([
    ["Invalid login credentials", "auth.error.invalidCredentials"],
    ["Email not confirmed", "auth.error.emailNotConfirmed"],
    ["User already registered", "auth.error.alreadyRegistered"],
    ["Weak password", "auth.error.weakPassword"],
    ["Rate limit exceeded", "auth.error.rateLimit"],
    ["RAW_PROVIDER_SENTINEL", "auth.error.operationFailed"],
  ] as const)("maps provider category %s safely in every locale", (raw, key) => {
    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      const message = authErrorMessage({ message: raw }, translator(locale));
      expect(message).toBe(translateMessage(locale, key));
      expect(message).not.toContain(raw);
    }
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

  it("localizes account validation and confirmation while keeping email interpolation exact", () => {
    expect(
      validateEmailChange(
        {
          currentEmail: "staff@example.com",
          nextEmail: "staff@example.com",
          confirmation: "staff@example.com",
          currentPassword: "secret",
        },
        translator("it-IT"),
      ),
    ).toBe("La nuova email deve essere diversa da quella corrente");
    expect(validateNewPassword("short", "short", translator("en"))).toBe(
      "The new password must be at least 8 characters",
    );
    expect(emailChangeRequestedMessage("dynamic@example.test", translator("it-IT"))).toBe(
      "Email di conferma inviata a dynamic@example.test. Continua dal link ricevuto nel nuovo indirizzo.",
    );
  });
});
