import { describe, expect, it } from "vitest";

import { normalizeOrderDataRows } from "./order-data-import-normalizer";
import type { OrderDataDbRow } from "./order-data.repository";

const emptyCandidates = {
  byId: new Map<string, OrderDataDbRow>(),
  byPublicNo: new Map<string, OrderDataDbRow>(),
  byExternalRef: new Map<string, OrderDataDbRow>(),
  customersByPhoneRaw: new Map<string, { id: string; name: string; updated_at: string }>(),
};

function createRow(custody?: string) {
  return {
    __row_number: "2",
    template_version: "repairdesk-order-data-v2",
    import_action: "create",
    source_system: "seatable",
    external_record_id: "row-1",
    order_type: "quick_repair",
    ...(custody === undefined ? {} : { device_custody_status: custody }),
    customer_name: "Mario",
    customer_phone: "+39 333 123 4567",
    device_brand: "Apple",
    device_model: "iPhone 15",
    issue_description: "No power",
  };
}

function existingOrder(overrides: Partial<OrderDataDbRow> = {}): OrderDataDbRow {
  return {
    id: "order-1",
    store_id: "store-1",
    public_no: "R0000001",
    updated_at: "2026-07-16T12:00:00.000Z",
    order_type: "quick_repair",
    status: "new",
    customer_id: "customer-1",
    device_id: "device-1",
    customer: {
      id: "customer-1",
      name: "Mario",
      phone_e164: "+39 333 123 4567",
      contact_phones: [],
      updated_at: "2026-07-16T11:00:00.000Z",
    },
    device: {
      id: "device-1",
      brand: "Apple",
      model: "iPhone 15",
      serial_or_imei: "",
      device_notes: null,
      updated_at: "2026-07-16T11:00:00.000Z",
    },
    device_custody_status: "with_shop",
    issue_description: "No power",
    diagnosis_result: null,
    internal_tag: null,
    accessory_notes: null,
    warranty_text: "6 mesi",
    warranty_months: 6,
    quotation_amount: 0,
    deposit_amount: 0,
    fault_prices: [],
    ...overrides,
  };
}

describe("order data custody normalization", () => {
  it("preserves legacy v1 create semantics as explicit unknown instead of inventing custody", () => {
    const result = normalizeOrderDataRows({
      rawRows: [{ ...createRow(), template_version: "repairdesk-order-data-v1" }],
      repairItemRows: [],
      mode: "create_and_update",
      candidates: emptyCandidates,
    });

    expect(result.previewRows[0]).toMatchObject({ status: "ready", action: "create" });
    expect(result.stagedRows[0].normalized_data).toMatchObject({ device_custody_status: null });
  });

  it("stages both valid custody values and rejects unstable labels or unknown enums", () => {
    const customerHeld = normalizeOrderDataRows({
      rawRows: [createRow("with_customer")],
      repairItemRows: [],
      mode: "create_and_update",
      candidates: emptyCandidates,
    });
    const invalid = normalizeOrderDataRows({
      rawRows: [createRow("客户持有")],
      repairItemRows: [],
      mode: "create_and_update",
      candidates: emptyCandidates,
    });

    expect(customerHeld.stagedRows[0].normalized_data).toMatchObject({
      device_custody_status: "with_customer",
    });
    expect(invalid.previewRows[0].errors).toContainEqual(
      expect.objectContaining({ code: "invalid_device_custody" }),
    );
  });

  it("treats blank updates as unchanged and custody-only updates as order-local", () => {
    const current = existingOrder();
    const candidates = {
      ...emptyCandidates,
      byId: new Map([[current.id, current]]),
      byPublicNo: new Map([[current.public_no, current]]),
    };
    const blank = normalizeOrderDataRows({
      rawRows: [
        {
          __row_number: "2",
          import_action: "update",
          order_id: current.id,
          public_no: current.public_no,
          expected_updated_at: current.updated_at,
          device_custody_status: "",
        },
      ],
      repairItemRows: [],
      mode: "update_only",
      candidates,
    });
    const changed = normalizeOrderDataRows({
      rawRows: [
        {
          __row_number: "2",
          import_action: "update",
          order_id: current.id,
          public_no: current.public_no,
          expected_updated_at: current.updated_at,
          device_custody_status: "with_customer",
        },
      ],
      repairItemRows: [],
      mode: "update_only",
      candidates,
    });

    expect(blank.previewRows[0]).toMatchObject({ status: "skipped", changedFields: [] });
    expect(changed.previewRows[0]).toMatchObject({
      status: "ready",
      changedFields: ["device_custody_status"],
    });
    expect(changed.previewRows[0].warnings).not.toContainEqual(
      expect.objectContaining({ code: "shared_record_update" }),
    );
    expect(changed.previewRows[0].errors).not.toContainEqual(
      expect.objectContaining({ code: "shared_record_conflict" }),
    );
  });
});

