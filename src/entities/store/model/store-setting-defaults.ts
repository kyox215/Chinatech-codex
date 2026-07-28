import type { NewOrderEntryMode, StoreSettingsRulesSectionInput } from "@/lib/repairdesk/types";

export const STORE_RULE_DEFAULTS = {
  default_order_warranty_months: 6,
  default_inventory_warranty_months: 12,
  new_order_entry_mode: "professional",
} as const satisfies StoreSettingsRulesSectionInput;

export function normalizeNewOrderEntryMode(value: unknown): NewOrderEntryMode {
  return value === "simple" ? "simple" : "professional";
}

export const STORE_INVENTORY_WARRANTY_RANGE = {
  min: 0,
  max: 120,
} as const;

export function normalizeStoreInventoryWarrantyDefault(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return STORE_RULE_DEFAULTS.default_inventory_warranty_months;
  }
  return Math.min(
    STORE_INVENTORY_WARRANTY_RANGE.max,
    Math.max(STORE_INVENTORY_WARRANTY_RANGE.min, Math.trunc(numeric)),
  );
}

export function resolveNewInventoryWarrantyMonths(
  explicitMonths: number | undefined,
  storeDefaultMonths: unknown,
) {
  if (explicitMonths !== undefined) {
    return Math.max(0, Math.trunc(Number.isFinite(explicitMonths) ? explicitMonths : 0));
  }
  return normalizeStoreInventoryWarrantyDefault(storeDefaultMonths);
}

export function resolveStoredInventoryWarrantyMonths(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return STORE_RULE_DEFAULTS.default_inventory_warranty_months;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.max(0, Math.trunc(numeric))
    : STORE_RULE_DEFAULTS.default_inventory_warranty_months;
}
