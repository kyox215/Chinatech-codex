const explicitStaffNamesByEmail = new Map<string, string>([
  ["kyox120@gmail.com", "Alessio"],
  ["owner@repairdesk.local", "Alessio"],
]);

const roleLikeDisplayNames = new Set([
  "最高管理员",
  "管理员",
  "店铺管理员",
  "技师",
  "技术人员",
  "维修",
  "前台",
  "销售",
  "销售/前台",
  "前台/销售",
  "只读",
  "账号",
  "员工",
  "owner",
  "manager",
  "admin",
  "administrator",
  "technician",
  "sales",
  "viewer",
  "staff",
  "user",
]);

export function resolveStaffDisplayName({
  email,
  displayName,
  role,
  fallback = "员工",
}: {
  email?: string | null;
  displayName?: string | null;
  role?: string | null;
  fallback?: string;
}) {
  const normalizedEmail = normalizeEmail(email);
  const explicitName = normalizedEmail ? explicitStaffNamesByEmail.get(normalizedEmail) : undefined;
  if (explicitName) return explicitName;

  const cleanDisplayName = displayName?.trim();
  if (
    cleanDisplayName &&
    cleanDisplayName !== normalizedEmail &&
    !looksLikeEmail(cleanDisplayName) &&
    !isRoleLikeDisplayName(cleanDisplayName)
  ) {
    return cleanDisplayName;
  }

  const emailName = displayNameFromEmail(normalizedEmail);
  if (emailName) return emailName;

  const normalizedRole = role?.trim();
  if (normalizedRole && !isRoleLikeDisplayName(normalizedRole)) return normalizedRole;

  return fallback;
}

export function isRoleLikeDisplayName(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return false;
  return roleLikeDisplayNames.has(normalized) || roleLikeDisplayNames.has(normalized.toLowerCase());
}

function normalizeEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase();
  return normalized && looksLikeEmail(normalized) ? normalized : undefined;
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function displayNameFromEmail(email?: string) {
  if (!email) return "";
  const localPart = email.split("@")[0]?.split("+")[0] ?? "";
  const words = localPart
    .replace(/\d+/g, " ")
    .split(/[._\-\s]+/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !isRoleLikeDisplayName(part));
  if (!words.length) return "";
  return words.map(toTitleCase).join(" ");
}

function toTitleCase(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}` : value;
}
