import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { AuditActor, StoreRole } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";

import {
  assertRepairDeskOfflineOperationMetadataSafe,
  assertRepairDeskOfflineOrderCreatePermission,
  assertRepairDeskOfflineOrderUpdatePermission,
  createRepairDeskOfflineCanonicalJson,
  createRepairDeskOfflineRequestHash,
  mapRepairDeskOfflineServerResultCodeToHandlerResult,
  repairDeskOfflineOrderCreateSyncSchema,
  repairDeskOfflineOrderUpdateSyncSchema,
  resolveRepairDeskOfflineOperationReplay,
  resolveRepairDeskOfflineOrderUpdateActions,
} from "./offline-sync-contract";

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

function validCreatePayload() {
  return {
    operationId: "op:create:001",
    baseClientCreatedAt: "2026-07-07T08:00:00.000Z",
    payload: {
      relationshipPlan: {
        customer: {
          mode: "new_customer_local",
          localCustomerId: "customer-local-001",
          snapshot: {
            name: "Cliente",
            phoneRaw: "+39 333 000 0000",
            language: "it",
          },
        },
        device: {
          mode: "new_customer_device_local",
          localDeviceId: "device-local-001",
          snapshot: {
            brand: "Apple",
            model: "iPhone 15",
            serialOrImei: "IMEI-LOCAL-REDACTED",
          },
        },
      },
      order: {
        order_type: "quick_repair",
        issue_description: "Schermo rotto",
        accessory_notes: "Custodia presente",
        fault_prices: [{ name: "Display", price: 89, currency_code: "EUR" }],
        deposit_amount: 20,
      },
    },
  };
}

function validUpdatePayload() {
  return {
    operationId: "op:update:001",
    baseClientCreatedAt: "2026-07-07T08:02:00.000Z",
    payload: {
      serverOrderId: "order_001",
      baseUpdatedAt: "2026-07-07T08:01:00.000Z",
      changes: {
        issue_description: "Display e batteria",
      },
    },
  };
}

describe("offline sync contract schemas", () => {
  it("accepts narrow order create payloads with explicit customer and device relationship plans", () => {
    const parsed = repairDeskOfflineOrderCreateSyncSchema.parse(validCreatePayload());

    expect(parsed.payload.relationshipPlan.customer.mode).toBe("new_customer_local");
    expect(parsed.payload.relationshipPlan.device.mode).toBe("new_customer_device_local");
    expect(parsed.payload.order.order_type).toBe("quick_repair");
  });

  it("rejects high-risk and unexpected create fields before hashing or writing", () => {
    const dangerous = [
      { status: "completed" },
      { device_unlock: { method: "pin", value: "1234" } },
      { payment_status: "paid" },
      { whatsapp_body: "ready" },
      { attachment_storage_path: "private/order/file.jpg" },
      { customer_id: "customer_1" },
    ];

    for (const extra of dangerous) {
      expect(() =>
        repairDeskOfflineOrderCreateSyncSchema.parse({
          ...validCreatePayload(),
          payload: {
            ...validCreatePayload().payload,
            order: { ...validCreatePayload().payload.order, ...extra },
          },
        }),
      ).toThrow();
    }
  });

  it("rejects unexpected relationship snapshot fields that could mutate customer or device master data", () => {
    expect(() =>
      repairDeskOfflineOrderCreateSyncSchema.parse({
        ...validCreatePayload(),
        payload: {
          ...validCreatePayload().payload,
          relationshipPlan: {
            ...validCreatePayload().payload.relationshipPlan,
            customer: {
              mode: "new_customer_local",
              localCustomerId: "customer-local-001",
              snapshot: {
                name: "Cliente",
                phoneRaw: "+39 333 000 0000",
                consent_sms: true,
              },
            },
          },
        },
      }),
    ).toThrow();
  });

  it("accepts only narrow order update fields and requires optimistic baseUpdatedAt", () => {
    expect(repairDeskOfflineOrderUpdateSyncSchema.parse(validUpdatePayload())).toMatchObject({
      payload: {
        serverOrderId: "order_001",
        baseUpdatedAt: "2026-07-07T08:01:00.000Z",
      },
    });

    expect(() =>
      repairDeskOfflineOrderUpdateSyncSchema.parse({
        ...validUpdatePayload(),
        payload: { ...validUpdatePayload().payload, baseUpdatedAt: "" },
      }),
    ).toThrow();
  });

  it("rejects empty update changes and high-risk update fields", () => {
    expect(() =>
      repairDeskOfflineOrderUpdateSyncSchema.parse({
        ...validUpdatePayload(),
        payload: { ...validUpdatePayload().payload, changes: {} },
      }),
    ).toThrow();

    for (const extra of [
      { customer_phone: "+39 333 111 1111" },
      { device_unlock: { method: "pin", value: "1234" } },
      { status: "completed" },
      { payment_status: "paid" },
      { parts_supplier_id: "supplier_1" },
      { whatsapp_body: "ready" },
      { attachment_storage_path: "private/order/file.jpg" },
    ]) {
      expect(() =>
        repairDeskOfflineOrderUpdateSyncSchema.parse({
          ...validUpdatePayload(),
          payload: {
            ...validUpdatePayload().payload,
            changes: { ...validUpdatePayload().payload.changes, ...extra },
          },
        }),
      ).toThrow();
    }
  });
});

