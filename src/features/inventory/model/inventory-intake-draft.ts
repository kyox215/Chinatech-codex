import type {
  AiInventoryFieldName,
  AiInventoryIdentifierCandidate,
  AiInventoryRecognition,
} from "@/features/ai-assistant/model/contracts";
import type { CreateInventoryIntakeInput, InventoryItemStatus } from "@/lib/repairdesk/types";

export type InventoryIntakeFormDraft = {
  source_type: string;
  initial_status: string;
  brand: string;
  model: string;
  category: string;
  color: string;
  storage_capacity: string;
  serial_or_imei: string;
  buyback_price: string;
  repair_cost_amount: string;
  list_price: string;
  warranty_months: string;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  notes: string;
};

export type InventoryFieldReviewDecision = "pending" | "accepted" | "edited" | "rejected";

export type InventoryFieldReview = {
  field: AiInventoryFieldName;
  value: string;
  decision: InventoryFieldReviewDecision;
  overwriteManual: boolean;
};

export type InventoryIdentifierReview = {
  candidate: AiInventoryIdentifierCandidate;
  value: string;
  decision: InventoryFieldReviewDecision;
  isPrimary: boolean;
  overwriteManual: boolean;
};

export type InventoryRecognitionReview = {
  fields: Record<AiInventoryFieldName, InventoryFieldReview>;
  identifiers: InventoryIdentifierReview[];
};

export type InventoryDraftApplyResult = {
  draft: InventoryIntakeFormDraft;
  appliedFields: string[];
  preservedManualFields: string[];
  unmappedFields: string[];
};

const mappedFieldNames = ["brand", "model", "color", "storage_capacity"] as const;
const primaryIdentifierTypes = new Set(["imei1", "imei2", "serial"]);

export function createEmptyInventoryIntakeDraft(): InventoryIntakeFormDraft {
  return {
    source_type: "manual_stock",
    initial_status: "listed",
    brand: "",
    model: "",
    category: "phone",
    color: "",
    storage_capacity: "",
    serial_or_imei: "",
    buyback_price: "",
    repair_cost_amount: "",
    list_price: "",
    warranty_months: "",
    payment_method: "",
    customer_name: "",
    customer_phone: "",
    notes: "",
  };
}

export function createInventoryRecognitionReview(
  recognition: AiInventoryRecognition,
): InventoryRecognitionReview {
  return {
    fields: {
      brand: fieldReview("brand", recognition),
      model: fieldReview("model", recognition),
      color: fieldReview("color", recognition),
      ram_capacity: fieldReview("ram_capacity", recognition),
      storage_capacity: fieldReview("storage_capacity", recognition),
    },
    identifiers: recognition.identifiers.map((candidate) => ({
      candidate,
      value: candidate.value,
      decision: "pending",
      isPrimary: false,
      overwriteManual: false,
    })),
  };
}

export function applyInventoryRecognitionReview(
  current: InventoryIntakeFormDraft,
  review: InventoryRecognitionReview,
): InventoryDraftApplyResult {
  const draft = { ...current };
  const appliedFields: string[] = [];
  const preservedManualFields: string[] = [];
  const unmappedFields: string[] = [];

  for (const field of mappedFieldNames) {
    const item = review.fields[field];
    if (!isApproved(item.decision) || !item.value.trim()) continue;
    applyValue({
      draft,
      field,
      value: item.value,
      overwriteManual: item.overwriteManual,
      appliedFields,
      preservedManualFields,
    });
  }

  const ram = review.fields.ram_capacity;
  if (isApproved(ram.decision) && ram.value.trim()) unmappedFields.push("ram_capacity");

  const primary = review.identifiers.find(
    (item) =>
      item.isPrimary &&
      isApproved(item.decision) &&
      item.candidate.validation !== "invalid" &&
      primaryIdentifierTypes.has(item.candidate.type) &&
      item.value.trim(),
  );
  if (primary) {
    applyValue({
      draft,
      field: "serial_or_imei",
      value: primary.value,
      overwriteManual: primary.overwriteManual,
      appliedFields,
      preservedManualFields,
    });
  }

  for (const item of review.identifiers) {
    if (!isApproved(item.decision) || !item.value.trim() || item === primary) continue;
    unmappedFields.push(`identifier:${item.candidate.type}`);
  }

  return {
    draft,
    appliedFields,
    preservedManualFields,
    unmappedFields,
  };
}

export function inventoryIntakeDraftToInput(
  draft: InventoryIntakeFormDraft,
): CreateInventoryIntakeInput {
  return {
    customer_name: optional(draft.customer_name),
    customer_phone: optional(draft.customer_phone),
    source_type: optional(draft.source_type),
    initial_status: optional(draft.initial_status) as InventoryItemStatus | undefined,
    category: optional(draft.category),
    brand: draft.brand.trim(),
    model: draft.model.trim(),
    color: optional(draft.color),
    storage_capacity: optional(draft.storage_capacity),
    serial_or_imei: optional(draft.serial_or_imei),
    buyback_price: optionalNumber(draft.buyback_price),
    repair_cost_amount: optionalNumber(draft.repair_cost_amount),
    list_price: optionalNumber(draft.list_price),
    warranty_months: optionalNumber(draft.warranty_months),
    payment_method: optional(draft.payment_method),
    notes: optional(draft.notes),
  };
}

function fieldReview(
  field: AiInventoryFieldName,
  recognition: AiInventoryRecognition,
): InventoryFieldReview {
  return {
    field,
    value: recognition.fields[field].value ?? "",
    decision: "pending",
    overwriteManual: false,
  };
}

function applyValue({
  draft,
  field,
  value,
  overwriteManual,
  appliedFields,
  preservedManualFields,
}: {
  draft: InventoryIntakeFormDraft;
  field: keyof InventoryIntakeFormDraft;
  value: string;
  overwriteManual: boolean;
  appliedFields: string[];
  preservedManualFields: string[];
}) {
  const proposed = value.trim();
  const existing = draft[field].trim();
  if (existing && normalize(existing) !== normalize(proposed) && !overwriteManual) {
    preservedManualFields.push(field);
    return;
  }
  draft[field] = proposed;
  appliedFields.push(field);
}

function isApproved(decision: InventoryFieldReviewDecision) {
  return decision === "accepted" || decision === "edited";
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").trim();
}

function optional(value: string) {
  const normalized = value.trim();
  return normalized || undefined;
}

function optionalNumber(value: string) {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : undefined;
}
