export type SettingsSectionKey =
  | "account"
  | "store"
  | "suppliers"
  | "members"
  | "kiosk"
  | "notifications"
  | "rules"
  | "workflow"
  | "order-data";

export type SettingsSectionAccess = "editable" | "readonly" | "blocked" | "unavailable";

export interface SettingsSectionCapabilities {
  canReadSuppliers?: boolean;
  canManageSuppliers?: boolean;
  canUpdateStoreSettings?: boolean;
  canConfigureWorkflow?: boolean;
  canListMembers?: boolean;
  canManageKioskDevices?: boolean;
  canReviewKioskSessions?: boolean;
  canManageOrderData?: boolean;
}

const sectionKeys = new Set<SettingsSectionKey>([
  "account",
  "store",
  "suppliers",
  "members",
  "kiosk",
  "notifications",
  "rules",
  "workflow",
  "order-data",
]);

export function normalizeSettingsSection(value: string | null): SettingsSectionKey {
  return sectionKeys.has(value as SettingsSectionKey) ? (value as SettingsSectionKey) : "account";
}

export function resolveSettingsSectionAccess(
  section: SettingsSectionKey,
  capabilities: SettingsSectionCapabilities | undefined,
): SettingsSectionAccess {
  if (section === "account") return "editable";
  if (!capabilities) return "unavailable";

  if (section === "store" || section === "notifications" || section === "rules") {
    return capabilities.canUpdateStoreSettings === true ? "editable" : "readonly";
  }
  if (section === "suppliers") {
    if (capabilities.canReadSuppliers === undefined) return "unavailable";
    if (!capabilities.canReadSuppliers) return "blocked";
    return capabilities.canManageSuppliers === true ? "editable" : "readonly";
  }
  if (section === "members") {
    if (capabilities.canListMembers === undefined) return "unavailable";
    return capabilities.canListMembers ? "editable" : "blocked";
  }
  if (section === "kiosk") {
    if (
      capabilities.canManageKioskDevices === undefined &&
      capabilities.canReviewKioskSessions === undefined
    ) {
      return "unavailable";
    }
    return capabilities.canManageKioskDevices === true ||
      capabilities.canReviewKioskSessions === true
      ? "editable"
      : "blocked";
  }
  if (section === "workflow") {
    if (capabilities.canConfigureWorkflow === undefined) return "unavailable";
    return capabilities.canConfigureWorkflow ? "editable" : "readonly";
  }
  if (capabilities.canManageOrderData === undefined) return "unavailable";
  return capabilities.canManageOrderData ? "editable" : "blocked";
}
