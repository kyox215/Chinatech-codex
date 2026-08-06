"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeEuro, RefreshCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { costCurrencyQueryOptions } from "@/features/procurement/api/query-options";
import { procurementKeys } from "@/features/procurement/api/query-keys";
import {
  COST_CURRENCY_LABELS,
  SUPPORTED_COST_CURRENCIES,
} from "@/features/procurement/model/cost-currencies";
import { UnsavedSettingsGuard } from "@/features/settings/components/unsaved-settings-guard";
import { updateCostCurrencySettings } from "@/lib/repairdesk/api";
import type {
  CostCurrencyCode,
  CostCurrencyRate,
  CostCurrencySettingsResult,
} from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

type CurrencyDraft = Record<CostCurrencyCode, { enabled: boolean; rate: string; rateAt?: string }>;

function draftFromResult(result: CostCurrencySettingsResult): CurrencyDraft {
  return Object.fromEntries(
    SUPPORTED_COST_CURRENCIES.map((code) => {
      const item = result.items.find((candidate) => candidate.currency_code === code);
      return [
        code,
        {
          enabled: code === "EUR" || item?.enabled === true,
          rate:
            item?.rate_to_eur === null || item?.rate_to_eur === undefined
              ? ""
              : String(item.rate_to_eur),
          rateAt: item?.rate_at,
        },
      ];
    }),
  ) as CurrencyDraft;
}

function draftsEqual(left: CurrencyDraft, right: CurrencyDraft) {
  return SUPPORTED_COST_CURRENCIES.every(
    (code) =>
      left[code].enabled === right[code].enabled &&
      left[code].rate === right[code].rate &&
      left[code].rateAt === right[code].rateAt,
  );
}

function invalidCodes(draft: CurrencyDraft) {
  return SUPPORTED_COST_CURRENCIES.filter((code) => {
    const item = draft[code];
    if (!item.enabled) return false;
    const rate = Number(item.rate);
    return (
      !Number.isFinite(rate) ||
      rate <= 0 ||
      rate > 1_000_000 ||
      (code === "EUR" && rate !== 1) ||
      Math.abs(rate * 10_000_000_000 - Math.round(rate * 10_000_000_000)) > 1e-5
    );
  });
}

