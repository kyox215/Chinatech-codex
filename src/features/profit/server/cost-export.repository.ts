import type { AuditActor, CostExportInput, CostExportRow } from "@/lib/repairdesk/types";
import { getSupabaseAdmin } from "@/server/supabase";
import { fail, maybeString, requiredString } from "@/server/repairdesk-shared";

type Row = Record<string, unknown>;

export class CostExportOperationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CostExportOperationError";
  }
}

function requireActorId(actor: AuditActor) {
  if (!actor.id) throw new CostExportOperationError("缺少导出操作人", "missing_actor", 403);
  return actor.id;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function exportRow(value: unknown): CostExportRow | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Row;
  const publicNo = maybeString(row.order_public_no);
  const date = maybeString(row.order_created_date)?.slice(0, 10);
  const lineId = maybeString(row.line_id);
  if (!publicNo || !date || !lineId) return undefined;
  return {
    order_public_no: publicNo,
    order_created_date: date,
    order_status: requiredString(row.order_status),
    line_id: lineId,
    catalog_key: maybeString(row.catalog_key),
    line_name: requiredString(row.line_name) || "未命名维修项目",
    quote_amount_eur: nullableNumber(row.quote_amount_eur) ?? 0,
    cost_amount_eur: nullableNumber(row.cost_amount_eur),
    cost_source: requiredString(row.cost_source) || "unrecorded",
    evidence_status: requiredString(row.evidence_status) || "unknown",
    original_amount: nullableNumber(row.original_amount),
    original_currency_code: maybeString(row.original_currency_code),
    fx_rate_to_eur: nullableNumber(row.fx_rate_to_eur),
    fx_rate_at: maybeString(row.fx_rate_at),
    fx_rate_source: maybeString(row.fx_rate_source),
    supplier_name: maybeString(row.supplier_name),
    margin_amount_eur: nullableNumber(row.margin_amount_eur),
  };
}

export async function readCostExportRows(input: CostExportInput, actor: AuditActor) {
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_read_cost_export_rpc", {
    p_store_id: input.expected_store_id,
    p_actor_id: requireActorId(actor),
    p_start_date: input.start_date,
    p_end_date: input.end_date,
    p_statuses: input.statuses ?? null,
    p_sources: input.sources ?? null,
    p_limit: input.limit ?? 10_000,
  });
  fail(error, "读取成本导出数据失败");
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new CostExportOperationError("成本导出返回无效", "invalid_result", 502);
  }
  const result = data as Row;
  if (result.ok !== true) {
    const code = requiredString(result.code) || "cost_export_failed";
    if (code === "actor_forbidden") {
      throw new CostExportOperationError("无权导出维修成本与毛利", "forbidden", 403);
    }
    if (code === "invalid_date_range" || code === "invalid_filter") {
      throw new CostExportOperationError("成本导出筛选范围无效", code, 422);
    }
    throw new CostExportOperationError(`成本导出失败：${code}`, code, 409);
  }
  return {
    timezone: requiredString(result.timezone) || "Europe/Rome",
    overflow: result.overflow === true,
    rows: (Array.isArray(result.items) ? result.items : []).flatMap((item) => {
      const parsed = exportRow(item);
      return parsed ? [parsed] : [];
    }),
  };
}
