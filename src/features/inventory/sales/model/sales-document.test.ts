import { describe, expect, it } from "vitest";
import { buildSalesDocument, salesWarrantyEndDate } from "./sales-document";

import { documentFixture } from "./sales-document.fixture";

describe("sales document presentation projection", () => {
  it("reprints a historical receipt at its own ledger position after delivery", () => {
    const source = documentFixture();
    source.payments = [...source.payments].reverse();
    const doc = buildSalesDocument(source, "payment", "DEMO-R1");
    expect(doc.paidCents).toBe(10000);
    expect(doc.balanceCents).toBe(32900);
    expect(doc.number).toBe("DEMO-R001");
  });
  it.each([Infinity, NaN, -1, 0.1, Number.MAX_SAFE_INTEGER])(
    "rejects unsafe cents %s",
    (amount) => {
      const source = documentFixture();
      source.payments = [{ ...source.payments[0], amountCents: amount }];
      expect(() => buildSalesDocument(source, "sale")).toThrow();
    },
  );
  it("rejects duplicate payment identities and overpayment", () => {
    const source = documentFixture();
    source.payments = [source.payments[0], source.payments[0]];
    expect(() => buildSalesDocument(source, "sale")).toThrow();
    source.payments = [{ ...source.payments[0], amountCents: 42901 }];
    expect(() => buildSalesDocument(source, "sale")).toThrow();
  });
  it("prints the agreed term before delivery without inventing coverage", () => {
    const source = documentFixture();
    source.deliveredAt = undefined;
    source.coverage = undefined;
    source.payments = source.payments.slice(0, 1);
    expect(buildSalesDocument(source, "sale").source.warrantyAgreement.months).toBe(24);
    expect(() => buildSalesDocument(source, "warranty")).toThrow("warranty-not-started");
  });
  it("requires a used product, express agreement and the matching 12-month expiry", () => {
    const source = documentFixture();
    source.warrantyAgreement.months = 12;
    expect(() => buildSalesDocument(source, "warranty")).toThrow();
    source.warrantyAgreement.shorteningAgreed = true;
    expect(() => buildSalesDocument(source, "warranty")).toThrow(
      "invalid-document-warranty-coverage",
    );
    source.coverage!.endsOn = "2027-09-07";
    source.warrantyAgreement.usedDevice = false;
    expect(() => buildSalesDocument(source, "warranty")).toThrow();
    source.warrantyAgreement.usedDevice = true;
    expect(buildSalesDocument(source, "warranty").source.warrantyAgreement.months).toBe(12);
  });
  it("clamps a leap-day anniversary and rejects a mismatched end date", () => {
    expect(salesWarrantyEndDate("2028-02-29T09:00:00Z", 24)).toBe("2030-02-28");
    const source = documentFixture();
    source.coverage!.endsOn = "2028-09-08";
    expect(() => buildSalesDocument(source, "warranty")).toThrow(
      "invalid-document-warranty-coverage",
    );
  });
  it.each([
    ["2028-02-29T00:30:00+01:00", "2030-02-28"],
    ["2026-03-29T00:30:00+01:00", "2028-03-29"],
    ["2026-10-25T02:30:00+02:00", "2028-10-25"],
  ])("keeps the Rome calendar anniversary for %s", (start, expected) => {
    expect(salesWarrantyEndDate(start, 24)).toBe(expected);
  });
  it("rejects delivery before the final positive payment", () => {
    const source = documentFixture();
    source.deliveredAt = "2026-09-06T09:00:00Z";
    expect(() => buildSalesDocument(source, "sale")).toThrow("invalid-document-delivery");
  });
  it("uses integer cents for small sequential payments", () => {
    const source = documentFixture();
    source.priceCents = 30;
    source.payments = source.payments.map((payment, index) => ({
      ...payment,
      amountCents: index ? 20 : 10,
    }));
    expect(buildSalesDocument(source, "sale").balanceCents).toBe(0);
  });
});
