import { describe, expect, it } from "vitest";

import type { OrderListItem } from "@/lib/repairdesk/types";

import { buildDashboardPrioritySummary } from "./dashboard-priority";

const now = new Date("2026-07-16T12:00:00.000Z");

describe("dashboard priority", () => {
  it("ranks every active candidate before applying the limit", () => {
    const ordinary = Array.from({ length: 60 }, (_, index) =>
      order({
        id: `ordinary-${index}`,
        public_no: `R${index + 1}`,
        status: "repairing",
        created_at: `2026-07-${String((index % 9) + 1).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );
    const urgent = order({
      id: "urgent-beyond-page",
      public_no: "R999",
      status: "waiting_approval",
      approval_overdue: true,
      approval_sent_at: "2026-07-01T08:00:00.000Z",
    });

    const summary = buildDashboardPrioritySummary([...ordinary, urgent], {
      coverage: "store",
      limit: 8,
      now,
    });

    expect(summary.items).toHaveLength(8);
    expect(summary.items[0]).toMatchObject({
      orderId: "urgent-beyond-page",
      reasonCode: "approval_overdue",
      rank: 1,
    });
    expect(summary.totalCandidates).toBe(61);
    expect(summary.hasMore).toBe(true);
  });

  it("uses the documented overdue, ready, active, and waiting tier order", () => {
    const summary = buildDashboardPrioritySummary(
      [
        order({ id: "waiting", status: "parts_ordered" }),
        order({ id: "active", status: "diagnosing" }),
        order({ id: "arrived", status: "parts_arrived" }),
        order({ id: "repaired", status: "repaired" }),
        order({ id: "rework", status: "rework" }),
        order({ id: "pickup", status: "waiting_pickup", pickup_overdue: true }),
        order({ id: "approval", status: "waiting_approval", approval_overdue: true }),
      ],
      { coverage: "store", limit: 20, now },
    );

    expect(summary.items.map((item) => item.orderId)).toEqual([
      "approval",
      "pickup",
      "rework",
      "repaired",
      "arrived",
      "active",
      "waiting",
    ]);
    expect(summary.counts).toEqual({ overdue: 2, ready: 3, active: 1, waiting: 1 });
  });

  it("sorts same-reason work by the oldest valid business timestamp with stable ties", () => {
    const summary = buildDashboardPrioritySummary(
      [
        order({ id: "id-z", public_no: "R10", approval_overdue: true, approval_sent_at: "bad" }),
        order({
          id: "id-b",
          public_no: "R2",
          approval_overdue: true,
          approval_sent_at: "2026-07-02T00:00:00.000Z",
          created_at: "2026-07-01T00:00:00.000Z",
        }),
        order({
          id: "id-a",
          public_no: "R1",
          approval_overdue: true,
          approval_sent_at: "2026-07-02T00:00:00.000Z",
          created_at: "2026-07-01T00:00:00.000Z",
        }),
        order({
          id: "oldest",
          public_no: "R20",
          approval_overdue: true,
          approval_sent_at: "2026-07-01T00:00:00.000Z",
        }),
      ],
      { coverage: "store", limit: 20, now },
    );

    expect(summary.items.map((item) => item.orderId)).toEqual(["oldest", "id-a", "id-b", "id-z"]);
  });

  it("excludes terminal work and never promotes an unpaid order", () => {
    const summary = buildDashboardPrioritySummary(
      [
        order({ id: "completed", status: "completed", is_paid: false }),
        order({ id: "cancelled", status: "cancelled", is_paid: false }),
        order({ id: "new-unpaid", status: "new", is_paid: false }),
        order({ id: "waiting-paid", status: "parts_ordered", is_paid: true }),
      ],
      { coverage: "store", limit: 20, now },
    );

    expect(summary.items.map((item) => item.orderId)).toEqual(["new-unpaid", "waiting-paid"]);
    expect(summary.items.every((item) => !item.reasonLabel.includes("付款"))).toBe(true);
  });

  it("returns only explainable task guidance and a display-only assignment projection", () => {
    const summary = buildDashboardPrioritySummary(
      [
        order({
          id: "mine",
          status: "waiting_approval",
          workflow_status: "quote",
          approval_overdue: true,
          assignee_membership_id: "membership-me",
          technician_name: "Luca",
        }),
        order({
          id: "unassigned",
          assignee_membership_id: undefined,
          technician_name: "",
        }),
      ],
      {
        coverage: "assigned",
        currentMembershipId: "membership-me",
        limit: 20,
        now,
      },
    );

    expect(summary.items[0]).toMatchObject({
      currentStep: "等待客户确认报价",
      nextStep: expect.stringContaining("联系客户"),
      assigneeLabel: "Luca",
      assigneeState: "assigned",
      isMine: true,
      action: { href: "/orders/mine/task" },
      detailHref: "/orders?workspace=order-detail&orderId=mine&source=dashboard",
    });
    expect(summary.items[1]).toMatchObject({
      assigneeLabel: "未分配",
      assigneeState: "unassigned",
      isMine: false,
    });
    expect(summary.items[0]).not.toHaveProperty("assigneeMembershipId");
    expect(summary.items[0]).not.toHaveProperty("quotationAmount");
    expect(summary.items[0]).not.toHaveProperty("phone");
  });

  it("keeps canonical waiting and paused side states out of the actionable queue", () => {
    const summary = buildDashboardPrioritySummary(
      [
        order({
          id: "approval-side-state",
          status: "quoted",
          workflow_status: "quote",
          approval_flow_status: "waiting_customer",
        }),
        order({
          id: "paused-side-state",
          status: "repairing",
          workflow_status: "repair",
          exception_status: "paused",
        }),
        order({
          id: "unrepairable-side-state",
          status: "diagnosing",
          workflow_status: "diagnosis",
          exception_status: "unrepairable",
        }),
      ],
      { coverage: "store", limit: 20, now },
    );

    expect(summary.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          orderId: "approval-side-state",
          tier: "waiting",
          reasonCode: "waiting_customer",
          isActionable: false,
          action: expect.objectContaining({ label: "查看跟进" }),
        }),
        expect.objectContaining({
          orderId: "paused-side-state",
          tier: "waiting",
          reasonCode: "paused",
          isActionable: false,
          action: expect.objectContaining({ label: "查看暂停原因" }),
        }),
        expect.objectContaining({
          orderId: "unrepairable-side-state",
          tier: "waiting",
          reasonCode: "unrepairable",
          isActionable: false,
          action: expect.objectContaining({ label: "联系客户" }),
        }),
      ]),
    );
    expect(summary.counts.waiting).toBe(3);
    expect(summary.counts.active).toBe(0);
  });

  it("aligns classification-specific task buttons with the visible next step", () => {
    const summary = buildDashboardPrioritySummary(
      [
        order({ id: "parts-wait", status: "parts_ordered" }),
        order({ id: "parts-ready", status: "parts_arrived" }),
        order({ id: "rework", status: "rework" }),
      ],
      { coverage: "store", limit: 20, now },
    );

    expect(summary.items.find((item) => item.orderId === "parts-wait")?.action.label).toBe(
      "查看跟进",
    );
    expect(summary.items.find((item) => item.orderId === "parts-ready")?.action.label).toBe(
      "继续维修",
    );
    expect(summary.items.find((item) => item.orderId === "rework")?.action.label).toBe(
      "开始返修检测",
    );
  });

  it("routes customer-held devices to receipt instead of physical repair or pickup work", () => {
    const summary = buildDashboardPrioritySummary(
      [
        order({ id: "customer-new", device_custody_status: "with_customer", status: "new" }),
        order({
          id: "customer-parts",
          device_custody_status: "with_customer",
          status: "parts_arrived",
          parts_status: "arrived",
        }),
        order({
          id: "customer-stale-pickup",
          device_custody_status: "with_customer",
          status: "waiting_pickup",
          pickup_overdue: true,
        }),
      ],
      { coverage: "store", limit: 20, now },
    );

    for (const id of ["customer-new", "customer-parts", "customer-stale-pickup"]) {
      expect(summary.items.find((item) => item.orderId === id)).toMatchObject({
        tier: "active",
        reasonLabel: "设备待收机",
        action: { label: "确认收机" },
      });
    }
    expect(summary.items.find((item) => item.orderId === "customer-parts")?.currentStep).toBe(
      "配件已到，设备未收",
    );
    expect(
      summary.items.find((item) => item.orderId === "customer-stale-pickup")?.reasonCode,
    ).not.toBe("pickup_overdue");
  });

  it("keeps unknown legacy custody conservative in existing pickup queues", () => {
    const summary = buildDashboardPrioritySummary(
      [
        order({
          id: "legacy-pickup",
          device_custody_status: null,
          status: "waiting_pickup",
          pickup_overdue: true,
        }),
      ],
      { coverage: "store", limit: 20, now },
    );

    expect(summary.items[0]).toMatchObject({
      orderId: "legacy-pickup",
      reasonCode: "pickup_overdue",
      reasonLabel: "取件超期",
    });
  });
});

function order(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: "order-1",
    public_no: "R2026001",
    status: "new",
    workflow_status: "intake",
    order_type: "quick_repair",
    payment_status: "unpaid",
    approval_status: "pending",
    customer_id: "customer-1",
    device_id: "device-1",
    customer_name: "Mario Rossi",
    customer_phone: "+390000000",
    device_label: "Apple iPhone 14",
    device_imei: "350100000000000",
    issue_description: "Synthetic issue",
    quotation_amount: 100,
    deposit_amount: 0,
    balance_amount: 100,
    currency_code: "EUR",
    is_paid: false,
    technician_name: "Hexiang",
    assignee_membership_id: "membership-owner",
    contact_phones: [],
    fault_prices: [],
    approval_overdue: false,
    pickup_overdue: false,
    created_at: "2026-07-10T09:00:00.000Z",
    updated_at: "2026-07-10T09:00:00.000Z",
    ...overrides,
    device_custody_status: overrides.device_custody_status ?? "with_shop",
  };
}
