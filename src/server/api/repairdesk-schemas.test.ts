import { describe, expect, it } from "vitest";

import {
  BUYBACK_AGREEMENT_VERSION,
  BUYBACK_PRIVACY_NOTICE_SHA256,
  BUYBACK_PRIVACY_NOTICE_TEXT_IT,
  BUYBACK_PRIVACY_NOTICE_VERSION,
  BUYBACK_TERMS_SHA256,
  BUYBACK_TERMS_TEXT_IT,
} from "@/features/buyback/model/buyback-agreement";
import { repairServiceCatalogItems } from "@/entities/order";

import {
  approvalStatusSchema,
  batchTransitionBodySchema,
  buybackFinalizeInputSchema,
  createOrderSchema,
  correctTerminalOrderInputSchema,
  customerListPageInputSchema,
  customerIntakeSearchBodySchema,
  customerSearchBodySchema,
  dashboardPrioritySummaryInputSchema,
  dashboardSummaryInputSchema,
  inventoryIntakeInputSchema,
  inventoryQualityCheckInputSchema,
  inventorySellInputSchema,
  inventoryUpdateInputSchema,
  kioskSessionReviewBodySchema,
  onboardingDecisionBodySchema,
  onboardingRequestBodySchema,
  orderListFiltersSchema,
  orderListPageInputSchema,
  orderLineCostsUpdateBodySchema,
  patchOrderInputSchema,
  paymentBodySchema,
  profitCenterReadBodySchema,
  costExportBodySchema,
  costBackfillApplyBodySchema,
  costBackfillPreviewBodySchema,
  costBackfillRevertBodySchema,
  costCurrencyReadBodySchema,
  costCurrencyUpdateBodySchema,
  partCatalogCreateBodySchema,
  partLotReceiveBodySchema,
  orderPartAllocateBodySchema,
  publishOrderQuoteInputSchema,
  confirmOrderQuoteSentInputSchema,
  storeInviteLinkCreateBodySchema,
  storeInviteLinkDecisionBodySchema,
  storeInviteLinkRedeemBodySchema,
  storeCloseBodySchema,
  storeCreateInputSchema,
  storeLifecycleChallengeBodySchema,
  storeMemberDecisionBodySchema,
  storeMemberRoleUpdateBodySchema,
  storeRenameBodySchema,
  storeRestoreBodySchema,
  storeSettingsUpdateBodySchema,
  storeFaultCostDefaultsUpdateBodySchema,
  supplierCreateBodySchema,
  transitionOrderBodySchema,
  updateOrderCustodyBodySchema,
  updateOrderInputSchema,
  whatsappNotificationBodySchema,
} from "./repairdesk-schemas";

