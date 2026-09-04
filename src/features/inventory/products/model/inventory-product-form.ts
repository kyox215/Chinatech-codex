import type {
  CreateInventoryProductInput,
  InventoryProductCategory,
  InventoryProductIdentifierInput,
  InventoryProductIdentifierKind,
  InventoryProductIdentifierSource,
  InventoryProductEditData,
  InventoryProductFaceIdStatus,
  InventoryProductInspectionInput,
  UpdateInventoryProductInput,
} from "@/lib/repairdesk/types";

import {
  inventoryProductIdentifierKinds,
  isValidGtin,
  normalizeDeviceIdentifier,
  validateProductIdentifier,
} from "./device-data";
import { resolveDeviceColorPolicy, type AppleColorApprovalOverlay } from "./device-color-policy";

export type InventoryProductFormIdentifierSource = Extract<
  InventoryProductIdentifierSource,
  "manual" | "scan" | "ai_confirmed"
>;

export type InventoryProductFormDraft = {
  category: InventoryProductCategory;
  brand: string;
  model: string;
  color: string;
  ram_capacity: string;
  storage_capacity: string;
  gtin: string;
  condition: string;
  specifications: Record<string, string>;
  identifiers: Record<InventoryProductIdentifierKind, string>;
  identifier_sources: Record<InventoryProductIdentifierKind, InventoryProductFormIdentifierSource>;
  primary_identifier_kind?: InventoryProductIdentifierKind;
  list_price: string;
  cost_amount: string;
  location: string;
  warranty_months: string;
  notes: string;
  inspection_battery_health: string;
  inspection_face_id_status: InventoryProductFaceIdStatus;
  inspection_touched: boolean;
};

export type InventoryProductFormValidationCode =
  | "brand_required"
  | "model_required"
  | "notes_too_long"
  | "battery_invalid"
  | "imei2_requires_imei1"
  | "imei1_required"
  | "gtin_invalid"
  | "imei_invalid"
  | "serial_invalid"
  | "eid_invalid"
  | "identifier_duplicate"
  | "primary_identifier_required"
  | "eid_primary_forbidden"
  | "list_price_invalid"
  | "cost_amount_invalid"
  | "warranty_invalid"
  | "color_required"
  | "color_not_approved";

export type InventoryProductFormValidationError = {
  code: InventoryProductFormValidationCode;
  message: string;
  fieldId?: string;
};

export type InventoryProductFormOptions = {
  canEnterCost?: boolean;
  /** Only reviewed exact-model Apple colors may be supplied here. */
  approvedAppleColorOverlay?: AppleColorApprovalOverlay;
  /** The persisted edit value; create flows leave this unset. */
  existingColor?: string;
  /** Independent business requirement; pending Apple mapping is otherwise optional. */
  colorRequired?: boolean;
  /** Intake-only phone rule; edit flows intentionally leave this unset. */
  requireImei1?: boolean;
};

export const eligiblePrimaryIdentifierKinds = ["imei1", "imei2", "serial"] as const;

export function createInventoryProductFormDraft(
  category: InventoryProductCategory = "phone",
): InventoryProductFormDraft {
  return {
    category,
    brand: "",
    model: "",
    color: "",
    ram_capacity: "",
    storage_capacity: "",
    gtin: "",
    condition: "",
    specifications: {},
    identifiers: { imei1: "", imei2: "", serial: "", eid: "" },
    identifier_sources: {
      imei1: "manual",
      imei2: "manual",
      serial: "manual",
      eid: "manual",
    },
    list_price: "",
    cost_amount: "",
    location: "",
    warranty_months: "",
    notes: "",
    inspection_battery_health: "",
    inspection_face_id_status: "not_tested",
    inspection_touched: false,
  };
}

export function isInventoryProductFormDraftDirty(draft: InventoryProductFormDraft) {
  return (
    draft.category !== "phone" ||
    [
      draft.brand,
      draft.model,
      draft.color,
      draft.ram_capacity,
      draft.storage_capacity,
      draft.gtin,
      draft.condition,
      ...Object.values(draft.identifiers),
      draft.list_price,
      draft.cost_amount,
      draft.location,
      draft.warranty_months,
      draft.notes,
      draft.inspection_battery_health,
      draft.inspection_face_id_status === "not_tested" ? "" : draft.inspection_face_id_status,
      draft.inspection_touched ? "inspection-touched" : "",
      ...Object.values(draft.specifications),
    ].some((value) => value.trim().length > 0)
  );
}

