import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";

import {
  createCustomerFollowup,
  sendCustomerMessage,
  upsertCustomerDevice,
} from "./customer.repository";

const mocks = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => mocks.supabase,
}));

const storeActor: AuditActor = {
  id: "staff_1",
  email: "staff@example.com",
  displayName: "Staff",
  storeId: "store_1",
  storeName: "ChinaTech",
  storeRole: "technician",
};

describe("customer repository tenant write boundaries", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
  });

  it("blocks device upsert when the customer is outside the active store", async () => {
    const customerQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from.mockReturnValueOnce(customerQuery);

    await expect(
      upsertCustomerDevice("customer_2", { brand: "Apple", model: "iPhone 15 Pro" }, storeActor),
    ).rejects.toThrow("客户不存在");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
    expect(mocks.supabase.from).toHaveBeenCalledWith("customers");
    expect(customerQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
    expect(customerQuery.eq).toHaveBeenCalledWith("id", "customer_2");
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("devices");
  });

  it("blocks followup creation when the linked order is not in the same store and customer", async () => {
    const customerQuery = createSupabaseQuery({ data: { id: "customer_1" }, error: null });
    const orderQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from.mockReturnValueOnce(customerQuery).mockReturnValueOnce(orderQuery);

    await expect(
      createCustomerFollowup(
        "customer_1",
        {
          order_id: "ord_2",
          title: "回访报价",
          due_at: "2026-07-05T10:00:00.000Z",
        },
        storeActor,
      ),
    ).rejects.toThrow("关联工单不存在或不属于当前客户");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(2);
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(1, "customers");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(2, "repair_orders");
    expect(orderQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
    expect(orderQuery.eq).toHaveBeenCalledWith("customer_id", "customer_1");
    expect(orderQuery.eq).toHaveBeenCalledWith("id", "ord_2");
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("customer_followups");
  });

  it("blocks outbound customer messages before writing interactions for another store", async () => {
    const customerQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from.mockReturnValueOnce(customerQuery);

    await expect(
      sendCustomerMessage(
        "customer_2",
        { channel: "whatsapp", body: "您的维修报价已更新" },
        storeActor,
      ),
    ).rejects.toThrow("客户不存在");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
    expect(mocks.supabase.from).toHaveBeenCalledWith("customers");
    expect(customerQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
    expect(customerQuery.eq).toHaveBeenCalledWith("id", "customer_2");
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("customer_interactions");
  });
});

function createSupabaseQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(() => result),
    insert: vi.fn(() => result),
    update: vi.fn(() => query),
  };
  return query;
}
