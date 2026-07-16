import { describe, expect, it } from "vitest";

import {
  getOrderTaskGuidance,
  getOrderTaskUrl,
  getWorkflowProgressValue,
  orderTaskStages,
} from "@/features/orders/model/order-task-flow";
import {
  getSimpleOrderFlowCounts,
  getSimpleOrderFlowWorkflowStatuses,
} from "@/features/orders/model/order-simple-flow";

describe("order task flow", () => {
  it("keeps customer-held devices out of stale pickup-overdue guidance", () => {
    expect(
      getOrderTaskGuidance({
        status: "waiting_pickup",
        workflow_status: "pickup",
        approval_overdue: false,
        pickup_overdue: true,
        device_custody_status: "with_customer",
      }),
    ).toMatchObject({
      label: "客户持有设备",
      nextAction: "确认收机",
    });
  });

  it("defines the five simplified repair workflow stages", () => {
    expect(orderTaskStages.map((stage) => stage.label)).toEqual([
      "接单",
      "检测报价",
      "维修处理",
      "通知取机",
      "收款完成",
    ]);
  });

  it("aggregates detailed workflow statuses into the simplified progress rail", () => {
    expect(getWorkflowProgressValue("diagnosis")).toBe(getWorkflowProgressValue("quote"));
    expect(getWorkflowProgressValue("parts")).toBe(getWorkflowProgressValue("repair"));
    expect(getWorkflowProgressValue("pickup")).toBe(3);
    expect(getWorkflowProgressValue("closed")).toBe(4);
  });

  it("maps exception-only cancellations to the closed workflow stage", () => {
    expect(
      getOrderTaskGuidance({
        status: "repairing",
        workflow_status: "repair",
        exception_status: "cancelled",
        approval_overdue: false,
        pickup_overdue: false,
      }).workflowStatus,
    ).toBe("closed");
  });

  it("aggregates detailed workflow counts for the simplified queue tabs", () => {
    expect(
      getSimpleOrderFlowCounts({
        all: 10,
        intake: 1,
        diagnosis: 2,
        quote: 3,
        parts: 1,
        repair: 2,
        pickup: 1,
        closed: 0,
      }),
    ).toMatchObject({
      all: 10,
      intake: 1,
      quote: 5,
      repair: 3,
      pickup: 1,
      closed: 0,
    });
    expect(getSimpleOrderFlowWorkflowStatuses("quote")).toEqual(["diagnosis", "quote"]);
    expect(getSimpleOrderFlowWorkflowStatuses("repair")).toEqual(["parts", "repair"]);
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
        exception_status: undefined,
        approval_overdue: true,
        pickup_overdue: false,
      }),
    ).toMatchObject({
      label: "报价超期",
      nextAction: "联系客户",
      tone: "danger",
    });
  });

  it("keeps repaired orders in the repair task stage until customer notification", () => {
    expect(
      getOrderTaskGuidance({
        status: "repaired",
        workflow_status: undefined,
        exception_status: undefined,
        approval_overdue: false,
        pickup_overdue: false,
      }),
    ).toMatchObject({
      workflowStatus: "repair",
      stage: expect.objectContaining({ key: "repair", label: "维修处理" }),
      label: "已修复",
      nextAction: "通知取机",
      tone: "success",
    });
  });

  it("describes exception-only cancellations as non-collectible history", () => {
    expect(
      getOrderTaskGuidance({
        status: "repairing",
        workflow_status: "repair",
        exception_status: "cancelled",
        approval_overdue: true,
        pickup_overdue: true,
      }),
    ).toMatchObject({
      workflowStatus: "closed",
      stage: expect.objectContaining({ label: "取消归档", tone: "neutral" }),
      label: "已取消",
      task: expect.stringContaining("不计入待收"),
      nextAction: "查看取消原因",
      tone: "neutral",
    });
  });
});
