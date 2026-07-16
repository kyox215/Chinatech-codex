import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { AuditActor, StoreRole } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";

import type {
  RepairDeskOfflineOperationClaimInput,
  RepairDeskOfflineOperationClaimResult,
  RepairDeskOfflineOperationCompletionInput,
  RepairDeskOfflineOperationStorePort,
  RepairDeskOfflineSyncServicePorts,
} from "./offline-sync-service";
import {
  createRepairDeskOfflineSyncService,
  parseRepairDeskOfflineSyncServiceError,
} from "./offline-sync-service";
import type { RepairDeskOfflineStoredOperation } from "./offline-sync-contract";

const baseActor: AuditActor = {
  id: "00000000-0000-4000-8000-000000000101",
  email: "staff@example.com",
  displayName: "Staff",
  storeId: "00000000-0000-4000-8000-000000000201",
  storeName: "ChinaTech",
};

function actor(role: StoreRole, overrides: Partial<AuditActor> = {}): AuditActor {
  return {
    ...baseActor,
    role,
    storeRole: role,
    ...overrides,
  };
}

function validCreatePayload(overrides: Record<string, unknown> = {}) {
  return {
    operationId: "op:create:9f001",
    expectedStoreId: baseActor.storeId,
    baseClientCreatedAt: "2026-07-07T10:00:00.000Z",
    payload: {
      relationshipPlan: {
        customer: {
          mode: "existing_customer",
          customerId: "customer_1",
          customerUpdatedAt: "2026-07-07T09:59:00.000Z",
        },
        device: {
          mode: "existing_customer_device",
          deviceId: "device_1",
          deviceUpdatedAt: "2026-07-07T09:59:00.000Z",
        },
      },
      order: {
        order_type: "quick_repair",
        device_custody_status: "with_shop",
        issue_description: "Display rotto",
        fault_prices: [{ name: "Display", price: 89, currency_code: "EUR" }],
      },
    },
    ...overrides,
  };
}

function validUpdatePayload(overrides: Record<string, unknown> = {}) {
  return {
    operationId: "op:update:9f001",
    baseClientCreatedAt: "2026-07-07T10:01:00.000Z",
    payload: {
      serverOrderId: "order_1",
      baseUpdatedAt: "2026-07-07T10:00:00.000Z",
      changes: {
        issue_description: "Display e batteria",
      },
    },
    ...overrides,
  };
}

class FakeOperationStore implements RepairDeskOfflineOperationStorePort {
  rows = new Map<string, RepairDeskOfflineStoredOperation>();
  completions: RepairDeskOfflineOperationCompletionInput[] = [];
  claims: RepairDeskOfflineOperationClaimInput[] = [];

  async claimOperation(
    input: RepairDeskOfflineOperationClaimInput,
  ): Promise<RepairDeskOfflineOperationClaimResult> {
    this.claims.push(input);
    const key = this.key(input);
    const existing = this.rows.get(key);
    if (existing) return { status: "existing", operation: existing };

    this.rows.set(key, {
      requestHash: input.requestHash,
      status: "started",
      updatedAt: input.nowIso,
    });
    return { status: "claimed" };
  }

  async completeOperation(input: RepairDeskOfflineOperationCompletionInput): Promise<void> {
    this.completions.push(input);
    this.rows.set(this.key(input), {
      requestHash: input.requestHash,
      status: input.status,
      resultCode: input.resultCode,
      responseSummary: input.responseSummary,
      updatedAt: input.nowIso,
    });
  }

  private key(input: {
    storeId: string;
    actorId: string;
    operationType: string;
    operationId: string;
  }) {
    return `${input.storeId}:${input.actorId}:${input.operationType}:${input.operationId}`;
  }
}

