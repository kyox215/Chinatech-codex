import { describe, expect, it } from "vitest";

import type { OrderListItem, OrderStats } from "@/lib/repairdesk/types";

import { buildDashboardWorkInsight } from "./dashboard-work-insights";

const baseStats: OrderStats = {
  total: 8,
  today: 2,
  inProgress: 3,
  unpaid: 0,
  approvalOverdue: 0,
  pickupOverdue: 0,
};

function makeOrder(overrides: Partial<OrderListItem>): OrderListItem {
  return {
    id: overrides.id ?? "order_1",
    public_no: overrides.public_no ?? "SEA-000001",
    order_type: overrides.order_type ?? "quick_repair",
    status: overrides.status ?? "received",
    workflow_status: overrides.workflow_status ?? "intake",
    customer_id: overrides.customer_id ?? "customer_1",
    device_id: overrides.device_id ?? "device_1",
    issue_description: overrides.issue_description ?? "screen",
    quotation_amount: overrides.quotation_amount ?? 0,
    deposit_amount: overrides.deposit_amount ?? 0,
    balance_amount: overrides.balance_amount ?? 0,
    currency_code: overrides.currency_code ?? "EUR",
    is_paid: overrides.is_paid ?? true,
    approval_status: overrides.approval_status ?? "pending",
    technician_name: overrides.technician_name ?? "ALESSIO",
    contact_phones: overrides.contact_phones ?? [],
    fault_prices: overrides.fault_prices ?? [],
    customer_name: overrides.customer_name ?? "Mario Rossi",
    customer_phone: overrides.customer_phone ?? "+39333",
    device_label: overrides.device_label ?? "APPLE iPhone 13",
    device_imei: overrides.device_imei ?? "",
    approval_overdue: overrides.approval_overdue ?? false,
    pickup_overdue: overrides.pickup_overdue ?? false,
    created_at: overrides.created_at ?? "2026-06-18T08:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-06-18T08:00:00.000Z",
  };
}

describe("dashboard work insights", () => {
  it("prioritizes overdue quotation approval before other work", () => {
    const insight = buildDashboardWorkInsight(
      { ...baseStats, approvalOverdue: 2, unpaid: 5, pickupOverdue: 1 },
      [makeOrder({ public_no: "SEA-004920", approval_overdue: true })],
    );

    expect(insight.tone).toBe("danger");
    expect(insight.headline).toContain("报价确认");
    expect(insight.primaryHref).toBe("/orders/order_1");
    expect(insight.reasons).toContain("2 个报价超期");
  });

  it("routes pickup reminders when quotation queue is clear", () => {
    const insight = buildDashboardWorkInsight({ ...baseStats, pickupOverdue: 3, unpaid: 1 }, [
      makeOrder({ id: "pickup_1", pickup_overdue: true }),
    ]);

    expect(insight.tone).toBe("warn");
    expect(insight.primaryLabel).toBe("查看取机");
    expect(insight.primaryHref).toBe("/orders/pickup_1");
  });

  it("points to customers when there are no orders", () => {
    const insight = buildDashboardWorkInsight({
      total: 0,
      today: 0,
      inProgress: 0,
      unpaid: 0,
      approvalOverdue: 0,
      pickupOverdue: 0,
    });

    expect(insight.tone).toBe("neutral");
    expect(insight.primaryHref).toBe("/customers");
    expect(insight.reasons).toEqual(["无待处理工单"]);
  });
});
