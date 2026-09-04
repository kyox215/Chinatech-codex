export function normalizeAuthEmail(value: string) {
  return value.trim().toLowerCase();
}

import type { MessageKey } from "@/shared/i18n/messages";

type AuthTranslate = (key: MessageKey, values?: Record<string, string | number>) => string;

function authMessage(t: AuthTranslate | undefined, key: MessageKey, fallback: string) {
  return t ? t(key) : fallback;
}

export function authErrorMessage(
  error: { message?: string } | null | undefined,
  t?: AuthTranslate,
) {
  const key = authErrorMessageKey(error);
  const fallbacks: Record<ReturnType<typeof authErrorMessageKey>, string> = {
    "auth.error.operationFailed": "操作失败，请稍后再试",
    "auth.error.invalidCredentials": "邮箱或密码不正确，请检查邮箱，或使用忘记密码重置。",
    "auth.error.emailNotConfirmed": "邮箱还没有确认，请先打开邮件完成确认后再登录。",
    "auth.error.alreadyRegistered": "这个邮箱已经注册，请直接登录或使用忘记密码重置。",
    "auth.error.weakPassword": "密码强度不够，请至少输入 8 位，并避免过于简单。",
    "auth.error.rateLimit": "操作太频繁，请稍后再试。",
  };
  return authMessage(t, key, fallbacks[key]);
}

export function authErrorMessageKey(
  error: { message?: string } | null | undefined,
):
  | "auth.error.operationFailed"
  | "auth.error.invalidCredentials"
  | "auth.error.emailNotConfirmed"
  | "auth.error.alreadyRegistered"
  | "auth.error.weakPassword"
  | "auth.error.rateLimit" {
  const message = error?.message?.trim();
  if (!message) return "auth.error.operationFailed";

  if (/invalid login credentials/i.test(message)) {
    return "auth.error.invalidCredentials";
  }
  if (/email not confirmed|not confirmed/i.test(message)) {
    return "auth.error.emailNotConfirmed";
  }
  if (/user already registered|already registered|already exists/i.test(message)) {
    return "auth.error.alreadyRegistered";
  }
  if (/password should be at least|password.*characters|weak password/i.test(message)) {
    return "auth.error.weakPassword";
  }
  if (/rate limit|too many|over.*limit/i.test(message)) {
    return "auth.error.rateLimit";
  }

  return "auth.error.operationFailed";
}

export function passwordResetSentMessage(t?: AuthTranslate) {
  return authMessage(
    t,
    "auth.error.resetSent",
    "如果邮箱已注册，我们会发送重置密码邮件，请到邮箱中继续操作。",
  );
}

export function verificationEmailSentMessage(t?: AuthTranslate) {
  return authMessage(
    t,
    "auth.error.verificationSent",
    "如果这个邮箱可以接收验证邮件，我们会发送确认链接。请从邮箱中继续。",
  );
}

export function emailChangeRequestedMessage(email: string, t?: AuthTranslate) {
  return t
    ? t("auth.error.emailChangeRequested", { email })
    : `确认邮件已发送到 ${email}。完成邮箱确认前，当前登录邮箱不会改变。`;
}

export function validateNewPassword(password: string, confirmation: string, t?: AuthTranslate) {
  if (password.length < 8) {
    return authMessage(t, "auth.error.passwordTooShort", "新密码至少需要 8 位");
  }
  if (password !== confirmation) {
    return authMessage(t, "auth.error.passwordMismatch", "两次输入的新密码不一致");
  }
  return undefined;
}

export function validateEmailAddress(value: string, t?: AuthTranslate) {
  const email = normalizeAuthEmail(value);
  if (!email) return authMessage(t, "auth.error.emailRequired", "请输入邮箱");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return authMessage(t, "auth.error.emailInvalid", "邮箱格式不正确");
  }
  return undefined;
}

export function validateEmailChange(
  {
    currentEmail,
    nextEmail,
    confirmation,
    currentPassword,
  }: {
    currentEmail?: string | null;
    nextEmail: string;
    confirmation: string;
    currentPassword: string;
  },
  t?: AuthTranslate,
) {
  const normalizedCurrent = normalizeAuthEmail(currentEmail ?? "");
  const normalizedNext = normalizeAuthEmail(nextEmail);
  const normalizedConfirmation = normalizeAuthEmail(confirmation);
  const emailError = validateEmailAddress(normalizedNext, t);
  if (emailError) return emailError;
  if (!normalizedCurrent) {
    return authMessage(t, "auth.error.currentEmailUnavailable", "未读取当前登录邮箱");
  }
  if (normalizedNext === normalizedCurrent) {
    return authMessage(t, "auth.error.emailUnchanged", "新邮箱不能和当前登录邮箱相同");
  }
  if (normalizedNext !== normalizedConfirmation) {
    return authMessage(t, "auth.error.emailMismatch", "两次输入的新邮箱不一致");
  }
  if (!currentPassword) {
    return authMessage(t, "auth.error.currentPasswordRequired", "请输入当前密码后再更改邮箱");
  }
  return undefined;
}