export function clearInventoryProductFormDependencies(
  draft: InventoryProductFormDraft,
  kind: "brand" | "model",
): InventoryProductFormDraft {
  if (kind === "brand") {
    return {
      ...draft,
      model: "",
      ram_capacity: "",
      storage_capacity: "",
      color: "",
      specifications: {},
      inspection_battery_health: "",
      inspection_face_id_status: "not_tested",
      inspection_touched: false,
    };
  }
  return {
    ...draft,
    ram_capacity: "",
    storage_capacity: "",
    color: "",
    specifications: {},
    inspection_battery_health: "",
    inspection_face_id_status: "not_tested",
    inspection_touched: false,
  };
}

export function formIdentifiers(
  draft: Pick<
    InventoryProductFormDraft,
    "identifiers" | "identifier_sources" | "primary_identifier_kind"
  >,
): InventoryProductIdentifierInput[] {
  const populated = inventoryProductIdentifierKinds
    .filter((kind) => draft.identifiers[kind].trim())
    .map((kind) => ({
      kind,
      value: draft.identifiers[kind].trim(),
      source: draft.identifier_sources[kind],
      ...(draft.primary_identifier_kind === kind ? { primary: true } : {}),
    }));

  // A new item has no explicit primary selection. Choose the first eligible
  // identifier only; EID is deliberately never promoted to primary.
  if (!populated.some((item) => item.primary)) {
    const firstEligible = populated.find((item) =>
      eligiblePrimaryIdentifierKinds.includes(
        item.kind as (typeof eligiblePrimaryIdentifierKinds)[number],
      ),
    );
    if (firstEligible) firstEligible.primary = true;
  }
  return populated;
}

