import type {
  OrderDataImportApplyResult,
  OrderDataImportIssue,
  OrderDataImportPreview,
} from "@/lib/repairdesk/types";

export interface OrderDataTextReport {
  content: string;
  fileName: string;
}

export function buildOrderDataPreviewReport(
  preview: OrderDataImportPreview,
  createdAt = new Date(),
): OrderDataTextReport {
  return {
    fileName: `repairdesk-order-preview-${dateStamp(createdAt)}.csv`,
    content: csv([
      ["批次ID", preview.batchId],
      ["店铺ID", preview.storeId],
      ["导入模式", preview.mode],
      ["过期时间", preview.expiresAt],
      [],
      ["行号", "工单编号", "工单ID", "动作", "状态", "修改字段", "警告", "错误"],
      ...preview.rows.map((row) => [
        row.rowNumber,
        row.publicNo ?? "",
        row.orderId ?? "",
        row.action,
        row.status,
        row.changedFields.join(" | "),
        issueText(row.warnings),
        issueText(row.errors),
      ]),
    ]),
  };
}

export function buildOrderDataApplyReport(
  result: OrderDataImportApplyResult,
  createdAt = new Date(),
): OrderDataTextReport {
  return {
    fileName: `repairdesk-order-apply-errors-${dateStamp(createdAt)}.csv`,
    content: csv([
      ["批次ID", result.batchId],
      ["批次状态", result.status],
      ["成功", result.applied],
      ["冲突", result.conflicts],
      ["失败", result.failed],
      ["跳过", result.skipped],
      [],
      ["行号", "状态", "错误"],
      ...(result.rows ?? []).map((row) => [row.rowNumber, row.status, issueText(row.errors)]),
    ]),
  };
}

function issueText(issues: OrderDataImportIssue[]) {
  return issues
    .map((issue) => [issue.code, issue.field, issue.message].filter(Boolean).join(":"))
    .join(" | ");
}

function csv(rows: (string | number)[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function dateStamp(value: Date) {
  return value.toISOString().slice(0, 10);
}
