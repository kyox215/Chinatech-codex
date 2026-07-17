import { describe, expect, it } from "vitest";

import {
  canShowWorkspaceNavItem,
  getShellCommandActions,
  getWorkspaceNavItems,
  routeLabels,
} from "./navigation";

describe("workspace navigation", () => {
  it("uses one user-facing name for repair orders", () => {
    const orders = getWorkspaceNavItems(false).find((item) => item.id === "orders");

    expect(orders).toMatchObject({
      title: "维修工单",
      shortTitle: "工单",
      commandLabel: "维修工单",
    });
    expect(routeLabels.orders).toBe("维修工单");
  });

  it("hides inventory and message modules when the store context denies them", () => {
    const items = getWorkspaceNavItems(false);
    const visible = items.filter((item) =>
      canShowWorkspaceNavItem(item, {
        canReadInventory: false,
        canReadMessageTemplates: false,
      }),
    );

    expect(visible.map((item) => item.id)).not.toContain("inventory");
    expect(visible.map((item) => item.id)).not.toContain("buyback");
    expect(visible.map((item) => item.id)).not.toContain("messages");
    expect(visible.map((item) => item.id)).toContain("orders");
  });

  it("filters write shortcuts for viewers and inventory shortcuts without permission", () => {
    expect(
      getShellCommandActions({ canReadInventory: true }, "viewer").map((item) => item.id),
    ).toEqual(["account-center"]);

    const staffActions = getShellCommandActions({ canReadInventory: false }, "technician").map(
      (item) => item.id,
    );
    expect(staffActions).toContain("new-order");
    expect(staffActions).toContain("new-customer");
    expect(staffActions).not.toContain("new-buyback");
    expect(staffActions).not.toContain("new-inventory");

    const technicianWithInventory = getShellCommandActions(
      { canReadInventory: true },
      "technician",
    ).map((item) => item.id);
    expect(technicianWithInventory).not.toContain("new-buyback");
    expect(technicianWithInventory).toContain("new-inventory");
    expect(
      getShellCommandActions({ canReadInventory: true }, "manager").map((item) => item.id),
    ).toContain("new-buyback");
  });
});
