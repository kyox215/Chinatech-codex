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
    });

    expect(badges.map((badge) => badge.label)).toEqual([
      "外修寄送中",
      "暂停",
      "等客户确认",
      "已订件",
      "已通知",
    ]);
  });
});
