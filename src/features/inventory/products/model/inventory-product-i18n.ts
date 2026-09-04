import type {
  InventoryProductCategory,
  InventoryProductDisplayStatus,
  InventoryProductIdentifierKind,
  InventoryProductIdentifierSource,
} from "@/lib/repairdesk/types";
import { formatCurrency, formatDateTime } from "@/shared/i18n/format";
import type { AppLocale } from "@/shared/i18n/locales";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";
import type { InventoryAvailabilityState } from "@/features/inventory/model/inventory-availability";
import type {
  InventoryDetailActionId,
  InventoryDetailNextAction,
} from "@/features/inventory/model/inventory-detail-next-action";
import {
  classifyInventoryOperationError,
  type InventoryOperationErrorSubtype,
} from "@/features/inventory/model/inventory-operation-error";
import type { InventoryReadFreshnessState } from "@/features/inventory/model/inventory-read-freshness";
import type { InventoryProductFormValidationCode } from "./inventory-product-form";

type Translate = (key: MessageKey, values?: MessageValues) => string;

const categoryKeys: Record<InventoryProductCategory, MessageKey> = {
  phone: "inventory2b4.product.category.phone",
  tablet: "inventory2b4.product.category.tablet",
  computer: "inventory2b4.product.category.computer",
  game_console: "inventory2b4.product.category.gameConsole",
  other: "inventory2b4.product.category.other",
};

const statusKeys: Record<InventoryProductDisplayStatus, MessageKey> = {
  in_stock: "inventory2b4.product.status.inStock",
  reserved: "inventory2b4.product.status.reserved",
  sold: "inventory2b4.product.status.sold",
  removed: "inventory2b4.product.status.removed",
  returned: "inventory2b4.product.status.returned",
};

const identifierKindKeys: Record<InventoryProductIdentifierKind, MessageKey> = {
  imei1: "inventory2b4.product.identifier.imei1",
  imei2: "inventory2b4.product.identifier.imei2",
  serial: "inventory2b4.product.identifier.serial",
  eid: "inventory2b4.product.identifier.eid",
};

const identifierSourceKeys: Record<InventoryProductIdentifierSource, MessageKey> = {
  manual: "inventory2b4.product.identifierSource.manual",
  scan: "inventory2b4.product.identifierSource.scan",
  ai_confirmed: "inventory2b4.product.identifierSource.aiConfirmed",
};

const inspectionKeys: Record<string, MessageKey> = {
  not_tested: "inventory2b4.inspection.notTested",
  normal: "inventory2b4.inspection.normal",
  abnormal: "inventory2b4.inspection.abnormal",
  not_applicable: "inventory2b4.inspection.notApplicable",
};

const formValidationKeys: Record<InventoryProductFormValidationCode, MessageKey> = {
  brand_required: "inventory2b4.quick.validation.brandRequired",
  model_required: "inventory2b4.quick.validation.modelRequired",
  notes_too_long: "inventory2b4.quick.validation.notesTooLong",
  battery_invalid: "inventory2b4.quick.validation.batteryInvalid",
  imei2_requires_imei1: "inventory2b4.quick.validation.imei2RequiresImei1",
  imei1_required: "inventory2b4.quick.validation.imei1Required",
  gtin_invalid: "inventory2b4.quick.validation.gtinInvalid",
  imei_invalid: "inventory2b4.quick.validation.imeiInvalid",
  serial_invalid: "inventory2b4.quick.validation.serialInvalid",
  eid_invalid: "inventory2b4.quick.validation.eidInvalid",
  identifier_duplicate: "inventory2b4.quick.validation.identifierDuplicate",
  primary_identifier_required: "inventory2b4.quick.validation.primaryIdentifierRequired",
  eid_primary_forbidden: "inventory2b4.quick.validation.eidPrimaryForbidden",
  list_price_invalid: "inventory2b4.quick.validation.listPriceInvalid",
  cost_amount_invalid: "inventory2b4.quick.validation.costAmountInvalid",
  warranty_invalid: "inventory2b4.quick.validation.warrantyInvalid",
  color_not_approved: "inventory2b4.validation.colorNotApproved",
  color_required: "inventory2b4.validation.colorRequired",
};

