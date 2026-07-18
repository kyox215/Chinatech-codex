import type {
  AuditActor,
  ProfitCenterInput,
  ProfitCenterResult,
  ProfitBreakdownItem,
  ProfitOrderDrilldownItem,
  ProfitPeriodSummary,
  ProfitTrendPoint,
} from "@/lib/repairdesk/types";
import { getSupabaseAdmin } from "@/server/supabase";
import {
  fail,
  maybeString,
  requiredString,
  requireStoreIdFromActor,
} from "@/server/repairdesk-shared";
import { isPartsProcurementEnabled } from "@/features/orders/server/order-cost-feature";
import { assertCanReadProfitCenter } from "./profit-feature";

type Row = Record<string, unknown>;

export class ProfitOperationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProfitOperationError";
  }
}

function requireActorId(actor: AuditActor) {
  if (!actor.id) throw new ProfitOperationError("缺少报表操作人", "missing_actor", 403);
  return actor.id;
}

function finiteNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function assertProfitRpcResult(data: unknown, error: { message: string } | null) {
  fail(error, "读取维修毛利中心失败");
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("读取维修毛利中心失败：数据库返回无效");
  }
  const result = data as Row;
  if (result.ok === true) return result;
  switch (requiredString(result.code)) {
    case "actor_forbidden":
      throw new ProfitOperationError("无权查看维修毛利中心", "forbidden", 403);
    case "invalid_date_range":
      throw new ProfitOperationError("报表日期范围无效", "invalid_date_range", 422);
    case "store_not_found":
    case "invalid_store_timezone":
      throw new ProfitOperationError("当前店铺时区配置无效", "invalid_store_timezone", 409);
    default:
      throw new ProfitOperationError(
        `读取维修毛利中心失败：${requiredString(result.code) || "操作被拒绝"}`,
        requiredString(result.code) || "profit_operation_failed",
        422,
      );
  }
}

function periodSummary(value: unknown): ProfitPeriodSummary {
  const row = value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
  return {
    order_count: finiteNumber(row.order_count),
    eligible_order_count: finiteNumber(row.eligible_order_count),
    quote_amount: finiteNumber(row.quote_amount),
    known_cost_amount: finiteNumber(row.known_cost_amount),
    exact_margin_amount: finiteNumber(row.exact_margin_amount),
    exact_order_count: finiteNumber(row.exact_order_count),
    incomplete_order_count: finiteNumber(row.incomplete_order_count),
    estimated_order_count: finiteNumber(row.estimated_order_count),
    negative_margin_order_count: finiteNumber(row.negative_margin_order_count),
  };
}

function trendPoint(value: unknown): ProfitTrendPoint | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Row;
  const date = maybeString(row.date)?.slice(0, 10);
  if (!date) return undefined;
  return {
    date,
    expected_order_count: finiteNumber(row.expected_order_count),
    expected_quote_amount: finiteNumber(row.expected_quote_amount),
    expected_known_cost_amount: finiteNumber(row.expected_known_cost_amount),
    expected_exact_margin_amount: finiteNumber(row.expected_exact_margin_amount),
    expected_incomplete_order_count: finiteNumber(row.expected_incomplete_order_count),
    completed_order_count: finiteNumber(row.completed_order_count),
    completed_quote_amount: finiteNumber(row.completed_quote_amount),
    completed_known_cost_amount: finiteNumber(row.completed_known_cost_amount),
    completed_exact_margin_amount: finiteNumber(row.completed_exact_margin_amount),
    completed_incomplete_order_count: finiteNumber(row.completed_incomplete_order_count),
  };
}

function drilldownItem(value: unknown): ProfitOrderDrilldownItem | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Row;
  const orderId = maybeString(row.order_id);
  const publicNo = maybeString(row.public_no);
  const createdAt = maybeString(row.created_at);
  const completeness = row.cost_completeness;
  const paymentStatus = row.payment_status;
  if (
    !orderId ||
    !publicNo ||
    !createdAt ||
    !["incomplete", "estimated", "confirmed"].includes(String(completeness)) ||
    !["unpaid", "partial", "paid", "refunded"].includes(String(paymentStatus))
  ) {
    return undefined;
  }
  return {
    order_id: orderId,
    public_no: publicNo,
    status: requiredString(row.status),
    exception_status: maybeString(row.exception_status),
    payment_status: paymentStatus as ProfitOrderDrilldownItem["payment_status"],
    created_at: createdAt,
    completed_at: maybeString(row.completed_at),
    delivered_at: maybeString(row.delivered_at),
    quote_amount: finiteNumber(row.quote_amount),
    known_cost_amount: finiteNumber(row.known_cost_amount),
    quote_gross_margin: nullableFiniteNumber(row.quote_gross_margin),
    quote_gross_margin_percent: nullableFiniteNumber(row.quote_gross_margin_percent),
    quote_line_count: finiteNumber(row.quote_line_count),
    unknown_cost_line_count: finiteNumber(row.unknown_cost_line_count),
    estimated_cost_line_count: finiteNumber(row.estimated_cost_line_count),
    confirmed_cost_line_count: finiteNumber(row.confirmed_cost_line_count),
    cost_completeness: completeness as ProfitOrderDrilldownItem["cost_completeness"],
    is_refunded: row.is_refunded === true,
    is_rework: row.is_rework === true,
  };
}

