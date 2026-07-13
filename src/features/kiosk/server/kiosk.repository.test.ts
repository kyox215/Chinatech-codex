import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";

import {
  acceptKioskSession,
  listKioskSessions,
  pairKioskDevice,
  revokeKioskDevice,
  submitKioskPublicSession,
} from "./kiosk.repository";

const mocks = vi.hoisted(() => {
  const from = vi.fn();
  const storageFrom = vi.fn();
  return {
    from,
    storageFrom,
    supabase: { from, storage: { from: storageFrom } },
  };
});

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => mocks.supabase,
}));

describe("kiosk repository pickup acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a signed pickup after its own phone/signature writes and processes it once", async () => {
    const initialUpdatedAt = "2026-07-16T20:00:00.000Z";
    let currentOrderUpdatedAt = initialUpdatedAt;
    let orderCall = 0;
    let sessionCall = 0;
    const acceptedSessionUpdate = vi.fn();
    const sessionRow = {
      id: "session_1",
      store_id: "store_1",
      device_id: "device_1",
      order_id: "order_1",
      customer_id: "customer_1",
      session_type: "pickup_signature",
      status: "submitted",
      request_payload: {},
      submission_payload: {
        customer_phone: "+39 333 111 2222",
        confirmation_checked: true,
        signature_data_url:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      },
      submission_version: 1,
      expires_at: "2026-07-16T21:00:00.000Z",
      submitted_at: initialUpdatedAt,
      created_at: initialUpdatedAt,
      updated_at: initialUpdatedAt,
    };

    mocks.storageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === "customer_kiosk_sessions") {
        sessionCall += 1;
        if (sessionCall === 1) return createPickupQuery({ data: sessionRow, error: null });
        if (sessionCall === 2) {
          return createPickupQuery(
            { data: { ...sessionRow, status: "accepted" }, error: null },
            acceptedSessionUpdate,
          );
        }
        return createPickupQuery({ data: null, error: null });
      }
      if (table === "repair_orders") {
        orderCall += 1;
        if (orderCall === 1 || orderCall === 2 || orderCall === 5) {
          return createPickupQuery({
            data: {
              id: "order_1",
              customer_id: "customer_1",
              contact_phones: [],
              device_custody_status: "with_shop",
              updated_at: currentOrderUpdatedAt,
            },
            error: null,
          });
        }
        return createPickupQuery({ data: null, error: null }, (value) => {
          const updatedAt = (value as { updated_at?: unknown }).updated_at;
          if (typeof updatedAt === "string") currentOrderUpdatedAt = updatedAt;
        });
      }
      if (table === "customers") {
        const customerCall = mocks.from.mock.calls.filter(([name]) => name === "customers").length;
        if (customerCall === 1) {
          return createPickupQuery({
            data: {
              id: "customer_1",
              name: "Mock Customer",
              phone_e164: "+39 333 000 0000",
              phone_raw: "393330000000",
              contact_phones: [],
              preferred_channel: "whatsapp",
              language: "it",
            },
            error: null,
          });
        }
        if (customerCall === 2) return createPickupQuery({ data: [], error: null });
        return createPickupQuery({ data: null, error: null });
      }
      return createPickupQuery({ data: null, error: null });
    });

    const actor = {
      id: "staff_1",
      displayName: "Staff",
      role: "owner" as const,
      storeRole: "owner" as const,
      storeId: "store_1",
    };

    await expect(acceptKioskSession("session_1", actor)).resolves.toMatchObject({
      id: "session_1",
      status: "accepted",
    });
    expect(currentOrderUpdatedAt).not.toBe(initialUpdatedAt);
    expect(acceptedSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "accepted", updated_at: currentOrderUpdatedAt }),
    );
    await expect(acceptKioskSession("session_1", actor)).rejects.toThrow("没有可审核");
  });
});

function createPickupQuery(
  result: { data: unknown; error: unknown },
  onUpdate?: (value: unknown) => void,
) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    update: vi.fn((value: unknown) => {
      onUpdate?.(value);
      return query;
    }),
    insert: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    maybeSingle: vi.fn(() => query),
  };
  return query;
}

const actor: AuditActor = {
  id: "owner-1",
  displayName: "Owner",
  email: "owner@example.com",
  emailVerified: true,
  storeId: "5248dda1-2b32-46cd-8ed0-d15386a9e8ed",
  storeName: "Store A",
  storeRole: "owner",
};

