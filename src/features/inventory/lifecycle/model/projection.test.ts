import { describe, expect, it } from "vitest";

import {
  countInventoryLifecycleProjections,
  getInventoryLifecycleAfterSalesNextStatuses,
  getInventoryLifecycleProjectionMeta,
  projectCompatibleInventoryLifecycle,
  projectExactInventoryLifecycle,
  projectUnavailableInventoryLifecycle,
} from "./projection";

describe("inventory lifecycle projection", () => {
  it.each([
    ["intake", "processing"],
    ["evaluating", "processing"],
    ["refurbishing", "processing"],
    ["ready_for_sale", "processing"],
    ["listed", "in_stock"],
    ["reserved", "reserved"],
    ["sold", "processing"],
    ["cancelled", "removed"],
    ["recycled", "removed"],
    ["returned", "processing"],
  ] as const)("does not guess a green sale state for %s", (legacyStatus, expected) => {
    const projection = projectCompatibleInventoryLifecycle(legacyStatus);
    expect(projection.status).toBe(expected);
    expect(projection.allowed_actions).toEqual([]);
    if (legacyStatus !== "listed") expect(projection.status).not.toBe("in_stock");
  });

  it("keeps compatible sold records neutral and marks them for human review", () => {
    const sold = projectCompatibleInventoryLifecycle("sold");
    expect(sold).toMatchObject({ status: "processing", needs_review: true });
    expect(getInventoryLifecycleProjectionMeta(sold, "sold")).toMatchObject({
      label: "已售",
      nextStep: "核对实际取走记录",
    });
    expect(
      getInventoryLifecycleProjectionMeta(
        projectCompatibleInventoryLifecycle("returned"),
        "returned",
      ),
    ).toMatchObject({ label: "退回·需核对" });
  });

  it("requires an explicitly listed, clean item before exposing reservation.create", () => {
    const allowed = ["reservation.create"] as const;
    const listed = projectExactInventoryLifecycle({
      legacyStatus: "listed",
      unitStatus: "listed",
      allowedActions: [...allowed],
    });
    expect(listed.status).toBe("in_stock");
    expect(listed.allowed_actions).toEqual([...allowed]);

    const conflicting = projectExactInventoryLifecycle({
      legacyStatus: "listed",
      unitStatus: "listed",
      order: { status: "reserved" },
      allowedActions: [...allowed],
    });
    expect(conflicting.status).toBe("reserved");
    expect(conflicting.allowed_actions).toEqual([]);

    const missingUnit = projectExactInventoryLifecycle({
      legacyStatus: "listed",
      allowedActions: [...allowed],
    });
    expect(missingUnit).toMatchObject({ status: "processing", needs_review: true });
    expect(missingUnit.allowed_actions).toEqual([]);
  });

  it("does not call a sold item delivered without actual pickup", () => {
    expect(
      projectExactInventoryLifecycle({
        legacyStatus: "sold",
        unitStatus: "sold",
        order: { status: "sold" },
      }).status,
    ).toBe("sold_pending_pickup");
    expect(
      projectExactInventoryLifecycle({
        legacyStatus: "sold",
        unitStatus: "sold",
        order: { status: "sold", actualPickupAt: "2026-08-10T10:00:00.000Z" },
      }).status,
    ).toBe("delivered");
  });

  it("keeps after-sales before delivery in review instead of relisting it", () => {
    const projection = projectExactInventoryLifecycle({
      legacyStatus: "sold",
      unitStatus: "sold",
      order: { status: "sold" },
      afterSales: { status: "open" },
    });
    expect(projection).toMatchObject({ status: "processing", needs_review: true });
  });

  it("returns only server-owned legal after-sales transitions", () => {
    expect(getInventoryLifecycleAfterSalesNextStatuses("open")).toEqual([
      "in_progress",
      "waiting_customer",
      "returned",
    ]);
    expect(getInventoryLifecycleAfterSalesNextStatuses("in_progress")).toEqual([
      "waiting_customer",
      "returned",
    ]);
    expect(getInventoryLifecycleAfterSalesNextStatuses("waiting_customer")).toEqual([
      "in_progress",
      "returned",
    ]);
    expect(getInventoryLifecycleAfterSalesNextStatuses("returned")).toEqual(["closed"]);
    expect(getInventoryLifecycleAfterSalesNextStatuses("closed")).toEqual([]);
    expect(getInventoryLifecycleAfterSalesNextStatuses("unknown_from_legacy_data")).toEqual([]);
  });

  it("omits unknown count when no projection is unknown", () => {
    const counts = countInventoryLifecycleProjections([
      projectCompatibleInventoryLifecycle("listed"),
      projectCompatibleInventoryLifecycle("reserved"),
    ]);
    expect(counts).toEqual({ in_stock: 1, reserved: 1 });
    expect(counts).not.toHaveProperty("unknown");
    expect(projectUnavailableInventoryLifecycle().mode).toBe("unavailable");
  });
});
