import type { SaveRepairDeskOfflineOrderDraftInput } from "@/features/offline/model/offline-order-service";
import type {
  RepairDeskOfflineOrderDraft,
  RepairDeskOfflineRelationshipPlan,
  RepairDeskOfflineSafeRecord,
} from "@/features/offline/model/offline-types";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { DeviceCustodyStatus } from "@/lib/repairdesk/types";
import { ensureOrderLineId } from "@/entities/order/model/order-line-identity";

import { isDeviceCustodyStatus } from "./device-custody";
import { initialNewOrderForm, type NewOrderFormState } from "./new-order-form";
import {
  inferIssueCaptureModeForLegacyDraft,
  isIntakeQuotePaused,
  issueDescriptionForIntake,
  resolveIntakeQuoteDraft,
} from "./order-diagnosis-quote";

export type NewOrderOfflineDraftRestoreResult = {
  form: NewOrderFormState;
  sensitiveUnlockNeedsReentry: boolean;
  relationshipNeedsReview: boolean;
  custodyNeedsConfirmation: boolean;
};

export function buildNewOrderOfflineDraftInput({
  form,
  localDraftId,
}: {
  form: NewOrderFormState;
  localDraftId?: string;
}): SaveRepairDeskOfflineOrderDraftInput {
  return {
    localDraftId,
    mode: "create",
    draftPayload: buildNewOrderOfflineDraftPayload(form),
    relationshipPlan: buildNewOrderOfflineRelationshipPlan(form),
    hasSensitiveVaultEntry: hasNewOrderSensitiveUnlockDraft(form),
  };
}

export function buildNewOrderOfflineDraftPayload(
  form: NewOrderFormState,
): RepairDeskOfflineSafeRecord {
  const serializedRepairItems = form.faults
    .map((item) => ({
      ...(item.line_id ? { line_id: item.line_id } : {}),
      ...(item.catalog_key ? { catalog_key: item.catalog_key } : {}),
      key: item.key,
      categoryKey: item.categoryKey,
      categoryLabel: item.categoryLabel,
      name: item.name.trim(),
      price: normalizeMoneyNumber(item.price),
      note: item.note?.trim() ?? "",
    }))
    .filter((item) => item.name || item.price > 0 || item.note);
  const serializedQuoteTotal = serializedRepairItems.reduce(
    (sum, item) => sum + normalizeMoneyNumber(item.price),
    0,
  );
  const activeQuote = resolveIntakeQuoteDraft({
    mode: form.issueCaptureMode,
    items: serializedRepairItems,
    total: serializedQuoteTotal,
    deposit: form.deposit,
  });
  const quotedPriceCents = moneyToCents(activeQuote.total);

  return {
    orderType: form.type,
    orderStatus: form.status,
    customerName: form.customerName.trim(),
    customerPhone: form.customerPhone.trim(),
    deviceBrand: form.brand.trim(),
    deviceModel: form.model.trim(),
    deviceNotes: form.deviceNotes.trim(),
    deviceCustody: form.deviceCustodyStatus,
    imei: form.imei.trim(),
    issueMode: form.issueCaptureMode,
    issueDescription:
      form.issueCaptureMode === "reported"
        ? form.issue.trim()
        : issueDescriptionForIntake(form.issueCaptureMode, form.issue),
    ...(isIntakeQuotePaused(form.issueCaptureMode) && form.issue.trim()
      ? { reportedIssueDraft: form.issue.trim() }
      : {}),
    ...(isIntakeQuotePaused(form.issueCaptureMode) && serializedRepairItems.length
      ? { pausedRepairItems: serializedRepairItems }
      : {}),
    ...(isIntakeQuotePaused(form.issueCaptureMode) && form.deposit > 0
      ? { pausedDepositAmountCents: moneyToCents(form.deposit) }
      : {}),
    accessoryNotes: form.accessoryNotes.trim(),
    warrantyDraft: {
      text: form.warrantyText.trim(),
      months: normalizeInteger(form.warrantyMonths),
      changeReason: form.warrantyChangeReason.trim(),
    },
    depositAmountCents: moneyToCents(activeQuote.deposit),
    quotedPriceCents,
    repairItems: activeQuote.items,
  };
}

