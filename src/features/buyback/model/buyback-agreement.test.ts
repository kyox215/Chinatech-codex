import { describe, expect, it } from "vitest";

import {
  BUYBACK_PRIVACY_NOTICE_SHA256,
  BUYBACK_PRIVACY_NOTICE_TEXT_IT,
  BUYBACK_TERMS_SHA256,
  BUYBACK_TERMS_TEXT_IT,
  canUseConfiguredBuybackLegalProfile,
  canonicalizeBuybackAgreement,
  documentNumberLast4,
  hashBuybackAgreementSnapshot,
  hashBuybackLegalText,
  isSafeBuybackVerificationNote,
  requiredBuybackDocumentSides,
} from "./buyback-agreement";

describe("buyback agreement binding", () => {
  it("canonicalizes nested objects independent of key insertion order", async () => {
    const left = { quote: { currency: "EUR", amount: 250 }, seller: { name: "Mario" } };
    const right = { seller: { name: "Mario" }, quote: { amount: 250, currency: "EUR" } };

    expect(canonicalizeBuybackAgreement(left)).toBe(canonicalizeBuybackAgreement(right));
    expect(await hashBuybackAgreementSnapshot(left)).toBe(
      await hashBuybackAgreementSnapshot(right),
    );
  });

  it("invalidates the hash when a critical transaction value changes", async () => {
    const snapshot = { device: { imei: "3560001" }, quote: { amount: 250 } };
    const changed = { device: { imei: "3560001" }, quote: { amount: 260 } };

    expect(await hashBuybackAgreementSnapshot(snapshot)).not.toBe(
      await hashBuybackAgreementSnapshot(changed),
    );
  });

  it("pins the visible Italian privacy notice and buyback terms to SHA-256", async () => {
    expect(await hashBuybackLegalText(BUYBACK_PRIVACY_NOTICE_TEXT_IT)).toBe(
      BUYBACK_PRIVACY_NOTICE_SHA256,
    );
    expect(await hashBuybackLegalText(BUYBACK_TERMS_TEXT_IT)).toBe(BUYBACK_TERMS_SHA256);
  });

  it("invalidates the signed summary when legal text changes without a new signature", async () => {
    const snapshot = {
      legal_documents: {
        privacy_notice: { text: BUYBACK_PRIVACY_NOTICE_TEXT_IT },
        buyback_terms: { text: BUYBACK_TERMS_TEXT_IT },
      },
    };
    const changed = {
      legal_documents: {
        ...snapshot.legal_documents,
        buyback_terms: { text: `${BUYBACK_TERMS_TEXT_IT}\nModifica non firmata` },
      },
    };

    expect(await hashBuybackAgreementSnapshot(snapshot)).not.toBe(
      await hashBuybackAgreementSnapshot(changed),
    );
  });

  it("requires one passport page and two sides for standard identity documents", () => {
    expect(requiredBuybackDocumentSides("passport")).toEqual(["id_front"]);
    expect(requiredBuybackDocumentSides("id_card")).toEqual(["id_front", "id_back"]);
    expect(documentNumberLast4("YA 1234567")).toBe("4567");
  });

  it("rejects verification notes that try to retain a separated document number", () => {
    expect(isSafeBuybackVerificationNote("Documento verificato in negozio")).toBe(true);
    expect(isSafeBuybackVerificationNote("Documento A-1-2-3-4-5")).toBe(false);
  });

  it("does not allow the placeholder legal profile as a multi-store default", () => {
    expect(canUseConfiguredBuybackLegalProfile()).toBe(false);
    expect(BUYBACK_PRIVACY_NOTICE_TEXT_IT).not.toMatch(/ChinaTech|Chinatech|Floridia/i);
    expect(BUYBACK_TERMS_TEXT_IT).not.toMatch(/ChinaTech|Chinatech|Floridia/i);
  });
});
