import { describe, expect, it } from "vitest";
import type { OrderWorkflow } from "@/lib/repairdesk/types";
import { translateMessage } from "@/shared/i18n/messages";
import { fallbackOrderWorkflowStatuses, getWorkflowTransitionActions } from "./order-workflow";
import {
  getTransitionPickerHintTarget,
  getTransitionPickerLabel,
  getTransitionPickerReasonTarget,
  buildTransitionPickerSequence,
  getTransitionPickerRestriction,
} from "./order-transition-picker";

const workflow: OrderWorkflow = { statuses: fallbackOrderWorkflowStatuses, transitions: [] };

describe("transition picker presentation", () => {
  it("keeps approval decisions separate from manual transitions", () => {
    const pending = {
      status: "waiting_approval",
      approval_flow_status: "waiting_customer",
    } as const;
    for (const to of ["quoted", "repairing", "completed", "cancelled"] as const) {
      expect(getTransitionPickerRestriction(pending, to, workflow)).toBe(
        "orders2b2.picker.approvalRequired",
      );
    }
    expect(
      getTransitionPickerRestriction(
        { status: "quoted", approval_status: "pending" },
        "repairing",
        workflow,
      ),
    ).toBe("orders2b2.picker.approvalRequired");
    expect(
      getTransitionPickerRestriction(
        { status: "quoted", approval_status: "pending" },
        "waiting_approval",
        workflow,
      ),
    ).toBeUndefined();
    expect(
      getTransitionPickerRestriction(
        { ...pending, approval_flow_status: "approved" },
        "repairing",
        workflow,
      ),
    ).toBeUndefined();
    expect(
      getTransitionPickerRestriction(
        { ...pending, approval_flow_status: "rejected" },
        "repairing",
        workflow,
      ),
    ).toBe("orders2b2.picker.approvalRequired");
  });

  it("explains an unbound custom group without removing its configured position", () => {
    const customWorkflow = {
      ...workflow,
      statuses: [
        ...workflow.statuses,
        {
          ...workflow.statuses[0]!,
          code: "custom_pending",
          bucket: "custom" as const,
          is_system: false,
          sort_order: 999,
        },
      ],
    };
    expect(
      getTransitionPickerRestriction({ status: "repairing" }, "custom_pending", customWorkflow),
    ).toBe("orders2b2.picker.configureBucket");
    expect(
      buildTransitionPickerSequence(
        getWorkflowTransitionActions(customWorkflow, "repairing"),
        customWorkflow,
        "repairing",
      ).at(-1)?.code,
    ).toBe("custom_pending");
  });
  it.each(["zh-CN", "it-IT", "en"] as const)(
    "gives every system state a distinct meaningful label in %s",
    (locale) => {
      const labels = workflow.statuses.map(({ code }) =>
        getTransitionPickerLabel(workflow, code, (key, values) =>
          translateMessage(locale, key, values),
        ),
      );
      expect(new Set(labels).size).toBe(labels.length);
      expect(labels).not.toContain("mail_in_progress");
      if (locale !== "zh-CN") expect(labels.join(" ")).not.toMatch(/[一-龥]/);
      expect(
        getTransitionPickerLabel(workflow, "cancelled", (key, values) =>
          translateMessage(locale, key, values),
        ),
      ).toBe(translateMessage(locale, "orders2b2.picker.cancelled"));
    },
  );

  it("uses configuration order without promoting recommendations or mutating permissions", () => {
    const actions = getWorkflowTransitionActions(workflow, "repairing");
    actions[actions.length - 1]!.isPrimary = true;
    const before = structuredClone(actions);
    const entries = buildTransitionPickerSequence(actions, workflow, "repairing");
    expect(entries.map(({ code }) => code)).toEqual(workflow.statuses.map(({ code }) => code));
    expect(entries.filter(({ current }) => current).map(({ code }) => code)).toEqual(["repairing"]);
    expect(entries.flatMap(({ action }) => (action ? [action.to] : [])).sort()).toEqual(
      actions.map(({ to }) => to).sort(),
    );
    expect(actions).toEqual(before);
    expect(
      buildTransitionPickerSequence([], workflow, "repairing").every(({ action }) => !action),
    ).toBe(true);
  });

  it("retains a disabled current state in order, omits other disabled states and does not enable restricted targets", () => {
    const configured = {
      ...workflow,
      statuses: workflow.statuses.map((status) => ({
        ...status,
        enabled: !["parts_arrived", "repairing"].includes(status.code),
      })),
    };
    const allowed = getWorkflowTransitionActions(configured, "repairing").filter(
      ({ to }) => to === "repaired",
    );
    const entries = buildTransitionPickerSequence(allowed, configured, "repairing");
    expect(entries.find(({ code }) => code === "repairing")).toMatchObject({
      current: true,
      enabled: false,
      configured: true,
      action: undefined,
    });
    expect(entries.some(({ code }) => code === "parts_arrived")).toBe(false);
    expect(entries.flatMap(({ action }) => (action ? [action.to] : []))).toEqual(["repaired"]);
    expect(entries.find(({ code }) => code === "diagnosing")?.action).toBeUndefined();
  });

  it("shows an unknown current state without inventing a position or a transition", () => {
    const entries = buildTransitionPickerSequence(
      getWorkflowTransitionActions(workflow, "unknown"),
      workflow,
      "unknown",
    );
    expect(entries[0]).toEqual({
      code: "unknown",
      current: true,
      position: null,
      configured: false,
      enabled: false,
    });
    expect(entries.filter(({ current }) => current)).toHaveLength(1);
    expect(entries[1]?.position).toBe(1);
  });

  it("does not resurrect a known disabled target from a stale action list", () => {
    const stale = getWorkflowTransitionActions(workflow, "repairing");
    const configured = {
      ...workflow,
      statuses: workflow.statuses.map((status) =>
        status.code === "parts_arrived" ? { ...status, enabled: false } : status,
      ),
    };
    const entries = buildTransitionPickerSequence(stale, configured, "repairing");
    expect(entries.some(({ code }) => code === "parts_arrived")).toBe(false);
    expect(entries.find(({ current }) => current)?.action).toBeUndefined();
  });

  it("keeps custom labels and codes while respecting cancelled and done bucket semantics", () => {
    const configured: OrderWorkflow = {
      ...workflow,
      statuses: [
        ...workflow.statuses,
        {
          ...workflow.statuses[0]!,
          code: "custom_cancel",
          label: "Shop special",
          is_system: false,
          bucket: "cancelled",
        },
        {
          ...workflow.statuses[0]!,
          code: "custom_done",
          label: "Shop special",
          is_system: false,
          bucket: "done",
        },
      ],
    };
    const actions = getWorkflowTransitionActions(configured, "new");
    const cancelled = actions.find(({ to }) => to === "custom_cancel")!;
    const done = actions.find(({ to }) => to === "custom_done")!;
    expect(getTransitionPickerLabel(configured, cancelled.to, (key) => key)).toBe("Shop special");
    expect(getTransitionPickerReasonTarget(cancelled, configured)).toBe("cancelled");
    expect(getTransitionPickerHintTarget(cancelled, configured)).toBe("cancelled");
    expect(getTransitionPickerHintTarget(done, configured)).toBe("completed");
    expect(getTransitionPickerReasonTarget(done, configured)).toBeUndefined();
    expect(cancelled.to).toBe("custom_cancel");
  });
});
