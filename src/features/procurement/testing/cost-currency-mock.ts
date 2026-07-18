import type {
  AuditActor,
  CostCurrencyCode,
  CostCurrencyRate,
  CostCurrencySettingsResult,
  UpdateCostCurrencySettingsInput,
} from "@/lib/repairdesk/types";

const now = new Date().toISOString();
let version = 1;
let rates: CostCurrencyRate[] = [
  current("EUR", true, 1, "store_base"),
  current("USD", true, 0.92, "owner_manual"),
  current("GBP", false),
  current("CNY", true, 0.12, "owner_manual"),
  current("CHF", false),
];

export async function readMockCostCurrencySettings(
  input: { expected_store_id: string; mode?: "settings" | "options" },
  _actor?: AuditActor,
): Promise<CostCurrencySettingsResult> {
  const visible = input.mode === "settings" ? rates : rates.filter((item) => item.enabled);
  return { version, items: visible.map((item) => ({ ...item })) };
}

export async function replaceMockCostCurrencySettings(
  input: UpdateCostCurrencySettingsInput,
  _actor?: AuditActor,
): Promise<CostCurrencySettingsResult> {
  if (input.expected_version !== version) throw new Error("汇率设置已被其他会话更新，请重新加载");
  version += 1;
  rates = input.items.map((item) => ({
    currency_code: item.currency_code,
    enabled: item.enabled,
    rate_to_eur: item.enabled ? item.rate_to_eur : null,
    rate_at: item.enabled ? item.rate_at : undefined,
    rate_source:
      item.currency_code === "EUR" ? "store_base" : item.enabled ? "owner_manual" : undefined,
    revision: version,
    stale:
      item.currency_code !== "EUR" &&
      item.enabled &&
      Boolean(item.rate_at && Date.now() - Date.parse(item.rate_at) > 30 * 86_400_000),
  }));
  return readMockCostCurrencySettings({
    expected_store_id: input.expected_store_id,
    mode: "settings",
  });
}

export function resolveMockCostCurrencyRate(currencyCode: CostCurrencyCode): {
  rate_to_eur: number;
  rate_at: string;
  rate_source: "store_base" | "owner_manual";
  revision: number;
} {
  const item = rates.find((candidate) => candidate.currency_code === currencyCode);
  if (
    !item?.enabled ||
    item.rate_to_eur === null ||
    !item.rate_at ||
    !item.rate_source ||
    item.stale
  ) {
    throw new Error("该币种缺少可用的最新汇率");
  }
  return {
    rate_to_eur: item.rate_to_eur,
    rate_at: item.rate_at,
    rate_source: item.rate_source,
    revision: item.revision,
  };
}

function current(
  currency_code: CostCurrencyCode,
  enabled: boolean,
  rate_to_eur: number | null = null,
  rate_source?: CostCurrencyRate["rate_source"],
): CostCurrencyRate {
  return {
    currency_code,
    enabled,
    rate_to_eur,
    rate_at: enabled ? now : undefined,
    rate_source,
    revision: version,
    stale: false,
  };
}