const validationKeys: Record<string, MessageKey> = {
  required: "inventory2b4.validation.required",
  invalid: "inventory2b4.validation.invalid",
  duplicate: "inventory2b4.validation.duplicate",
  invalid_imei: "inventory2b4.validation.invalidImei",
  invalid_eid: "inventory2b4.validation.invalidEid",
  invalid_amount: "inventory2b4.validation.invalidAmount",
  ...formValidationKeys,
};

const colorKeys: Record<string, MessageKey> = {
  black: "inventory2b4.color.black",
  gray: "inventory2b4.color.gray",
  "dark-blue": "inventory2b4.color.darkBlue",
  green: "inventory2b4.color.green",
  white: "inventory2b4.color.white",
  silver: "inventory2b4.color.silver",
  blue: "inventory2b4.color.blue",
  red: "inventory2b4.color.red",
  purple: "inventory2b4.color.purple",
  yellow: "inventory2b4.color.yellow",
};

const conditionKeys: Record<string, MessageKey> = {
  "100": "inventory2b4.quick.condition.new",
  "90": "inventory2b4.quick.condition.likeNew",
  "80": "inventory2b4.quick.condition.good",
  "70": "inventory2b4.quick.condition.fair",
  "60": "inventory2b4.quick.condition.used",
};

const specificationKeys: Record<string, MessageKey> = {
  processor: "inventory2b4.quick.spec.processor",
  disk_type: "inventory2b4.quick.spec.diskType",
  graphics: "inventory2b4.quick.spec.graphics",
  edition: "inventory2b4.quick.spec.edition",
  region: "inventory2b4.quick.spec.region",
  included_controller_count: "inventory2b4.quick.spec.controllerCount",
  network_variant: "inventory2b4.quick.spec.networkVariant",
  connectivity: "inventory2b4.quick.spec.connectivity",
  screen_size_inches: "inventory2b4.quick.spec.screenSize",
  short_specification: "inventory2b4.quick.spec.short",
};

const colorPolicyKeys: Record<"generic" | "approved" | "pending-official-color", MessageKey> = {
  generic: "inventory2b4.quick.colorPolicy.generic",
  approved: "inventory2b4.quick.colorPolicy.approved",
  "pending-official-color": "inventory2b4.quick.colorPolicy.pending",
};

const availabilityKeys: Record<InventoryAvailabilityState, MessageKey> = {
  loading: "inventory2b4.availability.loading",
  "no-permission": "inventory2b4.availability.noPermission",
  "feature-off": "inventory2b4.availability.featureOff",
  "not-found-or-hidden": "inventory2b4.availability.notFound",
  "service-unavailable": "inventory2b4.availability.unavailable",
  retrying: "inventory2b4.availability.retrying",
  available: "inventory2b4.availability.available",
};

const freshnessKeys: Record<InventoryReadFreshnessState, MessageKey> = {
  fresh: "inventory2b4.freshness.fresh",
  stale: "inventory2b4.freshness.stale",
  verifying: "inventory2b4.freshness.verifying",
  "verify-failed": "inventory2b4.freshness.verifyFailed",
  recovered: "inventory2b4.freshness.recovered",
  "privacy-redacted": "inventory2b4.freshness.privacyRedacted",
};

const actionKeys: Record<InventoryDetailActionId, MessageKey> = {
  "after-sales-work": "inventory2b4.nextAction.afterSalesWork",
  "view-after-sales": "inventory2b4.nextAction.viewAfterSales",
  "sale-collection": "inventory2b4.nextAction.saleCollection",
  "sale-pickup": "inventory2b4.nextAction.salePickup",
  "sale-warranty": "inventory2b4.nextAction.saleWarranty",
  "view-sale": "inventory2b4.nextAction.viewSale",
  "reserve-product": "inventory2b4.nextAction.reserveProduct",
  "inspection-editor": "inventory2b4.nextAction.inspectionEditor",
  "edit-product": "inventory2b4.nextAction.editProduct",
};

export function localizeInventoryProductCategory(code: string, fallback: string, t: Translate) {
  const key = categoryKeys[code as InventoryProductCategory];
  return key ? t(key) : fallback;
}

export function localizeInventoryProductStatus(code: string, fallback: string, t: Translate) {
  const key = statusKeys[code as InventoryProductDisplayStatus];
  return key ? t(key) : fallback;
}

