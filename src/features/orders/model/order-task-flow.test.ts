import { describe, expect, it } from "vitest";

import {
  getOrderTaskGuidance,
  getOrderTaskUrl,
  orderTaskStages,
} from "@/features/orders/model/order-task-flow";

describe("order task flow", () => {
  it("defines the seven repair workflow stages", () => {
    expect(orderTaskStages.map((stage) => stage.label)).toEqual([
      "收机",
      "检测",
      "报价",
      "配件",
      "维修",
      "取机",
      "结案",
    ]);
  });

  it("builds task links from internal order ids", () => {
    expect(getOrderTaskUrl("order_123", "https://repair.example")).toBe(
      "https://repair.example/orders/order_123/task",
    );
  });

  it("prioritizes overdue task guidance", () => {
    expect(
      getOrderTaskGuidance({
        status: "waiting_approval",
        workflow_status: "quote",
        approval_overdue: true,
        pickup_overdue: false,
      }),
    ).toMatchObject({
      label: "报价超期",
      nextAction: "联系客户",
      tone: "danger",
    });
  });
});