describe("order data import normalizer capacity", () => {
  it(
    "indexes the maximum 10,000 order and 50,000 repair-item contract without quadratic scans",
    { timeout: 10_000 },
    () => {
      const rawRows = Array.from({ length: 10_000 }, (_value, index) => ({
        __row_number: String(index + 2),
        import_action: "skip",
        order_id: `order-${index}`,
      }));
      const repairItemRows = Array.from({ length: 50_000 }, (_value, index) => ({
        __row_number: String(index + 2),
        工单ID: `order-${Math.floor(index / 5)}`,
        项目名称: `维修项目 ${index}`,
        金额: "1",
      }));

      const result = normalizeOrderDataRows({
        rawRows,
        repairItemRows,
        mode: "update_only",
        candidates: {
          byId: new Map(),
          byPublicNo: new Map(),
          byExternalRef: new Map(),
          customersByPhoneRaw: new Map(),
        },
      });

      expect(result.summary).toMatchObject({ total: 10_000, skipped: 10_000 });
      expect(result.stagedRows).toHaveLength(10_000);
      expect(result.stagedRows[0].normalized_data.fault_prices).toHaveLength(5);
      expect(result.stagedRows[9_999].normalized_data.fault_prices).toHaveLength(5);
    },
  );

  it("requires every supplied repair identifier to match the same order row", () => {
    expect(() =>
      normalizeOrderDataRows({
        rawRows: [
          {
            __row_number: "2",
            import_action: "skip",
            order_id: "order-1",
            public_no: "R0001",
          },
        ],
        repairItemRows: [
          {
            __row_number: "2",
            工单ID: "order-1",
            工单编号: "R9999",
            项目名称: "屏幕",
            金额: "10",
          },
        ],
        mode: "update_only",
        candidates: {
          byId: new Map(),
          byPublicNo: new Map(),
          byExternalRef: new Map(),
          customersByPhoneRaw: new Map(),
        },
      }),
    ).toThrow("没有匹配的工单行");
  });

  it("preserves repair-sheet row order across interleaved identifier signatures", () => {
    const result = normalizeOrderDataRows({
      rawRows: [
        {
          __row_number: "2",
          import_action: "skip",
          order_id: "order-1",
          public_no: "R0001",
        },
      ],
      repairItemRows: [
        {
          __row_number: "2",
          工单编号: "R0001",
          项目名称: "sheet-first",
          金额: "10",
        },
        {
          __row_number: "3",
          工单ID: "order-1",
          项目名称: "sheet-second",
          金额: "20",
        },
      ],
      mode: "update_only",
      candidates: {
        byId: new Map(),
        byPublicNo: new Map(),
        byExternalRef: new Map(),
        customersByPhoneRaw: new Map(),
      },
    });

    expect(result.stagedRows[0].normalized_data.fault_prices).toEqual([
      expect.objectContaining({ name: "sheet-first", price: 10 }),
      expect.objectContaining({ name: "sheet-second", price: 20 }),
    ]);
  });
});