export function validateInventoryProductFormDraft(
  draft: InventoryProductFormDraft,
  options: InventoryProductFormOptions = {},
): InventoryProductFormValidationError | undefined {
  if (!draft.brand.trim()) return validationError("brand_required", "请填写品牌", "product-brand");
  if (!draft.model.trim())
    return validationError("model_required", "请填写型号或商品名称", "product-model");
  if (draft.notes.length > 2_000)
    return validationError("notes_too_long", "内部备注不能超过 2000 个字符", "product-notes");
  if (
    draft.inspection_touched &&
    draft.inspection_battery_health.trim() &&
    (!/^\d+$/.test(draft.inspection_battery_health.trim()) ||
      Number(draft.inspection_battery_health) < 0 ||
      Number(draft.inspection_battery_health) > 100)
  ) {
    return validationError(
      "battery_invalid",
      "电池健康度必须是 0 到 100 的整数或空值",
      "product-battery-health",
    );
  }
  if (draft.identifiers.imei2.trim() && !draft.identifiers.imei1.trim()) {
    return validationError(
      "imei2_requires_imei1",
      "请先填写 IMEI 1，再填写 IMEI 2",
      "product-imei1",
    );
  }
  if (options.requireImei1 && draft.category === "phone" && !draft.identifiers.imei1.trim()) {
    return validationError("imei1_required", "手机商品必须填写 IMEI 1", "product-imei1");
  }
  if (draft.gtin.trim() && !isValidGtin(draft.gtin)) {
    return validationError("gtin_invalid", "EAN / GTIN 校验位不正确", "product-gtin");
  }
  const identifiers = formIdentifiers(draft);
  const seenIdentifiers = new Set<string>();
  for (const identifier of identifiers) {
    const identifierMessage = validateProductIdentifier(identifier.kind, identifier.value);
    if (identifierMessage) {
      const code =
        identifier.kind === "eid"
          ? "eid_invalid"
          : identifier.kind === "serial"
            ? "serial_invalid"
            : "imei_invalid";
      return validationError(code, identifierMessage, `product-${identifier.kind}`);
    }
    const normalized = normalizeDeviceIdentifier(identifier.value);
    if (seenIdentifiers.has(normalized)) {
      return validationError(
        "identifier_duplicate",
        "设备标识不能重复",
        `product-${identifier.kind}`,
      );
    }
    seenIdentifiers.add(normalized);
  }
  if (identifiers.length && !identifiers.some((item) => item.primary)) {
    return validationError(
      "primary_identifier_required",
      "请填写 IMEI 1、IMEI 2 或序列号作为主要标识",
      "product-imei1",
    );
  }
  if (identifiers.some((item) => item.primary && item.kind === "eid")) {
    return validationError("eid_primary_forbidden", "EID 不能作为主要设备标识", "product-eid");
  }
  for (const [code, label, value, fieldId] of [
    ["list_price_invalid", "计划售价", draft.list_price, "product-price"],
    ...(options.canEnterCost
      ? [["cost_amount_invalid", "入库成本", draft.cost_amount, "product-cost"]]
      : []),
  ] as string[][]) {
    if (value.trim() && !/^[0-9]+(?:[.,][0-9]{1,2})?$/.test(value.trim())) {
      return validationError(
        code as Extract<
          InventoryProductFormValidationCode,
          "list_price_invalid" | "cost_amount_invalid"
        >,
        `${label}格式无效，最多两位小数`,
        fieldId,
      );
    }
  }
  if (
    draft.warranty_months.trim() &&
    (!/^\d+$/.test(draft.warranty_months) || Number(draft.warranty_months) > 120)
  ) {
    return validationError(
      "warranty_invalid",
      "保修月数必须是 0 到 120 的整数",
      "product-warranty",
    );
  }
  const colorPolicy = resolveDeviceColorPolicy({
    category: draft.category,
    brand: draft.brand,
    model: draft.model,
    selectedColor: draft.color,
    existingColor: options.existingColor,
    approvedAppleColors: options.approvedAppleColorOverlay,
    colorRequired: options.colorRequired,
  });
  if (!colorPolicy.save.canSave) {
    return colorPolicy.save.blockedReason === "color-required"
      ? validationError("color_required", "请先选择设备颜色后再保存", "product-color")
      : validationError(
          "color_not_approved",
          "Apple 设备颜色必须来自已审核的官方颜色映射",
          "product-color",
        );
  }
  return undefined;
}

function validationError(
  code: InventoryProductFormValidationCode,
  message: string,
  fieldId: string,
): InventoryProductFormValidationError {
  return { code, message, fieldId };
}

export function inventoryProductFormToCreateInput(
  draft: InventoryProductFormDraft,
  idempotency_key: string,
  options: InventoryProductFormOptions = {},
): CreateInventoryProductInput {
  const color = colorForSave(draft, options);
  return {
    idempotency_key,
    category: draft.category,
    brand: draft.brand.trim(),
    model: draft.model.trim(),
    ...(color ? { color } : {}),
    ram_capacity: optional(draft.ram_capacity),
    storage_capacity: optional(draft.storage_capacity),
    gtin: optional(draft.gtin),
    condition: optional(draft.condition),
    specifications: cleanedRecord(draft.specifications),
    identifiers: formIdentifiers(draft),
    list_price: optionalMoney(draft.list_price),
    ...(options.canEnterCost ? { cost_amount: optionalMoney(draft.cost_amount) } : {}),
    location: optional(draft.location),
    warranty_months: draft.warranty_months.trim() ? Number(draft.warranty_months) : undefined,
    notes: optional(draft.notes),
    ...formInspectionInput(draft),
  };
}

export function inventoryProductFormToUpdateInput(
  draft: InventoryProductFormDraft,
  idempotency_key: string,
  expected_version: number,
  options: InventoryProductFormOptions = {},
): UpdateInventoryProductInput {
  return {
    ...inventoryProductFormToCreateInput(draft, idempotency_key, options),
    expected_version,
    identifiers: formIdentifiers(draft),
  };
}

