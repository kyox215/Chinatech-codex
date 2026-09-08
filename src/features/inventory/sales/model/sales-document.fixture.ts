import type { SalesDocumentSource } from "./sales-document";

/** Synthetic browser/unit fixture; never imported by a production screen. */
export const documentFixture = (): SalesDocumentSource => ({
  saleNumber: "DEMO-S2026-001",
  agreedAt: "2026-09-01T09:00:00Z",
  product: {
    name: "Samsung Galaxy S23",
    sku: "DEMO-P001",
    specification: "256 GB · 8 GB · Black",
    identifierLabel: "IMEI",
    identifier: "990000000000093",
  },
  customer: { name: "Demo Customer", phone: "+1 202-555-0101" },
  priceCents: 42900,
  payments: [
    {
      id: "DEMO-R1",
      receiptNumber: "DEMO-R001",
      sequence: 1,
      amountCents: 10000,
      occurredAt: "2026-09-01T09:00:00Z",
      method: "cash",
    },
    {
      id: "DEMO-R2",
      receiptNumber: "DEMO-R002",
      sequence: 2,
      amountCents: 32900,
      occurredAt: "2026-09-07T09:00:00Z",
      method: "card",
    },
  ],
  deliveredAt: "2026-09-07T09:00:00Z",
  warrantyAgreement: {
    months: 24,
    usedDevice: true,
    shorteningAgreed: false,
    termsVersion: "DEMO-2026-01",
  },
  coverage: { startsAt: "2026-09-07T09:00:00Z", endsOn: "2028-09-07" },
  store: {
    storeName: "Demo Store",
    storeAddress: "1 Test Street",
    storeContactLine: "Tel +1 202-555-0100",
    storeSummaryLine: "1 Test Street · Tel +1 202-555-0100",
    printFooter: "",
    privacyNote: "",
    canOutput: true,
    warnings: [],
  },
  sample: true,
});
