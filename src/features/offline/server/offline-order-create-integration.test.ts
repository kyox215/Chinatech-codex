import { describe, expect, it, vi } from "vitest";

import { createRepairDeskOfflineOrderService } from "@/features/offline/model/offline-order-service";
import { buildRepairDeskOfflineOrderCreateSyncInput } from "@/features/offline/model/offline-order-sync-adapter";
import { createRepairDeskOfflineMemoryStore } from "@/features/offline/model/offline-store";
import { buildNewOrderOfflineDraftInput } from "@/features/orders/model/new-order-offline-draft";
import { initialNewOrderForm } from "@/features/orders/model/new-order-form";
import type { AuditActor } from "@/lib/repairdesk/types";

import { syncRepairDeskOfflineOrderCreate } from "./offline-order-create-sync";

describe("queued offline order create integration", () => {
  it("carries custody from draft through outbox and replays one idempotency key", async () => {
    const scope = { storeId: "store_1", userId: "staff_1" };
    const store = createRepairDeskOfflineMemoryStore();
    let id = 0;
    const service = createRepairDeskOfflineOrderService({
      store,
      scope,
      now: () => "2026-07-16T20:00:00.000Z",
      idFactory: () => `id_${(id += 1)}`,
    });
    const saved = await service.saveDraft(
      buildNewOrderOfflineDraftInput({
        form: {
          ...initialNewOrderForm,
          customerName: "Mario",
          customerPhone: "+393331112222",
          brand: "Apple",
          model: "iPhone 13",
          deviceCustodyStatus: "with_customer",
          faults: [
            {
              key: "display",
              categoryKey: "display",
              categoryLabel: "Display",
              name: "Display",
              price: 100,
            },
          ],
        },
      }),
    );
    if (!saved.ok) throw new Error(saved.error.message);
    const queued = await service.queueDraftForSync({ localDraftId: saved.value.localDraftId });
    if (!queued.ok) throw new Error(queued.error.message);

    const input = buildRepairDeskOfflineOrderCreateSyncInput(queued.value.outboxEntry);
    const hashes: string[] = [];
    const rpc = vi.fn(async (_input, context: { requestHash: string }) => {
      hashes.push(context.requestHash);
      return {
        resultCode: hashes.length === 1 ? "synced" : "idempotent_replay",
        responseSummary: {
          serverOrderId: "order_1",
          updatedAt: "2026-07-16T20:01:00.000Z",
          deviceCustodyStatus: "with_customer",
        },
      };
    });
    const syncOptions = {
      isEnabled: () => true,
      getSecret: () => "integration-offline-secret-001",
      assertLifecycleActive: vi.fn(async () => undefined),
      rpc,
    };
    const actor: AuditActor = {
      id: scope.userId,
      displayName: "Staff",
      role: "sales",
      storeRole: "sales",
      storeId: scope.storeId,
    };

    const first = await syncRepairDeskOfflineOrderCreate(input, actor, syncOptions);
    const replay = await syncRepairDeskOfflineOrderCreate(input, actor, syncOptions);

    expect(input.payload.order.device_custody_status).toBe("with_customer");
    expect(first.handlerResult).toEqual({ status: "synced", serverOrderId: "order_1" });
    expect(replay.handlerResult).toEqual({ status: "synced", serverOrderId: "order_1" });
    expect(hashes).toHaveLength(2);
    expect(hashes[1]).toBe(hashes[0]);
    expect(queued.value.outboxEntry.operationId).toBe(input.operationId);
  });
});