export function CostCurrencySettingsCard({ storeId }: { storeId: string }) {
  const client = useQueryClient();
  const query = useQuery(costCurrencyQueryOptions(storeId, "settings"));
  const [baseline, setBaseline] = useState<CurrencyDraft>();
  const [draft, setDraft] = useState<CurrencyDraft>();
  const invalid = useMemo(() => (draft ? invalidCodes(draft) : []), [draft]);
  const dirty = Boolean(baseline && draft && !draftsEqual(baseline, draft));

  useEffect(() => {
    if (!query.data || draft) return;
    const next = draftFromResult(query.data);
    setBaseline(next);
    setDraft(next);
  }, [draft, query.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!query.data || !draft || invalid.length > 0) throw new Error("请先修正汇率");
      return updateCostCurrencySettings({
        expected_store_id: storeId,
        expected_version: query.data.version,
        items: SUPPORTED_COST_CURRENCIES.map((code) => {
          const item = draft[code];
          return {
            currency_code: code,
            enabled: item.enabled,
            rate_to_eur: item.enabled ? Number(item.rate) : null,
            rate_at: item.enabled ? (item.rateAt ?? new Date().toISOString()) : undefined,
          };
        }),
      });
    },
    onSuccess: async (result) => {
      const next = draftFromResult(result);
      client.setQueryData(procurementKeys.costCurrencies(storeId, "settings"), result);
      setBaseline(next);
      setDraft(next);
      await client.invalidateQueries({ queryKey: procurementKeys.costCurrencies(storeId) });
      toast.success("采购成本币种与汇率已保存");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setItem = (code: CostCurrencyCode, patch: Partial<CurrencyDraft[CostCurrencyCode]>) => {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, [code]: { ...current[code], ...patch } };
      if (patch.rate !== undefined && patch.rate !== current[code].rate) {
        next[code].rateAt = new Date().toISOString();
      }
      return next;
    });
  };

  if (query.isError) {
    return (
      <section className={cn(repairOs.mobileInfoCard, "space-y-3 p-3 sm:p-4")}>
        <p role="alert" className="text-xs text-destructive">
          采购成本汇率读取失败。
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>
          <RefreshCcw className="size-3.5" /> 重新加载
        </Button>
      </section>
    );
  }

  if (query.isPending || !draft || !baseline) {
    return (
      <section className={cn(repairOs.mobileInfoCard, "space-y-3 p-3 sm:p-4")} aria-busy>
        <p className="text-sm font-semibold">采购成本币种与汇率</p>
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      </section>
    );
  }

  return (
    <section
      aria-label="采购成本币种与汇率"
      className={cn(repairOs.mobileInfoCard, "min-w-0 space-y-4 p-3 sm:p-4")}
    >
      <UnsavedSettingsGuard
        id={`settings-cost-currencies-${storeId}`}
        dirty={dirty}
        busy={save.isPending}
        canSave={dirty && invalid.length === 0}
        label="采购成本币种与汇率"
        saveUnavailableReason="请先填写所有已启用币种的有效汇率"
        onSave={async () => {
          try {
            await save.mutateAsync();
            return { status: "resolved" };
          } catch {
            return { status: "blocked" };
          }
        }}
        onDiscard={() => {
          setDraft(baseline);
          return { status: "resolved" };
        }}
      />
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BadgeEuro className="size-4 text-primary" /> 采购成本币种与汇率
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          1 单位原币等于多少 EUR。新入库会保存当时汇率快照；以后修改汇率不会改动历史成本。
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {SUPPORTED_COST_CURRENCIES.map((code) => {
          const item = draft[code];
          const saved = query.data.items.find((candidate) => candidate.currency_code === code);
          const isEur = code === "EUR";
          return (
            <CurrencyRow
              key={code}
              code={code}
              item={item}
              saved={saved}
              locked={isEur}
              invalid={invalid.includes(code)}
              onEnabledChange={(enabled) =>
                setItem(code, {
                  enabled,
                  rate: enabled ? item.rate : "",
                  rateAt: enabled ? item.rateAt : undefined,
                })
              }
              onRateChange={(rate) => setItem(code, { rate })}
            />
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={!dirty || invalid.length > 0 || save.isPending}
          onClick={() => save.mutate()}
        >
          <Save className="size-3.5" /> {save.isPending ? "正在保存" : "保存汇率设置"}
        </Button>
      </div>
    </section>
  );
}

function CurrencyRow({
  code,
  item,
  saved,
  locked,
  invalid,
  onEnabledChange,
  onRateChange,
}: {
  code: CostCurrencyCode;
  item: CurrencyDraft[CostCurrencyCode];
  saved?: CostCurrencyRate;
  locked: boolean;
  invalid: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onRateChange: (rate: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold">
            {code} · {COST_CURRENCY_LABELS[code]}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground lg:text-xs lg:leading-4">
            {saved?.stale
              ? "已超过 30 天，新采购将被阻止"
              : locked
                ? "系统基准币种"
                : "店主手动汇率"}
          </p>
        </div>
        <Switch
          checked={item.enabled}
          disabled={locked}
          aria-label={`启用 ${code}`}
          onCheckedChange={onEnabledChange}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
          1 {code} =
        </span>
        <Input
          aria-label={`${code} 兑 EUR 汇率`}
          type="number"
          inputMode="decimal"
          min="0.0000000001"
          max="1000000"
          step="0.0000000001"
          value={item.rate}
          disabled={!item.enabled || locked}
          aria-invalid={invalid}
          onChange={(event) => onRateChange(event.target.value)}
        />
        <span className="text-[11px] font-semibold lg:text-xs lg:leading-4">EUR</span>
      </div>
      {invalid ? (
        <p className="mt-1 text-[10px] text-destructive lg:text-xs lg:leading-[18px]">
          请输入有效正数汇率。
        </p>
      ) : null}
      {item.rateAt ? (
        <Badge variant="outline" className="mt-2 font-mono text-[9px] lg:text-[11px] lg:leading-4">
          {new Date(item.rateAt).toLocaleString("it-IT")}
        </Badge>
      ) : null}
    </div>
  );
}