function createPorts(
  overrides: Partial<RepairDeskOfflineSyncServicePorts> = {},
): RepairDeskOfflineSyncServicePorts & { operationStore: FakeOperationStore } {
  const operationStore = new FakeOperationStore();
  const ports: RepairDeskOfflineSyncServicePorts = {
    operationStore,
    getRequestHashSecret: () => "local-test-secret-for-slice-9f",
    now: () => "2026-07-07T10:02:00.000Z",
    validateCreateRelationships: vi.fn(async () => ({ ok: true as const })),
    validateUpdateTarget: vi.fn(async () => ({ ok: true as const, scopeSatisfied: true })),
    executeCreate: vi.fn(async () => ({
      resultCode: "synced" as const,
      responseSummary: {
        serverOrderId: "order_1",
        publicNo: "RD-0001",
        updatedAt: "2026-07-07T10:02:00.000Z",
      },
      targetEntityId: "order_1",
    })),
    executeUpdate: vi.fn(async () => ({
      resultCode: "synced" as const,
      responseSummary: {
        serverOrderId: "order_1",
        updatedAt: "2026-07-07T10:02:00.000Z",
      },
      targetEntityId: "order_1",
    })),
    ...overrides,
  };
  return { ...ports, operationStore };
}

describe("offline sync service draft", () => {
  it("runs a local-only order create through strict schema, relationship validation, claim, write, and completion", async () => {
    const ports = createPorts();
    const service = createRepairDeskOfflineSyncService(ports);

    const result = await service.syncOrderCreate(validCreatePayload(), actor("sales"));

    expect(result).toMatchObject({
      operationId: "op:create:9f001",
      operationType: "order_create",
      resultCode: "synced",
      handlerResult: { status: "synced", serverOrderId: "order_1" },
    });
    expect(result.requestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(ports.validateCreateRelationships).toHaveBeenCalledTimes(1);
    expect(ports.executeCreate).toHaveBeenCalledTimes(1);
    expect(ports.operationStore.completions).toHaveLength(1);
    expect(ports.operationStore.completions[0]).toMatchObject({
      status: "succeeded",
      resultCode: "synced",
      targetEntityType: "repair_order",
      targetEntityId: "order_1",
    });
    expect(result.auditMetadata).toEqual({
      operationId: "op:create:9f001",
      operationType: "order_create",
      requestHash: result.requestHash,
      resultCode: "synced",
      target: { entityType: "repair_order", entityId: "order_1" },
    });
  });

  it("replays the same operation and payload without calling the write executor again", async () => {
    const ports = createPorts();
    const service = createRepairDeskOfflineSyncService(ports);

    const first = await service.syncOrderCreate(validCreatePayload(), actor("sales"));
    const replay = await service.syncOrderCreate(validCreatePayload(), actor("sales"));

    expect(first.resultCode).toBe("synced");
    expect(replay.resultCode).toBe("synced");
    expect(replay.handlerResult).toEqual({ status: "synced", serverOrderId: "order_1" });
    expect(ports.executeCreate).toHaveBeenCalledTimes(1);
    expect(ports.operationStore.completions).toHaveLength(1);
  });

  it("returns idempotency conflict for same operation key with a different canonical payload", async () => {
    const ports = createPorts();
    const service = createRepairDeskOfflineSyncService(ports);

    await service.syncOrderCreate(validCreatePayload(), actor("sales"));
    const conflict = await service.syncOrderCreate(
      validCreatePayload({
        payload: {
          ...validCreatePayload().payload,
          order: {
            ...validCreatePayload().payload.order,
            issue_description: "Different issue",
          },
        },
      }),
      actor("sales"),
    );

    expect(conflict.resultCode).toBe("idempotency_conflict");
    expect(conflict.handlerResult).toEqual({ status: "conflict" });
    expect(ports.executeCreate).toHaveBeenCalledTimes(1);
  });

  it("blocks duplicate or ambiguous relationship plans as needs_review before write execution", async () => {
    const ports = createPorts({
      validateCreateRelationships: vi.fn(async () => ({
        ok: false as const,
        resultCode: "needs_review" as const,
        errorCode: "duplicate_customer",
      })),
    });
    const service = createRepairDeskOfflineSyncService(ports);

    const result = await service.syncOrderCreate(validCreatePayload(), actor("sales"));

    expect(result.resultCode).toBe("needs_review");
    expect(result.handlerResult).toEqual({ status: "blocked" });
    expect(ports.executeCreate).not.toHaveBeenCalled();
    expect(ports.operationStore.completions[0]).toMatchObject({
      status: "blocked",
      resultCode: "needs_review",
      errorCode: "duplicate_customer",
    });
  });

  it("classifies stale update targets as conflict and never executes the write", async () => {
    const ports = createPorts({
      validateUpdateTarget: vi.fn(async () => ({
        ok: false as const,
        resultCode: "stale_version" as const,
        errorCode: "base_updated_at_stale",
      })),
    });
    const service = createRepairDeskOfflineSyncService(ports);

    const result = await service.syncOrderUpdate(validUpdatePayload(), actor("sales"));

    expect(result.resultCode).toBe("stale_version");
    expect(result.handlerResult).toEqual({ status: "conflict" });
    expect(ports.executeUpdate).not.toHaveBeenCalled();
    expect(ports.operationStore.completions[0]).toMatchObject({
      status: "conflict",
      resultCode: "stale_version",
      errorCode: "base_updated_at_stale",
    });
  });

  it("uses scoped update permission after target validation", async () => {
    const ports = createPorts({
      validateUpdateTarget: vi.fn(async () => ({ ok: true as const, scopeSatisfied: false })),
    });
    const service = createRepairDeskOfflineSyncService(ports);

    const result = await service.syncOrderUpdate(validUpdatePayload(), actor("technician"));

    expect(result.resultCode).toBe("forbidden");
    expect(result.handlerResult).toEqual({ status: "blocked" });
    expect(ports.executeUpdate).not.toHaveBeenCalled();
    expect(ports.operationStore.completions[0]).toMatchObject({
      status: "blocked",
      resultCode: "forbidden",
      errorCode: "forbidden",
    });
  });

  it("rejects viewer create permission before claiming an operation", async () => {
    const ports = createPorts();
    const service = createRepairDeskOfflineSyncService(ports);

    await expect(service.syncOrderCreate(validCreatePayload(), actor("viewer"))).rejects.toThrow(
      ForbiddenError,
    );
    expect(ports.operationStore.claims).toHaveLength(0);
    expect(ports.executeCreate).not.toHaveBeenCalled();
  });

  it("rejects missing actor identity and system actors before claiming an operation", async () => {
    const ports = createPorts();
    const service = createRepairDeskOfflineSyncService(ports);

    await expect(
      service.syncOrderCreate(validCreatePayload(), actor("sales", { id: undefined })),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      service.syncOrderCreate(validCreatePayload(), {
        displayName: "系统",
        isSystem: true,
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(ports.operationStore.claims).toHaveLength(0);
    expect(ports.executeCreate).not.toHaveBeenCalled();
  });

  it("fails closed when the HMAC secret is missing or too short", async () => {
    const ports = createPorts({
      getRequestHashSecret: () => "",
    });
    const service = createRepairDeskOfflineSyncService(ports);

    await expect(service.syncOrderCreate(validCreatePayload(), actor("sales"))).rejects.toThrow(
      "at least 16 characters",
    );
    expect(ports.operationStore.claims).toHaveLength(0);
    expect(ports.executeCreate).not.toHaveBeenCalled();
  });

  it("allows at most one business write for ten concurrent identical operations", async () => {
    const ports = createPorts();
    const service = createRepairDeskOfflineSyncService(ports);

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        service.syncOrderCreate(validCreatePayload(), actor("sales")),
      ),
    );

    expect(ports.executeCreate).toHaveBeenCalledTimes(1);
    expect(ports.operationStore.completions).toHaveLength(1);
    expect(results.filter((result) => result.resultCode === "synced")).toHaveLength(1);
    expect(results.filter((result) => result.resultCode === "retryable_error")).toHaveLength(9);
  });

  it("maps internal executor failures to retryable_error without leaking raw messages", async () => {
    const ports = createPorts({
      executeCreate: vi.fn(async () => {
        throw new Error("database host private.internal.local failed for customer phone");
      }),
    });
    const service = createRepairDeskOfflineSyncService(ports);

    const result = await service.syncOrderCreate(validCreatePayload(), actor("sales"));

    expect(result.resultCode).toBe("retryable_error");
    expect(result.handlerResult).toEqual({ status: "retryable_error" });
    expect(JSON.stringify(result.auditMetadata)).not.toContain("private.internal.local");
    expect(JSON.stringify(result.auditMetadata)).not.toContain("customer phone");
    expect(ports.operationStore.completions[0]).toMatchObject({
      status: "failed",
      resultCode: "retryable_error",
      errorCode: "retryable_error",
    });
  });

  it("fails closed when executors return unsafe operation summaries or error codes", async () => {
    const cases = [
      {
        operationId: "op:create:unsafe-response",
        leakedText: "+39 333 000 0000",
        executeCreate: vi.fn(async () => ({
          resultCode: "synced" as const,
          responseSummary: {
            serverOrderId: "order_1",
            phone: "+39 333 000 0000",
          },
          targetEntityId: "order_1",
        })),
      },
      {
        operationId: "op:create:unsafe-error-code",
        leakedText: "raw_customer_phone",
        executeCreate: vi.fn(async () => ({
          resultCode: "needs_review" as const,
          responseSummary: {
            serverOrderId: "order_1",
          },
          errorCode: "raw_customer_phone",
        })),
      },
    ];

    for (const testCase of cases) {
      const ports = createPorts({
        executeCreate: testCase.executeCreate,
      });
      const service = createRepairDeskOfflineSyncService(ports);

      const result = await service.syncOrderCreate(
        validCreatePayload({ operationId: testCase.operationId }),
        actor("sales"),
      );
      const persistedCompletion = JSON.stringify(ports.operationStore.completions[0]);

      expect(result.resultCode).toBe("retryable_error");
      expect(result.handlerResult).toEqual({ status: "retryable_error" });
      expect(result.responseSummary).toBeUndefined();
      expect(testCase.executeCreate).toHaveBeenCalledTimes(1);
      expect(ports.operationStore.completions[0]).toMatchObject({
        status: "failed",
        resultCode: "retryable_error",
        errorCode: "retryable_error",
      });
      expect(persistedCompletion).not.toContain(testCase.leakedText);
    }
  });

  it("converts invalid payload and permission errors to stable generic API error bodies", async () => {
    let invalidPayloadError: unknown;
    try {
      await createRepairDeskOfflineSyncService(createPorts()).syncOrderCreate(
        { operationId: "bad" },
        actor("sales"),
      );
    } catch (error) {
      invalidPayloadError = error;
    }

    expect(parseRepairDeskOfflineSyncServiceError(invalidPayloadError)).toEqual({
      status: 400,
      body: { code: "blocked_operation", message: "Offline sync payload is invalid." },
    });

    expect(parseRepairDeskOfflineSyncServiceError(new ForbiddenError("raw role detail"))).toEqual({
      status: 403,
      body: { code: "forbidden", message: "Offline sync is not allowed." },
    });
    expect(parseRepairDeskOfflineSyncServiceError(new Error("private sql failure"))).toEqual({
      status: 500,
      body: { code: "retryable_error", message: "Offline sync failed. Please retry later." },
    });
  });

  it("does not import broad order APIs, router wrappers, realtime, network, or Supabase clients", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/offline/server/offline-sync-service.ts"),
      "utf8",
    );

    expect(source).not.toContain("@/features/orders/server");
    expect(source).not.toContain("@/server/api/repairdesk-router");
    expect(source).not.toContain("@/lib/repairdesk/api");
    expect(source).not.toContain("createOrder(");
    expect(source).not.toContain("updateOrder(");
    expect(source).not.toContain("patchOrder(");
    expect(source).not.toContain("auditGeneric");
    expect(source).not.toContain("queueRepairDeskRealtimeBroadcast");
    expect(source).not.toContain("realtime-broadcast");
    expect(source).not.toContain("getSupabase");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("WebSocket");
    expect(source).not.toContain("EventSource");
  });
});