export function localizeInventoryIdentifierKind(code: string, fallback: string, t: Translate) {
  const key = identifierKindKeys[code as InventoryProductIdentifierKind];
  return key ? t(key) : fallback;
}

export function localizeInventoryIdentifierSource(code: string, fallback: string, t: Translate) {
  const key = identifierSourceKeys[code as InventoryProductIdentifierSource];
  return key ? t(key) : fallback;
}

export function localizeInventoryInspection(code: string, fallback: string, t: Translate) {
  const key = inspectionKeys[code];
  return key ? t(key) : fallback;
}

export function localizeInventoryCondition(code: string, fallback: string, t: Translate) {
  const key = conditionKeys[code];
  return key ? t(key) : fallback;
}

export function localizeInventorySpecificationLabel(code: string, fallback: string, t: Translate) {
  const key = specificationKeys[code];
  return key ? t(key) : fallback;
}

export function localizeInventoryColorPolicy(
  state: "generic" | "approved" | "pending-official-color",
  t: Translate,
) {
  return t(colorPolicyKeys[state]);
}

export function localizeInventoryValidation(code: string, fallback: string, t: Translate) {
  const key = validationKeys[code];
  return key ? t(key) : fallback;
}

export type InventoryColorPresentation = {
  stableId?: string | null;
  value: string;
  label?: string | null;
};

/** The canonical/persisted color value is never rewritten by localization. */
export function localizeInventoryColor(
  color: InventoryColorPresentation,
  t: Translate,
): { value: string; label: string } {
  const key = color.stableId ? colorKeys[color.stableId] : undefined;
  return { value: color.value, label: key ? t(key) : (color.label ?? color.value) };
}

export function localizeInventoryAvailability(state: InventoryAvailabilityState, t: Translate) {
  return t(availabilityKeys[state]);
}

export function localizeInventoryFreshness(state: InventoryReadFreshnessState, t: Translate) {
  return t(freshnessKeys[state]);
}

export function localizeInventoryDetailNextAction(
  action: InventoryDetailNextAction,
  t: Translate,
): string | undefined {
  if (action.kind === "loading") return t("inventory2b4.nextAction.loading");
  if (action.kind !== "action") return undefined;
  const key = action.id ? actionKeys[action.id] : undefined;
  return key ? t(key) : action.label;
}

export function formatInventoryProductDate(
  value: Date | string | number | null | undefined,
  locale: AppLocale,
  t: Translate,
) {
  if (value === null || value === undefined || value === "") {
    return t("inventory2b4.common.dateUnavailable");
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return t("inventory2b4.common.dateUnavailable");
  return formatDateTime(date, locale);
}

export function formatInventoryProductMoney(
  value: number | null | undefined,
  locale: AppLocale,
  t: Translate,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? formatCurrency(value, locale)
    : t("inventory2b4.common.amountUnavailable");
}

const errorSubtypeKeys: Record<InventoryOperationErrorSubtype, MessageKey> = {
  validation: "inventory2b4.error.validation",
  authorization: "inventory2b4.error.authorization",
  connectivity: "inventory2b4.error.connectivity",
  server: "inventory2b4.error.server",
  generic: "inventory2b4.error.generic",
};

/** Uses only stable status/code/name classification and never forwards raw diagnostics. */
export function getInventorySafeErrorMessage(error: unknown, t: Translate) {
  const candidate =
    error && typeof error === "object" ? (error as { status?: unknown }) : undefined;
  if (candidate?.status === 409) return t("inventory2b4.error.conflict");
  const classified = classifyInventoryOperationError(error);
  return t(errorSubtypeKeys[classified?.subtype ?? "generic"]);
}

export function getInventoryQuickEntryErrorMessage(
  error: unknown,
  operation: "create" | "update",
  t: Translate,
) {
  const candidate =
    error && typeof error === "object" ? (error as { status?: unknown }) : undefined;
  if (candidate?.status === 409) return t("inventory2b4.error.conflict");
  const classified = classifyInventoryOperationError(error);
  if (!classified || classified.subtype === "generic") {
    return t(
      operation === "create"
        ? "inventory2b4.quick.screen.createFailed"
        : "inventory2b4.quick.edit.updateFailed",
    );
  }
  return t(errorSubtypeKeys[classified.subtype]);
}
