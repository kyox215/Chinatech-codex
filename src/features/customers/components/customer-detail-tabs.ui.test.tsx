import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomerDetailTabs } from "./customer-detail-tabs";

afterEach(cleanup);

describe("CustomerDetailTabs", () => {
  const tabs = [
    { key: "overview", label: "总览" },
    { key: "orders", label: "工单", count: 2 },
    { key: "devices", label: "设备", count: 1 },
    { key: "followups", label: "跟进", count: 3 },
    { key: "profile", label: "资料" },
  ] as const;

  it("keeps all five groups in one tablist and supports arrow navigation", () => {
    const onChange = vi.fn();
    render(
      <CustomerDetailTabs
        tabs={tabs}
        activeTab="overview"
        onChange={onChange}
        idPrefix="test-tabs"
        panelIdPrefix="test-detail"
      />,
    );

    const tablist = screen.getByRole("tablist", { name: "客户详情分组" });
    expect(tablist).toHaveClass("grid-cols-5");
    expect(screen.getAllByRole("tab")).toHaveLength(5);

    const overview = screen.getByRole("tab", { name: "总览" });
    fireEvent.keyDown(overview, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("orders");
    expect(screen.getByRole("tab", { name: /工单/ })).toHaveFocus();
  });
});
