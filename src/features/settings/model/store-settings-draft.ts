import { formatWarrantyText } from "@/features/orders/model/order-warranty";
import type {
  StoreSettings,
  StoreSettingsNotificationsSectionInput,
  StoreSettingsRulesSectionInput,
  StoreSettingsSection,
  StoreSettingsSectionUpdateRequest,
  StoreSettingsStoreSectionInput,
} from "@/lib/repairdesk/types";

export interface StoreSettingsDraftValues {
  store: StoreSettingsStoreSectionInput;
  notifications: StoreSettingsNotificationsSectionInput;
  rules: StoreSettingsRulesSectionInput;
}

export interface StoreSettingsDraftConflict<T> {
  serverUpdatedAt: string;
  serverValue: T;
}

export interface StoreSettingsSectionDraft<T> {
  storeId: string;
  baseUpdatedAt: string;
  base: T;
  value: T;
  conflict: StoreSettingsDraftConflict<T> | null;
  lastSavedAt: string | null;
}

export interface StoreSettingsDrafts {
  storeId: string;
  sections: {
    store: StoreSettingsSectionDraft<StoreSettingsDraftValues["store"]>;
    notifications: StoreSettingsSectionDraft<StoreSettingsDraftValues["notifications"]>;
    rules: StoreSettingsSectionDraft<StoreSettingsDraftValues["rules"]>;
  };
}

export function createStoreSettingsDrafts(settings: StoreSettings): StoreSettingsDrafts {
  const storeId = settings.store_id;
  if (!storeId) throw new Error("店铺设置缺少店铺范围");
  return {
    storeId,
    sections: {
      store: createSectionDraft(storeId, settings.updated_at, storeValueFromSettings(settings)),
      notifications: createSectionDraft(
        storeId,
        settings.updated_at,
        notificationsValueFromSettings(settings),
      ),
      rules: createSectionDraft(storeId, settings.updated_at, rulesValueFromSettings(settings)),
    },
  };
}

export function updateStoreSettingsDraft<S extends StoreSettingsSection>(
  drafts: StoreSettingsDrafts,
  section: S,
  patch: Partial<StoreSettingsDraftValues[S]>,
): StoreSettingsDrafts {
  const current = drafts.sections[section] as StoreSettingsSectionDraft<
    StoreSettingsDraftValues[S]
  >;
  return {
    ...drafts,
    sections: {
      ...drafts.sections,
      [section]: {
        ...current,
        value: { ...current.value, ...patch },
        conflict: current.conflict,
      },
    },
  } as StoreSettingsDrafts;
}

export function isStoreSettingsSectionDirty(
  drafts: StoreSettingsDrafts | null | undefined,
  section: StoreSettingsSection,
) {
  if (!drafts) return false;
  const current = drafts.sections[section];
  return !valuesEqual(current.base, current.value);
}

export function hasDirtyStoreSettingsDraft(drafts: StoreSettingsDrafts | null | undefined) {
  return (
    isStoreSettingsSectionDirty(drafts, "store") ||
    isStoreSettingsSectionDirty(drafts, "notifications") ||
    isStoreSettingsSectionDirty(drafts, "rules")
  );
}

export function getDirtyStoreSettingsSections(
  drafts: StoreSettingsDrafts | null | undefined,
  preferredSection?: StoreSettingsSection | null,
) {
  const sections = (["store", "notifications", "rules"] as const).filter((section) =>
    isStoreSettingsSectionDirty(drafts, section),
  );
  if (!preferredSection || !sections.includes(preferredSection)) return sections;
  return [preferredSection, ...sections.filter((section) => section !== preferredSection)];
}

export function buildStoreSettingsSectionUpdateRequest<S extends StoreSettingsSection>(
  drafts: StoreSettingsDrafts,
  section: S,
): Extract<StoreSettingsSectionUpdateRequest, { section: S }> {
  const current = drafts.sections[section];
  if (current.conflict) throw new Error("当前分组存在版本冲突，请先处理冲突");
  return {
    section,
    expectedStoreId: drafts.storeId,
    expectedUpdatedAt: current.baseUpdatedAt,
    input: { ...current.value },
  } as Extract<StoreSettingsSectionUpdateRequest, { section: S }>;
}

export function discardStoreSettingsSectionDraft(
  drafts: StoreSettingsDrafts,
  section: StoreSettingsSection,
): StoreSettingsDrafts {
  const current = drafts.sections[section];
  const base = current.conflict?.serverValue ?? current.base;
  const baseUpdatedAt = current.conflict?.serverUpdatedAt ?? current.baseUpdatedAt;
  return {
    ...drafts,
    sections: {
      ...drafts.sections,
      [section]: {
        ...current,
        base: { ...base },
        value: { ...base },
        baseUpdatedAt,
        conflict: null,
      },
    },
  } as StoreSettingsDrafts;
}

export function rebaseStoreSettingsSectionDraft(
  drafts: StoreSettingsDrafts,
  section: StoreSettingsSection,
): StoreSettingsDrafts {
  const current = drafts.sections[section];
  if (!current.conflict) return drafts;
  const serverValue = current.conflict.serverValue;
  return {
    ...drafts,
    sections: {
      ...drafts.sections,
      [section]: {
        ...current,
        base: { ...serverValue },
        value: mergeRebasedValue(current.base, current.value, serverValue),
        baseUpdatedAt: current.conflict.serverUpdatedAt,
        conflict: null,
      },
    },
  } as StoreSettingsDrafts;
}

