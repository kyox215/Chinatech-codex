import { describe, expect, it } from "vitest";

import { getQuoteDraftReadiness, getQuoteNotificationReadiness } from "./order-diagnosis-quote";

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
