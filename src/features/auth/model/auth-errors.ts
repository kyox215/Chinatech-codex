export function normalizeAuthEmail(value: string) {
  return value.trim().toLowerCase();
}

export function authErrorMessage(error: { message?: string } | null | undefined) {
  const message = error?.message?.trim();
  if (!message) return "操作失败，请稍后再试";

  if (/invalid login credentials/i.test(message)) {
    return "邮箱或密码不正确，请检查邮箱，或使用忘记密码重置。";
  }
  if (/email not confirmed|not confirmed/i.test(message)) {
    return "邮箱还没有确认，请先打开邮件完成确认后再登录。";
  }
  if (/user already registered|already registered|already exists/i.test(message)) {
    return "这个邮箱已经注册，请直接登录或使用忘记密码重置。";
  }
  if (/password should be at least|password.*characters|weak password/i.test(message)) {
    return "密码强度不够，请至少输入 8 位，并避免过于简单。";
  }
  if (/rate limit|too many|over.*limit/i.test(message)) {
    return "操作太频繁，请稍后再试。";
  }

  return message;
}

export function passwordResetSentMessage() {
  return "如果邮箱已注册，我们会发送重置密码邮件，请到邮箱中继续操作。";
}

export function verificationEmailSentMessage() {
  return "如果这个邮箱可以接收验证邮件，我们会发送确认链接。请从邮箱中继续。";
}

export function emailChangeRequestedMessage(email: string) {
  return `确认邮件已发送到 ${email}。完成邮箱确认前，当前登录邮箱不会改变。`;
}

export function validateNewPassword(password: string, confirmation: string) {
  if (password.length < 8) return "新密码至少需要 8 位";
  if (password !== confirmation) return "两次输入的新密码不一致";
  return undefined;
}

export function validateEmailAddress(value: string) {
  const email = normalizeAuthEmail(value);
  if (!email) return "请输入邮箱";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "邮箱格式不正确";
  return undefined;
}

export function validateEmailChange({
  currentEmail,
  nextEmail,
  confirmation,
  currentPassword,
}: {
  currentEmail?: string | null;
  nextEmail: string;
  confirmation: string;
  currentPassword: string;
}) {
  const normalizedCurrent = normalizeAuthEmail(currentEmail ?? "");
  const normalizedNext = normalizeAuthEmail(nextEmail);
  const normalizedConfirmation = normalizeAuthEmail(confirmation);
  const emailError = validateEmailAddress(normalizedNext);
  if (emailError) return emailError;
  if (!normalizedCurrent) return "未读取当前登录邮箱";
  if (normalizedNext === normalizedCurrent) return "新邮箱不能和当前登录邮箱相同";
  if (normalizedNext !== normalizedConfirmation) return "两次输入的新邮箱不一致";
  if (!currentPassword) return "请输入当前密码后再更改邮箱";
  return undefined;
}
