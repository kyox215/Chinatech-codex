import type {
  OrderCapabilities,
  PatchOrderChanges,
  UpdateOrderInput,
} from "@/lib/repairdesk/types";
import { uniqueContactPhones } from "@/shared/lib/phone";

const intakeStringFields = [
  "customer_name",
  "customer_phone",
  "device_brand",
  "device_model",
  "device_imei",
  "issue_description",
  "accessory_notes",
] as const;

const repairStringFields = [
  "device_notes",
  "diagnosis_result",
  "internal_tag",
  "warranty_text",
  "warranty_change_reason",
] as const;

export function buildOrderPatchChanges(
  baseline: UpdateOrderInput,
  draft: UpdateOrderInput,
  capabilities: Pick<OrderCapabilities, "canEditIntake" | "canEditRepair">,
): PatchOrderChanges {
  const changes: PatchOrderChanges = {};

  if (capabilities.canEditIntake) {
    for (const field of intakeStringFields) {
      if (normalizeText(baseline[field]) !== normalizeText(draft[field])) {
        changes[field] = normalizeText(draft[field]);
      }
    }
    if (draft.contact_phones !== undefined) {
      const before = uniqueContactPhones(baseline.customer_phone, baseline.contact_phones);
      const after = uniqueContactPhones(draft.customer_phone, draft.contact_phones);
      if (JSON.stringify(before) !== JSON.stringify(after)) changes.contact_phones = after;
    }
  }

  if (capabilities.canEditRepair) {
    for (const field of repairStringFields) {
      if (normalizeText(baseline[field]) !== normalizeText(draft[field])) {
        changes[field] = normalizeText(draft[field]);
      }
    }
    if (Number(baseline.warranty_months ?? 0) !== Number(draft.warranty_months ?? 0)) {
      changes.warranty_months = Number(draft.warranty_months ?? 0);
    }
    if (unlockSignature(baseline.device_unlock) !== unlockSignature(draft.device_unlock)) {
      changes.device_unlock = draft.device_unlock ?? { method: "none" };
    }
  }

  return changes;
}

function normalizeText(value: string | undefined) {
  return value?.trim() ?? "";
}

function unlockSignature(value: UpdateOrderInput["device_unlock"]) {
  if (!value || value.method === "none") return "none";
  if (value.method === "pattern") return `pattern:${value.pattern.join("-")}`;
  return `${value.method}:${value.value.trim()}`;
}
