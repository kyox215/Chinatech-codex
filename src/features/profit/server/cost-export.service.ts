import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";

import type { AuditActor, CostExportInput, CostExportRow } from "@/lib/repairdesk/types";
import { writeAuditLog } from "@/server/audit";

import { assertCostExportStore } from "./cost-export-feature";
import { CostExportOperationError, readCostExportRows } from "./cost-export.repository";

export const COST_EXPORT_HEADERS = [
  "工单编号",
  "建单日期",
  "工单状态",
  "维修行ID",
  "维修类别键",
  "维修项目",
  "报价_EUR",
  "成本_EUR",
  "成本来源",
  "证据状态",
  "原币金额",
  "原币币种",
  "兑欧元汇率",
  "汇率时间",
  "汇率来源",
  "采购供应商",
  "报价毛利_EUR",
] as const;

export async function exportCostReport(
  input: CostExportInput,
  actor: AuditActor,
  readRows: typeof readCostExportRows = readCostExportRows,
) {
  const storeId = assertCostExportStore(actor, input.expected_store_id);
  const exportId = randomUUID();
  const result = await readRows(input, actor);
  if (result.overflow) {
    await auditCostExport({
      actor,
      exportId,
      input,
      rowCount: input.limit ?? 10_000,
      result: "rejected_row_limit",
    });
    throw new CostExportOperationError(
      `导出结果超过 ${input.limit ?? 10_000} 行，请缩短日期范围或增加筛选`,
      "row_limit_exceeded",
      422,
    );
  }
  const bytes = buildCostExportCsv(result.rows);
  const contentSha256 = createHash("sha256").update(bytes).digest("hex");
  await auditCostExport({
    actor,
    exportId,
    input,
    rowCount: result.rows.length,
    result: "generated",
    contentSha256,
  });
  const fileName = `repairdesk-cost-margin-${input.start_date}-${input.end_date}.csv`;
  return {
    bytes,
    fileName,
    headers: csvDownloadHeaders(fileName),
    storeId,
    timezone: result.timezone,
    rowCount: result.rows.length,
    contentSha256,
  };
}

export function buildCostExportCsv(rows: CostExportRow[]) {
  const csvRows: Array<Array<string | number | null | undefined>> = [
    [...COST_EXPORT_HEADERS],
    ...rows.map((row) => [
      row.order_public_no,
      row.order_created_date,
      row.order_status,
      row.line_id,
      row.catalog_key,
      row.line_name,
      row.quote_amount_eur.toFixed(2),
      row.cost_amount_eur?.toFixed(2),
      row.cost_source,
      row.evidence_status,
      row.original_amount?.toFixed(6),
      row.original_currency_code,
      row.fx_rate_to_eur?.toFixed(10),
      row.fx_rate_at,
      row.fx_rate_source,
      row.supplier_name,
      row.margin_amount_eur?.toFixed(2),
    ]),
  ];
  const content = `\uFEFF${csvRows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
  return Buffer.from(content, "utf8");
}

function csvCell(value: string | number | null | undefined) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function csvDownloadHeaders(fileName: string) {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="repairdesk-cost-margin.csv"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "X-Content-Type-Options": "nosniff",
  };
}

async function auditCostExport(input: {
  actor: AuditActor;
  exportId: string;
  input: CostExportInput;
  rowCount: number;
  result: "generated" | "rejected_row_limit";
  contentSha256?: string;
}) {
  await writeAuditLog({
    actor: input.actor,
    action: "export",
    entityType: "repair_cost_export",
    entityId: input.exportId,
    metadata: {
      start_date: input.input.start_date,
      end_date: input.input.end_date,
      status_filter_count: input.input.statuses?.length ?? 0,
      source_filter_count: input.input.sources?.length ?? 0,
      row_count: input.rowCount,
      content_sha256: input.contentSha256,
      result: input.result,
    },
  });
}
