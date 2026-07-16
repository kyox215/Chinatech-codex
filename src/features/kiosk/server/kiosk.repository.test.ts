import { beforeEach, describe, expect, it, vi } from "vitest";

import { acceptKioskSession } from "./kiosk.repository";

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
        if (sessionCall === 1) return createQuery({ data: sessionRow, error: null });
        if (sessionCall === 2) {
          return createQuery(
            { data: { ...sessionRow, status: "accepted" }, error: null },
            acceptedSessionUpdate,
          );
        }
        return createQuery({ data: null, error: null });
      }
      if (table === "repair_orders") {
        orderCall += 1;
        if (orderCall === 1 || orderCall === 2 || orderCall === 5) {
          return createQuery({
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
        return createQuery({ data: null, error: null }, (value) => {
          const updatedAt = (value as { updated_at?: unknown }).updated_at;
          if (typeof updatedAt === "string") currentOrderUpdatedAt = updatedAt;
        });
      }
      if (table === "customers") {
        const customerCall = mocks.from.mock.calls.filter(([name]) => name === "customers").length;
        if (customerCall === 1) {
          return createQuery({
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
        if (customerCall === 2) return createQuery({ data: [], error: null });
        return createQuery({ data: null, error: null });
      }
      return createQuery({ data: null, error: null });
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

function createQuery(
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
