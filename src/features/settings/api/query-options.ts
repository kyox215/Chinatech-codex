import type { SettingsSectionCapabilities } from "@/features/settings/model/settings-section-access";
import type { SettingsView } from "@/features/settings/model/settings-section-registry";

export interface SettingsQueryActivation {
  storeSettings: boolean;
  account: boolean;
  suppliers: boolean;
  members: boolean;
  accessRequests: boolean;
  workflow: boolean;
  kioskDevices: boolean;
  kioskSessions: boolean;
  aiUsage: boolean;
  orderData: boolean;
}

const inactiveQueries: SettingsQueryActivation = {
  storeSettings: false,
  account: false,
  suppliers: false,
  members: false,
  accessRequests: false,
  workflow: false,
  kioskDevices: false,
  kioskSessions: false,
  aiUsage: false,
  orderData: false,
};

export function getSettingsQueryActivation(
  view: SettingsView,
  capabilities: SettingsSectionCapabilities | undefined,
): SettingsQueryActivation {
  if (view.kind === "section" && view.section === "account") {
    return { ...inactiveQueries, account: true };
  }
  if (!capabilities) return inactiveQueries;
  if (view.kind === "overview") {
    return {
      ...inactiveQueries,
      storeSettings: capabilities.canReadStoreSettings === true,
    };
  }

  const section = view.section;
  if (section === "store" || section === "notifications" || section === "rules") {
    return {
      ...inactiveQueries,
      storeSettings: capabilities.canReadStoreSettings === true,
    };
  }
  if (section === "suppliers") {
    return { ...inactiveQueries, suppliers: capabilities.canReadSuppliers === true };
  }
  if (section === "members") {
    const canListMembers = capabilities.canListMembers === true;
    return {
      ...inactiveQueries,
      members: canListMembers,
      accessRequests: canListMembers && capabilities.canReviewAccessRequests === true,
    };
  }
  if (section === "kiosk") {
    return {
      ...inactiveQueries,
      kioskDevices: capabilities.canManageKioskDevices === true,
      kioskSessions: capabilities.canReviewKioskSessions === true,
    };
  }
  if (section === "workflow") {
    return {
      ...inactiveQueries,
      workflow: capabilities.canConfigureWorkflow !== undefined,
    };
  }
  if (section === "ai-usage") {
    return {
      ...inactiveQueries,
      aiUsage: capabilities.canReadAggregateFinance === true,
    };
  }
  return {
    ...inactiveQueries,
    orderData: capabilities.canManageOrderData === true,
  };
}
