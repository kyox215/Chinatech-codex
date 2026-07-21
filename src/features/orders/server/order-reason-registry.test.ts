import { describe, expect, it } from "vitest";

import { ORDER_REASON_CATALOG_REVISION } from "@/features/orders/model/order-reason-catalog";
import {
  getActorScopedOrderReasonCatalog,
  resolveOrderReasonSelection,
  resolveOrderTransitionReasonSelection,
} from "./order-reason-registry";

const capabilities = {
  canEditIntake: true,
  canEditRepair: true,
  canAdjustFinance: true,
  canPrepareQuote: true,
  canSendQuote: true,
  canCollectPayment: true,
  canCorrectInitialDeposit: true,
  canTransition: true,
  canConfirmCancelledReturn: true,
  canCreateKioskSession: true,
  canCorrect: true,
  canReopen: true,
  canVoid: true,
};

describe("server order reason registry", () => {
  it("resolves a stable code to server-owned legacy text", () => {
    const resolved = resolveOrderTransitionReasonSelection({
      from: "diagnosing",
      to: "cancelled",
      selection: {
        schema_version: 2,
        kind: "preset",
        primary_code: "customer_cancelled",
        catalog_revision: ORDER_REASON_CATALOG_REVISION,
      },
    });

    expect(resolved.context).toBe("transition.cancel");
    expect(resolved.legacyText).toBe("客户主动取消本次维修。");
    expect(resolved.auditMetadata).toMatchObject({
      primary_code: "customer_cancelled",
      has_note: false,
    });
    expect(resolved.storedSelection.internal_snapshot).toEqual({
      locale: "zh-CN",
      labels: ["客户主动取消"],
      text: "客户主动取消本次维修。",
    });
  });

  it("rejects stale revisions and unknown codes", () => {
    expect(() =>
      resolveOrderReasonSelection("transition.cancel", {
        schema_version: 2,
        kind: "preset",
        primary_code: "customer_cancelled",
        catalog_revision: "stale",
      }),
    ).toThrow("目录已更新");

    expect(() =>
      resolveOrderReasonSelection("transition.cancel", {
        schema_version: 2,
        kind: "preset",
        primary_code: "not_real",
        catalog_revision: ORDER_REASON_CATALOG_REVISION,
      }),
    ).toThrow("已不可用");
  });

  it("requires other notes and normalizes line endings", () => {
    const resolved = resolveOrderReasonSelection("transition.cancel", {
      schema_version: 2,
      kind: "other",
      primary_code: "other",
      note: "  特殊情况\r\n稍后重建  ",
      catalog_revision: ORDER_REASON_CATALOG_REVISION,
    });

    expect(resolved.legacyText).toBe("特殊情况\n稍后重建");
    expect(() =>
      resolveOrderReasonSelection("transition.cancel", {
        schema_version: 2,
        kind: "other",
        primary_code: "other",
        note: " ",
        catalog_revision: ORDER_REASON_CATALOG_REVISION,
      }),
    ).toThrow("请填写其他原因");
  });

  it("limits rework to post-close reopening", () => {
    expect(() =>
      resolveOrderTransitionReasonSelection({
        from: "repairing",
        to: "rework",
        selection: {
          schema_version: 2,
          kind: "preset",
          primary_code: "suspected_same_issue",
          catalog_revision: ORDER_REASON_CATALOG_REVISION,
        },
      }),
    ).toThrow("返修只用于已结束工单");
  });

  it("returns an actor-scoped catalog without server legacy text", () => {
    const response = getActorScopedOrderReasonCatalog({
      orderStatus: "completed",
      capabilities,
      request: { action: "terminal_reopen" },
    });

    expect(response).toMatchObject({
      context: "terminal.reopen",
      policy: "required",
      cardinality: { primary: 1, detail_min: 0, detail_max: 0 },
    });
    expect(response.options[0]).not.toHaveProperty("legacyText");
    expect(response.options[0]).not.toHaveProperty("legacy_text");
  });

  it("does not expose a catalog when the projected capability is denied", () => {
    expect(() =>
      getActorScopedOrderReasonCatalog({
        orderStatus: "completed",
        capabilities: { ...capabilities, canVoid: false },
        request: { action: "terminal_void" },
      }),
    ).toThrow("当前工单不允许此原因操作");
  });
});
