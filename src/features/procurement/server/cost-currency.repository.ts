import type {
  AuditActor,
  CostCurrencyCode,
  CostCurrencyRate,
  CostCurrencySettingsResult,
  UpdateCostCurrencySettingsInput,
} from "@/lib/repairdesk/types";
import { fail, maybeString, requiredString } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";

type Row = Record<string, unknown>;

export class CostCurrencyOperationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CostCurrencyOperationError";
  }
}

function actorId(actor: AuditActor) {
  if (!actor.id) throw new CostCurrencyOperationError("缺少汇率操作人", "missing_actor", 403);
  return actor.id;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseResult(data: unknown, error: { message: string } | null) {
  fail(error, "采购成本汇率操作失败");
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new CostCurrencyOperationError("采购成本汇率返回无效", "invalid_result", 502);
  }
  const result = data as Row;
  if (result.ok === true) return result;
  const code = requiredString(result.code) || "currency_operation_failed";
  const messages: Record<string, string> = {
    actor_forbidden: "无权操作采购成本汇率",
    version_conflict: "汇率设置已被其他会话更新，请重新加载",
    invalid_currency_settings: "采购成本币种设置不完整",
    eur_rate_must_be_one: "EUR 兑 EUR 汇率必须固定为 1",
    invalid_currency_rate: "汇率必须大于零，且时间不能晚于当前时间",
    disabled_currency_has_rate: "停用币种不能保留当前汇率",
  };
  throw new CostCurrencyOperationError(
    messages[code] ?? `采购成本汇率操作失败：${code}`,
    code,
    code === "actor_forbidden" ? 403 : 409,
  );
}

function rate(value: unknown): CostCurrencyRate | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Row;
  const code = requiredString(row.currency_code) as CostCurrencyCode;
  if (!["EUR", "USD", "GBP", "CNY", "CHF"].includes(code)) return undefined;
  const source = maybeString(row.rate_source);
  return {
    currency_code: code,
    enabled: row.enabled === true,
    rate_to_eur: nullableNumber(row.rate_to_eur),
    rate_at: maybeString(row.rate_at),
    rate_source: source === "store_base" || source === "owner_manual" ? source : undefined,
    revision: numberValue(row.revision),
    stale: row.stale === true,
  };
}

function settings(result: Row): CostCurrencySettingsResult {
  return {
    version: numberValue(result.version),
    items: (Array.isArray(result.items) ? result.items : []).flatMap((item) => {
      const parsed = rate(item);
      return parsed ? [parsed] : [];
    }),
  };
}

export async function readCostCurrencySettingsRepository(
  expectedStoreId: string,
  actor: AuditActor,
  mode: "settings" | "options",
) {
  const functionName =
    mode === "settings"
      ? "repairdesk_read_cost_currency_settings_rpc"
      : "repairdesk_read_cost_currency_options_rpc";
  const { data, error } = await getSupabaseAdmin().rpc(functionName, {
    p_store_id: expectedStoreId,
    p_actor_id: actorId(actor),
  });
  return settings(parseResult(data, error));
}

export async function replaceCostCurrencySettingsRepository(
  input: UpdateCostCurrencySettingsInput,
  actor: AuditActor,
) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "repairdesk_replace_cost_currency_settings_rpc",
    {
      p_store_id: input.expected_store_id,
      p_actor_id: actorId(actor),
      p_expected_version: input.expected_version,
      p_items: input.items,
    },
  );
  parseResult(data, error);
  return readCostCurrencySettingsRepository(input.expected_store_id, actor, "settings");
}
