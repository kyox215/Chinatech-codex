import { describe, expect, it } from "vitest";

import { fallbackOrderWorkflowStatuses } from "@/features/orders/model/order-workflow";
import type { OrderWorkflow } from "@/lib/repairdesk/types";

import {
  addOrderWorkflowStatusDraft,
  createOrderWorkflowDraftState,
  discardOrderWorkflowDraft,
  isOrderWorkflowDraftDirty,
  moveOrderWorkflowStatusDraft,
  reconcileOrderWorkflowDraftState,
  updateOrderWorkflowStatusDraft,
  updateOrderWorkflowTransitionDraft,
} from "./order-workflow-draft";
import {
  summarizeOrderWorkflowChanges,
  validateOrderWorkflowDraft,
} from "./order-workflow-draft-review";

const storeId = "store-1";

function workflowFixture(): OrderWorkflow {
  return {
    statuses: fallbackOrderWorkflowStatuses.map((status) => ({
      ...status,
      store_id: storeId,
    })),
    transitions: [],
  };
}

describe("order workflow settings draft", () => {
  it("edits a cloned snapshot without mutating query data", () => {
    const workflow = workflowFixture();
    const originalLabel = workflow.statuses[0].label;
    const state = createOrderWorkflowDraftState(workflow, storeId);
    const next = updateOrderWorkflowStatusDraft(state, state.value.statuses[0].id, {
      label: "待接收",
    });

    expect(isOrderWorkflowDraftDirty(state)).toBe(false);
    expect(isOrderWorkflowDraftDirty(next)).toBe(true);
    expect(workflow.statuses[0].label).toBe(originalLabel);
    expect(state.base.statuses[0].label).toBe(originalLabel);
    expect(next.value.statuses[0].label).toBe("待接收");
  });

  it("tracks local ordering and recommended transition changes in the review summary", () => {
    const initial = createOrderWorkflowDraftState(workflowFixture(), storeId);
    const moved = moveOrderWorkflowStatusDraft(initial, initial.value.statuses[1].id, -1);
    const next = updateOrderWorkflowTransitionDraft(moved, "new", "diagnosing", {
      enabled: true,
      is_primary: true,
    });
    const summary = summarizeOrderWorkflowChanges(next);

    expect(summary.hasChanges).toBe(true);
    expect(summary.orderChanged).toBe(true);
    expect(summary.transitionsChanged).toBe(1);
    expect(summary.impactedEntrypoints).toContain("工单详情、任务页与批量流转");
  });

  it("flags unsafe system and unmapped custom status changes before apply", () => {
    const initial = createOrderWorkflowDraftState(workflowFixture(), storeId);
    const disabledSystem = updateOrderWorkflowStatusDraft(initial, initial.value.statuses[0].id, {
      enabled: false,
    });
    const custom = addOrderWorkflowStatusDraft(disabledSystem, {
      code: "waiting_vendor",
      label: "等待供应商",
      short_label: "等供货",
      tone: "warn",
      bucket: "custom",
      enabled: true,
      show_in_order_filters: true,
      allowed_for_create: false,
      is_default_create_status: false,
    });
    const issueCodes = validateOrderWorkflowDraft(custom).map((item) => item.code);

    expect(issueCodes).toContain("system_disabled");
    expect(issueCodes).toContain("custom_status_unmapped");
  });

  it("defensively rejects a duplicate custom status code", () => {
    const initial = createOrderWorkflowDraftState(workflowFixture(), storeId);
    const input = {
      code: "waiting_vendor",
      label: "等待供应商",
      short_label: "等供货",
      tone: "warn" as const,
      bucket: "custom" as const,
      enabled: true,
      show_in_order_filters: true,
      allowed_for_create: false,
      is_default_create_status: false,
    };
    const first = addOrderWorkflowStatusDraft(initial, input);
    const second = addOrderWorkflowStatusDraft(first, input);
    const customRows = second.value.statuses.filter((status) => status.code === input.code);

    expect(second).toBe(first);
    expect(customRows).toHaveLength(1);
  });

  it("preserves a dirty local draft when a fresher server snapshot arrives", () => {
    const initial = createOrderWorkflowDraftState(workflowFixture(), storeId);
    const local = updateOrderWorkflowStatusDraft(initial, initial.value.statuses[0].id, {
      label: "本地名称",
    });
    const incoming = workflowFixture();
    incoming.statuses[0] = {
      ...incoming.statuses[0],
      label: "服务器名称",
      updated_at: "2026-07-13T12:00:00.000Z",
    };

    const reconciled = reconcileOrderWorkflowDraftState(local, incoming);

    expect(reconciled.conflict).toBe(true);
    expect(reconciled.value.statuses[0].label).toBe("本地名称");
    expect(discardOrderWorkflowDraft(reconciled).value.statuses[0].label).toBe("服务器名称");
  });

  it("rejects a snapshot projected from another store", () => {
    const initial = createOrderWorkflowDraftState(workflowFixture(), storeId);
    const incoming = workflowFixture();
    incoming.statuses = incoming.statuses.map((status) => ({ ...status, store_id: "store-2" }));

    const reconciled = reconcileOrderWorkflowDraftState(initial, incoming);

    expect(reconciled.conflict).toBe(true);
    expect(reconciled.latest.statuses.every((status) => status.store_id === storeId)).toBe(true);
  });

  it("handles an empty workflow as an invalid but safe draft", () => {
    const state = createOrderWorkflowDraftState({ statuses: [], transitions: [] }, storeId);
    const issueCodes = validateOrderWorkflowDraft(state).map((item) => item.code);

    expect(state.value.statuses).toEqual([]);
    expect(issueCodes).toContain("invalid_default_count");
    expect(issueCodes).toContain("no_create_status");
  });
});
