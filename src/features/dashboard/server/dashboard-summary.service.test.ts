import { describe, expect, it, vi } from "vitest";

import type { AuditActor, OrderListItem } from "@/lib/repairdesk/types";

import { getDashboardPrioritySummary } from "./dashboard-summary.service";

describe("dashboard summary service", () => {
  it("forwards the authenticated actor to the active-order reader", async () => {
    const actor = makeActor({ storeRole: "technician", activeMembershipId: "membership-tech" });
    const listOrders = vi.fn(async () => [] as OrderListItem[]);

    const result = await getDashboardPrioritySummary({ actor, limit: 6, listOrders });

    expect(listOrders).toHaveBeenCalledWith({ view: "active" }, actor);
    expect(result).toMatchObject({ coverage: "assigned", totalCandidates: 0, items: [] });
  });

  it.each(["owner", "manager", "sales"] as const)(
    "uses store coverage for %s without adding finance aggregates",
    async (storeRole) => {
      const result = await getDashboardPrioritySummary({
        actor: makeActor({ storeRole }),
        listOrders: async () => [],
      });

      expect(result.coverage).toBe("store");
      expect(result).not.toHaveProperty("stats.unpaid");
      expect(result).not.toHaveProperty("unpaid");
    },
  );

  it("propagates candidate-read failures instead of claiming an empty queue", async () => {
    await expect(
      getDashboardPrioritySummary({
        actor: makeActor(),
        listOrders: async () => {
          throw new Error("database details must remain server-side");
        },
      }),
    ).rejects.toThrow("优先队列暂时不可用");
  });
});

function makeActor(overrides: Partial<AuditActor> = {}): AuditActor {
  return {
    id: "user-1",
    displayName: "Synthetic Owner",
    storeId: "store-1",
    storeRole: "owner",
    activeMembershipId: "membership-owner",
    ...overrides,
  };
}