describe("repairdesk API schemas", () => {
  it("accepts only explicit customer identity conflict resolutions", () => {
    const base = {
      operation_id: "00000000-0000-4000-8000-000000000801",
      customer_name: "Cliente Due",
      customer_phone: "+39000000000",
      device_brand: "Apple",
      device_model: "iPhone",
      order_type: "quick_repair" as const,
      status: "new" as const,
      issue_description: "display",
      fault_prices: [],
    };
    expect(
      createOrderSchema.parse({
        ...base,
        customer_identity_resolution: {
          mode: "use_existing",
          customer_id: "customer-1",
          conflict_token: "00000000-0000-4000-8000-000000000802",
        },
      }).customer_identity_resolution,
    ).toMatchObject({ mode: "use_existing", customer_id: "customer-1" });
    expect(() =>
      createOrderSchema.parse({
        ...base,
        customer_identity_resolution: { mode: "create_distinct_shared_phone" },
      }),
    ).toThrow();
  });

  it("trims an optional new-store print address and bounds its length", () => {
    expect(
      storeCreateInputSchema.parse({
        name: "Negozio Roma",
        address: "  Via Roma 12  ",
        currency_code: "EUR",
      }),
    ).toMatchObject({ address: "Via Roma 12" });

    expect(() =>
      storeCreateInputSchema.parse({
        name: "Negozio Roma",
        address: "x".repeat(501),
        currency_code: "EUR",
      }),
    ).toThrow();
  });

  it("keeps blank costs distinct from zero and requires a complete default catalog", () => {
    const items = repairServiceCatalogItems.map((item) => ({
      catalog_key: item.catalogKey,
      catalog_name: item.name,
      default_cost_amount: item.catalogKey === "display:main" ? 0 : null,
    }));
    expect(
      storeFaultCostDefaultsUpdateBodySchema
        .parse({
          expected_store_id: "00000000-0000-4000-8000-000000000001",
          expected_version: 0,
          items,
        })
        .items.find((item) => item.catalog_key === "display:main")?.default_cost_amount,
    ).toBe(0);
    expect(() =>
      storeFaultCostDefaultsUpdateBodySchema.parse({
        expected_store_id: "00000000-0000-4000-8000-000000000001",
        expected_version: 0,
        items: items.slice(1),
      }),
    ).toThrow("完整");
  });

  it("validates manual and blank order cost corrections", () => {
    const base = {
      id: "00000000-0000-4000-8000-000000000010",
      input: {
        expected_store_id: "00000000-0000-4000-8000-000000000001",
        expected_version: 1,
      },
    };
    expect(
      orderLineCostsUpdateBodySchema.parse({
        ...base,
        input: {
          ...base.input,
          items: [
            { line_id: "00000000-0000-4000-8000-000000000011", mode: "manual", amount: 0 },
            { line_id: "00000000-0000-4000-8000-000000000012", mode: "blank" },
          ],
        },
      }).input.items,
    ).toHaveLength(2);
    expect(() =>
      orderLineCostsUpdateBodySchema.parse({
        ...base,
        input: {
          ...base.input,
          items: [{ line_id: "00000000-0000-4000-8000-000000000011", mode: "manual" }],
        },
      }),
    ).toThrow("请输入成本");
  });

  it("accepts valid report-local dates and rejects reversed or oversized profit ranges", () => {
    expect(
      profitCenterReadBodySchema.parse({
        start_date: "2026-07-01",
        end_date: "2026-07-18",
      }),
    ).toEqual({ start_date: "2026-07-01", end_date: "2026-07-18" });
    expect(() =>
      profitCenterReadBodySchema.parse({
        start_date: "2026-07-19",
        end_date: "2026-07-18",
      }),
    ).toThrow("367 天以内");
    expect(() =>
      profitCenterReadBodySchema.parse({
        start_date: "2025-01-01",
        end_date: "2026-07-18",
      }),
    ).toThrow("367 天以内");
    expect(() =>
      profitCenterReadBodySchema.parse({
        start_date: "2026-02-30",
        end_date: "2026-03-01",
      }),
    ).toThrow("日期无效");
  });

  it("bounds cost export dates, filters, and row limit", () => {
    const valid = {
      expected_store_id: "00000000-0000-4000-8000-000000000001",
      start_date: "2026-07-01",
      end_date: "2026-07-18",
      statuses: ["ready"],
      sources: ["manual", "purchase_lot"],
      limit: 10_000,
    };
    expect(costExportBodySchema.parse(valid)).toEqual(valid);
    expect(() => costExportBodySchema.parse({ ...valid, limit: 10_001 })).toThrow();
    expect(() =>
      costExportBodySchema.parse({
        ...valid,
        statuses: Array.from({ length: 21 }, (_, index) => `status-${index}`),
      }),
    ).toThrow();
    expect(() =>
      costExportBodySchema.parse({
        ...valid,
        start_date: "2025-01-01",
      }),
    ).toThrow("367 天以内");
  });

  it("bounds preview, apply, and compensating revert inputs", () => {
    const store = "00000000-0000-4000-8000-000000000001";
    const run = "00000000-0000-4000-8000-000000000002";
    const preview = {
      expected_store_id: store,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      max_candidates: 5_000,
      idempotency_key: run,
    };
    expect(costBackfillPreviewBodySchema.parse(preview)).toEqual(preview);
    expect(() =>
      costBackfillPreviewBodySchema.parse({ ...preview, max_candidates: 5_001 }),
    ).toThrow();
    expect(() =>
      costBackfillPreviewBodySchema.parse({ ...preview, start_date: "2025-01-01" }),
    ).toThrow("367 天以内");

    const apply = {
      expected_store_id: store,
      run_id: run,
      expected_fixture_hash: "a".repeat(64),
      batch_size: 100,
      idempotency_key: run,
    };
    expect(costBackfillApplyBodySchema.parse(apply)).toEqual(apply);
    expect(() => costBackfillApplyBodySchema.parse({ ...apply, batch_size: 101 })).toThrow();
    expect(
      costBackfillRevertBodySchema.parse({
        expected_store_id: store,
        run_id: run,
        batch_size: 1,
        idempotency_key: run,
      }),
    ).toMatchObject({ run_id: run, batch_size: 1 });
  });

  it("validates traceable procurement catalog, lot and allocation inputs", () => {
    const store = "00000000-0000-4000-8000-000000000001";
    const part = "00000000-0000-4000-8000-000000000002";
    const lot = "00000000-0000-4000-8000-000000000003";
    const idempotency = "00000000-0000-4000-8000-000000000004";
    expect(
      partCatalogCreateBodySchema.parse({
        expected_store_id: store,
        sku: " OLED-15 ",
        name: " 屏幕 ",
        compatible_models: [],
        idempotency_key: idempotency,
      }),
    ).toMatchObject({ sku: "OLED-15", name: "屏幕" });
    expect(
      partLotReceiveBodySchema.parse({
        expected_store_id: store,
        part_item_id: part,
        lot_code: "LOT-1",
        quantity: 2,
        original_unit_cost: 15,
        original_currency_code: "EUR",
        fx_rate_to_eur: 1,
        fx_rate_at: "2026-07-18T10:00:00.000Z",
        fx_rate_source: "store_base",
        idempotency_key: idempotency,
      }),
    ).toMatchObject({ quantity: 2, original_currency_code: "EUR" });
    expect(
      orderPartAllocateBodySchema.parse({
        order_id: part,
        input: {
          expected_store_id: store,
          line_id: part,
          lot_id: lot,
          quantity: 1,
          idempotency_key: idempotency,
        },
      }).input.quantity,
    ).toBe(1);
    expect(() =>
      partLotReceiveBodySchema.parse({
        expected_store_id: store,
        part_item_id: part,
        lot_code: "LOT-1",
        quantity: 0,
        original_unit_cost: 15,
        original_currency_code: "eur",
        fx_rate_to_eur: 1,
        fx_rate_at: "2026-07-18T10:00:00.000Z",
        fx_rate_source: "store_base",
        idempotency_key: idempotency,
      }),
    ).toThrow();
  });

  it("requires a complete five-currency cost configuration with EUR fixed at one", () => {
    const store = "00000000-0000-4000-8000-000000000001";
    const settings = {
      expected_store_id: store,
      expected_version: 1,
      items: [
        {
          currency_code: "EUR" as const,
          enabled: true,
          rate_to_eur: 1,
          rate_at: "2026-07-18T10:00:00.000Z",
        },
        {
          currency_code: "USD" as const,
          enabled: true,
          rate_to_eur: 0.92,
          rate_at: "2026-07-18T10:00:00.000Z",
        },
        { currency_code: "GBP" as const, enabled: false, rate_to_eur: null },
        {
          currency_code: "CNY" as const,
          enabled: true,
          rate_to_eur: 0.12,
          rate_at: "2026-07-18T10:00:00.000Z",
        },
        { currency_code: "CHF" as const, enabled: false, rate_to_eur: null },
      ],
    };
    expect(costCurrencyReadBodySchema.parse({ expected_store_id: store, mode: "options" })).toEqual(
      {
        expected_store_id: store,
        mode: "options",
      },
    );
    expect(costCurrencyUpdateBodySchema.parse(settings).items).toHaveLength(5);
    expect(() =>
      costCurrencyUpdateBodySchema.parse({
        ...settings,
        items: settings.items.map((item) =>
          item.currency_code === "EUR" ? { ...item, rate_to_eur: 0.99 } : item,
        ),
      }),
    ).toThrow("EUR");
    expect(() =>
      costCurrencyUpdateBodySchema.parse({
        ...settings,
        items: settings.items.map((item) =>
          item.currency_code === "GBP" ? { ...item, enabled: true } : item,
        ),
      }),
    ).toThrow("启用币种");
    expect(() =>
      costCurrencyUpdateBodySchema.parse({
        ...settings,
        items: settings.items.map((item) =>
          item.currency_code === "CHF" ? { ...item, rate_to_eur: 1.02 } : item,
        ),
      }),
    ).toThrow("停用币种");
    expect(() =>
      costCurrencyUpdateBodySchema.parse({
        ...settings,
        items: settings.items.map((item) =>
          item.currency_code === "USD" ? { ...item, rate_to_eur: 0.12345678901 } : item,
        ),
      }),
    ).toThrow("十位小数");
  });

  it("accepts server-resolved FX fields while keeping EUR snapshots exact", () => {
    const base = {
      expected_store_id: "00000000-0000-4000-8000-000000000001",
      part_item_id: "00000000-0000-4000-8000-000000000002",
      lot_code: "LOT-USD",
      quantity: 2,
      original_unit_cost: 10,
      original_currency_code: "USD" as const,
      idempotency_key: "00000000-0000-4000-8000-000000000004",
    };
    expect(partLotReceiveBodySchema.parse(base)).toEqual(base);
    expect(() => partLotReceiveBodySchema.parse({ ...base, fx_rate_to_eur: 0.9 })).toThrow(
      "完整提供",
    );
    expect(() =>
      partLotReceiveBodySchema.parse({
        ...base,
        original_currency_code: "EUR",
        fx_rate_to_eur: 0.9,
        fx_rate_at: "2026-07-18T10:00:00.000Z",
        fx_rate_source: "store_base",
      }),
    ).toThrow("EUR 汇率必须为 1");
  });

  it("accepts a strict diagnosis quote publication and exact quote send confirmation", () => {
    const quote = {
      expected_updated_at: "2026-07-17T18:00:00.000Z",
      idempotency_key: "00000000-0000-4000-8000-000000000801",
      diagnosis_result: "检测确认电池健康度过低",
      fault_prices: [{ name: "更换电池", price: 59, currency_code: "EUR" as const }],
    };
    expect(publishOrderQuoteInputSchema.parse(quote)).toEqual(quote);
    expect(
      confirmOrderQuoteSentInputSchema.parse({
        expected_updated_at: "2026-07-17T18:01:00.000Z",
        idempotency_key: "00000000-0000-4000-8000-000000000802",
        quote_event_id: "00000000-0000-4000-8000-000000000803",
        message_body: "Preventivo pronto",
      }),
    ).toMatchObject({ quote_event_id: "00000000-0000-4000-8000-000000000803" });
  });

  it("rejects malformed quote rows, hidden fields and invalid zero-price exceptions", () => {
    const base = {
      expected_updated_at: "2026-07-17T18:00:00.000Z",
      idempotency_key: "00000000-0000-4000-8000-000000000804",
      diagnosis_result: "检测完成",
    };
    expect(() =>
      publishOrderQuoteInputSchema.parse({
        ...base,
        fault_prices: [{ name: "屏幕", price: 59.999 }],
      }),
    ).toThrow("两位小数");
    expect(() =>
      publishOrderQuoteInputSchema.parse({
        ...base,
        fault_prices: [{ name: "保修检测", price: 0 }],
      }),
    ).toThrow("零元项目");
    expect(() =>
      publishOrderQuoteInputSchema.parse({
        ...base,
        fault_prices: [{ name: "屏幕", price: 59, total: 59 }],
      }),
    ).toThrow();
    expect(() =>
      publishOrderQuoteInputSchema.parse({
        ...base,
        fault_prices: [{ name: "屏幕", price: 59 }],
        price_exception: { kind: "free", reason: "无零元项目" },
      }),
    ).toThrow("没有零元项目");
  });

  it.each([0, 3, 6, 12, 24])("accepts terminal warranty month %s", (warrantyMonths) => {
    expect(
      correctTerminalOrderInputSchema.parse({
        expected_updated_at: "2026-07-16T20:00:00.000Z",
        idempotency_key: "00000000-0000-4000-8000-000000000701",
        reason: "纠正质保记录",
        changes: { warranty_months: warrantyMonths },
      }).changes.warranty_months,
    ).toBe(warrantyMonths);
  });

  it.each([1, 36])("rejects unsupported terminal warranty month %s", (warrantyMonths) => {
    expect(() =>
      correctTerminalOrderInputSchema.parse({
        expected_updated_at: "2026-07-16T20:00:00.000Z",
        idempotency_key: "00000000-0000-4000-8000-000000000702",
        reason: "纠正质保记录",
        changes: { warranty_months: warrantyMonths },
      }),
    ).toThrow("质保月数仅支持");
  });

  it("rejects unknown and over-limit terminal correction fields", () => {
    const base = {
      expected_updated_at: "2026-07-16T20:00:00.000Z",
      idempotency_key: "00000000-0000-4000-8000-000000000703",
      reason: "纠正终态记录",
    };
    expect(() =>
      correctTerminalOrderInputSchema.parse({
        ...base,
        changes: { quotation_amount: 0 },
      }),
    ).toThrow();
    expect(() =>
      correctTerminalOrderInputSchema.parse({
        ...base,
        changes: { diagnosis_result: "x".repeat(8001) },
      }),
    ).toThrow();
  });

  it("accepts only a bounded Dashboard limit and rejects caller-controlled scope", () => {
    expect(dashboardPrioritySummaryInputSchema.parse({ limit: 8 })).toEqual({ limit: 8 });
    expect(() => dashboardPrioritySummaryInputSchema.parse({ limit: 21 })).toThrow();
    expect(() =>
      dashboardPrioritySummaryInputSchema.parse({ limit: 8, storeId: "other-store" }),
    ).toThrow();
  });

  it("keeps the legacy Dashboard page-size contract available during rolling releases", () => {
    expect(dashboardSummaryInputSchema.parse({ pageSize: 6 })).toEqual({ pageSize: 6 });
  });

  it("keeps legacy order page sizes accepted while clamping the detail budget to 50", () => {
    expect(orderListPageInputSchema.parse({ page: "2", pageSize: "50" })).toEqual({
      page: 2,
      pageSize: 50,
    });
    expect(orderListPageInputSchema.parse({ pageSize: 100 })).toEqual({ pageSize: 50 });
    expect(() => orderListPageInputSchema.parse({ pageSize: 101 })).toThrow();
  });

  it("accepts an optional ISO version for inventory quality-check CAS", () => {
    expect(
      inventoryQualityCheckInputSchema.parse({
        expected_updated_at: "2026-07-13T10:00:00.000Z",
        data_wipe_status: "pass",
      }),
    ).toMatchObject({
      expected_updated_at: "2026-07-13T10:00:00.000Z",
      data_wipe_status: "pass",
    });
    expect(() =>
      inventoryQualityCheckInputSchema.parse({ expected_updated_at: "stale-version" }),
    ).toThrow();
  });

  it("accepts only the allowlisted buyback agreement snapshot without full document data", () => {
    const input = {
      expected_updated_at: "2026-07-12T12:00:00.000Z",
      idempotency_key: "00000000-0000-4000-8000-000000000201",
      item_patch: {},
      quality_check: {},
      agreement_snapshot: {
        agreement_version: BUYBACK_AGREEMENT_VERSION,
        privacy_notice_version: BUYBACK_PRIVACY_NOTICE_VERSION,
        language: "it-IT",
        legal_documents: {
          privacy_notice: {
            version: BUYBACK_PRIVACY_NOTICE_VERSION,
            sha256: BUYBACK_PRIVACY_NOTICE_SHA256,
            text: BUYBACK_PRIVACY_NOTICE_TEXT_IT,
          },
          buyback_terms: {
            version: BUYBACK_AGREEMENT_VERSION,
            sha256: BUYBACK_TERMS_SHA256,
            text: BUYBACK_TERMS_TEXT_IT,
          },
        },
        device: {
          brand: "Apple",
          model: "iPhone 17",
          storage_capacity: "128GB",
          serial_or_imei: "356789012345678",
          purchase_proof: false,
          box_included: false,
        },
        payment: { method: "cash" },
        quote: { amount: 475, currency_code: "EUR" },
        seller: {
          name: "Mario Demo",
          phone: "+39 333 000 1234",
          document_type: "id_card",
          document_no_last4: "1234",
        },
        declarations: {
          ownership_confirmed: true,
          data_wipe_authorized: true,
          privacy_notice_accepted: true,
          agreement_accepted: true,
          no_invoice_confirmed: true,
          no_box_confirmed: true,
        },
      },
      agreement_hash: "a".repeat(64),
      agreement_version: BUYBACK_AGREEMENT_VERSION,
      privacy_notice_version: BUYBACK_PRIVACY_NOTICE_VERSION,
      language: "it-IT",
      document_type: "id_card",
      document_no_last4: "1234",
      signature_attachment_id: "00000000-0000-4000-8000-000000000202",
      evidence_attachment_ids: [
        "00000000-0000-4000-8000-000000000203",
        "00000000-0000-4000-8000-000000000204",
        "00000000-0000-4000-8000-000000000205",
      ],
      payment_method: "cash",
    };

    expect(() => buybackFinalizeInputSchema.parse(input)).not.toThrow();
    expect(() =>
      buybackFinalizeInputSchema.parse({
        ...input,
        agreement_snapshot: {
          ...input.agreement_snapshot,
          legal_documents: {
            ...input.agreement_snapshot.legal_documents,
            buyback_terms: {
              ...input.agreement_snapshot.legal_documents.buyback_terms,
              text: `${BUYBACK_TERMS_TEXT_IT}\nModifica non firmata`,
            },
          },
        },
      }),
    ).toThrow();
    expect(() =>
      buybackFinalizeInputSchema.parse({
        ...input,
        agreement_snapshot: {
          ...input.agreement_snapshot,
          seller: {
            ...input.agreement_snapshot.seller,
            document_no: "CA1234567",
          },
        },
      }),
    ).toThrow();
    expect(() =>
      buybackFinalizeInputSchema.parse({
        ...input,
        agreement_snapshot: {
          ...input.agreement_snapshot,
          seller: {
            ...input.agreement_snapshot.seller,
            verification_note: "Documento CA1234567",
          },
        },
      }),
    ).toThrow(/完整证件号/);
    expect(() =>
      buybackFinalizeInputSchema.parse({
        ...input,
        document_no_last4: "12345678",
      }),
    ).toThrow();
    expect(() =>
      buybackFinalizeInputSchema.parse({
        ...input,
        agreement_snapshot: {
          ...input.agreement_snapshot,
          seller: {
            ...input.agreement_snapshot.seller,
            verification_note: "Documento A-1-2-3-4-5",
          },
        },
      }),
    ).toThrow(/完整证件号/);
    expect(() =>
      buybackFinalizeInputSchema.parse({
        ...input,
        agreement_version: "forged-v2",
        agreement_snapshot: {
          ...input.agreement_snapshot,
          agreement_version: "forged-v2",
        },
      }),
    ).toThrow();
  });

  it("coerces payment amounts", () => {
    expect(
      paymentBodySchema.parse({
        id: "R1",
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        idempotency_key: "00000000-0000-4000-8000-000000000101",
        amount: "25.5",
      }),
    ).toMatchObject({
      id: "R1",
      expected_updated_at: "2026-06-11T00:00:00.000Z",
      idempotency_key: "00000000-0000-4000-8000-000000000101",
      amount: 25.5,
    });
  });

  it("requires a valid payment idempotency key and cent precision", () => {
    const payment = {
      id: "R1",
      expected_updated_at: "2026-06-11T00:00:00.000Z",
      idempotency_key: "00000000-0000-4000-8000-000000000101",
      amount: 25.5,
    };
    expect(paymentBodySchema.parse(payment)).toMatchObject(payment);
    const { idempotency_key: _legacyKey, ...legacyPayment } = payment;
    expect(paymentBodySchema.parse(legacyPayment).idempotency_key).toBeUndefined();
    expect(paymentBodySchema.parse({ ...payment, amount: 0.29 }).amount).toBe(0.29);
    expect(paymentBodySchema.parse({ ...payment, amount: 0.57 }).amount).toBe(0.57);
    expect(() => paymentBodySchema.parse({ ...payment, idempotency_key: "retry-1" })).toThrow();
    expect(() => paymentBodySchema.parse({ ...payment, amount: 25.555 })).toThrow();
  });

  it("applies customer search defaults", () => {
    expect(customerSearchBodySchema.parse({})).toEqual({ q: "", limit: 8 });
    expect(() => customerSearchBodySchema.parse({ q: "333", limit: 13 })).toThrow();
  });

  it("keeps legacy and structured customer intake searches mutually exclusive", () => {
    expect(customerIntakeSearchBodySchema.parse({ q: "333" })).toEqual({
      q: "333",
      limit: 8,
      deviceLimit: 4,
    });
    expect(
      customerIntakeSearchBodySchema.parse({
        phone: "3335719865",
        name: "Alessio",
        phoneMatchMode: "exact",
      }),
    ).toEqual({
      phone: "3335719865",
      name: "Alessio",
      phoneMatchMode: "exact",
      limit: 8,
      deviceLimit: 4,
    });
    expect(customerIntakeSearchBodySchema.parse({})).toEqual({ limit: 8, deviceLimit: 4 });
    expect(() => customerIntakeSearchBodySchema.parse({ q: "333", phone: "333" })).toThrow();
    expect(() => customerIntakeSearchBodySchema.parse({ q: "Al", name: "Al" })).toThrow();
    expect(() =>
      customerIntakeSearchBodySchema.parse({ phone: "333", unexpected: true }),
    ).toThrow();
  });

  it("coerces and caps customer page input", () => {
    expect(customerListPageInputSchema.parse({ page: "2", pageSize: "75" })).toMatchObject({
      page: 2,
      pageSize: 75,
    });
    expect(() => customerListPageInputSchema.parse({ pageSize: 101 })).toThrow();
  });

  it("accepts the active order queue groups and rejects retired queue keys", () => {
    const queueGroups = [
      "processing",
      "ordered",
      "arrived",
      "arrived_notified",
      "repaired",
      "repaired_notified",
    ] as const;

    expect(orderListFiltersSchema.parse({ queueGroups }).queueGroups).toEqual(queueGroups);
    expect(() => orderListFiltersSchema.parse({ queueGroups: ["settlement"] })).toThrow();
    expect(() => orderListFiltersSchema.parse({ queueGroups: ["review"] })).toThrow();
  });

  it("accepts WhatsApp notification template metadata", () => {
    expect(
      whatsappNotificationBodySchema.parse({
        id: "R1",
        body: "Messaggio",
        template_kind: "pickup_ready",
        transition_to: "notified",
        recipient_phone: "380 151 2196",
      }),
    ).toMatchObject({
      template_kind: "pickup_ready",
      transition_to: "notified",
      recipient_phone: "+393801512196",
    });
    expect(() =>
      whatsappNotificationBodySchema.parse({
        id: "R1",
        body: "Messaggio",
        template_kind: "pickup_ready",
        recipient_phone: "+380 1512196",
      }),
    ).toThrow();
  });

  it("validates store invite link creation and redemption payloads", () => {
    expect(
      storeInviteLinkCreateBodySchema.parse({
        input: {
          label: "临时员工",
          role: "technician",
          expires_in_days: 7,
          max_uses: 1,
        },
      }).input,
    ).toMatchObject({ role: "technician", expires_in_days: 7, max_uses: 1 });

    expect(() =>
      storeInviteLinkCreateBodySchema.parse({
        input: { role: "owner", expires_in_days: 7, max_uses: 1 },
      }),
    ).toThrow();
    expect(() =>
      storeInviteLinkCreateBodySchema.parse({
        input: { role: "viewer", expires_in_days: 31, max_uses: 1 },
      }),
    ).toThrow();
    expect(() =>
      storeInviteLinkCreateBodySchema.parse({
        input: { role: "viewer", expires_in_days: 7, max_uses: 51 },
      }),
    ).toThrow();

    expect(
      storeInviteLinkDecisionBodySchema.parse({
        id: "00000000-0000-4000-8000-000000000201",
      }),
    ).toMatchObject({ id: "00000000-0000-4000-8000-000000000201" });
    expect(storeInviteLinkRedeemBodySchema.parse({ code: " rd_valid_invite_code " })).toMatchObject(
      { code: "rd_valid_invite_code" },
    );
    expect(() => storeInviteLinkRedeemBodySchema.parse({ code: "short" })).toThrow();
  });

  it("uses a strict non-coercing section contract for store settings", () => {
    const request = {
      section: "rules",
      expectedStoreId: "5248dda1-2b32-46cd-8ed0-d15386a9e8ed",
      expectedUpdatedAt: "2026-07-12T10:00:00.000Z",
      input: { default_order_warranty_months: 6, default_inventory_warranty_months: 12 },
    };
    expect(storeSettingsUpdateBodySchema.parse(request)).toEqual(request);
    expect(() =>
      storeSettingsUpdateBodySchema.parse({
        ...request,
        input: { ...request.input, default_order_warranty_text: "Injected" },
      }),
    ).toThrow();
    expect(() =>
      storeSettingsUpdateBodySchema.parse({
        ...request,
        input: { ...request.input, default_inventory_warranty_months: "12" },
      }),
    ).toThrow();
  });

  it("uses a strict non-coercing Kiosk review version contract", () => {
    const request = { id: "session-1", expected_submission_version: 2 };
    expect(kioskSessionReviewBodySchema.parse(request)).toEqual(request);
    expect(() =>
      kioskSessionReviewBodySchema.parse({
        ...request,
        expected_submission_version: "2",
      }),
    ).toThrow();
    expect(() =>
      kioskSessionReviewBodySchema.parse({
        ...request,
        unexpected: true,
      }),
    ).toThrow();
  });

  it("preserves omitted versus explicit zero inventory warranty semantics", () => {
    const intakeBase = { brand: "Apple", model: "iPhone 13" };
    expect(inventoryIntakeInputSchema.parse(intakeBase).warranty_months).toBeUndefined();
    expect(
      inventoryIntakeInputSchema.parse({ ...intakeBase, warranty_months: "" }).warranty_months,
    ).toBeUndefined();
    expect(
      inventoryIntakeInputSchema.parse({ ...intakeBase, warranty_months: 0 }).warranty_months,
    ).toBe(0);
    expect(inventoryUpdateInputSchema.parse({ warranty_months: "6" }).warranty_months).toBe(6);
    expect(
      inventorySellInputSchema.parse({ sale_price: 100, warranty_months: "" }).warranty_months,
    ).toBeUndefined();
    expect(() =>
      inventoryIntakeInputSchema.parse({ ...intakeBase, warranty_months: -1 }),
    ).toThrow();
    expect(() =>
      inventoryIntakeInputSchema.parse({ ...intakeBase, warranty_months: 1.5 }),
    ).toThrow();
    for (const invalid of [null, false, true]) {
      expect(() =>
        inventoryIntakeInputSchema.parse({ ...intakeBase, warranty_months: invalid }),
      ).toThrow();
      expect(() => inventoryUpdateInputSchema.parse({ warranty_months: invalid })).toThrow();
      expect(() =>
        inventorySellInputSchema.parse({ sale_price: 100, warranty_months: invalid }),
      ).toThrow();
    }
  });

  it("validates store member lifecycle payloads without accepting owner role", () => {
    expect(
      storeMemberRoleUpdateBodySchema.parse({
        id: "00000000-0000-4000-8000-000000000301",
        role: "sales",
      }),
    ).toMatchObject({
      id: "00000000-0000-4000-8000-000000000301",
      role: "sales",
    });

    expect(() =>
      storeMemberRoleUpdateBodySchema.parse({
        id: "00000000-0000-4000-8000-000000000301",
        role: "owner",
      }),
    ).toThrow();
    expect(() =>
      storeMemberRoleUpdateBodySchema.parse({
        id: "not-a-uuid",
        role: "viewer",
      }),
    ).toThrow();
    expect(
      storeMemberDecisionBodySchema.parse({
        id: "00000000-0000-4000-8000-000000000301",
      }),
    ).toEqual({ id: "00000000-0000-4000-8000-000000000301" });
    expect(() => storeMemberDecisionBodySchema.parse({ id: "membership_staff" })).toThrow();
  });

  it("binds lifecycle challenges and mutations to UUID, revision and exact confirmation", () => {
    const base = {
      expectedStoreId: "00000000-0000-4000-8000-000000000301",
      expectedRevision: 7,
      operationId: "00000000-0000-4000-8000-000000000302",
      reauthChallengeId: "00000000-0000-4000-8000-000000000303",
    };
    expect(
      storeLifecycleChallengeBodySchema.parse({
        expectedStoreId: base.expectedStoreId,
        expectedRevision: 7,
        operationKind: "request_close",
        preflightSnapshotHash: "a".repeat(64),
      }),
    ).toMatchObject({ operationKind: "request_close" });
    expect(() =>
      storeLifecycleChallengeBodySchema.parse({
        expectedStoreId: base.expectedStoreId,
        expectedRevision: 7,
        operationKind: "request_close",
      }),
    ).toThrow("预检摘要");
    expect(
      storeRenameBodySchema.parse({
        ...base,
        name: "  Chinatech Centro  ",
        syncCustomerFacingName: true,
      }),
    ).toMatchObject({ name: "Chinatech Centro" });
    expect(
      storeCloseBodySchema.parse({
        ...base,
        preflightSnapshotHash: "b".repeat(64),
        confirmationStoreName: "Chinatech Centro",
        confirmationStoreIdSuffix: "00000301",
        reasonCode: "duplicate_store",
      }),
    ).toMatchObject({ confirmationStoreIdSuffix: "00000301" });
    expect(storeRestoreBodySchema.parse(base)).toEqual(base);
    expect(() =>
      storeRenameBodySchema.parse({ ...base, name: "x", syncCustomerFacingName: false }),
    ).toThrow();
  });

  it("validates order types from the canonical runtime enum", () => {
    const validOrder = {
      status: "new",
      issue_description: "屏幕碎裂",
      fault_prices: [],
    };

    expect(createOrderSchema.parse({ ...validOrder, order_type: "quick_repair" }).order_type).toBe(
      "quick_repair",
    );
    expect(
      createOrderSchema.parse({ ...validOrder, order_type: "dropoff_repair" }).order_type,
    ).toBe("dropoff_repair");
    expect(() =>
      createOrderSchema.parse({
        ...validOrder,
        order_type: "normal",
      }),
    ).toThrow();
  });

  it("accepts store workflow codes but rejects malformed status values", () => {
    const validOrder = {
      order_type: "quick_repair",
      issue_description: "屏幕碎裂",
      fault_prices: [],
    };
    expect(createOrderSchema.parse({ ...validOrder, status: "waiting_supplier" }).status).toBe(
      "waiting_supplier",
    );

    for (const status of ["A_STATUS", "1status", "bad status", "x", `a${"x".repeat(48)}`]) {
      expect(() => createOrderSchema.parse({ ...validOrder, status })).toThrow();
      expect(() => transitionOrderBodySchema.parse({ id: "R1", to: status })).toThrow();
      expect(() => batchTransitionBodySchema.parse({ ids: ["R1"], to: status })).toThrow();
    }
  });

  it("validates approval status from the canonical runtime enum", () => {
    for (const status of ["pending", "approved", "rejected"] as const) {
      expect(approvalStatusSchema.parse(status)).toBe(status);
    }
    expect(() => approvalStatusSchema.parse("accepted")).toThrow();
  });

  it("accepts and validates device unlock metadata", () => {
    expect(
      createOrderSchema.parse({
        order_type: "quick_repair",
        status: "new",
        issue_description: "屏幕碎裂",
        fault_prices: [],
        device_unlock: { method: "pin", value: "001258" },
      }).device_unlock,
    ).toEqual({ method: "pin", value: "001258" });

    expect(
      updateOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        customer_name: "Cliente",
        customer_phone: "+39 333 000 0000",
        device_brand: "Apple",
        device_model: "iPhone",
        issue_description: "屏幕",
        fault_prices: [],
        device_unlock: { method: "pattern", pattern: [1, 2, 5, 9, 8, 7, 4, 6, 3] },
      }).device_unlock,
    ).toEqual({ method: "pattern", pattern: [1, 2, 5, 9, 8, 7, 4, 6, 3] });

    expect(() =>
      updateOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        customer_name: "Cliente",
        customer_phone: "+39 333 000 0000",
        device_brand: "Apple",
        device_model: "iPhone",
        issue_description: "屏幕",
        fault_prices: [],
        device_unlock: { method: "pattern", pattern: [1, 2, 3] },
      }),
    ).toThrow();
    expect(() =>
      updateOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        customer_name: "Cliente",
        customer_phone: "+39 333 000 0000",
        device_brand: "Apple",
        device_model: "iPhone",
        issue_description: "屏幕",
        fault_prices: [],
        device_unlock: { method: "pattern", pattern: [1, 2, 1, 5] },
      }),
    ).toThrow("不能重复");
  });

  it("strictly validates audited device-custody mutations", () => {
    const valid = {
      id: "order_1",
      input: {
        expected_updated_at: "2026-07-16T20:00:00.000Z",
        device_custody_status: "with_customer",
        idempotency_key: "00000000-0000-4000-8000-000000000401",
        reason: "客人带回设备",
      },
    };
    expect(updateOrderCustodyBodySchema.parse(valid)).toEqual(valid);
    expect(() =>
      updateOrderCustodyBodySchema.parse({
        ...valid,
        input: { ...valid.input, device_custody_status: "unknown" },
      }),
    ).toThrow();
    expect(() =>
      updateOrderCustodyBodySchema.parse({
        ...valid,
        input: { ...valid.input, idempotency_key: "not-a-uuid" },
      }),
    ).toThrow();
    expect(() =>
      updateOrderCustodyBodySchema.parse({
        ...valid,
        input: { ...valid.input, reason: "x".repeat(241) },
      }),
    ).toThrow();
    expect(() =>
      updateOrderCustodyBodySchema.parse({
        ...valid,
        input: { ...valid.input, device_unlock_value: "1234" },
      }),
    ).toThrow();
  });

  it("rejects technician changes in inline order patches", () => {
    expect(() =>
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { technician_name: "Chen" },
      }),
    ).toThrow();
  });

  it("validates IMEI fields consistently while keeping create and full edit blank optional", () => {
    expect(() =>
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { device_imei: "   " },
      }),
    ).toThrow("IMEI / 序列号不能为空");

    expect(
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { device_imei: " SN-TEST_20260708:01 " },
      }).changes.device_imei,
    ).toBe("SN-TEST_20260708:01");

    expect(() =>
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { device_imei: "A".repeat(65) },
      }),
    ).toThrow("IMEI / 序列号不能超过 64 个字符");

    expect(() =>
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { device_imei: "SN<script>" },
      }),
    ).toThrow("IMEI / 序列号只能包含");

    expect(
      createOrderSchema.parse({
        order_type: "quick_repair",
        status: "new",
        issue_description: "屏幕碎裂",
        fault_prices: [],
        device_imei: "",
      }).device_imei,
    ).toBe("");
    expect(
      createOrderSchema.parse({
        order_type: "quick_repair",
        status: "new",
        issue_description: "屏幕碎裂",
        fault_prices: [],
        device_imei: " SN-TEST_20260708:01 ",
      }).device_imei,
    ).toBe("SN-TEST_20260708:01");
    expect(() =>
      createOrderSchema.parse({
        order_type: "quick_repair",
        status: "new",
        issue_description: "屏幕碎裂",
        fault_prices: [],
        device_imei: "A".repeat(65),
      }),
    ).toThrow("IMEI / 序列号不能超过 64 个字符");
    expect(() =>
      createOrderSchema.parse({
        order_type: "quick_repair",
        status: "new",
        issue_description: "屏幕碎裂",
        fault_prices: [],
        device_imei: "SN<script>",
      }),
    ).toThrow("IMEI / 序列号只能包含");

    expect(
      updateOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        customer_name: "Cliente",
        customer_phone: "+39 333 000 0000",
        device_brand: "Apple",
        device_model: "iPhone",
        device_imei: "",
        issue_description: "屏幕",
        fault_prices: [],
      }).device_imei,
    ).toBe("");
    expect(
      updateOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        customer_name: "Cliente",
        customer_phone: "+39 333 000 0000",
        device_brand: "Apple",
        device_model: "iPhone",
        device_imei: " SN-TEST_20260708:01 ",
        issue_description: "屏幕",
        fault_prices: [],
      }).device_imei,
    ).toBe("SN-TEST_20260708:01");
    expect(() =>
      updateOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        customer_name: "Cliente",
        customer_phone: "+39 333 000 0000",
        device_brand: "Apple",
        device_model: "iPhone",
        device_imei: "=490154203237518",
        issue_description: "屏幕",
        fault_prices: [],
      }),
    ).toThrow("IMEI / 序列号只能包含");
  });

  it("accepts device unlock inline patches without exposing a technician patch hole", () => {
    expect(
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { device_unlock: { method: "pattern", pattern: [1, 2, 5, 9, 8, 7] } },
      }).changes.device_unlock,
    ).toEqual({ method: "pattern", pattern: [1, 2, 5, 9, 8, 7] });

    expect(() =>
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { device_unlock: { method: "pin", value: "12a4" } },
      }),
    ).toThrow();
    expect(() =>
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { device_unlock: { method: "pattern", pattern: [1, 2, 1, 5] } },
      }),
    ).toThrow("不能重复");
  });

  it("accepts parts supplier inline patches without broadening quick edit fields", () => {
    expect(
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { parts_supplier_id: "supplier-1" },
      }).changes.parts_supplier_id,
    ).toBe("supplier-1");

    expect(
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { parts_supplier_id: null },
      }).changes.parts_supplier_id,
    ).toBeNull();

    expect(() =>
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { supplier_id: "supplier-1" },
      }),
    ).toThrow();
  });

  it("validates supplier settings payloads", () => {
    expect(
      supplierCreateBodySchema.parse({
        input: {
          name: "MOBILAX",
          short_name: "MOB",
          color: "#2563eb",
          phone: "+39 333 000 0000",
        },
      }).input,
    ).toMatchObject({ name: "MOBILAX", short_name: "MOB", color: "#2563eb" });

    expect(() =>
      supplierCreateBodySchema.parse({
        input: { name: "MOBILAX", color: "blue" },
      }),
    ).toThrow("供应商颜色格式不正确");
  });

  it("validates onboarding request mode-specific fields", () => {
    expect(
      onboardingRequestBodySchema.parse({
        input: {
          request_type: "join_store",
          target_owner_email: "owner@chinatech.in",
          note: "新员工申请加入",
          requested_role: "manager",
        },
      }).input,
    ).toMatchObject({
      request_type: "join_store",
      target_owner_email: "owner@chinatech.in",
      requested_role: "manager",
    });

    expect(() =>
      onboardingRequestBodySchema.parse({
        input: {
          request_type: "join_store",
          target_store_id: "5248dda1-2b32-46cd-8ed0-d15386a9e8ed",
          requested_role: "technician",
        },
      }),
    ).toThrow("请填写店铺负责人的邮箱");

    expect(() =>
      onboardingRequestBodySchema.parse({
        input: {
          request_type: "join_store",
          target_owner_email: "owner@chinatech.in",
          target_store_id: "5248dda1-2b32-46cd-8ed0-d15386a9e8ed",
          requested_role: "technician",
        },
      }),
    ).toThrow("加入店铺不能直接指定店铺 id");

    expect(() =>
      onboardingRequestBodySchema.parse({
        input: { request_type: "create_store" },
      }),
    ).toThrow("创建店铺请使用创建店铺接口");

    expect(() =>
      onboardingRequestBodySchema.parse({
        input: {
          request_type: "create_store",
          desired_store_name: "ChinaTech Roma",
        },
      }),
    ).toThrow("创建店铺请使用创建店铺接口");
  });

  it("validates onboarding decision approved role", () => {
    expect(
      onboardingDecisionBodySchema.parse({
        id: "00000000-0000-4000-8000-000000000001",
        approved_role: "viewer",
        note: "只读先加入",
      }),
    ).toMatchObject({
      id: "00000000-0000-4000-8000-000000000001",
      approved_role: "viewer",
      note: "只读先加入",
    });

    expect(() =>
      onboardingDecisionBodySchema.parse({
        id: "00000000-0000-4000-8000-000000000001",
        approved_role: "owner",
      }),
    ).toThrow();
  });
});
