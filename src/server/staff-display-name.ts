const explicitStaffNamesByEmail = new Map<string, string>([
  ["kyox120@gmail.com", "Alessio"],
  ["owner@repairdesk.local", "Alessio"],
]);

const roleLikeDisplayNames = new Set([
  "owner",
  "manager",
  "admin",
  "administrator",
  "technician",
  "sales",
  "viewer",
  "staff",
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

  const normalizedDisplayName = displayName?.trim();
  if (
    normalizedDisplayName &&
    normalizedDisplayName !== normalizedEmail &&
    !isRoleLikeDisplayName(normalizedDisplayName)
  ) {
    return normalizedDisplayName;
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
  return normalized && normalized.includes("@") ? normalized : undefined;
}

function displayNameFromEmail(email?: string) {
  const localPart = email?.split("@")[0]?.trim();
  if (!localPart) return undefined;
  return localPart
    .split(/[._-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