export function buildNewOrderOfflineRelationshipPlan(
  form: NewOrderFormState,
): RepairDeskOfflineRelationshipPlan {
  const customerSnapshot = {
    ...(form.customerId ? { customerId: form.customerId } : {}),
    name: form.customerName.trim(),
    phone: form.customerPhone.trim(),
  };
  const deviceSnapshot = {
    ...(form.deviceId ? { deviceId: form.deviceId } : {}),
    brand: form.brand.trim(),
    model: form.model.trim(),
    imei: form.imei.trim(),
  };

  const hasCustomerSnapshot = Boolean(form.customerName.trim() || form.customerPhone.trim());
  const customerLinkMode = form.customerId
    ? "existing_customer"
    : hasCustomerSnapshot
      ? "new_customer_local"
      : "walk_in_snapshot_only";
  const deviceLinkMode =
    form.deviceId && form.customerId
      ? "existing_customer_device"
      : form.brand.trim() && form.model.trim()
        ? "new_customer_device_local"
        : "order_snapshot_only";

  return {
    customerLinkMode,
    customerLinkDraft: form.customerId
      ? {
          customerId: form.customerId,
          snapshot: customerSnapshot,
        }
      : {
          ...(customerLinkMode === "new_customer_local"
            ? { localCustomerId: stableOfflineLocalId("customer", customerSnapshot) }
            : {}),
          snapshot: customerSnapshot,
        },
    deviceLinkMode,
    deviceLinkDraft:
      form.deviceId && form.customerId
        ? {
            deviceId: form.deviceId,
            snapshot: deviceSnapshot,
          }
        : {
            ...(deviceLinkMode === "new_customer_device_local"
              ? { localDeviceId: stableOfflineLocalId("device", deviceSnapshot) }
              : {}),
            snapshot: deviceSnapshot,
          },
  };
}

export function restoreNewOrderFormFromOfflineDraft(
  draft: RepairDeskOfflineOrderDraft,
): NewOrderOfflineDraftRestoreResult {
  const payload = draft.draftPayload;
  const warrantyDraft = readRecord(payload.warrantyDraft);
  const issueCaptureMode = readIssueCaptureMode(payload.issueMode, payload.issueDescription);
  const restoredFaults = readRepairItems(payload.repairItems);
  const pausedRepairItems = readRepairItems(payload.pausedRepairItems);
  const restoredCustody = readDeviceCustodyStatus(payload.deviceCustody);

  return {
    form: {
      ...initialNewOrderForm,
      type: readOrderType(payload.orderType) ?? initialNewOrderForm.type,
      status:
        readRepairOrderStatus(payload.orderStatus) ??
        readRepairOrderStatus(payload.status) ??
        initialNewOrderForm.status,
      customerId:
        draft.customerLinkMode === "existing_customer"
          ? draft.customerLinkDraft?.customerId
          : undefined,
      customerName: readString(payload.customerName) ?? "",
      customerPhone: readString(payload.customerPhone) ?? "",
      deviceId:
        draft.deviceLinkMode === "existing_customer_device"
          ? draft.deviceLinkDraft?.deviceId
          : undefined,
      brand: readString(payload.deviceBrand) ?? "",
      model: readString(payload.deviceModel) ?? "",
      imei: readString(payload.imei) ?? "",
      deviceCustodyStatus: restoredCustody,
      issueCaptureMode,
      issue: isIntakeQuotePaused(issueCaptureMode)
        ? (readString(payload.reportedIssueDraft) ?? "")
        : (readString(payload.issueDescription) ?? ""),
      accessoryNotes: readString(payload.accessoryNotes) ?? "",
      warrantyText: readString(warrantyDraft.text) ?? initialNewOrderForm.warrantyText,
      warrantyMonths: readNumber(warrantyDraft.months) ?? initialNewOrderForm.warrantyMonths,
      warrantyChangeReason: readString(warrantyDraft.changeReason) ?? "",
      deposit: isIntakeQuotePaused(issueCaptureMode)
        ? centsToMoney(
            readNumber(payload.pausedDepositAmountCents) ?? readNumber(payload.depositAmountCents),
          )
        : centsToMoney(readNumber(payload.depositAmountCents)),
      faults:
        isIntakeQuotePaused(issueCaptureMode) && pausedRepairItems.length
          ? pausedRepairItems
          : restoredFaults,
      deviceUnlock: { method: "none" },
    },
    sensitiveUnlockNeedsReentry: draft.hasSensitiveVaultEntry,
    custodyNeedsConfirmation: restoredCustody === null,
    relationshipNeedsReview:
      draft.customerLinkMode === "unknown_needs_review" ||
      draft.deviceLinkMode === "unknown_device_needs_review",
  };
}

