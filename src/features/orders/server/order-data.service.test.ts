import { Buffer } from "node:buffer";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";

const mocks = vi.hoisted(() => ({
  parseOrderDataWorkbook: vi.fn(),
  applyImportBatch: vi.fn(),
  createImportBatch: vi.fn(),
  listOrderDataBatchSummaries: vi.fn(),
  loadOrderDataCandidates: vi.fn(),
  assertValidExportBatch: vi.fn(),
  assertPrimaryStoreOwner: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/features/customers/server/customer.service", () => ({ listCustomersPage: vi.fn() }));
vi.mock("@/features/orders/server/order-data-workbook", () => ({
  parseOrderDataWorkbook: mocks.parseOrderDataWorkbook,
  buildCustomerStatsWorkbook: vi.fn(),
  buildOrderDataWorkbook: vi.fn(),
  workbookDownloadHeaders: vi.fn(),
}));
vi.mock("@/features/orders/server/order-data.repository", () => ({
  applyImportBatch: mocks.applyImportBatch,
  assertValidExportBatch: mocks.assertValidExportBatch,
  completeExportBatch: vi.fn(),
  createExportBatch: vi.fn(),
  createImportBatch: mocks.createImportBatch,
  externalRefKey: (source: string, id: string) =>
    `${source.trim().toLowerCase()}\u0000${id.trim()}`,
  listOrderDataExportRows: vi.fn(),
  listOrderExternalRefs: vi.fn(),
  listOrderDataBatchSummaries: mocks.listOrderDataBatchSummaries,
  loadOrderDataCandidates: mocks.loadOrderDataCandidates,
  relationRecord: (value: unknown) => value,
}));
vi.mock("@/features/stores/server/primary-store-owner", () => ({
  assertPrimaryStoreOwner: mocks.assertPrimaryStoreOwner,
}));
vi.mock("@/server/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { OrderDataApplyRepositoryError } from "@/features/orders/model/order-data-errors";

import {
  applyOrderDataImport,
  listOrderDataBatchHistory,
  previewOrderDataImport,
} from "./order-data.service";

const storeId = "00000000-0000-0000-0000-000000000001";
const actor: AuditActor = {
  id: "00000000-0000-0000-0000-000000000010",
  displayName: "Owner",
  storeId,
  storeRole: "owner",
};

describe("order data import preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ORDER_DATA_EXPORT_ENABLED", "1");
    vi.stubEnv("ORDER_DATA_APPLY_ENABLED", "1");
    mocks.assertPrimaryStoreOwner.mockResolvedValue({ actorId: actor.id, storeId });
    mocks.assertValidExportBatch.mockResolvedValue(undefined);
    mocks.listOrderDataBatchSummaries.mockResolvedValue({ items: [], hasMore: false });
    mocks.createImportBatch.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000020",
      expiresAt: "2026-07-11T12:00:00.000Z",
    });
  });

  it("binds batch history to the asserted store and fixed safe page size", async () => {
    mocks.listOrderDataBatchSummaries.mockResolvedValue({
      items: [
        {
          id: "batch-1",
          storeId,
          kind: "import",
          mode: "update_only",
          status: "previewed",
          actorDisplayName: "Owner",
          createdAt: "2026-07-13T08:00:00.000Z",
          expiresAt: "2026-07-14T08:00:00.000Z",
          summary: { total: 1, ready: 1 },
        },
      ],
      hasMore: true,
    });

    await expect(listOrderDataBatchHistory({ actor, expectedStoreId: storeId })).resolves.toEqual({
      storeId,
      items: [expect.objectContaining({ id: "batch-1", storeId })],
      hasMore: true,
    });
    expect(mocks.assertPrimaryStoreOwner).toHaveBeenCalledWith(actor);
    expect(mocks.listOrderDataBatchSummaries).toHaveBeenCalledWith({ storeId, limit: 20 });
  });

  it.each([
    ["batch_not_found", "导入批次不存在或不属于当前店铺"],
    ["batch_not_applicable", "导入预览已过期或已处理"],
    ["batch_has_invalid_rows", "预览仍有错误行，不能应用"],
    ["batch_has_no_ready_rows", "没有可应用的数据行"],
  ] as const)(
    "maps safe Apply recovery code %s without raw database text",
    async (code, message) => {
      mocks.applyImportBatch.mockRejectedValue(new OrderDataApplyRepositoryError(code));

      await expect(
        applyOrderDataImport({ actor, expectedStoreId: storeId, batchId: "batch-1" }),
      ).rejects.toThrow(message);
    },
  );

  afterEach(() => vi.unstubAllEnvs());

  it("keeps blank cells unchanged and stages only explicit differences", async () => {
    const order = existingOrder();
    mocks.parseOrderDataWorkbook.mockResolvedValue({
      templateVersion: "repairdesk-order-data-v1",
      exportBatchId: "00000000-0000-0000-0000-000000000030",
      orderRows: [
        {
          __row_number: "4",
          数据版本: "repairdesk-order-data-v1",
          导入动作: "update",
          工单ID: order.id,
          工单编号: order.public_no,
          版本时间: order.updated_at,
          客户姓名: "",
          故障描述: "更新后的故障",
          诊断结果: "__CLEAR__",
        },
      ],
      repairItemRows: [],
    });
    mocks.loadOrderDataCandidates.mockResolvedValue({
      byId: new Map([[order.id, order]]),
      byPublicNo: new Map([[order.public_no, order]]),
      byExternalRef: new Map(),
      customersByPhoneRaw: new Map(),
    });

    const preview = await previewOrderDataImport({
      actor,
      expectedStoreId: storeId,
      mode: "update_only",
      fileName: "orders.xlsx",
      bytes: Buffer.from("xlsx"),
    });

    expect(preview.summary).toMatchObject({ total: 1, update: 1, invalid: 0 });
    expect(preview.rows[0]).toMatchObject({ rowNumber: 4, action: "update", status: "ready" });
    const staged = mocks.createImportBatch.mock.calls[0][0].rows[0];
    expect(staged.normalized_data).toEqual({
      issue_description: "更新后的故障",
      diagnosis_result: null,
    });
    expect(staged.normalized_data).not.toHaveProperty("customer_name");
  });

  it("marks create rows invalid in update-only mode without writing business data", async () => {
    mocks.parseOrderDataWorkbook.mockResolvedValue({
      templateVersion: "repairdesk-order-data-v1",
      orderRows: [
        {
          __row_number: "2",
          数据版本: "repairdesk-order-data-v1",
          导入动作: "create",
          外部来源: "seatable",
          外部记录ID: "row-1",
          订单类型: "dropoff_repair",
          客户姓名: "Mario",
          客户电话: "+39 333 123 4567",
          设备品牌: "Apple",
          设备型号: "iPhone",
          故障描述: "No power",
        },
      ],
      repairItemRows: [],
    });
    mocks.loadOrderDataCandidates.mockResolvedValue({
      byId: new Map(),
      byPublicNo: new Map(),
      byExternalRef: new Map(),
      customersByPhoneRaw: new Map(),
    });

    const preview = await previewOrderDataImport({
      actor,
      expectedStoreId: storeId,
      mode: "update_only",
      fileName: "orders.xlsx",
      bytes: Buffer.from("xlsx"),
    });

    expect(preview.summary).toMatchObject({ total: 1, create: 0, invalid: 1 });
    expect(preview.rows[0].errors).toContainEqual(
      expect.objectContaining({ code: "create_disabled" }),
    );
  });

  it("does not treat legacy repair items without a currency key as changes", async () => {
    const order = {
      ...existingOrder(),
      quotation_amount: 99,
      balance_amount: 99,
      fault_prices: [{ name: "Screen", price: 99 }],
    };
    mocks.parseOrderDataWorkbook.mockResolvedValue({
      templateVersion: "repairdesk-order-data-v1",
      exportBatchId: "00000000-0000-0000-0000-000000000030",
      orderRows: [
        {
          __row_number: "2",
          数据版本: "repairdesk-order-data-v1",
          导入动作: "update",
          工单ID: order.id,
          工单编号: order.public_no,
          版本时间: order.updated_at,
        },
      ],
      repairItemRows: [
        {
          __row_number: "2",
          工单ID: order.id,
          工单编号: order.public_no,
          项目名称: "Screen",
          金额: "99",
        },
      ],
    });
    mocks.loadOrderDataCandidates.mockResolvedValue({
      byId: new Map([[order.id, order]]),
      byPublicNo: new Map([[order.public_no, order]]),
      byExternalRef: new Map(),
      customersByPhoneRaw: new Map(),
    });

    const preview = await previewOrderDataImport({
      actor,
      expectedStoreId: storeId,
      mode: "update_only",
      fileName: "orders.xlsx",
      bytes: Buffer.from("xlsx"),
    });

    expect(preview.summary).toMatchObject({ total: 1, ready: 0, skipped: 1, invalid: 0 });
    expect(preview.rows[0].warnings).toContainEqual(
      expect.objectContaining({ code: "no_changes" }),
    );
  });

  it("does not stage backup phone replacement when the primary phone is unchanged", async () => {
    const order = {
      ...existingOrder(),
      customer: {
        ...existingOrder().customer,
        phone_e164: "+39 333 123 4567",
        phone_raw: "3331234567",
        contact_phones: ["3331234567", "0931123456"],
      },
    };
    mocks.parseOrderDataWorkbook.mockResolvedValue({
      templateVersion: "repairdesk-order-data-v1",
      exportBatchId: "00000000-0000-0000-0000-000000000030",
      orderRows: [
        {
          __row_number: "2",
          数据版本: "repairdesk-order-data-v1",
          导入动作: "update",
          工单ID: order.id,
          工单编号: order.public_no,
          版本时间: order.updated_at,
          客户电话: "+39 333 123 4567",
        },
      ],
      repairItemRows: [],
    });
    mocks.loadOrderDataCandidates.mockResolvedValue({
      byId: new Map([[order.id, order]]),
      byPublicNo: new Map([[order.public_no, order]]),
      byExternalRef: new Map(),
      customersByPhoneRaw: new Map(),
    });

    const preview = await previewOrderDataImport({
      actor,
      expectedStoreId: storeId,
      mode: "update_only",
      fileName: "orders.xlsx",
      bytes: Buffer.from("xlsx"),
    });

    expect(preview.summary).toMatchObject({ total: 1, ready: 0, skipped: 1, invalid: 0 });
    const staged = mocks.createImportBatch.mock.calls[0][0].rows[0];
    expect(staged.normalized_data).toEqual({});
    expect(staged.changed_fields).not.toContain("contact_phones");
  });

  it("rejects repair item rows that do not match an order row", async () => {
    const order = existingOrder();
    mocks.parseOrderDataWorkbook.mockResolvedValue({
      templateVersion: "repairdesk-order-data-v1",
      exportBatchId: "00000000-0000-0000-0000-000000000030",
      orderRows: [
        {
          __row_number: "2",
          数据版本: "repairdesk-order-data-v1",
          导入动作: "update",
          工单ID: order.id,
          工单编号: order.public_no,
          版本时间: order.updated_at,
        },
      ],
      repairItemRows: [
        {
          __row_number: "5",
          工单编号: "R9999999",
          项目名称: "Screen",
          金额: "99",
        },
      ],
    });
    mocks.loadOrderDataCandidates.mockResolvedValue({
      byId: new Map([[order.id, order]]),
      byPublicNo: new Map([[order.public_no, order]]),
      byExternalRef: new Map(),
      customersByPhoneRaw: new Map(),
    });

    await expect(
      previewOrderDataImport({
        actor,
        expectedStoreId: storeId,
        mode: "update_only",
        fileName: "orders.xlsx",
        bytes: Buffer.from("xlsx"),
      }),
    ).rejects.toThrow("维修项目第 5 行没有匹配的工单行");
    expect(mocks.createImportBatch).not.toHaveBeenCalled();
  });

  it("rejects repair item rows with identifiers that point at different order rows", async () => {
    const firstOrder = existingOrder();
    const secondOrder = { ...existingOrder(), id: "order-2", public_no: "R0000002" };
    mocks.parseOrderDataWorkbook.mockResolvedValue({
      templateVersion: "repairdesk-order-data-v1",
      exportBatchId: "00000000-0000-0000-0000-000000000030",
      orderRows: [
        {
          __row_number: "2",
          数据版本: "repairdesk-order-data-v1",
          导入动作: "update",
          工单ID: firstOrder.id,
          工单编号: firstOrder.public_no,
          版本时间: firstOrder.updated_at,
        },
        {
          __row_number: "3",
          数据版本: "repairdesk-order-data-v1",
          导入动作: "update",
          工单ID: secondOrder.id,
          工单编号: secondOrder.public_no,
          版本时间: secondOrder.updated_at,
        },
      ],
      repairItemRows: [
        {
          __row_number: "5",
          工单ID: firstOrder.id,
          工单编号: secondOrder.public_no,
          项目名称: "Screen",
          金额: "99",
        },
      ],
    });
    mocks.loadOrderDataCandidates.mockResolvedValue({
      byId: new Map([
        [firstOrder.id, firstOrder],
        [secondOrder.id, secondOrder],
      ]),
      byPublicNo: new Map([
        [firstOrder.public_no, firstOrder],
        [secondOrder.public_no, secondOrder],
      ]),
      byExternalRef: new Map(),
      customersByPhoneRaw: new Map(),
    });

    await expect(
      previewOrderDataImport({
        actor,
        expectedStoreId: storeId,
        mode: "update_only",
        fileName: "orders.xlsx",
        bytes: Buffer.from("xlsx"),
      }),
    ).rejects.toThrow("维修项目第 5 行没有匹配的工单行");
    expect(mocks.createImportBatch).not.toHaveBeenCalled();
  });

  it("rejects a deposit that exceeds the effective quotation during preview", async () => {
    const order = {
      ...existingOrder(),
      quotation_amount: 100,
      balance_amount: 90,
      deposit_amount: 10,
      fault_prices: [{ name: "Screen", price: 100, currency_code: "EUR" }],
    };
    mocks.parseOrderDataWorkbook.mockResolvedValue({
      templateVersion: "repairdesk-order-data-v1",
      exportBatchId: "00000000-0000-0000-0000-000000000030",
      orderRows: [
        {
          __row_number: "2",
          数据版本: "repairdesk-order-data-v1",
          导入动作: "update",
          工单ID: order.id,
          工单编号: order.public_no,
          版本时间: order.updated_at,
          定金: "120",
        },
      ],
      repairItemRows: [],
    });
    mocks.loadOrderDataCandidates.mockResolvedValue({
      byId: new Map([[order.id, order]]),
      byPublicNo: new Map([[order.public_no, order]]),
      byExternalRef: new Map(),
      customersByPhoneRaw: new Map(),
    });

    const preview = await previewOrderDataImport({
      actor,
      expectedStoreId: storeId,
      mode: "update_only",
      fileName: "orders.xlsx",
      bytes: Buffer.from("xlsx"),
    });

    expect(preview.summary.invalid).toBe(1);
    expect(preview.rows[0].errors).toContainEqual(
      expect.objectContaining({ code: "deposit_exceeds_quote" }),
    );
  });

  it("rejects a create row when its phone belongs to a different customer name", async () => {
    mocks.parseOrderDataWorkbook.mockResolvedValue({
      templateVersion: "repairdesk-order-data-v1",
      orderRows: [
        {
          __row_number: "2",
          数据版本: "repairdesk-order-data-v1",
          导入动作: "create",
          外部来源: "seatable",
          外部记录ID: "row-2",
          订单类型: "dropoff_repair",
          客户姓名: "Luigi",
          客户电话: "+39 333 123 4567",
          设备品牌: "Apple",
          设备型号: "iPhone",
          故障描述: "No power",
        },
      ],
      repairItemRows: [],
    });
    mocks.loadOrderDataCandidates.mockResolvedValue({
      byId: new Map(),
      byPublicNo: new Map(),
      byExternalRef: new Map(),
      customersByPhoneRaw: new Map([
        ["393331234567", { id: "customer-1", name: "Mario", updated_at: "2026-07-10" }],
      ]),
    });

    const preview = await previewOrderDataImport({
      actor,
      expectedStoreId: storeId,
      mode: "create_and_update",
      fileName: "orders.xlsx",
      bytes: Buffer.from("xlsx"),
    });

    expect(preview.summary.invalid).toBe(1);
    expect(preview.rows[0].errors).toContainEqual(
      expect.objectContaining({ code: "customer_phone_collision" }),
    );
  });

  it("rejects repeated mutations of a shared customer in the same batch", async () => {
    const firstOrder = existingOrder();
    const secondOrder = {
      ...existingOrder(),
      id: "order-2",
      public_no: "R0000002",
      device_id: "device-2",
      device: {
        ...existingOrder().device,
        id: "device-2",
      },
    };
    mocks.parseOrderDataWorkbook.mockResolvedValue({
      templateVersion: "repairdesk-order-data-v1",
      exportBatchId: "00000000-0000-0000-0000-000000000030",
      orderRows: [
        {
          __row_number: "2",
          数据版本: "repairdesk-order-data-v1",
          导入动作: "update",
          工单ID: firstOrder.id,
          工单编号: firstOrder.public_no,
          版本时间: firstOrder.updated_at,
          客户姓名: "Mario Rossi",
        },
        {
          __row_number: "3",
          数据版本: "repairdesk-order-data-v1",
          导入动作: "update",
          工单ID: secondOrder.id,
          工单编号: secondOrder.public_no,
          版本时间: secondOrder.updated_at,
          客户电话: "+39 333 999 0000",
        },
      ],
      repairItemRows: [],
    });
    mocks.loadOrderDataCandidates.mockResolvedValue({
      byId: new Map([
        [firstOrder.id, firstOrder],
        [secondOrder.id, secondOrder],
      ]),
      byPublicNo: new Map([
        [firstOrder.public_no, firstOrder],
        [secondOrder.public_no, secondOrder],
      ]),
      byExternalRef: new Map(),
      customersByPhoneRaw: new Map(),
    });

    const preview = await previewOrderDataImport({
      actor,
      expectedStoreId: storeId,
      mode: "update_only",
      fileName: "orders.xlsx",
      bytes: Buffer.from("xlsx"),
    });

    expect(preview.summary).toMatchObject({ total: 2, ready: 0, invalid: 2 });
    expect(preview.rows.every((row) => row.status === "invalid")).toBe(true);
    expect(
      preview.rows.every((row) =>
        row.errors.some((issue) => issue.code === "shared_record_conflict"),
      ),
    ).toBe(true);
  });
});

function existingOrder() {
  return {
    id: "order-1",
    store_id: storeId,
    public_no: "R0000001",
    updated_at: "2026-07-10T12:00:00.000Z",
    order_type: "dropoff_repair",
    status: "new",
    device_custody_status: "with_shop",
    customer_id: "customer-1",
    device_id: "device-1",
    customer: {
      id: "customer-1",
      name: "Mario",
      phone_e164: "+39 333 123 4567",
      updated_at: "2026-07-10T11:00:00.000Z",
    },
    device: {
      id: "device-1",
      brand: "Apple",
      model: "iPhone",
      serial_or_imei: "",
      device_notes: null,
      updated_at: "2026-07-10T11:00:00.000Z",
    },
    issue_description: "旧故障",
    diagnosis_result: "旧诊断",
    internal_tag: null,
    accessory_notes: null,
    warranty_text: "6 mesi",
    warranty_months: 6,
    deposit_amount: 0,
    fault_prices: [],
  };
}