function colorForSave(
  draft: Pick<InventoryProductFormDraft, "category" | "brand" | "model" | "color">,
  options: InventoryProductFormOptions,
) {
  const policy = resolveDeviceColorPolicy({
    category: draft.category,
    brand: draft.brand,
    model: draft.model,
    selectedColor: draft.color,
    existingColor: options.existingColor,
    approvedAppleColors: options.approvedAppleColorOverlay,
    colorRequired: options.colorRequired,
  });
  if (policy.state === "pending-official-color")
    return optional(policy.save.preservedExistingColor);
  if (policy.state === "approved") return optional(policy.save.payloadColor);
  return optional(draft.color);
}

export function inventoryProductEditDataToFormDraft(
  data: InventoryProductEditData,
): InventoryProductFormDraft {
  const draft = createInventoryProductFormDraft(data.category);
  draft.brand = data.brand;
  draft.model = data.model;
  draft.color = data.color ?? "";
  draft.ram_capacity = data.ram_capacity ?? "";
  draft.storage_capacity = data.storage_capacity ?? "";
  draft.gtin = data.gtin ?? "";
  draft.condition = data.condition ?? "";
  draft.specifications = data.specifications ?? {};
  draft.list_price = data.list_price?.toString() ?? "";
  draft.cost_amount = data.cost_amount?.toString() ?? "";
  draft.location = data.location ?? "";
  draft.warranty_months = data.warranty_months?.toString() ?? "";
  draft.notes = data.notes ?? "";
  draft.inspection_battery_health =
    data.inspection?.battery_health === null || data.inspection?.battery_health === undefined
      ? ""
      : String(data.inspection.battery_health);
  draft.inspection_face_id_status = data.inspection?.face_id_status ?? "not_tested";
  draft.inspection_touched = false;
  for (const identifier of data.identifiers) {
    draft.identifiers[identifier.kind] = identifier.value;
    draft.identifier_sources[identifier.kind] = identifier.source;
    if (identifier.primary) draft.primary_identifier_kind = identifier.kind;
  }
  return draft;
}

export function mergeInventoryProductFormDraft(
  base: InventoryProductFormDraft,
  local: InventoryProductFormDraft,
  latest: InventoryProductFormDraft,
): InventoryProductFormDraft {
  const merged = { ...latest };
  for (const key of [
    "category",
    "brand",
    "model",
    "color",
    "ram_capacity",
    "storage_capacity",
    "gtin",
    "condition",
    "primary_identifier_kind",
    "list_price",
    "cost_amount",
    "location",
    "warranty_months",
    "notes",
    "inspection_battery_health",
    "inspection_face_id_status",
    "inspection_touched",
  ] as const) {
    if (JSON.stringify(local[key]) !== JSON.stringify(base[key])) merged[key] = local[key] as never;
  }
  merged.identifiers = mergeRecord(base.identifiers, local.identifiers, latest.identifiers);
  merged.identifier_sources = mergeRecord(
    base.identifier_sources,
    local.identifier_sources,
    latest.identifier_sources,
  );
  merged.specifications = mergeRecord(
    base.specifications,
    local.specifications,
    latest.specifications,
  );
  return merged;
}

function mergeRecord<T extends Record<string, string>>(base: T, local: T, latest: T): T {
  const merged = { ...latest } as T;
  for (const key of new Set([
    ...Object.keys(base),
    ...Object.keys(local),
    ...Object.keys(latest),
  ])) {
    if (local[key] !== base[key]) merged[key as keyof T] = local[key] as T[keyof T];
  }
  return merged;
}

function optional(value: string | undefined) {
  return value?.trim() || undefined;
}

function optionalMoney(value: string) {
  const text = value.trim().replace(",", ".");
  return text && /^\d+(?:\.\d{1,2})?$/.test(text) ? Number(text) : undefined;
}

function cleanedRecord(value: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, item.trim()])
      .filter(([, item]) => item),
  );
}

function formInspectionInput(
  draft: Pick<
    InventoryProductFormDraft,
    "inspection_battery_health" | "inspection_face_id_status" | "inspection_touched"
  >,
): { inspection?: InventoryProductInspectionInput } {
  if (!draft.inspection_touched) return {};
  const battery = draft.inspection_battery_health.trim();
  const faceIdStatus = draft.inspection_face_id_status;
  return {
    inspection: {
      battery_health: battery ? Number(battery) : null,
      ...(faceIdStatus !== "not_tested" ? { face_id_status: faceIdStatus } : {}),
    },
  };
}
