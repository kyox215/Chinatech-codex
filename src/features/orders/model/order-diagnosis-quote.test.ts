import { describe, expect, it } from "vitest";

import {
  CANNOT_DESCRIBE_ISSUE_DESCRIPTION,
  DIAGNOSTIC_ONLY_ISSUE_DESCRIPTION,
  UNKNOWN_ISSUE_DESCRIPTION,
  getQuoteDraftReadiness,
  getQuoteNotificationReadiness,
  inferIssueCaptureModeForLegacyDraft,
  issueDescriptionForIntake,
  resolveIntakeQuoteDraft,
} from "./order-diagnosis-quote";

describe("unknown issue intake", () => {
  it("stores an explicit pending-diagnosis description without a fake quote row", () => {
    expect(issueDescriptionForIntake("unknown", "ignored")).toBe(UNKNOWN_ISSUE_DESCRIPTION);
    expect(inferIssueCaptureModeForLegacyDraft(UNKNOWN_ISSUE_DESCRIPTION)).toBe("unknown");
  });

  it("keeps cannot-describe and diagnostic-only as distinct no-typing intake intents", () => {
    expect(issueDescriptionForIntake("cannot_describe", "ignored")).toBe(
      CANNOT_DESCRIBE_ISSUE_DESCRIPTION,
    );
    expect(issueDescriptionForIntake("diagnostic_only", "ignored")).toBe(
      DIAGNOSTIC_ONLY_ISSUE_DESCRIPTION,
    );
    expect(inferIssueCaptureModeForLegacyDraft(CANNOT_DESCRIBE_ISSUE_DESCRIPTION)).toBe(
      "cannot_describe",
    );
    expect(inferIssueCaptureModeForLegacyDraft(DIAGNOSTIC_ONLY_ISSUE_DESCRIPTION)).toBe(
      "diagnostic_only",
    );
  });

  it("requires and preserves the customer's reported symptom when the problem is known", () => {
    expect(issueDescriptionForIntake("reported", "  掉电很快  ")).toBe("掉电很快");
    expect(() => issueDescriptionForIntake("reported", "  ")).toThrow("请填写客户描述的故障现象");
  });

  it("keeps paused quote drafts out of unknown-intake submissions", () => {
    const draftItems = [{ name: "更换电池", price: 59 }];
    expect(
      resolveIntakeQuoteDraft({
        mode: "unknown",
        items: draftItems,
        total: 59,
        deposit: 20,
      }),
    ).toEqual({ items: [], total: 0, deposit: 0 });
    expect(
      resolveIntakeQuoteDraft({
        mode: "diagnostic_only",
        items: draftItems,
        total: 59,
        deposit: 20,
      }),
    ).toEqual({ items: [], total: 0, deposit: 0 });
    expect(
      resolveIntakeQuoteDraft({
        mode: "reported",
        items: draftItems,
        total: 59,
        deposit: 20,
      }),
    ).toEqual({ items: draftItems, total: 59, deposit: 20 });
  });
});

describe("quote readiness", () => {
  const readyInput = {
    diagnosisResult: "检测确认电池健康度过低",
    faultPrices: [{ name: "更换电池", price: 59 }],
    depositAmount: 0,
  };

  it("requires a diagnosis and at least one complete quote item", () => {
    expect(
      getQuoteDraftReadiness({ ...readyInput, diagnosisResult: "", faultPrices: [] }),
    ).toMatchObject({
      ready: false,
      missing: ["diagnosis", "items"],
    });
  });

  it("accepts an ordinary positive quote", () => {
    expect(getQuoteDraftReadiness(readyInput)).toEqual({
      ready: true,
      missing: [],
      quotationAmount: 59,
    });
  });

  it("requires an explicit kind and reason when any quote line is zero", () => {
    const zeroQuote = {
      ...readyInput,
      faultPrices: [{ name: "保修检测", price: 0 }],
    };
    expect(getQuoteDraftReadiness(zeroQuote)).toMatchObject({
      ready: false,
      missing: ["price_exception"],
    });
    expect(
      getQuoteDraftReadiness({
        ...zeroQuote,
        priceException: { kind: "warranty" as const, reason: "店内保修复检" },
      }),
    ).toMatchObject({ ready: true, quotationAmount: 0 });
  });

  it("rejects a deposit above the server-derived quotation", () => {
    expect(getQuoteDraftReadiness({ ...readyInput, depositAmount: 60 })).toMatchObject({
      ready: false,
      missing: ["deposit"],
    });
  });

  it("binds notification readiness to permission, phone and an opaque quote publication id", () => {
    expect(
      getQuoteNotificationReadiness({
        draft: readyInput,
        canSendQuote: false,
        recipientPhone: "",
        quotePublicationId: undefined,
      }),
    ).toMatchObject({
      ready: false,
      missing: ["permission", "phone", "published_quote"],
    });

    expect(
      getQuoteNotificationReadiness({
        draft: readyInput,
        canSendQuote: true,
        recipientPhone: "+39 333 123 4567",
        quotePublicationId: "19ccfb69-81aa-48d5-891b-71764ac4782f",
      }),
    ).toMatchObject({ ready: true, missing: [] });
  });
});
