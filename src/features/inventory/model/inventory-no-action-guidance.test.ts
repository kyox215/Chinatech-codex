import { describe, expect, it } from "vitest";

import { resolveInventoryNoActionGuidance } from "./inventory-no-action-guidance";

const projection = {
  mode: "exact" as const,
  status: "in_stock" as const,
  needs_review: false,
};

describe("resolveInventoryNoActionGuidance", () => {
  it("does not expose a card before readable data exists", () => {
    expect(
      resolveInventoryNoActionGuidance({
        lifecycleState: "loading",
        hasData: false,
        allowedActions: [],
      }),
    ).toBeNull();
  });

  it("explains loading only when a readable record remains on screen", () => {
    expect(
      resolveInventoryNoActionGuidance({
        lifecycleState: "loading",
        hasData: true,
        allowedActions: [],
      }),
    ).toEqual({ state: "loading" });
  });

  it.each([
    ["unavailable", "projection-unavailable"],
    ["review", "facts-need-review"],
    ["terminal", "terminal-complete"],
    ["readonly", "server-readonly"],
  ] as const)("maps %s facts to %s", (_label, state) => {
    const result = resolveInventoryNoActionGuidance(
      state === "projection-unavailable"
        ? { hasData: true, projectionMode: "unavailable", allowedActions: [] }
        : state === "facts-need-review"
          ? {
              hasData: true,
              projection: { ...projection, needs_review: true },
              allowedActions: [],
            }
          : state === "terminal-complete"
            ? { hasData: true, projection, status: "closed", allowedActions: [] }
            : { hasData: true, projection, allowedActions: [] },
    );
    expect(result).toEqual({ state });
  });

  it("reports a missing explicit target without claiming no permission", () => {
    expect(
      resolveInventoryNoActionGuidance({
        hasData: true,
        projection,
        allowedActions: ["inspection.save"],
        targetCommand: "reservation.create",
      }),
    ).toEqual({ state: "target-unavailable", targetCommand: "reservation.create" });
  });

  it("keeps an allowed target in facts-review when transition facts are empty", () => {
    expect(
      resolveInventoryNoActionGuidance({
        hasData: true,
        projection,
        allowedActions: ["after_sales.update"],
        targetCommand: "after_sales.update",
        transitionTargetsAvailable: false,
      }),
    ).toEqual({ state: "facts-need-review", targetCommand: "after_sales.update" });
  });

  it("does not emit guidance when another server action is available", () => {
    expect(
      resolveInventoryNoActionGuidance({
        hasData: true,
        projection,
        allowedActions: ["inspection.save"],
      }),
    ).toBeNull();
  });
});