function readIssueCaptureMode(value: unknown, legacyDescription: unknown) {
  if (
    value === "reported" ||
    value === "unknown" ||
    value === "cannot_describe" ||
    value === "diagnostic_only"
  ) {
    return value;
  }
  return inferIssueCaptureModeForLegacyDraft(readString(legacyDescription));
}

export function isNewOrderFormWorthOfflineAutosave(form: NewOrderFormState): boolean {
  return Boolean(
    form.deviceCustodyStatus !== initialNewOrderForm.deviceCustodyStatus ||
    form.customerName.trim() ||
    form.customerPhone.trim() ||
    form.brand.trim() ||
    form.model.trim() ||
    form.imei.trim() ||
    form.issueCaptureMode !== initialNewOrderForm.issueCaptureMode ||
    form.issue.trim() ||
    form.accessoryNotes.trim() ||
    form.warrantyChangeReason.trim() ||
    normalizeMoneyNumber(form.deposit) > 0 ||
    form.faults.some(
      (item) => item.name.trim() || normalizeMoneyNumber(item.price) > 0 || item.note?.trim(),
    ),
  );
}

export function getNewOrderOfflineDraftFingerprint(form: NewOrderFormState): string {
  return JSON.stringify({
    draftPayload: buildNewOrderOfflineDraftPayload(form),
    relationshipPlan: buildNewOrderOfflineRelationshipPlan(form),
    hasSensitiveVaultEntry: hasNewOrderSensitiveUnlockDraft(form),
  });
}

export function hasNewOrderSensitiveUnlockDraft(form: NewOrderFormState): boolean {
  const unlock = form.deviceUnlock;
  if (unlock.method === "text" || unlock.method === "pin") return Boolean(unlock.value.trim());
  if (unlock.method === "pattern") return unlock.pattern.length > 0;
  return false;
}

function readRepairItems(value: unknown): NewOrderFormState["faults"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = readRecord(item);
      const name = readString(record.name) ?? "";
      const price = readNumber(record.price) ?? 0;
      const note = readString(record.note) ?? "";
      return {
        line_id: ensureOrderLineId(readString(record.line_id)),
        ...(readString(record.catalog_key) ? { catalog_key: readString(record.catalog_key) } : {}),
        key: readString(record.key) ?? `offline:${index}`,
        categoryKey: readString(record.categoryKey) ?? "offline",
        categoryLabel: readString(record.categoryLabel) ?? "本机草稿",
        name,
        price,
        note,
      };
    })
    .filter((item) => item.name.trim() || item.price > 0 || item.note.trim());
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readOrderType(value: unknown): NewOrderFormState["type"] | undefined {
  return value === "quick_repair" || value === "dropoff_repair" ? value : undefined;
}

function readRepairOrderStatus(value: unknown): RepairOrderStatus | undefined {
  return typeof value === "string" && value.trim() ? (value as RepairOrderStatus) : undefined;
}

function readDeviceCustodyStatus(value: unknown): DeviceCustodyStatus | null {
  return isDeviceCustodyStatus(value) ? value : null;
}

function normalizeMoneyNumber(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function moneyToCents(value: number) {
  return Math.round(normalizeMoneyNumber(value) * 100);
}

function centsToMoney(value: number | undefined) {
  return typeof value === "number" ? value / 100 : 0;
}

function stableOfflineLocalId(prefix: "customer" | "device", value: unknown) {
  const input = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `local_${prefix}_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
