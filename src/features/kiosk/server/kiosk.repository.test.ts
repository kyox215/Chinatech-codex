import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";

import {
  acceptKioskSession,
  createKioskSession,
  listKioskSessions,
  pairKioskDevice,
  returnKioskSession,
  revokeKioskDevice,
  submitKioskPublicSession,
} from "./kiosk.repository";

const mocks = vi.hoisted(() => {
  const from = vi.fn();
  const storageFrom = vi.fn();
  return {
    from,
    storageFrom,
    assertStoreLifecycleActive: vi.fn(),
    supabase: { from, storage: { from: storageFrom } },
  };
});

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => mocks.supabase,
}));

vi.mock("@/features/stores/server/store-lifecycle-access", () => ({
  assertStoreLifecycleActive: mocks.assertStoreLifecycleActive,
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

    await expect(
      acceptKioskSession({ id: "session_1", expected_submission_version: 1 }, actor),
    ).resolves.toMatchObject({
      id: "session_1",
      status: "accepted",
    });
    expect(currentOrderUpdatedAt).not.toBe(initialUpdatedAt);
    expect(acceptedSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "accepted", updated_at: currentOrderUpdatedAt }),
    );
    await expect(
      acceptKioskSession({ id: "session_1", expected_submission_version: 1 }, actor),
    ).rejects.toThrow("没有可审核");
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

  it("rejects an unbound technician before cancelling an existing kiosk session", async () => {
    const technician: AuditActor = {
      ...actor,
      id: "tech-1",
      storeRole: "technician",
      activeMembershipId: "membership-tech-1",
    };
    mocks.supabase.from.mockReturnValueOnce(
      createQuery({ data: deviceRow({ id: "device-a" }), error: null }),
    );

    await expect(
      createKioskSession({ device_id: "device-a", session_type: "intake_contact" }, technician),
    ).rejects.toThrow("没有权限");

    expect(mocks.supabase.from).not.toHaveBeenCalledWith("customer_kiosk_sessions");
  });

  it.each([
    {
      label: "the order is voided",
      actor,
      latest: orderRow({ record_state: "voided", deleted_at: "2026-07-17T00:00:00.000Z" }),
      message: "已作废",
    },
    {
      label: "pickup custody moves to the customer",
      actor,
      latest: orderRow({ device_custody_status: "with_customer" }),
      message: "门店保管",
    },
    {
      label: "the technician assignment changes",
      actor: {
        ...actor,
        id: "tech-1",
        storeRole: "technician" as const,
        activeMembershipId: "membership-tech-1",
      },
      latest: orderRow({ assignee_membership_id: "membership-tech-2" }),
      message: "没有权限",
    },
  ])("revalidates $label before cancelling the previous task", async (testCase) => {
    const initial = orderRow({ assignee_membership_id: "membership-tech-1" });
    mocks.supabase.from
      .mockReturnValueOnce(createQuery({ data: deviceRow(), error: null }))
      .mockReturnValueOnce(createQuery({ data: initial, error: null }))
      .mockReturnValueOnce(createQuery({ data: testCase.latest, error: null }));

    await expect(
      createKioskSession(
        {
          device_id: "device-a",
          order_id: "order-a",
          session_type: "pickup_signature",
        },
        testCase.actor,
      ),
    ).rejects.toThrow(testCase.message);

    expect(mocks.supabase.from).not.toHaveBeenCalledWith("customer_kiosk_sessions");
  });

  it("allows an assigned technician while preserving both pre-write scope checks", async () => {
    const technician: AuditActor = {
      ...actor,
      id: "tech-1",
      storeRole: "technician",
      activeMembershipId: "membership-tech-1",
    };
    const assignedOrder = orderRow({ assignee_membership_id: "membership-tech-1" });
    const cancelled = createQuery({ data: null, error: null });
    const created = createQuery({
      data: {
        ...sessionRow(),
        id: "session-created",
        order_id: "order-a",
        status: "queued",
        submission_payload: {},
        submission_version: 0,
      },
      error: null,
    });
    mocks.supabase.from
      .mockReturnValueOnce(createQuery({ data: deviceRow(), error: null }))
      .mockReturnValueOnce(createQuery({ data: assignedOrder, error: null }))
      .mockReturnValueOnce(createQuery({ data: assignedOrder, error: null }))
      .mockReturnValueOnce(cancelled)
      .mockReturnValueOnce(created)
      .mockReturnValueOnce(createQuery({ data: null, error: null }));

    await expect(
      createKioskSession(
        {
          device_id: "device-a",
          order_id: "order-a",
          session_type: "order_contact_signature",
        },
        technician,
      ),
    ).resolves.toMatchObject({ id: "session-created", order_id: "order-a" });

    expect(cancelled.update).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
    expect(created.insert).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: "order-a", requested_by: expect.any(String) }),
    );
  });

  it("rejects review of a voided order before touching customer or signature data", async () => {
    const submitted = createQuery({
      data: {
        ...sessionRow({ confirmation_checked: true }),
        order_id: "order-a",
        session_type: "pickup_signature",
        status: "submitted",
        submission_version: 2,
      },
      error: null,
    });
    const voidedOrder = createQuery({
      data: {
        id: "order-a",
        customer_id: "customer-a",
        contact_phones: [],
        device_custody_status: "with_shop",
        record_state: "voided",
        deleted_at: "2026-07-17T00:00:00.000Z",
        updated_at: "2026-07-17T00:00:00.000Z",
      },
      error: null,
    });
    mocks.supabase.from.mockReturnValueOnce(submitted).mockReturnValueOnce(voidedOrder);

    await expect(
      acceptKioskSession({ id: "session-a", expected_submission_version: 2 }, actor),
    ).rejects.toThrow("已作废");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(2);
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("customers");
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
    ).rejects.toThrow("L'attività è cambiata. Aggiorna il modulo e riprova.");

    expect(update.eq).toHaveBeenCalledWith("store_id", actor.storeId);
    expect(update.eq).toHaveBeenCalledWith("device_id", "device-a");
    expect(update.eq).toHaveBeenCalledWith("submission_version", 1);
    expect(update.in).toHaveBeenCalledWith("status", ["queued", "active", "returned"]);
    expect(update.gt).toHaveBeenCalledWith("expires_at", expect.any(String));
  });

  it("binds both the review read and return CAS to the submission version staff viewed", async () => {
    const submitted = createQuery({
      data: {
        ...sessionRow({
          confirmation_checked: true,
          signature_data_url: "data:image/png;base64,SECRET",
        }),
        status: "submitted",
        submission_version: 3,
      },
      error: null,
    });
    const returned = createQuery({
      data: {
        ...sessionRow({
          confirmation_checked: true,
          customer_return_reason: "请重新确认",
        }),
        status: "returned",
        submission_version: 3,
        returned_at: "2026-07-13T01:00:00.000Z",
      },
      error: null,
    });
    mocks.supabase.from.mockReturnValueOnce(submitted).mockReturnValueOnce(returned);

    await returnKioskSession(
      {
        id: "session-a",
        expected_submission_version: 3,
        reason: "请重新确认",
      },
      actor,
    );

    expect(submitted.eq).toHaveBeenCalledWith("submission_version", 3);
    expect(returned.eq).toHaveBeenCalledWith("submission_version", 3);
    const updatePayload = returned.update.mock.calls[0]?.[0] as {
      submission_payload?: Record<string, unknown>;
    };
    expect(updatePayload.submission_payload).toMatchObject({
      has_signature: true,
      customer_return_reason: "请重新确认",
    });
    expect(updatePayload.submission_payload).not.toHaveProperty("signature_data_url");
  });

  it("binds accept to the viewed version and prunes a raw signature without an attachment", async () => {
    const submitted = createQuery({
      data: {
        ...sessionRow({
          customer_name: "Cliente",
          customer_phone: "+39 333 000 0000",
          confirmation_checked: true,
          signature_data_url: "data:image/png;base64,SECRET",
        }),
        status: "submitted",
        submission_version: 4,
        customer_id: "customer-a",
      },
      error: null,
    });
    const customer = createQuery({
      data: {
        id: "customer-a",
        name: "Old Name",
        phone_e164: "+393330000000",
        phone_raw: "393330000000",
        contact_phones: [],
      },
      error: null,
    });
    const phoneAvailability = createQuery({ data: [], error: null });
    const customerUpdate = createQuery({ data: null, error: null });
    const accepted = createQuery({
      data: {
        ...sessionRow({
          customer_name: "Cliente",
          customer_phone: "+39 333 000 0000",
          confirmation_checked: true,
          has_signature: true,
        }),
        status: "accepted",
        submission_version: 4,
        customer_id: "customer-a",
        accepted_by: actor.displayName,
        accepted_at: "2026-07-13T01:00:00.000Z",
      },
      error: null,
    });
    mocks.supabase.from
      .mockReturnValueOnce(submitted)
      .mockReturnValueOnce(customer)
      .mockReturnValueOnce(phoneAvailability)
      .mockReturnValueOnce(customerUpdate)
      .mockReturnValueOnce(accepted);

    await expect(
      acceptKioskSession({ id: "session-a", expected_submission_version: 4 }, actor),
    ).resolves.toMatchObject({ status: "accepted", submission_version: 4 });

    expect(submitted.eq).toHaveBeenCalledWith("submission_version", 4);
    expect(accepted.eq).toHaveBeenCalledWith("submission_version", 4);
    const updatePayload = accepted.update.mock.calls[0]?.[0] as {
      submission_payload?: Record<string, unknown>;
    };
    expect(updatePayload.submission_payload).toMatchObject({ has_signature: true });
    expect(updatePayload.submission_payload).not.toHaveProperty("signature_data_url");
  });

  it("rejects accept when the final viewed-version CAS loses", async () => {
    const submitted = createQuery({
      data: {
        ...sessionRow({
          customer_name: "Cliente",
          customer_phone: "+39 333 000 0000",
          confirmation_checked: true,
        }),
        status: "submitted",
        submission_version: 5,
        customer_id: "customer-a",
      },
      error: null,
    });
    const customer = createQuery({
      data: {
        id: "customer-a",
        name: "Old Name",
        phone_e164: "+393330000000",
        phone_raw: "393330000000",
        contact_phones: [],
      },
      error: null,
    });
    const phoneAvailability = createQuery({ data: [], error: null });
    const customerUpdate = createQuery({ data: null, error: null });
    const lostCas = createQuery({ data: null, error: null });
    mocks.supabase.from
      .mockReturnValueOnce(submitted)
      .mockReturnValueOnce(customer)
      .mockReturnValueOnce(phoneAvailability)
      .mockReturnValueOnce(customerUpdate)
      .mockReturnValueOnce(lostCas);

    await expect(
      acceptKioskSession({ id: "session-a", expected_submission_version: 5 }, actor),
    ).rejects.toThrow("已被处理");

    expect(submitted.eq).toHaveBeenCalledWith("submission_version", 5);
    expect(lostCas.eq).toHaveBeenCalledWith("submission_version", 5);
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

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-a",
    store_id: actor.storeId,
    public_no: "R0000001",
    customer_id: "customer-a",
    status: "repairing",
    record_state: "active",
    deleted_at: null,
    assignee_membership_id: "membership-owner",
    device_custody_status: "with_shop",
    customer_name: "Cliente",
    customer_phone: "+39 333 000 0000",
    device_label: "iPhone 15",
    balance_amount: 0,
    updated_at: "2026-07-17T00:00:00.000Z",
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
