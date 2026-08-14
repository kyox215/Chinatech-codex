import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InventoryLifecycleTimeline } from "./inventory-lifecycle-timeline";

describe("InventoryLifecycleTimeline", () => {
  it("labels summary milestones as incomplete history and keeps native time values", () => {
    render(
      <InventoryLifecycleTimeline
        source="milestone-summary"
        result={{
          items: [
            {
              id: "m1",
              label: "设备检测",
              at: "2026-08-02T10:00:00.000Z",
              source: "milestone-summary",
            },
          ],
          scope: {
            source: "milestone-summary",
            totalValid: 1,
            displayedCount: 1,
            label: "当前摘要确认 1 项关键里程碑（不是完整审计历史）",
          },
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "关键里程碑（摘要）" })).toBeVisible();
    expect(screen.getByText(/不是完整审计历史/)).toBeVisible();
    expect(screen.getByRole("time")).toHaveAttribute("datetime", "2026-08-02T10:00:00.000Z");
  });

  it("uses list semantics and does not expose item details in privacy mode", () => {
    render(
      <InventoryLifecycleTimeline
        source="ledger-event"
        privacyRedacted
        items={[
          {
            id: "event-1",
            label: "建立案件",
            at: "2026-08-02T10:00:00.000Z",
            source: "ledger-event",
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "案件历史（服务端事件账）" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("详情已按隐私边界裁剪");
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("announces loading without pretending to know events", () => {
    render(<InventoryLifecycleTimeline source="ledger-event" status="loading" />);
    const section = screen.getByRole("region");
    expect(section).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent(/正在读取时间线/);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
