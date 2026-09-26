import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomerDetailTabs } from "./customer-detail-tabs";

afterEach(cleanup);

describe("CustomerDetailTabs", () => {
  const tabs = [
    { key: "overview", label: "概览" },
    { key: "business", label: "业务" },
    { key: "profile", label: "资料" },
  ] as const;

  it("keeps three groups in one tablist and supports arrow navigation", () => {
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
    expect(tablist).toHaveStyle({ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" });
    expect(screen.getAllByRole("tab")).toHaveLength(3);

    const overview = screen.getByRole("tab", { name: "概览" });
    expect(overview).toHaveClass("text-xs");
    expect(screen.queryByText("2")).not.toBeInTheDocument();
    fireEvent.keyDown(overview, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("business");
    expect(screen.getByRole("tab", { name: /业务/ })).toHaveFocus();
  });
});