function mergeRebasedValue<T extends object>(base: T, local: T, server: T): T {
  const merged = { ...server };
  for (const key of Object.keys(local) as Array<keyof T>) {
    if (!Object.is(local[key], base[key])) Object.assign(merged, { [key]: local[key] });
  }
  return merged;
}

export function acceptStoreSettingsSaveResult(
  drafts: StoreSettingsDrafts,
  savedSection: StoreSettingsSection,
  settings: StoreSettings,
  savedAt = new Date().toISOString(),
): StoreSettingsDrafts {
  assertSameStore(drafts, settings);
  return reconcileSections(drafts, settings, savedSection, savedAt);
}

export function reconcileIncomingStoreSettings(
  drafts: StoreSettingsDrafts,
  settings: StoreSettings,
): StoreSettingsDrafts {
  assertSameStore(drafts, settings);
  return reconcileSections(drafts, settings);
}

export function materializeStoreSettingsDraft(drafts: StoreSettingsDrafts) {
  return {
    ...drafts.sections.store.value,
    ...drafts.sections.notifications.value,
    ...drafts.sections.rules.value,
    default_order_warranty_text: formatWarrantyText(
      drafts.sections.rules.value.default_order_warranty_months,
    ),
  };
}

function reconcileSections(
  drafts: StoreSettingsDrafts,
  settings: StoreSettings,
  savedSection?: StoreSettingsSection,
  savedAt?: string,
): StoreSettingsDrafts {
  return {
    ...drafts,
    sections: {
      store: reconcileSection(drafts, settings, "store", savedSection === "store", savedAt),
      notifications: reconcileSection(
        drafts,
        settings,
        "notifications",
        savedSection === "notifications",
        savedAt,
      ),
      rules: reconcileSection(drafts, settings, "rules", savedSection === "rules", savedAt),
    },
  };
}

function reconcileSection<S extends StoreSettingsSection>(
  drafts: StoreSettingsDrafts,
  settings: StoreSettings,
  section: S,
  saved: boolean,
  savedAt?: string,
): StoreSettingsSectionDraft<StoreSettingsDraftValues[S]> {
  const current = drafts.sections[section] as StoreSettingsSectionDraft<
    StoreSettingsDraftValues[S]
  >;
  const serverValue = valueForSection(settings, section);
  if (saved || !isStoreSettingsSectionDirty(drafts, section)) {
    return createSectionDraft(
      drafts.storeId,
      settings.updated_at,
      serverValue,
      saved ? (savedAt ?? new Date().toISOString()) : current.lastSavedAt,
    );
  }
  if (valuesEqual(current.base, serverValue)) {
    return {
      ...current,
      baseUpdatedAt: settings.updated_at,
      conflict: null,
    };
  }
  return {
    ...current,
    conflict: {
      serverUpdatedAt: settings.updated_at,
      serverValue: { ...serverValue },
    },
  };
}

function createSectionDraft<T>(
  storeId: string,
  baseUpdatedAt: string,
  value: T,
  lastSavedAt: string | null = null,
): StoreSettingsSectionDraft<T> {
  return {
    storeId,
    baseUpdatedAt,
    base: { ...value },
    value: { ...value },
    conflict: null,
    lastSavedAt,
  };
}

function valueForSection<S extends StoreSettingsSection>(
  settings: StoreSettings,
  section: S,
): StoreSettingsDraftValues[S] {
  if (section === "store") return storeValueFromSettings(settings) as StoreSettingsDraftValues[S];
  if (section === "notifications") {
    return notificationsValueFromSettings(settings) as StoreSettingsDraftValues[S];
  }
  return rulesValueFromSettings(settings) as StoreSettingsDraftValues[S];
}

function storeValueFromSettings(settings: StoreSettings): StoreSettingsDraftValues["store"] {
  return {
    store_name: settings.store_name,
    store_address: settings.store_address,
    store_phone: settings.store_phone,
    store_whatsapp: settings.store_whatsapp,
    store_email: settings.store_email,
  };
}

function notificationsValueFromSettings(
  settings: StoreSettings,
): StoreSettingsDraftValues["notifications"] {
  return {
    print_footer: settings.print_footer,
    message_signature: settings.message_signature,
  };
}

function rulesValueFromSettings(settings: StoreSettings): StoreSettingsDraftValues["rules"] {
  return {
    default_order_warranty_months: settings.default_order_warranty_months as 0 | 3 | 6 | 12 | 24,
    default_inventory_warranty_months: settings.default_inventory_warranty_months,
  };
}

function assertSameStore(drafts: StoreSettingsDrafts, settings: StoreSettings) {
  if (!settings.store_id || settings.store_id !== drafts.storeId) {
    throw new Error("不能把其他店铺的设置应用到当前草稿");
  }
}

function valuesEqual(left: object, right: object) {
  return JSON.stringify(left) === JSON.stringify(right);
}