function breakdownItem(value: unknown): ProfitBreakdownItem | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Row;
  const key = maybeString(row.key);
  const label = maybeString(row.label);
  if (!key || !label) return undefined;
  return {
    key,
    label,
    order_count: finiteNumber(row.order_count),
    line_count: finiteNumber(row.line_count),
    quote_amount: finiteNumber(row.quote_amount),
    known_cost_amount: finiteNumber(row.known_cost_amount),
    exact_margin_amount: finiteNumber(row.exact_margin_amount),
    exact_line_count: finiteNumber(row.exact_line_count),
    incomplete_line_count: finiteNumber(row.incomplete_line_count),
  };
}

export async function getProfitCenter(
  input: ProfitCenterInput,
  actor: AuditActor,
): Promise<ProfitCenterResult> {
  assertCanReadProfitCenter(actor);
  const storeId = requireStoreIdFromActor(actor);
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_read_profit_center_rpc", {
    p_store_id: storeId,
    p_actor_id: requireActorId(actor),
    p_start_date: input.start_date,
    p_end_date: input.end_date,
  });
  const result = assertProfitRpcResult(data, error);
  const summary =
    result.summary && typeof result.summary === "object" && !Array.isArray(result.summary)
      ? (result.summary as Row)
      : {};
  const dataQuality =
    summary.data_quality &&
    typeof summary.data_quality === "object" &&
    !Array.isArray(summary.data_quality)
      ? (summary.data_quality as Row)
      : {};
  const collection =
    summary.collection_reference &&
    typeof summary.collection_reference === "object" &&
    !Array.isArray(summary.collection_reference)
      ? (summary.collection_reference as Row)
      : {};
  let breakdowns: ProfitCenterResult["breakdowns"];
  if (isPartsProcurementEnabled()) {
    const breakdownResponse = await getSupabaseAdmin().rpc(
      "repairdesk_read_profit_breakdowns_rpc",
      {
        p_store_id: storeId,
        p_actor_id: requireActorId(actor),
        p_start_date: input.start_date,
        p_end_date: input.end_date,
      },
    );
    const breakdownResult = assertProfitRpcResult(breakdownResponse.data, breakdownResponse.error);
    breakdowns = {
      categories: (Array.isArray(breakdownResult.categories)
        ? breakdownResult.categories
        : []
      ).flatMap((item) => breakdownItem(item) ?? []),
      suppliers: (Array.isArray(breakdownResult.suppliers)
        ? breakdownResult.suppliers
        : []
      ).flatMap((item) => breakdownItem(item) ?? []),
    };
  }

  return {
    timezone: requiredString(result.timezone) || "Europe/Rome",
    start_date: requiredString(result.start_date),
    end_date: requiredString(result.end_date),
    definition: "final_quote_operational_gross_margin",
    summary: {
      expected: periodSummary(summary.expected),
      completed: periodSummary(summary.completed),
      data_quality: {
        unknown_line_count: finiteNumber(dataQuality.unknown_line_count),
        refunded_order_count: finiteNumber(dataQuality.refunded_order_count),
        rework_order_count: finiteNumber(dataQuality.rework_order_count),
      },
      collection_reference: {
        amount: finiteNumber(collection.amount),
        entry_count: finiteNumber(collection.entry_count),
        non_eur_entry_count: finiteNumber(collection.non_eur_entry_count),
      },
    },
    trend: (Array.isArray(result.trend) ? result.trend : []).flatMap((item) => {
      const parsed = trendPoint(item);
      return parsed ? [parsed] : [];
    }),
    orders: (Array.isArray(result.orders) ? result.orders : []).flatMap((item) => {
      const parsed = drilldownItem(item);
      return parsed ? [parsed] : [];
    }),
    ...(breakdowns ? { breakdowns } : {}),
  };
}
