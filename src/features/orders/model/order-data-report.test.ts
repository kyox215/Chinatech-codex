import { describe, expect, it } from "vitest";

import type { OrderDataImportApplyResult, OrderDataImportPreview } from "@/lib/repairdesk/types";

import { buildOrderDataApplyReport, buildOrderDataPreviewReport } from "./order-data-report";

const preview: OrderDataImportPreview = {
  batchId: "batch-1",
  storeId: "store-1",
  templateVersion: "repairdesk-order-data-v1",
  mode: "update_only",
  expiresAt: "2026-07-14T12:00:00.000Z",
  summary: { total: 1, ready: 0, create: 0, update: 0, invalid: 1, skipped: 0 },
  rows: [
    {
      rowNumber: 2,
      action: "update",
      status: "invalid",
      publicNo: '=HYPERLINK("https://unsafe.test")',
      changedFields: ["客户姓名"],
      warnings: [],
      errors: [{ code: "version_conflict", field: "版本时间", message: "请重新导出" }],
    },
  ],
};

describe("order data text reports", () => {
  it("exports every preview row and neutralizes spreadsheet formulas", () => {
    const report = buildOrderDataPreviewReport(preview, new Date("2026-07-13T00:00:00Z"));

    expect(report.fileName).toBe("repairdesk-order-preview-2026-07-13.csv");
    expect(report.content).toContain("batch-1");
    expect(report.content).toContain("version_conflict:版本时间:请重新导出");
    expect(report.content).toContain("'=HYPERLINK");
    expect(report.content).not.toContain('\n"=HYPERLINK');
  });

  it("exports the complete non-applied row result", () => {
    const result: OrderDataImportApplyResult = {
      batchId: "batch-1",
      status: "partial",
      applied: 8,
      conflicts: 1,
      failed: 1,
      skipped: 0,
      rows: [
        {
          rowNumber: 3,
          status: "conflict",
          errors: [{ code: "version_conflict", message: "冲突" }],
        },
        { rowNumber: 7, status: "failed", errors: [{ code: "apply_failed", message: "失败" }] },
      ],
    };

    const report = buildOrderDataApplyReport(result, new Date("2026-07-13T00:00:00Z"));

    expect(report.fileName).toBe("repairdesk-order-apply-errors-2026-07-13.csv");
    expect(report.content).toContain("version_conflict:冲突");
    expect(report.content).toContain("apply_failed:失败");
  });
});
