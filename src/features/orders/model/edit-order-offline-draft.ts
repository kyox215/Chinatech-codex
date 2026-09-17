import type { SaveRepairDeskOfflineOrderDraftInput } from "@/features/offline/model/offline-order-service";
import type {
  RepairDeskOfflineOrderDraft,
  RepairDeskOfflineRelationshipPlan,
  RepairDeskOfflineSafeRecord,
} from "@/features/offline/model/offline-types";
import type { FaultPriceItem, OrderDetail, UpdateOrderInput } from "@/lib/repairdesk/types";
import { ensureOrderLineId } from "@/entities/order/model/order-line-identity";

import { buildEditForm } from "./edit-order-form";

export type EditOrderOfflineDraftRestoreResult =
  | {
      status: "restored";
      draft: UpdateOrderInput;
      sensitiveUnlockNeedsReentry: boolean;
      relationshipNeedsReview: boolean;
    }
  | {
      status: "conflict";
      localDraftId: string;
      baseUpdatedAt?: string;
      currentUpdatedAt: string;
      message: string;
    };

export function buildEditOrderOfflineDraftInput({
  data,
  draft,
  localDraftId,
}: {
  data: OrderDetail;
  draft: UpdateOrderInput;
  localDraftId?: string;
}): SaveRepairDeskOfflineOrderDraftInput {
  return {
    localDraftId,
    localOrderId: data.order.id,
    mode: "edit",
    serverOrderId: data.order.id,
    baseUpdatedAt: draft.expected_updated_at,
    draftPayload: buildEditOrderOfflineDraftPayload(draft),
    relationshipPlan: buildEditOrderOfflineRelationshipPlan(data),
    hasSensitiveVaultEntry: false,
  };
}

export function buildEditOrderOfflineDraftPayload(
  draft: UpdateOrderInput,
): RepairDeskOfflineSafeRecord {
  const repairItems = draft.fault_prices
    .map((item) => ({
      ...(item.line_id ? { line_id: item.line_id } : {}),
      ...(item.catalog_key ? { catalog_key: item.catalog_key } : {}),
      name: item.name.trim(),
      price: normalizeMoneyNumber(item.price),
      currency_code: item.currency_code,
      note: item.note?.trim() ?? "",
    }))
    .filter((item) => item.name || item.price > 0 || item.note);
  const quotedPriceCents = repairItems.reduce((sum, item) => sum + moneyToCents(item.price), 0);

  return {
    depositAmountCents: moneyToCents(draft.deposit_amount ?? 0),
    quotedPriceCents,
    repairItems,
  };
}

export function buildEditOrderOfflineRelationshipPlan(
  data: OrderDetail,
): RepairDeskOfflineRelationshipPlan {
  const customerId = data.customer?.id ?? data.order.customer_id;
  const deviceId = data.device?.id ?? data.order.device_id;

  return {
    customerLinkMode: "existing_customer",
    customerLinkDraft: {
      customerId,
    },
    deviceLinkMode: "existing_customer_device",
    deviceLinkDraft: {
      deviceId,
    },
  };
}

export function restoreEditOrderFormFromOfflineDraft({
  draft,
  data,
  defaultWarrantyMonths = 6,
}: {
  draft: RepairDeskOfflineOrderDraft;
  data: OrderDetail;
  defaultWarrantyMonths?: number;
}): EditOrderOfflineDraftRestoreResult {
  if (draft.mode !== "edit" || draft.serverOrderId !== data.order.id) {
    return {
      status: "conflict",
      localDraftId: draft.localDraftId,
      baseUpdatedAt: draft.baseUpdatedAt,
      currentUpdatedAt: data.order.updated_at,
      message: "本机草稿不属于当前工单，已阻止恢复。",
    };
  }

  if (!draft.baseUpdatedAt || draft.baseUpdatedAt !== data.order.updated_at) {
    return {
      status: "conflict",
      localDraftId: draft.localDraftId,
      baseUpdatedAt: draft.baseUpdatedAt,
      currentUpdatedAt: data.order.updated_at,
      message: "工单已被更新，本机草稿需要人工对照后重新编辑。",
    };
  }

  const base = buildEditForm(data, defaultWarrantyMonths);
  const payload = draft.draftPayload;
  const repairItems = readRepairItems(payload.repairItems);

  return {
    status: "restored",
    draft: {
      ...base,
      expected_updated_at: draft.baseUpdatedAt,
      // Local editing now restores the quote only. Legacy identity and repair fields
      // must never acquire the current customer version and overwrite newer records.
      fault_prices: Array.isArray(payload.repairItems) ? repairItems : base.fault_prices,
      deposit_amount: centsToMoney(readNumber(payload.depositAmountCents)) ?? base.deposit_amount,
      device_unlock: base.device_unlock,
    },
    sensitiveUnlockNeedsReentry: draft.hasSensitiveVaultEntry,
    relationshipNeedsReview:
      draft.customerLinkMode !== "existing_customer" ||
      draft.deviceLinkMode !== "existing_customer_device",
  };
}

export function isEditOrderFormWorthOfflineAutosave({
  data,
  draft,
  defaultWarrantyMonths = 6,
}: {
  data: OrderDetail;
  draft: UpdateOrderInput;
  defaultWarrantyMonths?: number;
}): boolean {
  const base = buildEditForm(data, defaultWarrantyMonths);
  return (
    getEditOrderOfflineDraftFingerprint({ data, draft }) !==
    getEditOrderOfflineDraftFingerprint({ data, draft: base })
  );
}

export function getEditOrderOfflineDraftFingerprint({
  data,
  draft,
}: {
  data: OrderDetail;
  draft: UpdateOrderInput;
}): string {
  return JSON.stringify({
    draftPayload: buildEditOrderOfflineDraftPayload(draft),
    relationshipPlan: buildEditOrderOfflineRelationshipPlan(data),
    hasSensitiveVaultEntry: false,
  });
}

export function hasEditOrderSensitiveUnlockDraft(draft: UpdateOrderInput | null): boolean {
  const unlock = draft?.device_unlock;
  if (!unlock) return false;
  if (unlock.method === "text" || unlock.method === "pin") return Boolean(unlock.value.trim());
  if (unlock.method === "pattern") return unlock.pattern.length > 0;
  return false;
}

function readRepairItems(value: unknown): FaultPriceItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = readRecord(item);
      const name = readString(record.name) ?? "";
      const price = readNumber(record.price) ?? 0;
      const note = readString(record.note) ?? "";
      const currencyCode = readString(record.currency_code);
      return {
        line_id: ensureOrderLineId(readString(record.line_id)),
        ...(readString(record.catalog_key) ? { catalog_key: readString(record.catalog_key) } : {}),
        name,
        price,
        ...(currencyCode ? { currency_code: currencyCode as FaultPriceItem["currency_code"] } : {}),
        ...(note ? { note } : {}),
      };
    })
    .filter((item) => item.name.trim() || item.price > 0 || item.note?.trim());
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

function normalizeMoneyNumber(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function moneyToCents(value: number) {
  return Math.round(normalizeMoneyNumber(value) * 100);
}

function centsToMoney(value: number | undefined) {
  return typeof value === "number" ? value / 100 : undefined;
}
