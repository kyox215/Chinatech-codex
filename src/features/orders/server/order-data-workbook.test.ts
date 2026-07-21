import { Buffer } from "node:buffer";

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  LEGACY_ORDER_DATA_TEMPLATE_VERSION,
  ORDER_DATA_TEMPLATE_VERSION,
  PREVIOUS_ORDER_DATA_TEMPLATE_VERSION,
} from "@/features/orders/model/order-data-contract";

import { buildOrderDataWorkbook, parseOrderDataWorkbook } from "./order-data-workbook";

const mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

describe("order data workbook", () => {
  it("builds and parses the blank template", async () => {
    const bytes = await buildOrderDataWorkbook({ kind: "template" });
    const parsed = await parseOrderDataWorkbook({
      bytes,
      fileName: "template.xlsx",
      mimeType,
    });

    expect(parsed.templateVersion).toBe(ORDER_DATA_TEMPLATE_VERSION);
    expect(parsed.orderRows).toEqual([]);
    expect(parsed.repairItemRows).toEqual([]);
  });

  it("round trips exported rows as text and keeps the export batch binding", async () => {
    const bytes = await buildOrderDataWorkbook({
      kind: "export",
      exportBatchId: "f6f5fa5c-3d43-4799-9d36-f8115e1e70de",
      orderRows: [
        {
          template_version: ORDER_DATA_TEMPLATE_VERSION,
          import_action: "update",
          order_id: "order-1",
          public_no: "R0000001",
          expected_updated_at: "2026-07-10T12:00:00.000Z",
          device_custody_status: "with_customer",
          device_custody_label: "客户持有",
          customer_name: '=HYPERLINK("https://example.com")',
          issue_description: "屏幕损坏",
        },
      ],
      repairItemRows: [
        {
          order_id: "order-1",
          public_no: "R0000001",
          sequence: 1,
          name: "屏幕更换",
          price: 99,
        },
      ],
    });
    const parsed = await parseOrderDataWorkbook({ bytes, fileName: "orders.xlsx", mimeType });

    expect(parsed.exportBatchId).toBe("f6f5fa5c-3d43-4799-9d36-f8115e1e70de");
    expect(parsed.orderRows[0]).toMatchObject({
      设备保管枚举: "with_customer",
      设备保管状态: "客户持有",
    });
    expect(parsed.orderRows[0]["客户姓名"]).toBe('=HYPERLINK("https://example.com")');
    expect(parsed.repairItemRows[0]).toMatchObject({ 项目名称: "屏幕更换", 金额: "99" });
  });

  it("continues to parse legacy v1 workbooks without custody columns", async () => {
    const bytes = await buildOrderDataWorkbook({
      kind: "template",
      templateVersion: LEGACY_ORDER_DATA_TEMPLATE_VERSION,
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(bytes).buffer);
    const orderSheet = workbook.getWorksheet("工单");
    const metadataSheet = workbook.getWorksheet("_元数据");
    if (!orderSheet || !metadataSheet) throw new Error("missing workbook sheets");

    orderSheet.getCell("A2").value = LEGACY_ORDER_DATA_TEMPLATE_VERSION;
    orderSheet.getCell("B2").value = "create";
    metadataSheet.getCell("B1").value = LEGACY_ORDER_DATA_TEMPLATE_VERSION;
    const legacyBytes = Buffer.from(await workbook.xlsx.writeBuffer());

    const parsed = await parseOrderDataWorkbook({
      bytes: legacyBytes,
      fileName: "legacy-orders.xlsx",
      mimeType,
    });

    expect(parsed.templateVersion).toBe(LEGACY_ORDER_DATA_TEMPLATE_VERSION);
    expect(parsed.orderRows[0]).not.toHaveProperty("设备保管枚举");
    expect(parsed.orderRows[0]).not.toHaveProperty("设备保管状态");
  });

  it("continues to parse v2 workbooks and treats v3 operation history as read-only", async () => {
    const v2Bytes = await buildOrderDataWorkbook({
      kind: "template",
      templateVersion: PREVIOUS_ORDER_DATA_TEMPLATE_VERSION,
    });
    const v2 = await parseOrderDataWorkbook({ bytes: v2Bytes, fileName: "v2.xlsx", mimeType });
    expect(v2.templateVersion).toBe(PREVIOUS_ORDER_DATA_TEMPLATE_VERSION);
    expect(v2.orderRows).toEqual([]);

    const v3Bytes = await buildOrderDataWorkbook({
      kind: "export",
      operationHistoryRows: [
        {
          order_id: "order-1",
          public_no: "R0000001",
          event_type: "note",
          operator_name: "老板",
          created_at: "2026-07-21T10:00:00.000Z",
          summary: "tampered-but-never-staged",
        },
      ],
    });
    const v3 = await parseOrderDataWorkbook({ bytes: v3Bytes, fileName: "v3.xlsx", mimeType });
    expect(v3.operationHistoryRows?.[0]?.["操作摘要"]).toBe("tampered-but-never-staged");
    expect(v3.orderRows).toEqual([]);
  });

  it("rejects formula cells from uploaded workbooks", async () => {
    const bytes = await buildOrderDataWorkbook({ kind: "template" });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(bytes).buffer);
    const sheet = workbook.getWorksheet("工单");
    if (!sheet) throw new Error("missing sheet");
    sheet.getCell("A2").value = ORDER_DATA_TEMPLATE_VERSION;
    sheet.getCell("B2").value = "create";
    sheet.getCell("J2").value = { formula: 'HYPERLINK("https://example.com")', result: "客户" };
    const unsafeBytes = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(
      parseOrderDataWorkbook({ bytes: unsafeBytes, fileName: "unsafe.xlsx", mimeType }),
    ).rejects.toThrow("不允许使用公式");
  });

  it("rejects macro-enabled extensions before parsing", async () => {
    const bytes = await buildOrderDataWorkbook({ kind: "template" });
    await expect(
      parseOrderDataWorkbook({ bytes, fileName: "unsafe.xlsm", mimeType }),
    ).rejects.toThrow("只支持 .xlsx");
  });

  it("rejects ZIP entries whose declared size is smaller than actual output", async () => {
    const bytes = await buildOrderDataWorkbook({ kind: "template" });
    const forged = forgeDeclaredUncompressedSize(bytes, "xl/worksheets/sheet1.xml", 1);

    await expect(
      parseOrderDataWorkbook({ bytes: forged, fileName: "forged.xlsx", mimeType }),
    ).rejects.toThrow();
  });
});

function forgeDeclaredUncompressedSize(bytes: Buffer, targetName: string, size: number) {
  const forged = Buffer.from(bytes);
  for (let offset = 0; offset <= forged.length - 46; offset += 1) {
    if (forged.readUInt32LE(offset) !== 0x02014b50) continue;
    const fileNameLength = forged.readUInt16LE(offset + 28);
    const name = forged.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    if (name !== targetName) continue;
    const localHeaderOffset = forged.readUInt32LE(offset + 42);
    forged.writeUInt32LE(size, offset + 24);
    forged.writeUInt32LE(size, localHeaderOffset + 22);
    return forged;
  }
  throw new Error(`ZIP entry not found: ${targetName}`);
}