describe("offline sync canonical hash and idempotency decisions", () => {
  it("creates stable canonical JSON and ignores undefined object fields", () => {
    const left = createRepairDeskOfflineCanonicalJson({
      b: 2,
      a: { d: undefined, c: 1 },
      list: [{ z: "last", a: "first" }],
    });
    const right = createRepairDeskOfflineCanonicalJson({
      list: [{ a: "first", z: "last" }],
      a: { c: 1 },
      b: 2,
    });

    expect(left).toBe(right);
    expect(left).toBe('{"a":{"c":1},"b":2,"list":[{"a":"first","z":"last"}]}');
  });

  it("uses keyed HMAC so same payload hashes consistently and changed payloads differ", () => {
    const secret = "local-test-secret-for-offline-hmac";
    const first = createRepairDeskOfflineRequestHash(validCreatePayload(), secret);
    const second = createRepairDeskOfflineRequestHash(
      {
        payload: validCreatePayload().payload,
        baseClientCreatedAt: "2026-07-07T08:00:00.000Z",
        operationId: "op:create:001",
      },
      secret,
    );
    const changed = createRepairDeskOfflineRequestHash(
      {
        ...validCreatePayload(),
        payload: {
          ...validCreatePayload().payload,
          order: { ...validCreatePayload().payload.order, issue_description: "Different" },
        },
      },
      secret,
    );

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
    expect(changed).not.toBe(first);
    expect(() => createRepairDeskOfflineRequestHash(validCreatePayload(), "too-short")).toThrow();
  });

  it("maps same-key replay and different-payload conflict without touching business writes", () => {
    const requestHash = createRepairDeskOfflineRequestHash(
      validCreatePayload(),
      "local-test-secret-for-offline-hmac",
    );

    expect(resolveRepairDeskOfflineOperationReplay(null, requestHash)).toEqual({
      decision: "start",
    });
    expect(
      resolveRepairDeskOfflineOperationReplay(
        {
          requestHash,
          status: "succeeded",
          resultCode: "synced",
          responseSummary: { serverOrderId: "order_1", updatedAt: "2026-07-07T08:03:00.000Z" },
        },
        requestHash,
      ),
    ).toMatchObject({
      decision: "replay",
      responseSummary: { serverOrderId: "order_1" },
    });
    expect(
      resolveRepairDeskOfflineOperationReplay(
        {
          requestHash: "0".repeat(64),
          status: "succeeded",
        },
        requestHash,
      ),
    ).toEqual({ decision: "conflict", resultCode: "idempotency_conflict" });
  });

  it("classifies stale started rows for reviewed recovery while keeping fresh started rows retryable", () => {
    const requestHash = "a".repeat(64);

    expect(
      resolveRepairDeskOfflineOperationReplay(
        {
          requestHash,
          status: "started",
          updatedAt: "2026-07-07T08:00:00.000Z",
        },
        requestHash,
        { now: new Date("2026-07-07T08:10:00.000Z"), staleStartedAfterMs: 5 * 60 * 1_000 },
      ),
    ).toEqual({ decision: "recover_stale_started", resultCode: "retryable_error" });

    expect(
      resolveRepairDeskOfflineOperationReplay(
        {
          requestHash,
          status: "started",
          updatedAt: "2026-07-07T08:08:00.000Z",
        },
        requestHash,
        { now: new Date("2026-07-07T08:10:00.000Z"), staleStartedAfterMs: 5 * 60 * 1_000 },
      ),
    ).toEqual({ decision: "retryable_error", resultCode: "retryable_error" });
  });

  it("maps stable server result codes to local runner outcomes", () => {
    expect(
      mapRepairDeskOfflineServerResultCodeToHandlerResult("synced", { serverOrderId: "order_1" }),
    ).toEqual({ status: "synced", serverOrderId: "order_1" });
    expect(mapRepairDeskOfflineServerResultCodeToHandlerResult("idempotency_conflict")).toEqual({
      status: "conflict",
    });
    expect(mapRepairDeskOfflineServerResultCodeToHandlerResult("stale_version")).toEqual({
      status: "conflict",
    });
    expect(mapRepairDeskOfflineServerResultCodeToHandlerResult("forbidden")).toEqual({
      status: "blocked",
    });
    expect(mapRepairDeskOfflineServerResultCodeToHandlerResult("retryable_error")).toEqual({
      status: "retryable_error",
    });
  });
});

