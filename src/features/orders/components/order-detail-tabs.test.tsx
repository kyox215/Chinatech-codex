import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { OrderDetailTabs, type OrderDetailTab } from "./order-detail-tabs";

afterEach(cleanup);

type View = "overview" | "records" | "photos";

const tabs: OrderDetailTab<View>[] = [
  { key: "overview", label: "概览" },
  { key: "records", label: "记录与信息 2" },
  { key: "photos", label: "设备照片 0" },
];

function TabsHarness() {
  const [activeTab, setActiveTab] = useState<View>("overview");
  return (
    <>
      <OrderDetailTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        ariaLabel="工单详情内容"
        idPrefix="order-detail-workspace"
      />
      {tabs.map((tab) => (
        <section
          key={tab.key}
          id={`order-detail-workspace-panel-${tab.key}`}
          role="tabpanel"
          aria-labelledby={`order-detail-workspace-tab-${tab.key}`}
          hidden={activeTab !== tab.key}
        >
          {tab.label}内容
        </section>
      ))}
    </>
  );
}

describe("OrderDetailTabs", () => {
  it("links tabs to panels and switches with click", async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);

    expect(screen.getByRole("tablist", { name: "工单详情内容" })).toBeInTheDocument();
    const recordsTab = screen.getByRole("tab", { name: "记录与信息 2" });
    expect(recordsTab).toHaveAttribute("aria-controls", "order-detail-workspace-panel-records");

    await user.click(recordsTab);

    expect(recordsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("记录与信息 2内容");
  });

  it("supports arrow, Home, and End keyboard navigation", async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);

    const overviewTab = screen.getByRole("tab", { name: "概览" });
    overviewTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "记录与信息 2" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "记录与信息 2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "设备照片 0" })).toHaveFocus();

    await user.keyboard("{Home}");
    expect(overviewTab).toHaveFocus();
    expect(overviewTab).toHaveAttribute("aria-selected", "true");
  });
});
