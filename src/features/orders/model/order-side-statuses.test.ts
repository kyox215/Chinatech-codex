import { describe, expect, it } from "vitest";

import { getOrderSideStatusBadges } from "./order-side-statuses";

describe("order side status badges", () => {
  it("separates logistics, approval, parts, notify and exception states from main workflow", () => {
    const badges = getOrderSideStatusBadges({
      status: "mail_in_progress",
      order_type: "dropoff_repair",
      supplier_id: "supplier-1",
      supplier_name: "PartsLab",
      exception_status: "paused",
      approval_flow_status: "waiting_customer",
      parts_status: "ordered",
      notify_status: "sent",
      device_custody_status: "with_shop",
      delivered_at: undefined,
    });

    expect(badges.map((badge) => badge.label)).toEqual([
      "门店保管",
      "寄修 PartsLab",
      "暂停",
      "等客户确认",
      "已订件",
      "已通知",
    ]);
    expect(badges.find((badge) => badge.key === "logistics-mail")?.supplierName).toBe("PartsLab");
  });

  it.each([
    ["with_shop", undefined, "门店保管"],
    ["with_customer", undefined, "客户持有"],
    ["with_customer", "2026-07-16T18:30:00.000Z", "已归还客户"],
    [null, undefined, "保管未确认"],
  ] as const)("renders custody %s with delivery %s as %s", (custody, deliveredAt, label) => {
    const badges = getOrderSideStatusBadges({
      status: "new",
      order_type: "quick_repair",
      supplier_id: undefined,
      supplier_name: undefined,
      exception_status: undefined,
      approval_flow_status: "not_required",
      parts_status: "not_required",
      notify_status: "not_sent",
      device_custody_status: custody,
      delivered_at: deliveredAt,
    });

    expect(badges[0]?.label).toBe(label);
  });

  it("exposes an external-repair supplier without requiring label parsing", () => {
    const badges = getOrderSideStatusBadges({
      status: "repairing",
      order_type: "dropoff_repair",
      supplier_id: "supplier-2",
      supplier_name: "Fornitore 动态",
      exception_status: undefined,
      approval_flow_status: "not_required",
      parts_status: "not_required",
      notify_status: "not_sent",
      device_custody_status: "with_shop",
      delivered_at: undefined,
    });

    expect(badges.find((badge) => badge.key === "external-repair")?.supplierName).toBe(
      "Fornitore 动态",
    );
  });
});
