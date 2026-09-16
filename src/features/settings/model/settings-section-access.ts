import type { StoreContext } from "@/lib/repairdesk/types";

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

export type SettingsSectionCapabilities = Partial<NonNullable<StoreContext["permissions"]>>;

export function resolveSettingsSectionAccess(
  section: SettingsSectionKey,
  capabilities: SettingsSectionCapabilities | undefined,
): SettingsSectionAccess {
  if (section === "account") return "editable";
  if (!capabilities) return "unavailable";

  if (section === "store" || section === "notifications" || section === "rules") {
    if (capabilities.canReadStoreSettings === undefined) return "unavailable";
    if (!capabilities.canReadStoreSettings) return "blocked";
    return capabilities.canUpdateStoreSettings === true ? "editable" : "readonly";
  }
  if (section === "suppliers") {
    if (capabilities.canReadSuppliers === undefined) return "unavailable";
    if (!capabilities.canReadSuppliers) return "blocked";
    return capabilities.canManageSuppliers === true ? "editable" : "readonly";
  }
  if (section === "members") {
    if (capabilities.canListMembers === undefined) return "unavailable";
    if (!capabilities.canListMembers) return "blocked";
    return capabilities.canInviteMembers === true ||
      capabilities.canManageMembers === true ||
      capabilities.canRevokeMembers === true ||
      capabilities.canReviewAccessRequests === true
      ? "editable"
      : "readonly";
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
