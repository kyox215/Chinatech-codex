import { describe, expect, it } from "vitest";

import {
  fallbackOrderWorkflowStatuses,
  getOrderListStatusGroups,
  getOrderListSubStatusTabs,
  getWorkflowTransitionActions,
} from "./order-workflow";

const workflow = { statuses: fallbackOrderWorkflowStatuses, transitions: [] };

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
});
