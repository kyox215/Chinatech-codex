import type {
  AiAssistantUsageKindMetric,
  AiAssistantUsageMetric,
  AiAssistantUsageSummary,
} from "@/features/ai-assistant/model/contracts";
import type { AuditActor } from "@/lib/repairdesk/types";
import { assertPermission } from "@/server/permissions";
import { getSupabaseAdmin } from "@/server/supabase";

const USAGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;
const USAGE_QUERY_LOOKBACK_MS = 31 * 24 * 60 * 60 * 1_000;

export type AiUsageRequestKind = "order_text" | "inventory_vision";

export interface AiUsageBucketRow {
  request_kind: AiUsageRequestKind;
  period_start_at: string;
  period_end_at: string;
  quota_timezone: string;
  request_limit: number | string;
  request_count: number | string;
  reserved_cost_microusd: number | string;
  settled_cost_microusd: number | string;
  input_token_count: number | string;
  cached_input_token_count: number | string;
  output_token_count: number | string;
}

type UsageRepositoryDependencies = {
  now?: () => Date;
  listStoreDayBuckets?: (storeId: string, periodEndAfter: string) => Promise<AiUsageBucketRow[]>;
};

export class AiUsageReadError extends Error {
  readonly status = 503;
  readonly code = "AI_USAGE_UNAVAILABLE";

  constructor() {
    super("AI 使用量暂时无法读取，请稍后重试");
    this.name = "AiUsageReadError";
  }
}

export async function getAiAssistantUsageSummary(
  actor: AuditActor,
  dependencies: UsageRepositoryDependencies = {},
): Promise<AiAssistantUsageSummary> {
  assertPermission(actor, "finance:aggregate_read");
  if (!actor.storeId) throw new AiUsageReadError();

  const now = dependencies.now?.() ?? new Date();
  const queryStart = new Date(now.getTime() - USAGE_QUERY_LOOKBACK_MS).toISOString();
  let rows: AiUsageBucketRow[];
  try {
    rows = await (dependencies.listStoreDayBuckets ?? listStoreDayBuckets)(
      actor.storeId,
      queryStart,
    );
  } catch {
    throw new AiUsageReadError();
  }

  return summarizeAiUsageBuckets(rows, now);
}

export function summarizeAiUsageBuckets(
  rows: readonly AiUsageBucketRow[],
  now: Date,
): AiAssistantUsageSummary {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new AiUsageReadError();
  const windowStart = new Date(nowMs - USAGE_WINDOW_MS);
  const normalizedRows = rows.map(normalizeRow);
  const windowRows = normalizedRows.filter(
    (row) => row.periodEndMs > windowStart.getTime() && row.periodStartMs <= nowMs,
  );
  const todayRows = normalizedRows.filter(
    (row) => row.periodStartMs <= nowMs && row.periodEndMs > nowMs,
  );
  const timezone = todayRows[0]?.quotaTimezone ?? windowRows[0]?.quotaTimezone ?? "Europe/Rome";

  return {
    generated_at: now.toISOString(),
    window_start_at: windowStart.toISOString(),
    timezone,
    today: sumRows(todayRows),
    last_30_days: sumRows(windowRows),
    today_by_kind: {
      order_text: sumKindRows(todayRows, "order_text"),
      inventory_vision: sumKindRows(todayRows, "inventory_vision"),
    },
    source: "repairdesk_usage_ledger",
  };
}

async function listStoreDayBuckets(storeId: string, periodEndAfter: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("ai_assistant_usage_buckets")
    .select(
      "request_kind,period_start_at,period_end_at,quota_timezone,request_limit,request_count,reserved_cost_microusd,settled_cost_microusd,input_token_count,cached_input_token_count,output_token_count",
    )
    .eq("scope", "store_day")
    .eq("store_id", storeId)
    .in("request_kind", ["order_text", "inventory_vision"])
    .gt("period_end_at", periodEndAfter)
    .order("period_start_at", { ascending: false })
    .limit(64);
  if (error || !Array.isArray(data)) throw new AiUsageReadError();
  return data as AiUsageBucketRow[];
}

function normalizeRow(row: AiUsageBucketRow) {
  const periodStartMs = Date.parse(row.period_start_at);
  const periodEndMs = Date.parse(row.period_end_at);
  if (
    !Number.isFinite(periodStartMs) ||
    !Number.isFinite(periodEndMs) ||
    periodEndMs <= periodStartMs ||
    (row.request_kind !== "order_text" && row.request_kind !== "inventory_vision")
  ) {
    throw new AiUsageReadError();
  }
  return {
    requestKind: row.request_kind,
    periodStartMs,
    periodEndMs,
    quotaTimezone: row.quota_timezone || "Europe/Rome",
    requestLimit: numericMetric(row.request_limit),
    requestCount: numericMetric(row.request_count),
    reservedCostMicroUsd: numericMetric(row.reserved_cost_microusd),
    settledCostMicroUsd: numericMetric(row.settled_cost_microusd),
    inputTokens: numericMetric(row.input_token_count),
    cachedInputTokens: numericMetric(row.cached_input_token_count),
    outputTokens: numericMetric(row.output_token_count),
  };
}

type NormalizedUsageRow = ReturnType<typeof normalizeRow>;

function sumRows(rows: readonly NormalizedUsageRow[]): AiAssistantUsageMetric {
  return rows.reduce<AiAssistantUsageMetric>(
    (total, row) => ({
      provider_request_count: total.provider_request_count + row.requestCount,
      input_token_count: total.input_token_count + row.inputTokens,
      cached_input_token_count: total.cached_input_token_count + row.cachedInputTokens,
      output_token_count: total.output_token_count + row.outputTokens,
      settled_cost_microusd: total.settled_cost_microusd + row.settledCostMicroUsd,
      reserved_cost_microusd: total.reserved_cost_microusd + row.reservedCostMicroUsd,
    }),
    emptyMetric(),
  );
}

function sumKindRows(
  rows: readonly NormalizedUsageRow[],
  requestKind: AiUsageRequestKind,
): AiAssistantUsageKindMetric {
  const kindRows = rows.filter((row) => row.requestKind === requestKind);
  return {
    ...sumRows(kindRows),
    request_limit: kindRows[0]?.requestLimit ?? null,
  };
}

function emptyMetric(): AiAssistantUsageMetric {
  return {
    provider_request_count: 0,
    input_token_count: 0,
    cached_input_token_count: 0,
    output_token_count: 0,
    settled_cost_microusd: 0,
    reserved_cost_microusd: 0,
  };
}

function numericMetric(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new AiUsageReadError();
  return parsed;
}