describe("offline sync permissions and safe metadata", () => {
  it("asserts role permissions through the server permission matrix", () => {
    expect(() => assertRepairDeskOfflineOrderCreatePermission(actor("viewer"))).toThrow(
      ForbiddenError,
    );
    expect(() => assertRepairDeskOfflineOrderCreatePermission(actor("sales"))).not.toThrow();
    expect(() =>
      assertRepairDeskOfflineOrderCreatePermission(actor("owner", { storeId: undefined })),
    ).toThrow(ForbiddenError);
  });

  it("splits offline update changes into intake and repair permissions", () => {
    expect(resolveRepairDeskOfflineOrderUpdateActions({ issue_description: "A" })).toEqual([
      "order:update_intake",
    ]);
    expect(resolveRepairDeskOfflineOrderUpdateActions({ diagnosis_result: "B" })).toEqual([
      "order:update_repair",
    ]);
    expect(
      resolveRepairDeskOfflineOrderUpdateActions({
        issue_description: "A",
        diagnosis_result: "B",
      }).sort(),
    ).toEqual(["order:update_intake", "order:update_repair"]);

    expect(() =>
      assertRepairDeskOfflineOrderUpdatePermission(actor("technician"), {
        issue_description: "A",
      }),
    ).toThrow(ForbiddenError);
    expect(() =>
      assertRepairDeskOfflineOrderUpdatePermission(
        actor("technician"),
        {
          issue_description: "A",
        },
        { scopeSatisfied: true },
      ),
    ).not.toThrow();
    expect(() =>
      assertRepairDeskOfflineOrderUpdatePermission(actor("sales"), { diagnosis_result: "B" }),
    ).toThrow(ForbiddenError);
    expect(() =>
      assertRepairDeskOfflineOrderUpdatePermission(
        actor("sales"),
        { diagnosis_result: "B" },
        {
          scopeSatisfied: true,
        },
      ),
    ).not.toThrow();
  });

  it("allows only minimal operation metadata and rejects sensitive audit/operation keys", () => {
    expect(() =>
      assertRepairDeskOfflineOperationMetadataSafe({
        operationId: "op:create:001",
        operationType: "order_create",
        requestHash: "a".repeat(64),
        resultCode: "synced",
        target: { entityType: "repair_order", entityId: "order_1" },
      }),
    ).not.toThrow();

    for (const metadata of [
      { phone: "+39 333 000 0000" },
      { email: "client@example.com" },
      { imei: "123456789012345" },
      { serial_or_imei: "123456789012345" },
      { device_unlock: { method: "pin", value: "1234" } },
      { storage_path: "private/order/file.jpg" },
      { signed_url: "https://example.invalid/private" },
      { message_body: "ready" },
      { recipient_phone: "+39 333 000 0000" },
    ]) {
      expect(() => assertRepairDeskOfflineOperationMetadataSafe(metadata)).toThrow();
    }
  });
});

describe("offline operation migration draft", () => {
  it("keeps the operation table server-only with idempotency constraints", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260707090000_repairdesk_offline_operations.sql"),
      "utf8",
    );

    expect(sql).toContain("create table if not exists public.repairdesk_offline_operations");
    expect(sql).toMatch(
      /repairdesk_offline_operations_unique_operation_idx\s+on public\.repairdesk_offline_operations/i,
    );
    expect(sql).toContain("request_hash ~ '^[a-f0-9]{64}$'");
    expect(sql).toContain(
      "alter table public.repairdesk_offline_operations enable row level security",
    );
    expect(sql).toContain("revoke all on table public.repairdesk_offline_operations from public");
    expect(sql).toContain("revoke all on table public.repairdesk_offline_operations from anon");
    expect(sql).toContain(
      "revoke all on table public.repairdesk_offline_operations from authenticated",
    );
    expect(sql).toContain(
      "grant all on table public.repairdesk_offline_operations to service_role",
    );
    expect(sql).not.toMatch(/create policy .*repairdesk_offline_operations/i);
  });
});
