import { describe, expect, it } from "vitest";

import type { InventoryLifecycleListSummary } from "@/lib/repairdesk/types";

import { resolveInventoryDetailNextAction } from "./resolve-inventory-detail-next-action";

describe("resolveInventoryDetailNextAction", () => {
  it("prioritizes writable after-sales work over edit fallback", () => {
    const action = resolve({
      after_sales: {
        case_id: "case/demo",
        sale_order_id: "sale/demo",
        inventory_item_id: "item-1",
        status: "in_progress",
        received_at: "2026-08-01T08:00:00.000Z",
        version: 1,
      },
      allowed_actions: ["after_sales.update"],
    });

    expect(action).toMatchObject({
      kind: "action",
      id: "after-sales-work",
      label: "继续处理售后",
      href: "/inventory/after-sales/case%2Fdemo",
      command: "after_sales.update",
    });
  });

  it("keeps a view-only after-sales case safe and routable", () => {
    const action = resolve({
      after_sales: {
        case_id: "case-1",
        sale_order_id: "sale-1",
        inventory_item_id: "item-1",
        status: "in_progress",
        received_at: "2026-08-01T08:00:00.000Z",
        version: 1,
      },
      allowed_actions: [],
    });

    expect(action).toMatchObject({
      kind: "action",
      id: "view-after-sales",
      label: "查看售后案件",
      readOnly: true,
    });
  });

  it.each([
    ["payment.append", "sale-collection", "继续预订与收款"],
    ["sale.complete", "sale-collection", "继续预订与收款"],
    ["reservation.cancel", "sale-collection", "继续预订与收款"],
    ["pickup.confirm", "sale-pickup", "确认客户取走"],
    ["warranty.adjust", "sale-warranty", "打开销售与保修"],
    ["after_sales.create", "sale-warranty", "打开销售与保修"],
  ] as const)("maps sale command %s to %s", (command, id, label) => {
    const action = resolve({ sale_order_id: "sale-1", allowed_actions: [command] });
    expect(action).toMatchObject({ kind: "action", id, label, command });
  });

  it("keeps a view-only sale readable without inventing a write action", () => {
    expect(resolve({ sale_order_id: "sale-1", allowed_actions: [] })).toMatchObject({
      kind: "action",
      id: "view-sale",
      label: "查看销售记录",
      readOnly: true,
    });
  });

  it("uses reservation.create before inspection or edit", () => {
    expect(resolve({ allowed_actions: ["reservation.create", "inspection.save"] })).toMatchObject({
      id: "reserve-product",
      label: "开始预订",
    });
  });

  it("routes inspection.save to the stable in-page editor anchor", () => {
    expect(resolve({ allowed_actions: ["inspection.save"] })).toMatchObject({
      kind: "action",
      id: "inspection-editor",
      target: "inspection-editor",
      command: "inspection.save",
    });
  });

  it("does not guess while lifecycle data is loading", () => {
    expect(
      resolve({ lifecycleSummaryState: "loading", canEdit: true, allowed_actions: [] }),
    ).toEqual({
      kind: "loading",
      label: "正在读取下一动作",
      reason: "lifecycle-loading",
    });
  });

  it("falls back to edit only when lifecycle is unavailable or dormant", () => {
    expect(resolve({ lifecycleSummaryState: "unavailable", canEdit: true })).toMatchObject({
      id: "edit-product",
      href: "/inventory/item-1/edit",
    });
    expect(resolve({ lifecycleSummaryState: "dormant", canEdit: true })).toMatchObject({
      id: "edit-product",
    });
    expect(resolve({ lifecycleSummaryState: "ready", canEdit: true })).toEqual({
      kind: "none",
      reason: "lifecycle-ready-without-summary",
    });
  });

  it("prefers exact projection actions over stale summary actions", () => {
    const action = resolve({
      allowed_actions: ["reservation.create"],
      projection: {
        mode: "exact",
        status: "in_stock",
        confidence: "high",
        needs_review: false,
        allowed_actions: ["inspection.save"],
      },
    });

    expect(action).toMatchObject({ id: "inspection-editor" });
  });

  it("does not turn stale empty actions into a write label", () => {
    expect(resolve({ allowed_actions: [], canEdit: false })).toEqual({
      kind: "none",
      reason: "no-server-action",
    });
  });

  it("does not use client edit capability when a readable summary has no server action", () => {
    expect(resolve({ allowed_actions: [], canEdit: true })).toEqual({
      kind: "none",
      reason: "no-server-action",
    });
  });
});

function resolve(
  overrides: Partial<InventoryLifecycleListSummary> & {
    lifecycleSummaryState?: "loading" | "ready" | "unavailable" | "dormant";
    canEdit?: boolean;
  } = {},
) {
  const { lifecycleSummaryState, canEdit = false, ...summaryOverrides } = overrides;
  const hasSummary = Object.keys(summaryOverrides).length > 0;
  return resolveInventoryDetailNextAction({
    itemId: "item-1",
    summary: hasSummary ? summaryFixture(summaryOverrides) : undefined,
    lifecycleSummaryState,
    canEdit,
  });
}

function summaryFixture(
  overrides: Partial<InventoryLifecycleListSummary>,
): InventoryLifecycleListSummary {
  return {
    item_id: "item-1",
    stock_unit_id: "unit-1",
    sku: "CT-DEMO-001",
    business_status: "in_stock",
    allowed_actions: [],
    after_sales: undefined,
    ...overrides,
  };
}
