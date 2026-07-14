import { describe, expect, it } from "vitest";

import type { InventoryItemStatus, InventoryListItem } from "@/lib/repairdesk/types";

import {
  buildBuybackListViews,
  buildBuybackListSummary,
  filterBuybackItemsByView,
  getBuybackInventoryHandoff,
  getBuybackNextActionLabel,
  getBuybackRecordPrimaryAction,
  getBuybackRecordProgress,
  getBuybackRecordReadiness,
  getBuybackRecordStepIndex,
  getBuybackRecordTaskGuidance,
} from "./buyback-record-workflow";

function makeItem(
  status: InventoryItemStatus,
  overrides: Partial<InventoryListItem> = {},
): InventoryListItem {
  return {
    id: `item_${status}_${Math.random()}`,
    public_no: "I001",
    status,
    source_type: "buyback",
    category: "phone",
    brand: "Apple",
    model: "iPhone 13",
    imei_check_status: "unchecked",
    activation_lock_status: "unchecked",
    data_wipe_status: "unchecked",
    cosmetic_grade: "good",
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
    created_at: "2026-06-18T08:00:00.000Z",
    updated_at: "2026-06-18T08:00:00.000Z",
    item_label: "Apple iPhone 13",
    profit: 0,
    ...overrides,
  };
}