describe("kiosk repository local safety contracts", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
  });

  it("never returns a raw signature data URL in the staff session list", async () => {
    const query = createQuery({
      data: [sessionRow({ signature_data_url: "data:image/png;base64,SECRET" })],
      error: null,
    });
    mocks.supabase.from.mockReturnValue(query);

    const sessions = await listKioskSessions(actor);

    expect(sessions[0]?.submission_payload).toMatchObject({ has_signature: true });
    expect(sessions[0]?.submission_payload).not.toHaveProperty("signature_data_url");
    expect(query.eq).toHaveBeenCalledWith("store_id", actor.storeId);
  });

  it("requires a store-scoped affected row before reporting device revocation success", async () => {
    const query = createQuery({ data: null, error: null });
    mocks.supabase.from.mockReturnValue(query);

    await expect(revokeKioskDevice("device-b", actor)).rejects.toThrow(
      "不存在、不属于当前店铺或已撤销",
    );
    expect(query.eq).toHaveBeenCalledWith("store_id", actor.storeId);
    expect(query.eq).toHaveBeenCalledWith("id", "device-b");
    expect(query.neq).toHaveBeenCalledWith("status", "revoked");
  });

  it("claims a pairing code with code, store, status, and expiry CAS conditions", async () => {
    const pairing = createQuery({
      data: deviceRow({ status: "pairing", pairing_code_expires_at: "2099-07-13T00:00:00.000Z" }),
      error: null,
    });
    const claim = createQuery({ data: deviceRow({ status: "active" }), error: null });
    mocks.supabase.from.mockReturnValueOnce(pairing).mockReturnValueOnce(claim);

    await expect(pairKioskDevice("ABCD1234")).resolves.toMatchObject({
      token: expect.any(String),
      device: { status: "active", store_id: actor.storeId },
    });

    const pairingHash = pairing.eq.mock.calls.find(([field]) => field === "pairing_code_hash")?.[1];
    expect(pairingHash).toEqual(expect.any(String));
    expect(claim.eq).toHaveBeenCalledWith("pairing_code_hash", pairingHash);
    expect(claim.eq).toHaveBeenCalledWith("store_id", actor.storeId);
    expect(claim.in).toHaveBeenCalledWith("status", ["pairing", "active"]);
    expect(claim.gt).toHaveBeenCalledWith("pairing_code_expires_at", expect.any(String));
  });

  it("rejects a lost public submit CAS instead of reporting duplicate success", async () => {
    const tokenLookup = createQuery({ data: deviceRow({ status: "active" }), error: null });
    const sessionLookup = createQuery({ data: sessionRow(), error: null });
    const update = createQuery({ data: null, error: null });
    mocks.supabase.from
      .mockReturnValueOnce(tokenLookup)
      .mockReturnValueOnce(sessionLookup)
      .mockReturnValueOnce(update);

    await expect(
      submitKioskPublicSession("valid-device-token-with-more-than-24-chars", {
        customer_name: "Cliente",
        customer_phone: "+39 333 000 0000",
        confirmation_checked: true,
      }),
    ).rejects.toThrow("当前任务已变化");

    expect(update.eq).toHaveBeenCalledWith("store_id", actor.storeId);
    expect(update.eq).toHaveBeenCalledWith("device_id", "device-a");
    expect(update.eq).toHaveBeenCalledWith("submission_version", 1);
    expect(update.in).toHaveBeenCalledWith("status", ["queued", "active", "returned"]);
    expect(update.gt).toHaveBeenCalledWith("expires_at", expect.any(String));
  });
});

function createQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, ReturnType<typeof vi.fn>> & {
    then?: PromiseLike<typeof result>["then"];
  } = {};
  for (const method of [
    "select",
    "insert",
    "update",
    "eq",
    "neq",
    "in",
    "gt",
    "lte",
    "order",
    "limit",
  ]) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn(async () => result);
  query.single = vi.fn(async () => result);
  query.then = (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected);
  return query;
}

function deviceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "device-a",
    store_id: actor.storeId,
    label: "Front iPad",
    status: "active",
    paired_at: "2026-07-13T00:00:00.000Z",
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}

function sessionRow(submissionPayload: Record<string, unknown> = {}) {
  return {
    id: "session-a",
    store_id: actor.storeId,
    device_id: "device-a",
    session_type: "intake_contact",
    status: "active",
    request_payload: {},
    submission_payload: submissionPayload,
    submission_version: 1,
    expires_at: "2099-07-13T00:00:00.000Z",
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:00:00.000Z",
  };
}
