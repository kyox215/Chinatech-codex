import type { OnboardingStatus, StoreRole } from "@/lib/repairdesk/types";

export type AccountEmailVerificationState = "verified" | "unverified" | "unknown";

export interface AccountSettingsSummary {
  email: string;
  emailVerificationState: AccountEmailVerificationState;
  accountNature: "平台管理员账号" | "门店成员账号" | "个人账号";
  activeStoreName: string;
  currentStoreRole: string;
}

const storeRoleLabels: Record<StoreRole, string> = {
  owner: "店主",
  manager: "经理",
  technician: "技师",
  sales: "前台",
  viewer: "只读",
};

export function buildAccountSettingsSummary(
  status:
    | Pick<OnboardingStatus, "email" | "emailVerified" | "isPlatformAdmin" | "activeStore">
    | undefined,
): AccountSettingsSummary | undefined {
  if (!status) return undefined;
  const email = status.email?.trim() ?? "";
  return {
    email,
    emailVerificationState: !email
      ? "unknown"
      : status.emailVerified === true
        ? "verified"
        : status.emailVerified === false
          ? "unverified"
          : "unknown",
    accountNature: status.isPlatformAdmin
      ? "平台管理员账号"
      : status.activeStore
        ? "门店成员账号"
        : "个人账号",
    activeStoreName: status.activeStore?.name ?? "尚未选择店铺",
    currentStoreRole: status.activeStore?.role
      ? storeRoleLabels[status.activeStore.role]
      : "当前无店铺角色",
  };
}
