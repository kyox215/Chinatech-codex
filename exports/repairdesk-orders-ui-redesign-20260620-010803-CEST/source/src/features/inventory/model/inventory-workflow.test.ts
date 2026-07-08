import { describe, expect, it } from "vitest";
import type { InventoryListItem } from "@/lib/repairdesk/types";

import {
  buildInventoryListViews,
  canTransitionInventoryItem,
  filterInventoryItemsByView,
  getInventoryPrimaryAction,
  getInventoryProfit,
  inventoryNextActionLabel,
  isInventoryAttentionItem,
  validateInventoryTransition,
} from "./inventory-workflow";

describe("inventory workflow", () => {
  it("allows the main buyback and resale flow", () => {
    expect(canTransitionInventoryItem("intake", "evaluating")).toBe(true);
    expect(canTransitionInventoryItem("intake", "offer_made")).toBe(true);
    expect(canTransitionInventoryItem("evaluating", "offer_made")).toBe(true);
    expect(canTransitionInventoryItem("offer_made", "purchased")).toBe(true);
    expect(canTransitionInventoryItem("purchased", "data_wipe")).toBe(true);
    expect(canTransitionInventoryItem("data_wipe", "refurbishing")).toBe(true);
    expect(canTransitionInventoryItem("refurbishing", "ready_for_sale")).toBe(true);
    expect(canTransitionInventoryItem("ready_for_sale", "listed")).toBe(true);
    expect(canTransitionInventoryItem("listed", "reserved")).toBe(true);
    expect(canTransitionInventoryItem("reserved", "sold")).toBe(true);
  });

  it("rejects illegal jumps out of intake", () => {
    expect(() => validateInventoryTransition("intake", "sold")).toThrow(/不能从/);
  });

  it("calculates profit with costs, fees, refunds, and extra transactions", () => {
    expect(
      getInventoryProfit(
        {
          sale_price: 420,
          buyback_price: 250,
          repair_cost_amount: 20,
          fees_amount: 5,
        },
        [
          { transaction_type: "refund", amount: 30 },
          { transaction_type: "repair_cost", amount: 10 },
          { transaction_type: "fee", amount: 5 },
        ],
      ),
    ).toBe(100);
  });

  it("builds guided list views from inventory business state", () => {
    const items = [
      inventoryItem({ id: "1", status: "intake" }),
      inventoryItem({ id: "2", status: "listed" }),
      inventoryItem({ id: "3", status: "reserved" }),
      inventoryItem({ id: "4", status: "sold" }),
      inventoryItem({ id: "5", status: "returned" }),
      inventoryItem({
        id: "6",
        status: "listed",
        functional_grade: "needs_repair",
      }),
    ];

    expect(filterInventoryItemsByView(items, "pipeline")).toHaveLength(1);
    expect(filterInventoryItemsByView(items, "sale")).toHaveLength(2);
    expect(filterInventoryItemsByView(items, "reserved")).toHaveLength(1);
    expect(filterInventoryItemsByView(items, "sold")).toHaveLength(1);
    expect(filterInventoryItemsByView(items, "attention")).toHaveLength(2);
    expect(filterInventoryItemsByView(items, "closed")).toHaveLength(1);

    expect(
      Object.fromEntries(buildInventoryListViews(items).map((view) => [view.key, view.count])),
    ).toMatchObject({
      all: 6,
      pipeline: 1,
      sale: 2,
      attention: 2,
    });
  });

  it("flags items that need staff attention before resale", () => {
    expect(
      isInventoryAttentionItem(
        inventoryItem({
          status: "listed",
          data_wipe_status: "unchecked",
        }),
      ),
    ).toBe(true);
    expect(
      isInventoryAttentionItem(
        inventoryItem({
          status: "listed",
          data_wipe_status: "pass",
          functional_grade: "passed",
          cosmetic_grade: "good",
        }),
      ),
    ).toBe(false);
    expect(
      isInventoryAttentionItem(
        inventoryItem({
          status: "evaluating",
          activation_lock_status: "fail",
        }),
      ),
    ).toBe(true);
  });

  it("builds operational primary actions for inventory cards", () => {
    expect(
      getInventoryPrimaryAction(
        inventoryItem({
          status: "listed",
          data_wipe_status: "unchecked",
        }),
      ),
    ).toMatchObject({
      label: "先清除资料",
      actionLabel: "登记检测",
      actionKind: "check",
      tone: "warning",
      nextStatus: "data_wipe",
    });

    expect(
      getInventoryPrimaryAction(
        inventoryItem({
          status: "intake",
          source_type: "buyback",
        }),
      ),
    ).toMatchObject({
      label: "补齐入库检测",
      detail: "来自回收报价，先完成检测和资料确认。",
      actionLabel: "登记检测",
      actionKind: "check",
      nextStatus: "evaluating",
    });

    expect(
      getInventoryPrimaryAction(
        inventoryItem({
          status: "refurbishing",
          list_price: 0,
        }),
      ),
    ).toMatchObject({
      label: "准备上架",
      actionLabel: "补价格",
      actionKind: "update",
      tone: "warning",
    });

    expect(
      getInventoryPrimaryAction(
        inventoryItem({
          status: "sold",
          sale_price: 299,
        }),
      ),
    ).toMatchObject({
      label: "已售出",
      actionLabel: "查看记录",
      actionKind: "view",
      tone: "success",
    });

    expect(
      getInventoryPrimaryAction(
        inventoryItem({
          status: "listed",
          list_price: 299,
        }),
      ),
    ).toMatchObject({
      label: "跟进销售",
      actionLabel: "登记售出",
      actionKind: "sell",
    });
  });

  it("keeps the legacy next action label available", () => {
    expect(inventoryNextActionLabel("offer_made")).toBe("下一步：客户确认回收");
    expect(
      inventoryNextActionLabel(
        inventoryItem({
          status: "reserved",
        }),
      ),
    ).toBe("下一步：确认售出");
  });
});

function inventoryItem(overrides: Partial<InventoryListItem>): InventoryListItem {
  return {
    id: "item",
    public_no: "INV-001",
    status: "intake",
    source_type: "buyback",
    category: "phone",
    brand: "Apple",
    model: "iPhone",
    imei_check_status: "unchecked",
    activation_lock_status: "unchecked",
    data_wipe_status: "pass",
    cosmetic_grade: "unknown",
    functional_grade: "untested",
    buyback_price: 0,
    list_price: 0,
    sale_price: 0,
    deposit_amount: 0,
    repair_cost_amount: 0,
    fees_amount: 0,
    currency_code: "EUR",
    warranty_months: 0,
    legacy_payload: {},
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
    item_label: "Apple iPhone",
    profit: 0,
    ...overrides,
  };
}
