import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor, OrderListItem, StoreRole } from "@/lib/repairdesk/types";

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  listOrders: vi.fn(async () => [] as OrderListItem[]),
}));

vi.mock("@/server/auth-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth-context")>()),
  getRequestActor: mocks.getRequestActor,
}));

vi.mock("@/server/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/supabase")>()),
  hasSupabaseConfig: () => true,
}));

vi.mock("@/shared/lib/e2e-auth-bypass", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/e2e-auth-bypass")>()),
  isRepairDeskE2eAuthBypassEnabled: () => false,
}));

vi.mock("@/features/orders/server/order.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/orders/server/order.service")>()),
  listOrders: mocks.listOrders,
}));

import { handleRepairDeskPost } from "./repairdesk-router";

describe("dashboard priority route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listOrders.mockResolvedValue([]);
  });

  it.each(["owner", "manager", "sales"] as const)(
    "returns a private store-scoped summary for %s",
    async (role) => {
      const requestActor = actor(role);
      const response = await handleRepairDeskPost(
        "dashboard/priority-summary",
        { limit: 8 },
        requestActor,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
      expect(mocks.listOrders).toHaveBeenCalledWith({ view: "active" }, requestActor);
      await expect(response.json()).resolves.toMatchObject({
        data: { coverage: "store", policyVersion: "dashboard-priority-v1", items: [] },
      });
    },
  );

  it("keeps technician coverage assigned and forwards the stable membership actor", async () => {
    const requestActor = actor("technician", { activeMembershipId: "membership-tech" });
    const response = await handleRepairDeskPost("dashboard/priority-summary", {}, requestActor);

    expect(response.status).toBe(200);
    expect(mocks.listOrders).toHaveBeenCalledWith({ view: "active" }, requestActor);
    await expect(response.json()).resolves.toMatchObject({ data: { coverage: "assigned" } });
  });

  it("returns a compact allowlist even when source rows contain sensitive order fields", async () => {
    mocks.listOrders.mockResolvedValueOnce([sensitiveOrder()]);

    const response = await handleRepairDeskPost("dashboard/priority-summary", {}, actor("owner"));
    const body = await response.json();
    const item = body.data.items[0];

    expect(item).toMatchObject({
      orderId: "order-sensitive",
      publicNo: "R-SYNTH-SEC",
      customerName: "Synthetic Customer",
      deviceLabel: "Synthetic Device",
      action: { href: "/orders/order-sensitive/task" },
    });
    expect(item).not.toHaveProperty("customer_phone");
    expect(item).not.toHaveProperty("device_imei");
    expect(item).not.toHaveProperty("assignee_membership_id");
    expect(item).not.toHaveProperty("quotation_amount");
    expect(item).not.toHaveProperty("device_unlock_value");
    expect(item).not.toHaveProperty("customer_signature");
    expect(JSON.stringify(item)).not.toContain("SECRET-SENTINEL");
  });

  it.each([actor("viewer"), actor("technician", { activeMembershipId: undefined })])(
    "returns 403 before reading any orders for unauthorized scope",
    async (requestActor) => {
      const response = await handleRepairDeskPost("dashboard/priority-summary", {}, requestActor);

      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
      expect(mocks.listOrders).not.toHaveBeenCalled();
    },
  );

  it("rejects caller-controlled store scope before reading orders", async () => {
    const response = await handleRepairDeskPost(
      "dashboard/priority-summary",
      { limit: 8, storeId: "other-store" },
      actor("owner"),
    );

    expect(response.status).toBe(400);
    expect(mocks.listOrders).not.toHaveBeenCalled();
  });

  it("returns fixed safe copy when the order reader fails", async () => {
    mocks.listOrders.mockRejectedValueOnce(
      new Error("database host and customer details must remain server-side"),
    );

    const response = await handleRepairDeskPost("dashboard/priority-summary", {}, actor("owner"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "优先队列暂时不可用" });
    expect(JSON.stringify(body)).not.toContain("database host");
  });
});

function actor(role: StoreRole, overrides: Partial<AuditActor> = {}): AuditActor {
  return {
    id: `staff-${role}`,
    displayName: role,
    role,
    storeRole: role,
    storeId: "store-1",
    activeMembershipId: role === "technician" ? "membership-tech" : `membership-${role}`,
    ...overrides,
  };
}

function sensitiveOrder(): OrderListItem {
  return {
    id: "order-sensitive",
    public_no: "R-SYNTH-SEC",
    order_type: "quick_repair",
    status: "new",
    device_custody_status: "with_shop",
    workflow_status: "intake",
    payment_status: "unpaid",
    approval_status: "pending",
    customer_id: "customer-sensitive",
    device_id: "device-sensitive",
    customer_name: "Synthetic Customer",
    customer_phone: "SECRET-SENTINEL-PHONE",
    device_label: "Synthetic Device",
    device_imei: "SECRET-SENTINEL-IMEI",
    issue_description: "SECRET-SENTINEL-ISSUE",
    quotation_amount: 999,
    deposit_amount: 1,
    balance_amount: 998,
    currency_code: "EUR",
    is_paid: false,
    technician_name: "Synthetic Owner",
    assignee_membership_id: "membership-owner",
    contact_phones: ["SECRET-SENTINEL-CONTACT"],
    fault_prices: [{ name: "SECRET-SENTINEL-PART", price: 999, currency_code: "EUR" }],
    device_unlock_value: "SECRET-SENTINEL-UNLOCK",
    customer_signature: "SECRET-SENTINEL-SIGNATURE",
    approval_overdue: false,
    pickup_overdue: false,
    created_at: "2026-07-16T08:00:00.000Z",
    updated_at: "2026-07-16T09:00:00.000Z",
  };
}
