import { describe, expect, it } from "vitest";

import { repairDeskOfflineOrderCreateSyncSchema } from "@/features/offline/server/offline-sync-contract";

import {
  buildRepairDeskOfflineOrderCreateSyncInput,
  classifyRepairDeskOfflineOrderSyncError,
} from "./offline-order-sync-adapter";
import type { RepairDeskOfflineOutboxEntry } from "./offline-types";

describe("offline order create sync adapter", () => {
  it("maps a queued new customer/device order with explicit custody and deposit", () => {
    const input = buildRepairDeskOfflineOrderCreateSyncInput(entry());
    const parsed = repairDeskOfflineOrderCreateSyncSchema.parse(input);

    expect(parsed).toMatchObject({
      operationId: "offline_op_001",
      payload: {
        relationshipPlan: {
          customer: {
            mode: "new_customer_local",
            localCustomerId: "local_customer_001",
            snapshot: { name: "Mario", phoneRaw: "+393331112222" },
          },
          device: {
            mode: "new_customer_device_local",
            localDeviceId: "local_device_001",
            snapshot: { brand: "Apple", model: "iPhone 13" },
          },
        },
        order: {
          device_custody_status: "with_customer",
          deposit_amount: 20,
          fault_prices: [{ name: "Display", price: 100, currency_code: "EUR" }],
        },
      },
    });
    expect(JSON.stringify(parsed).toLowerCase()).not.toContain("unlock");
  });

  it("blocks non-new workflow states before the network call", () => {
    expect(() =>
      buildRepairDeskOfflineOrderCreateSyncInput(
        entry({ payload: { ...entry().payload, orderStatus: "repairing" } }),
      ),
    ).toThrow("只能从“新工单”状态开始");
  });

  it("keeps a temporary active-store mismatch retryable", () => {
    expect(
      classifyRepairDeskOfflineOrderSyncError(new Error("离线工单需要切回原店铺后再同步")),
    ).toEqual({ status: "retryable_error" });
    expect(classifyRepairDeskOfflineOrderSyncError(new Error("请先确认设备是否留店"))).toEqual({
      status: "blocked",
    });
  });
});

function entry(
  overrides: Partial<RepairDeskOfflineOutboxEntry> = {},
): RepairDeskOfflineOutboxEntry {
  return {
    operationId: "offline_op_001",
    localOrderId: "local_order_001",
    storeId: "store_1",
    userId: "user_1",
    domain: "orders",
    action: "create",
    payload: {
      orderType: "quick_repair",
      orderStatus: "new",
      customerName: "Mario",
      customerPhone: "+393331112222",
      deviceBrand: "Apple",
      deviceModel: "iPhone 13",
      deviceCustody: "with_customer",
      issueDescription: "Schermo rotto",
      accessoryNotes: "Custodia",
      depositAmountCents: 2_000,
      repairItems: [{ name: "Display", price: 100 }],
      warrantyDraft: { text: "6 mesi", months: 6 },
    },
    relationshipPlan: {
      customerLinkMode: "new_customer_local",
      customerLinkDraft: {
        localCustomerId: "local_customer_001",
        snapshot: { name: "Mario", phone: "+393331112222" },
      },
      deviceLinkMode: "new_customer_device_local",
      deviceLinkDraft: {
        localDeviceId: "local_device_001",
        snapshot: { brand: "Apple", model: "iPhone 13" },
      },
    },
    createdAtLocal: "2026-07-16T20:00:00.000Z",
    retryCount: 0,
    status: "pending_sync",
    sensitiveVaultEntryIds: [],
    attachmentStagingIds: [],
    ...overrides,
  };
}
