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
  identifierLabels,
  inventoryProductIdentifierKinds,
  isValidGtin,
  validateProductIdentifiers,
} from "./device-data";

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

export type InventoryProductFormValidationError = {
  message: string;
  fieldId?: string;
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
  options: { canEnterCost?: boolean } = {},
): InventoryProductFormValidationError | undefined {
  if (!draft.brand.trim()) return { message: "请填写品牌", fieldId: "product-brand" };
  if (!draft.model.trim()) return { message: "请填写型号或商品名称", fieldId: "product-model" };
  if (draft.notes.length > 2_000)
    return { message: "内部备注不能超过 2000 个字符", fieldId: "product-notes" };
  if (
    draft.inspection_touched &&
    draft.inspection_battery_health.trim() &&
    (!/^\d+$/.test(draft.inspection_battery_health.trim()) ||
      Number(draft.inspection_battery_health) < 0 ||
      Number(draft.inspection_battery_health) > 100)
  ) {
    return { message: "电池健康度必须是 0 到 100 的整数或空值", fieldId: "product-battery-health" };
  }
  if (draft.identifiers.imei2.trim() && !draft.identifiers.imei1.trim()) {
    return { message: "请先填写 IMEI 1，再填写 IMEI 2", fieldId: "product-imei1" };
  }
  if (draft.gtin.trim() && !isValidGtin(draft.gtin)) {
    return { message: "EAN / GTIN 校验位不正确", fieldId: "product-gtin" };
  }
  const identifiers = formIdentifiers(draft);
  const identifierError = validateProductIdentifiers(identifiers);
  if (identifierError) {
    const failing = inventoryProductIdentifierKinds.find((kind) =>
      identifierError.includes(kind === "serial" ? "序列号" : identifierLabels[kind]),
    );
    return { message: identifierError, fieldId: `product-${failing ?? "imei1"}` };
  }
  if (identifiers.length && !identifiers.some((item) => item.primary)) {
    return { message: "请填写 IMEI 1、IMEI 2 或序列号作为主要标识", fieldId: "product-imei1" };
  }
  if (identifiers.some((item) => item.primary && item.kind === "eid")) {
    return { message: "EID 不能作为主要设备标识", fieldId: "product-eid" };
  }
  for (const [label, value, fieldId] of [
    ["计划售价", draft.list_price, "product-price"],
    ...(options.canEnterCost ? [["入库成本", draft.cost_amount, "product-cost"]] : []),
  ] as string[][]) {
    if (value.trim() && !/^[0-9]+(?:[.,][0-9]{1,2})?$/.test(value.trim())) {
      return { message: `${label}格式无效，最多两位小数`, fieldId };
    }
  }
  if (
    draft.warranty_months.trim() &&
    (!/^\d+$/.test(draft.warranty_months) || Number(draft.warranty_months) > 120)
  ) {
    return { message: "保修月数必须是 0 到 120 的整数", fieldId: "product-warranty" };
  }
  return undefined;
}

export function inventoryProductFormToCreateInput(
  draft: InventoryProductFormDraft,
  idempotency_key: string,
  options: { canEnterCost?: boolean } = {},
): CreateInventoryProductInput {
  return {
    idempotency_key,
    category: draft.category,
    brand: draft.brand.trim(),
    model: draft.model.trim(),
    color: optional(draft.color),
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
  options: { canEnterCost?: boolean } = {},
): UpdateInventoryProductInput {
  return {
    ...inventoryProductFormToCreateInput(draft, idempotency_key, options),
    expected_version,
    identifiers: formIdentifiers(draft),
  };
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

function optional(value: string) {
  return value.trim() || undefined;
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
