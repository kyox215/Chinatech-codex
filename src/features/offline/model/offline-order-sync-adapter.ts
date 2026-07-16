import type { RepairDeskOfflineOrderCreateSyncInput } from "@/features/offline/server/offline-sync-contract";

import type { RepairDeskOfflineOutboxSyncHandlerResult } from "./offline-outbox-sync-runner";
import type { RepairDeskOfflineOutboxEntry, RepairDeskOfflineSafeRecord } from "./offline-types";

export function classifyRepairDeskOfflineOrderSyncError(
  error: unknown,
): RepairDeskOfflineOutboxSyncHandlerResult {
  if (!(error instanceof Error)) return { status: "retryable_error" };
  if (error.message.includes("切回原店铺")) return { status: "retryable_error" };
  return /\u9700\u8981|\u7f3a\u5c11|\u53ea\u80fd|\u8bf7\u5148/.test(error.message)
    ? { status: "blocked" }
    : { status: "retryable_error" };
}

export function buildRepairDeskOfflineOrderCreateSyncInput(
  entry: RepairDeskOfflineOutboxEntry,
): RepairDeskOfflineOrderCreateSyncInput {
  if (entry.action !== "create") {
    throw new Error("当前同步通道只支持新建工单。");
  }

  const payload = entry.payload;
  if (readString(payload.orderStatus) !== "new") {
    throw new Error("离线新建只能从“新工单”状态开始。");
  }

  const custody = readString(payload.deviceCustody);
  if (custody !== "with_shop" && custody !== "with_customer") {
    throw new Error("请先确认设备是否留店。");
  }

  const repairItems = readRecords(payload.repairItems).flatMap((item) => {
    const name = readString(item.name);
    if (!name) return [];
    const note = readString(item.note);
    return [
      {
        name,
        price: readMoney(item.price),
        currency_code: "EUR" as const,
        ...(note ? { note } : {}),
      },
    ];
  });

  const issueDescription =
    readString(payload.issueDescription) ||
    repairItems.map((item) => item.name).join("，") ||
    "客户未补充故障描述，按所选故障项目检测。";
  const warranty = readRecord(payload.warrantyDraft);

  return {
    operationId: entry.operationId,
    expectedStoreId: entry.storeId,
    baseClientCreatedAt: entry.createdAtLocal,
    payload: {
      relationshipPlan: {
        customer: buildCustomerRelationship(entry),
        device: buildDeviceRelationship(entry),
      },
      order: {
        order_type: readOrderType(payload.orderType),
        device_custody_status: custody,
        issue_description: issueDescription,
        ...(readString(payload.accessoryNotes)
          ? { accessory_notes: readString(payload.accessoryNotes) }
          : {}),
        ...(readString(warranty.text) ? { warranty_text: readString(warranty.text) } : {}),
        ...(readWarrantyMonths(warranty.months) !== undefined
          ? { warranty_months: readWarrantyMonths(warranty.months) }
          : {}),
        ...(readString(warranty.changeReason)
          ? { warranty_change_reason: readString(warranty.changeReason) }
          : {}),
        fault_prices: repairItems,
        deposit_amount: readMoneyFromCents(payload.depositAmountCents),
      },
    },
  };
}

function buildCustomerRelationship(
  entry: RepairDeskOfflineOutboxEntry,
): RepairDeskOfflineOrderCreateSyncInput["payload"]["relationshipPlan"]["customer"] {
  const draft = entry.relationshipPlan.customerLinkDraft;
  if (entry.relationshipPlan.customerLinkMode === "existing_customer" && draft?.customerId) {
    return {
      mode: "existing_customer",
      customerId: draft.customerId,
      ...(draft.customerUpdatedAt ? { customerUpdatedAt: draft.customerUpdatedAt } : {}),
    };
  }

  if (entry.relationshipPlan.customerLinkMode !== "new_customer_local") {
    throw new Error("客户关联需要联网后人工确认。");
  }
  const snapshot = readRecord(draft?.snapshot);
  const phone = readString(snapshot.phone);
  const localCustomerId = draft?.localCustomerId;
  if (!localCustomerId || !phone) {
    throw new Error("离线新建缺少可同步的客户电话。");
  }
  return {
    mode: "new_customer_local",
    localCustomerId,
    snapshot: {
      name: readString(snapshot.name) || phone || "Cliente",
      phoneRaw: phone,
      language: "it",
    },
  };
}

function buildDeviceRelationship(
  entry: RepairDeskOfflineOutboxEntry,
): RepairDeskOfflineOrderCreateSyncInput["payload"]["relationshipPlan"]["device"] {
  const draft = entry.relationshipPlan.deviceLinkDraft;
  if (entry.relationshipPlan.deviceLinkMode === "existing_customer_device" && draft?.deviceId) {
    return { mode: "existing_customer_device", deviceId: draft.deviceId };
  }

  if (entry.relationshipPlan.deviceLinkMode !== "new_customer_device_local") {
    throw new Error("设备关联需要联网后人工确认。");
  }
  const snapshot = readRecord(draft?.snapshot);
  const brand = readString(snapshot.brand);
  const model = readString(snapshot.model);
  const localDeviceId = draft?.localDeviceId;
  if (!localDeviceId || !brand || !model) {
    throw new Error("离线新建缺少可同步的设备品牌或型号。");
  }
  return {
    mode: "new_customer_device_local",
    localDeviceId,
    snapshot: {
      brand,
      model,
      ...(readString(snapshot.imei) ? { serialOrImei: readString(snapshot.imei) } : {}),
      ...(readString(snapshot.deviceNotes)
        ? { deviceNotes: readString(snapshot.deviceNotes) }
        : {}),
    },
  };
}

function readOrderType(value: unknown): "quick_repair" | "dropoff_repair" {
  return value === "dropoff_repair" ? "dropoff_repair" : "quick_repair";
}

function readWarrantyMonths(value: unknown): 0 | 3 | 6 | 12 | 24 | undefined {
  return value === 0 || value === 3 || value === 6 || value === 12 || value === 24
    ? value
    : undefined;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readMoney(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function readMoneyFromCents(value: unknown) {
  return Math.round(readMoney(value)) / 100;
}

function readRecord(value: unknown): RepairDeskOfflineSafeRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as RepairDeskOfflineSafeRecord)
    : {};
}

function readRecords(value: unknown) {
  return Array.isArray(value) ? value.map(readRecord) : [];
}
