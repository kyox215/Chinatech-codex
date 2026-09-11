import { describe, expect, it } from "vitest";
import type { OrderListItem, OrderWorkflow } from "@/lib/repairdesk/types";
import { translateMessage, type MessageKey } from "@/shared/i18n/messages";
import { getOrderListPresentation, groupOrderListPresentation } from "./order-list-presentation";
import { getWorkflowProgressValue } from "./order-task-flow";

const t = (key: MessageKey) => translateMessage("zh-CN", key);
const order = (overrides: Partial<OrderListItem> = {}) =>
  ({
    id: "test",
    status: "new",
    workflow_status: "intake",
    device_custody_status: "with_shop",
    balance_amount: 50,
    is_paid: false,
    ...overrides,
  }) as OrderListItem;

describe("order list read-only presentation", () => {
  it.each([
    [{ status: "new", workflow_status: "intake" }, "接单", "开始检测"],
    [{ status: "diagnosing", workflow_status: "diagnosis" }, "检测报价", "检测报价"],
    [
      {
        status: "waiting_approval",
        workflow_status: "quote",
        approval_flow_status: "waiting_customer",
      },
      "检测报价",
      "客户反馈",
    ],
    [
      { status: "parts_ordered", workflow_status: "parts", parts_status: "ordered" },
      "维修处理",
      "维修处理",
    ],
    [
      { status: "repaired", workflow_status: "repair", notify_status: "not_sent" },
      "通知取机",
      "通知取机",
    ],
    [
      { status: "notified", workflow_status: "pickup", notify_status: "sent" },
      "等待客户取机",
      "处理取机",
    ],
  ] as const)(
    "presents the reference state without suggesting a transition: %j",
    (input, label, nextAction) => {
      expect(getOrderListPresentation(order(input), t)).toMatchObject({
        label,
        nextAction,
        terminal: false,
      });
    },
  );
  it("does not advance a repaired order's canonical progress before notification", () => {
    const result = getOrderListPresentation(
      order({ status: "repaired", workflow_status: "repair" }),
      t,
    );
    expect(result.workflowStatus).toBe("repair");
    expect(getWorkflowProgressValue(result.workflowStatus)).toBe(2);
    expect(result.boardStage).toBe("repair");
  });
  it.each([
    { status: "completed" },
    { workflow_bucket: "done" },
    { status: "cancelled" },
    { record_state: "voided" },
    { deleted_at: "2026-09-10" },
  ] as const)("keeps archived records out of active task guidance: %j", (input) => {
    const result = getOrderListPresentation(
      order({
        ...input,
        device_custody_status: "with_customer",
        approval_overdue: true,
        pickup_overdue: true,
      }),
      t,
    );
    expect(result.terminal).toBe(true);
    expect(result.danger).toBe(false);
    expect(result.nextAction).not.toMatch(/确认收机|联系客户|催取机/);
    expect(result.workflowStatus).toBe("closed");
  });
  it.each(["paused", "unrepairable", "returned_unfixed"] as const)(
    "prioritizes the exception %s over routine completion",
    (exception_status) => {
      const result = getOrderListPresentation(
        order({ status: "repairing", workflow_status: "repair", exception_status }),
        t,
      );
      expect(result.nextAction).toMatch(/查看/);
      expect(result.nextAction).not.toMatch(/完成维修|处理取机/);
    },
  );
  it("keeps customer custody ahead of stale pickup-overdue guidance", () => {
    expect(
      getOrderListPresentation(
        order({
          status: "waiting_pickup",
          workflow_status: "pickup",
          device_custody_status: "with_customer",
          pickup_overdue: true,
        }),
        t,
      ).nextAction,
    ).toBe("确认收机");
  });
  it("keeps approval and notification secondary to the actual repair stage", () => {
    expect(
      getOrderListPresentation(
        order({
          status: "parts_arrived",
          workflow_status: "parts",
          parts_status: "arrived",
          notify_status: "sent",
        }),
        t,
      ),
    ).toMatchObject({ label: "维修处理", detail: "配件已到货 · 已通知", boardStage: "repair" });
    expect(
      getOrderListPresentation(
        order({
          status: "waiting_approval",
          workflow_status: "quote",
          approval_flow_status: "rejected",
        }),
        t,
      ).detail,
    ).toBe("报价已拒绝");
  });
  it("uses bucket authority for stale closed state and preserves custom configured labels", () => {
    const workflow = {
      statuses: [{ code: "custom-review", label: "Verifica speciale", is_system: false }],
      transitions: [],
    } as unknown as OrderWorkflow;
    expect(
      getOrderListPresentation(
        order({ status: "custom-review", workflow_status: "closed", workflow_bucket: "repair" }),
        t,
        workflow,
      ),
    ).toMatchObject({ label: "Verifica speciale", terminal: false, workflowStatus: "repair" });
  });
  it("groups only its given page without modifying inputs or duplicating orders", () => {
    const rows = [
      order({ id: "a" }),
      order({ id: "b", workflow_status: "repair" }),
      order({ id: "c", status: "cancelled" }),
    ];
    const original = JSON.stringify(rows);
    const groups = groupOrderListPresentation(rows, t);
    expect(groups.flatMap((group) => group.orders.map((row) => row.id))).toEqual(["a", "b", "c"]);
    expect(JSON.stringify(rows)).toBe(original);
  });
});
