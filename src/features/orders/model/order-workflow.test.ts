import { describe, expect, it } from "vitest";
import type { OrderWorkflow, OrderWorkflowTransition } from "@/lib/repairdesk/types";

import {
  fallbackOrderWorkflowStatuses,
  getOrderListStatusGroups,
  getOrderListSubStatusTabs,
  getWorkflowStatuses,
  getWorkflowTransitionActions,
  getWorkflowNextActions,
  getCommonWorkflowTargets,
} from "./order-workflow";

const workflow = { statuses: fallbackOrderWorkflowStatuses, transitions: [] };

const transition = (
  from: string,
  to: string,
  overrides: Partial<OrderWorkflowTransition> = {},
): OrderWorkflowTransition => ({
  id: `${from}-${to}`,
  store_id: "test-store",
  from_status_code: from,
  to_status_code: to,
  enabled: true,
  is_primary: false,
  sort_order: 0,
  created_at: "",
  updated_at: "",
  ...overrides,
});

describe("enabled workflow action targets", () => {
  const configured: OrderWorkflow = {
    statuses: [
      ...fallbackOrderWorkflowStatuses.map((status) =>
        status.code === "diagnosing" ? { ...status, enabled: false } : status,
      ),
      {
        ...fallbackOrderWorkflowStatuses[0],
        id: "custom",
        code: "shop_check",
        label: "Store check",
        is_system: false,
      },
    ],
    transitions: [
      transition("new", "diagnosing", { is_primary: true }),
      transition("new", "repairing", { enabled: false }),
      transition("new", "shop_check"),
      transition("new", "missing_target"),
      transition("rework", "diagnosing"),
      transition("rework", "shop_check"),
      transition("rework", "parts_ordered"),
    ],
  };

  it("excludes disabled destinations, disabled transitions and missing destinations", () => {
    expect(getWorkflowNextActions(configured, "new")).toEqual({
      primary: {
        to: "shop_check",
        label: "Store check",
        tone: configured.statuses[0].tone,
        isPrimary: false,
      },
      secondary: [],
    });
  });

  it("intersects enabled destinations across every selected current status, including custom states", () => {
    expect(getCommonWorkflowTargets(configured, ["new", "rework"])).toEqual(["shop_check"]);
    expect(getCommonWorkflowTargets(configured, ["new", "quoted"])).toEqual([]);
    expect(getCommonWorkflowTargets(configured, [])).toEqual([]);
  });

  it("removes a common target when either its state or one selected transition is disabled", () => {
    expect(
      getCommonWorkflowTargets(
        {
          ...configured,
          statuses: configured.statuses.map((status) =>
            status.code === "shop_check" ? { ...status, enabled: false } : status,
          ),
        },
        ["new", "rework"],
      ),
    ).toEqual([]);
    expect(
      getCommonWorkflowTargets(
        {
          ...configured,
          transitions: configured.transitions.map((item) =>
            item.id === "rework-shop_check" ? { ...item, enabled: false } : item,
          ),
        },
        ["new", "rework"],
      ),
    ).toEqual([]);
  });
});

describe("order workflow list status groups", () => {
  it("groups the default workflow into repair shop phases", () => {
    const byGroup = Object.fromEntries(
      getOrderListStatusGroups(workflow).map((group) => [
        group.key,
        group.statuses.map((status) => status.code),
      ]),
    );

    expect(byGroup.intake).toEqual(["new", "rework"]);
    expect(byGroup.diagnosis_quote).toEqual(["diagnosing", "quoted", "waiting_approval"]);
    expect(byGroup.parts).toEqual(["parts_ordered", "parts_arrived"]);
    expect(byGroup.repair).toEqual(["mail_in_progress", "repairing", "repaired"]);
    expect(byGroup.pickup).toEqual(["notified", "unfixed_pickup", "waiting_pickup"]);
    expect(byGroup.done).toEqual(["completed"]);
    expect(byGroup.cancelled).toEqual(["cancelled"]);
  });

  it("uses visible sub-statuses without dropping hidden statuses from the group filter", () => {
    const customWorkflow = {
      statuses: fallbackOrderWorkflowStatuses.map((status) =>
        status.code === "parts_arrived" ? { ...status, show_in_order_filters: false } : status,
      ),
      transitions: [],
    };

    const partsGroup = getOrderListStatusGroups(customWorkflow).find(
      (group) => group.key === "parts",
    );
    const partsTabs = getOrderListSubStatusTabs(customWorkflow, "parts");

    expect(partsGroup?.statuses.map((status) => status.code)).toEqual([
      "parts_ordered",
      "parts_arrived",
    ]);
    expect(partsTabs.map((tab) => tab.key)).toEqual(["all", "parts_ordered"]);
    expect(partsTabs[0]?.statuses).toEqual(["parts_ordered", "parts_arrived"]);
    expect(partsTabs.find((tab) => tab.key === "parts_ordered")?.statuses).toEqual([
      "parts_ordered",
    ]);
  });

  it("offers every enabled non-current status for manual order transitions", () => {
    const actions = getWorkflowTransitionActions(workflow, "new");

    expect(actions.map((action) => action.to)).toEqual(
      fallbackOrderWorkflowStatuses
        .filter((status) => status.enabled && status.code !== "new")
        .map((status) => status.code),
    );
    expect(actions.find((action) => action.to === "diagnosing")?.isPrimary).toBe(false);
  });

  it("sorts a copied status list without mutating the query snapshot", () => {
    const statuses = [
      { ...fallbackOrderWorkflowStatuses[1], sort_order: 20 },
      { ...fallbackOrderWorkflowStatuses[0], sort_order: 10 },
    ];
    const originalOrder = statuses.map((status) => status.id);

    expect(
      getWorkflowStatuses({ statuses, transitions: [] }).map((status) => status.sort_order),
    ).toEqual([10, 20]);
    expect(statuses.map((status) => status.id)).toEqual(originalOrder);
  });
});