describe("buyback record workflow", () => {
  it.each([
    ["intake", 0],
    ["offer_made", 1],
    ["evaluating", 2],
    ["purchased", 3],
    ["data_wipe", 3],
    ["ready_for_sale", 3],
    ["sold", 3],
  ] satisfies [InventoryItemStatus, number][])("maps %s to step %s", (status, expected) => {
    expect(getBuybackRecordStepIndex(status)).toBe(expected);
  });

  it("marks progress steps for the current status", () => {
    const progress = getBuybackRecordProgress("evaluating", "low");

    expect(progress.activeStepIndex).toBe(2);
    expect(progress.steps.map((step) => [step.label, step.completed, step.active])).toEqual([
      ["估价", true, false],
      ["确认", true, false],
      ["检测", false, true],
      ["保存", false, false],
    ]);
    expect(progress.nextAction).toBe("下一步：完成功能检测");
  });

  it("uses risk review as the first next action for high risk records", () => {
    expect(getBuybackNextActionLabel("offer_made", "high")).toBe(
      "下一步：负责人复核风险后保存记录",
    );
  });

  it("summarizes buyback list counts by work state", () => {
    const summary = buildBuybackListSummary([
      makeItem("intake"),
      makeItem("evaluating"),
      makeItem("offer_made"),
      makeItem("purchased"),
      makeItem("ready_for_sale"),
      makeItem("listed"),
      makeItem("sold"),
      makeItem("offer_made", {
        legacy_payload: { buyback_quote: { risk_level: "high" } },
      }),
    ]);

    expect(summary).toEqual({
      total: 8,
      pendingCount: 2,
      quotedCount: 2,
      purchasedCount: 1,
      readyCount: 2,
      reviewCount: 1,
      soldCount: 1,
    });
  });

  it("builds guided list views and filters high-risk records for review", () => {
    const highRisk = makeItem("offer_made", {
      id: "review",
      legacy_payload: { buyback_quote: { risk_level: "high" } },
    });
    const items = [
      makeItem("intake", { id: "intake" }),
      makeItem("evaluating", { id: "inspection" }),
      highRisk,
      makeItem("ready_for_sale", { id: "ready" }),
      makeItem("listed", { id: "listed" }),
      makeItem("sold", { id: "sold" }),
    ];

    expect(buildBuybackListViews(items).map((view) => [view.key, view.count])).toEqual([
      ["all", 6],
      ["intake", 1],
      ["inspection", 1],
      ["quote", 1],
      ["review", 1],
      ["purchased", 0],
      ["ready", 2],
      ["done", 1],
    ]);
    expect(filterBuybackItemsByView(items, "review")).toEqual([highRisk]);
    expect(filterBuybackItemsByView(items, "ready").map((item) => item.id)).toEqual([
      "ready",
      "listed",
    ]);
  });

  it("describes the handoff between buyback and inventory work", () => {
    expect(getBuybackInventoryHandoff("intake", "low")).toMatchObject({
      target: "quote",
      label: "补全估价",
      actionLabel: "继续报价",
    });
    expect(getBuybackInventoryHandoff("offer_made", "high")).toMatchObject({
      target: "risk_review",
      label: "负责人复核",
      tone: "warning",
    });
    expect(getBuybackInventoryHandoff("purchased", "low")).toMatchObject({
      target: "inventory",
      label: "库存整备",
      actionLabel: "打开库存",
    });
    expect(getBuybackInventoryHandoff("listed", "low")).toMatchObject({
      target: "sales",
      label: "售卖跟进",
      tone: "success",
    });
    expect(getBuybackInventoryHandoff("sold", "low")).toMatchObject({
      target: "closed",
      label: "已完成",
      actionLabel: "查看记录",
    });
  });

  it("builds task guidance for technician follow-up", () => {
    expect(getBuybackRecordTaskGuidance("intake", "low")).toMatchObject({
      title: "补全简易估价",
      primaryAction: "继续估价",
      tone: "info",
    });
    expect(getBuybackRecordTaskGuidance("offer_made", "low")).toMatchObject({
      title: "报价与检测已保存",
      primaryAction: "复估或补检测",
      tone: "info",
    });
    expect(getBuybackRecordTaskGuidance("evaluating", "low").checklist).toContain(
      "核对 IMEI / 序列号",
    );
    expect(getBuybackRecordTaskGuidance("purchased", "low")).toMatchObject({
      title: "进入库存整备",
      primaryAction: "库存整备",
      tone: "success",
    });
    expect(getBuybackRecordTaskGuidance("purchased", "low").checklist).toContain(
      "不要补采证件或签名",
    );
  });

  it("prioritizes risk guidance while a quote can still be resumed", () => {
    const guidance = getBuybackRecordTaskGuidance("offer_made", "high");

    expect(guidance.title).toBe("先做负责人复核");
    expect(guidance.primaryAction).toBe("复核风险");
    expect(guidance.checklist).toContain("店长确认最终报价");
  });

  it("keeps purchased high-risk records in read-only inventory guidance", () => {
    const guidance = getBuybackRecordTaskGuidance("purchased", "high");

    expect(guidance).toMatchObject({
      title: "进入库存整备",
      primaryAction: "库存整备",
      tone: "success",
    });
    expect(guidance.checklist).toContain("历史凭证保持只读");
    expect(guidance.checklist).toContain("不要补采证件或签名");
  });

  it("keeps ready-for-sale high-risk records in sales guidance", () => {
    expect(getBuybackRecordTaskGuidance("ready_for_sale", "high")).toMatchObject({
      title: "售卖跟进",
      primaryAction: "查看销售",
      tone: "success",
    });
  });

  it("summarizes the next missing buyback action for list cards", () => {
    const readiness = getBuybackRecordReadiness(
      makeItem("evaluating", {
        buyback_price: 120,
        list_price: 260,
        legacy_payload: {
          buyback_quote: {
            final_offer: 120,
            intent_outcome: "accepted",
          },
          buyback_function_checks: {
            imei_check_status: "pass",
            screen_display_status: "pass",
            touch_status: "unchecked",
            data_wipe_status: "pass",
          },
        },
      }),
      "low",
    );

    expect(readiness).toMatchObject({
      state: "todo",
      label: "补齐功能检测",
      detail: "还缺 触控",
    });
    expect(readiness.missing).toContain("触控");
  });

  it("blocks high-risk records before inventory handoff", () => {
    const readiness = getBuybackRecordReadiness(
      makeItem("offer_made", {
        legacy_payload: {
          buyback_quote: {
            final_offer: 180,
            hard_block: true,
            risk_notes: ["账号锁 / Find My 未关闭"],
          },
        },
      }),
      "high",
    );

    expect(readiness.state).toBe("blocked");
    expect(readiness.label).toBe("先复核风险");
    expect(readiness.missing).toEqual(["账号锁 / Find My 未关闭"]);
  });

  it("does not ask staff to collect sensitive proof while the workflow is off", () => {
    const readiness = getBuybackRecordReadiness(
      makeItem("purchased", {
        customer_name: "Mario Rossi",
        customer_phone: "+393331234567",
        imei_check_status: "pass",
        data_wipe_status: "unchecked",
        legacy_payload: {
          buyback_quote: {
            final_offer: 180,
            intent_outcome: "accepted",
          },
          buyback_device: {
            purchase_proof: false,
            box_included: false,
          },
          buyback_declarations: {
            no_invoice_confirmed: false,
            no_box_confirmed: false,
          },
          buyback_customer: {
            name: "Mario Rossi",
            phone: "+393331234567",
            document_no_masked: "YA*****67",
            signature_captured: true,
            id_front_captured: true,
            id_back_captured: true,
            device_photo_captured: true,
            invoice_photo_captured: false,
            box_photo_captured: false,
          },
          buyback_function_checks: {
            imei_check_status: "pass",
            screen_display_status: "pass",
            touch_status: "pass",
            front_camera_status: "pass",
            back_camera_status: "pass",
            microphone_status: "pass",
            receiver_status: "pass",
            speaker_status: "pass",
            buttons_status: "pass",
            charging_status: "pass",
            wifi_status: "pass",
            bluetooth_status: "pass",
            cellular_status: "pass",
            water_damage_status: "pass",
            data_wipe_status: "pass",
          },
        },
      }),
      "low",
    );

    expect(readiness).toMatchObject({
      state: "todo",
      label: "补齐库存整备",
      detail: "还缺 数据抹除记录",
    });
    expect(readiness.missing).toEqual(["数据抹除记录"]);
  });

  it("accepts a passport data page and signed no-invoice/no-box declarations", () => {
    const readiness = getBuybackRecordReadiness(
      makeItem("purchased", {
        customer_name: "Mario Rossi",
        customer_phone: "+393331234567",
        imei_check_status: "pass",
        data_wipe_status: "pass",
        legacy_payload: {
          buyback_quote: { final_offer: 180, intent_outcome: "accepted" },
          buyback_device: { purchase_proof: false, box_included: false },
          buyback_declarations: {
            no_invoice_confirmed: true,
            no_box_confirmed: true,
          },
          buyback_customer: {
            name: "Mario Rossi",
            phone: "+393331234567",
            document_type: "passport",
            document_no_masked: "YA*****67",
            signature_captured: true,
            id_front_captured: true,
            id_back_captured: false,
            device_photo_captured: true,
            invoice_photo_captured: false,
            box_photo_captured: false,
          },
          buyback_function_checks: {
            imei_check_status: "pass",
            screen_display_status: "pass",
            touch_status: "pass",
            front_camera_status: "pass",
            back_camera_status: "pass",
            microphone_status: "pass",
            receiver_status: "pass",
            speaker_status: "pass",
            buttons_status: "pass",
            charging_status: "pass",
            wifi_status: "pass",
            bluetooth_status: "pass",
            cellular_status: "pass",
            water_damage_status: "pass",
            data_wipe_status: "pass",
          },
        },
      }),
      "low",
    );

    expect(readiness.missing).toEqual([]);
    expect(readiness.state).toBe("ready");
  });

  it("builds one primary action for buyback operators", () => {
    expect(
      getBuybackRecordPrimaryAction(
        makeItem("offer_made", {
          legacy_payload: {
            buyback_quote: {
              final_offer: 180,
              hard_block: true,
              risk_notes: ["账号锁 / Find My 未关闭"],
            },
          },
        }),
        "high",
      ),
    ).toMatchObject({
      label: "先复核风险",
      actionLabel: "复核风险",
      detail: "账号锁 / Find My 未关闭",
      canResumeQuote: true,
      missingCount: 1,
    });

    expect(
      getBuybackRecordPrimaryAction(
        makeItem("evaluating", {
          buyback_price: 120,
          legacy_payload: {
            buyback_quote: {
              final_offer: 120,
              intent_outcome: "accepted",
            },
            buyback_function_checks: {
              imei_check_status: "pass",
              screen_display_status: "pass",
              touch_status: "unchecked",
              data_wipe_status: "pass",
            },
          },
        }),
        "low",
      ),
    ).toMatchObject({
      label: "补齐功能检测",
      actionLabel: "继续检测",
      detail: "先补：触控",
      canResumeQuote: true,
    });

    expect(getBuybackRecordPrimaryAction(makeItem("sold"), "low")).toMatchObject({
      label: "已完成",
      actionLabel: "查看记录",
      canResumeQuote: false,
      missingCount: 0,
    });

    const purchasedHighRisk = getBuybackRecordPrimaryAction(makeItem("purchased"), "high");
    expect(purchasedHighRisk.canResumeQuote).toBe(false);
    expect(purchasedHighRisk.label).not.toBe("先复核风险");
  });
});
