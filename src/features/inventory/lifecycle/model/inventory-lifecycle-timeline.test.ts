import { describe, expect, it } from "vitest";

import {
  resolveInventoryLedgerTimeline,
  resolveInventoryMilestoneTimeline,
} from "./inventory-lifecycle-timeline";

describe("inventory lifecycle timelines", () => {
  it("filters invalid milestones, sorts newest first, and identifies the summary source", () => {
    const result = resolveInventoryMilestoneTimeline([
      { id: "sold", label: "完成销售", at: "2026-08-01T10:00:00.000Z" },
      { id: "invalid", label: "不要显示", at: "not-a-date" },
      { id: "reserved", label: "建立预订", at: "2026-08-02T10:00:00.000Z" },
    ]);
    expect(result.items.map((item) => item.id)).toEqual([
      "milestone:reserved:2026-08-02T10:00:00.000Z",
      "milestone:sold:2026-08-01T10:00:00.000Z",
    ]);
    expect(result.scope).toMatchObject({ source: "milestone-summary", totalValid: 2 });
    expect(result.scope.label).toContain("不是完整审计历史");
  });

  it("uses stable tie-breaks, neutralizes unknown event types, and preserves known status labels", () => {
    const result = resolveInventoryLedgerTimeline([
      {
        event_type: "z_unknown_private_name",
        from_status: "open",
        to_status: "waiting_customer",
        occurred_at: "2026-08-02T10:00:00.000Z",
      },
      {
        event_type: "created",
        occurred_at: "2026-08-02T10:00:00.000Z",
      },
      { event_type: "status_changed", occurred_at: "invalid" },
    ]);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      label: "建立案件",
      source: "ledger-event",
    });
    expect(result.items[1]).toMatchObject({
      label: "业务事件",
      fromStatusLabel: "待检测",
      toStatusLabel: "等客户",
    });
    expect(result.items.map((item) => item.id)).toEqual([
      "ledger:created:2026-08-02T10:00:00.000Z:::1",
      "ledger:z_unknown_private_name:2026-08-02T10:00:00.000Z:open:waiting_customer:1",
    ]);
  });

  it("limits visible entries while describing the server range", () => {
    const result = resolveInventoryLedgerTimeline(
      [
        { event_type: "created", occurred_at: "2026-08-01T10:00:00.000Z" },
        { event_type: "status_changed", occurred_at: "2026-08-02T10:00:00.000Z" },
      ],
      { limit: 1 },
    );
    expect(result.items).toHaveLength(1);
    expect(result.scope.totalValid).toBe(2);
    expect(result.scope.label).toContain("显示最近 1 项");
  });
});
