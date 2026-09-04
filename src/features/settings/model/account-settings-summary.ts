import type { OnboardingStatus, StoreRole } from "@/lib/repairdesk/types";
import { DEFAULT_LOCALE, type AppLocale } from "@/shared/i18n/locales";
import { translateMessage, type MessageKey } from "@/shared/i18n/messages";

export type AccountEmailVerificationState = "verified" | "unverified" | "unknown";

export interface AccountSettingsSummary {
  email: string;
  emailVerificationState: AccountEmailVerificationState;
  accountNature: string;
  activeStoreName: string;
  currentStoreRole: string;
}

const storeRoleLabelKeys: Record<StoreRole, MessageKey> = {
  owner: "settings.account.role.owner",
  manager: "settings.account.role.manager",
  technician: "settings.account.role.technician",
  sales: "settings.account.role.sales",
  viewer: "settings.account.role.viewer",
};

export function buildAccountSettingsSummary(
  status:
    | Pick<OnboardingStatus, "email" | "emailVerified" | "isPlatformAdmin" | "activeStore">
    | undefined,
  locale: AppLocale = DEFAULT_LOCALE,
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
    accountNature: translateMessage(
      locale,
      status.isPlatformAdmin
        ? "settings.account.platformNature"
        : status.activeStore
          ? "settings.account.storeNature"
          : "settings.account.personalNature",
    ),
    activeStoreName:
      status.activeStore?.name ?? translateMessage(locale, "settings.account.noStore"),
    currentStoreRole: status.activeStore?.role
      ? translateMessage(locale, storeRoleLabelKeys[status.activeStore.role])
      : translateMessage(locale, "settings.account.noStoreRole"),
  };
}
