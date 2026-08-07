import { describe, expect, it } from "vitest";

import {
  canShowWorkspaceNavItem,
  getSidebarNavItems,
  getShellCommandActions,
  getWorkspaceNavItems,
  routeLabels,
} from "./navigation";

describe("workspace navigation", () => {
  it("exposes the authenticated toolkit in navigation and route labels", () => {
    const toolkit = getWorkspaceNavItems(false).find((item) => item.id === "toolkit");
    expect(toolkit).toMatchObject({ title: "工具集", url: "/toolkit" });
    expect(getSidebarNavItems(false).map((item) => item.id)).toContain("toolkit");
    expect(routeLabels.toolkit).toBe("工具集");
  });

  it("uses one user-facing name for repair orders", () => {
    const orders = getWorkspaceNavItems(false).find((item) => item.id === "orders");

    expect(orders).toMatchObject({
      title: "维修工单",
      shortTitle: "工单",
      commandLabel: "维修工单",
    });
    expect(routeLabels.orders).toBe("维修工单");
  });

  it("keeps settings destinations out of the workspace sidebar", () => {
    expect(getSidebarNavItems(false).map((item) => item.id)).not.toEqual(
      expect.arrayContaining(["messages", "platform", "settings"]),
    );
    expect(getSidebarNavItems(true).map((item) => item.id)).not.toEqual(
      expect.arrayContaining(["messages", "platform", "settings"]),
    );
    expect(getSidebarNavItems(true).map((item) => item.id)).toContain("finance");
  });

  it("hides inventory, messages, and repair profit when the store context denies them", () => {
    const items = getWorkspaceNavItems(false);
    const visible = items.filter((item) =>
      canShowWorkspaceNavItem(item, {
        canReadInventory: false,
        canReadMessageTemplates: false,
        canReadRepairProfitReports: false,
        canReadMemos: false,
      }),
    );

    expect(visible.map((item) => item.id)).not.toContain("inventory");
    expect(visible.map((item) => item.id)).not.toContain("buyback");
    expect(visible.map((item) => item.id)).not.toContain("messages");
    expect(visible.map((item) => item.id)).not.toContain("finance");
    expect(visible.map((item) => item.id)).not.toContain("memos");
    expect(visible.map((item) => item.id)).toContain("orders");
  });

  it("places the capability-aware memo workspace after customers with command aliases", () => {
    const items = getWorkspaceNavItems(false);
    const memo = items.find((item) => item.id === "memos")!;
    expect(items.indexOf(memo)).toBe(items.findIndex((item) => item.id === "customers") + 1);
    expect(memo).toMatchObject({ title: "备忘录", url: "/memos" });
    expect(memo.aliases).toEqual(expect.arrayContaining(["备忘", "待办", "Todo", "交班"]));
    expect(canShowWorkspaceNavItem(memo, { canReadMemos: false })).toBe(false);
    expect(canShowWorkspaceNavItem(memo, { canReadMemos: true })).toBe(true);
    expect(routeLabels.memos).toBe("备忘录");
  });

  it("shows the repair profit workspace only with the explicit report capability", () => {
    const finance = getWorkspaceNavItems(false).find((item) => item.id === "finance")!;

    expect(canShowWorkspaceNavItem(finance)).toBe(false);
    expect(canShowWorkspaceNavItem(finance, { canReadRepairProfitReports: false })).toBe(false);
    expect(canShowWorkspaceNavItem(finance, { canReadRepairProfitReports: true })).toBe(true);
    expect(routeLabels.finance).toBe("维修毛利");
  });

  it("filters write shortcuts for viewers and inventory shortcuts without permission", () => {
    const staffActions = getShellCommandActions({ canReadInventory: false }, "technician").map(
      (item) => item.id,
    );
    expect(staffActions).toContain("new-order");
    expect(staffActions).toContain("new-customer");
    expect(staffActions).not.toContain("new-buyback");
    expect(staffActions).not.toContain("new-inventory");
    expect(staffActions).not.toContain("new-memo");

    expect(
      getShellCommandActions({ canReadMemos: true, canCreateMemos: true }, "technician").map(
        (item) => item.id,
      ),
    ).toContain("new-memo");

    const technicianWithInventory = getShellCommandActions(
      { canReadInventory: true, canCreateInventory: true },
      "technician",
    ).map((item) => item.id);
    expect(technicianWithInventory).not.toContain("new-buyback");
    expect(technicianWithInventory).toContain("new-inventory");
    expect(
      getShellCommandActions({ canReadInventory: true, canCreateInventory: true }, "manager").map(
        (item) => item.id,
      ),
    ).toContain("new-buyback");
  });
});
