import { describe, expect, it } from "vitest";

import {
  buildBusinessReasonSelection,
  createEmptyOrderReasonDraft,
  getOrderReasonCatalog,
  getOrderTransitionReasonContext,
  getWarrantyReasonContext,
  isOrderReasonDraftComplete,
} from "./order-reason-catalog";

describe("order reason catalog", () => {
  it("resolves transition contexts without using a dangerous default", () => {
    expect(getOrderTransitionReasonContext("cancelled")).toBe("transition.cancel");
    expect(getOrderTransitionReasonContext("mail_in_progress")).toBe("transition.mail_in");
    expect(createEmptyOrderReasonDraft()).toEqual({ primaryCode: "", note: "" });
  });

  it("keeps approval rejection separate from cancellation", () => {
    const cancellation = getOrderReasonCatalog("transition.cancel");
    const rejection = getOrderReasonCatalog("approval.reject");

    expect(cancellation.options.map((entry) => entry.code)).not.toContain("price_too_high");
    expect(rejection.options.map((entry) => entry.code)).toContain("price_too_high");
  });

  it("requires a note only after other is explicitly selected", () => {
    const catalog = getOrderReasonCatalog("transition.cancel");
    const emptyOther = { primaryCode: "other", note: "" };
    const completeOther = { primaryCode: "other", note: "  客户提出特殊安排\r\n稍后重建  " };

    expect(isOrderReasonDraftComplete(catalog, emptyOther)).toBe(false);
    expect(buildBusinessReasonSelection(catalog, emptyOther)).toBeUndefined();
    expect(buildBusinessReasonSelection(catalog, completeOther)).toMatchObject({
      kind: "other",
      primary_code: "other",
      note: "客户提出特殊安排\n稍后重建",
    });
  });

  it("filters warranty reason context by change direction", () => {
    expect(getWarrantyReasonContext(6, 0)).toBe("warranty.zero");
    expect(getWarrantyReasonContext(12, 6)).toBe("warranty.shorten");
    expect(getWarrantyReasonContext(6, 12)).toBe("warranty.extend");
    expect(getWarrantyReasonContext(6, 6)).toBeUndefined();
  });

  it("does not place refund or payment-method reasons in initial deposit correction", () => {
    const serialized = JSON.stringify(
      getOrderReasonCatalog("finance.initial_deposit_correction").options,
    );

    expect(serialized).not.toContain("退款");
    expect(serialized).not.toContain("支付方式");
  });
});
