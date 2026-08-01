"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, LoaderCircle, RefreshCcw, RotateCcw, Save } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  repairServiceCatalogGroups,
  repairServiceCatalogItems,
  repairServiceCatalogItemsForGroup,
} from "@/entities/order";
import { UnsavedSettingsGuard } from "@/features/settings/components/unsaved-settings-guard";
import {
  getStoreFaultCostDefaults,
  RepairDeskApiError,
  updateStoreFaultCostDefaults,
} from "@/lib/repairdesk/api";
import type { StoreFaultCostDefaultsResult } from "@/lib/repairdesk/types";
import { brandGradientStyle, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { RepairOsSectionHeader } from "@/shared/ui";

type CostDraft = Record<string, string>;
type CostNotice = { kind: "success" | "error" | "info"; message: string };

interface CostDraftState {
  storeId: string;
  version: number;
  baseline: CostDraft;
  values: CostDraft;
}

export interface RepairCostDefaultsCardProps {
  storeId: string;
  className?: string;
}

export function RepairCostDefaultsCard({ storeId, className }: RepairCostDefaultsCardProps) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["orders", "cost-defaults", storeId] as const, [storeId]);
  const [draftState, setDraftState] = useState<CostDraftState>();
  const [notice, setNotice] = useState<CostNotice>();
  const [hasSaveConflict, setHasSaveConflict] = useState(false);

  const defaultsQuery = useQuery({
    queryKey,
    queryFn: () => getStoreFaultCostDefaults(storeId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!defaultsQuery.data) return;
    setDraftState((current) => {
      if (current?.storeId === storeId) return current;
      return draftStateFromResult(storeId, defaultsQuery.data);
    });
  }, [defaultsQuery.data, storeId]);

  const values = useMemo(() => draftState?.values ?? {}, [draftState?.values]);
  const validation = useMemo(() => validateCostDraft(values), [values]);
  const isDirty = Boolean(
    draftState && !areCostDraftsEqual(draftState.baseline, draftState.values),
  );
  const hasRemoteConflict = Boolean(
    draftState && defaultsQuery.data && defaultsQuery.data.version !== draftState.version,
  );
  const isConflict = hasSaveConflict || hasRemoteConflict;
  const configuredCount = repairServiceCatalogItems.reduce((count, item) => {
    const parsed = parseCostDraft(values[item.catalogKey] ?? "");
    return count + (parsed.value !== null && !parsed.error ? 1 : 0);
  }, 0);

  const saveMutation = useMutation({
    mutationFn: async (request: {
      expectedStoreId: string;
      expectedVersion: number;
      values: CostDraft;
    }) => {
      const parsed = validateCostDraft(request.values);
      if (Object.keys(parsed.errors).length > 0) {
        throw new Error("请先修正标记的成本金额");
      }
      return updateStoreFaultCostDefaults({
        expected_store_id: request.expectedStoreId,
        expected_version: request.expectedVersion,
        items: repairServiceCatalogItems.map((item) => ({
          catalog_key: item.catalogKey,
          catalog_name: item.name,
          default_cost_amount: parsed.amounts[item.catalogKey] ?? null,
        })),
      });
    },
    onSuccess: (result, request) => {
      if (request.expectedStoreId !== storeId) return;
      queryClient.setQueryData(queryKey, result);
      setDraftState(draftStateFromResult(storeId, result));
      setHasSaveConflict(false);
      setNotice({ kind: "success", message: "维修项目默认成本已保存。" });
    },
    onError: (error) => {
      if (error instanceof RepairDeskApiError && error.status === 409) {
        setHasSaveConflict(true);
        setNotice({
          kind: "error",
          message: "默认成本已被其他会话更新。请重新加载最新值后再修改。",
        });
        return;
      }
      setNotice({
        kind: "error",
        message: error instanceof Error && error.message ? error.message : "保存默认成本失败",
      });
    },
  });

  const canSave = Boolean(
    draftState &&
    isDirty &&
    !isConflict &&
    Object.keys(validation.errors).length === 0 &&
    !saveMutation.isPending,
  );

  const save = async () => {
    if (!draftState || !canSave) return false;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setNotice({ kind: "error", message: "默认成本包含敏感数据，请联网后再保存。" });
      return false;
    }
    setNotice({ kind: "info", message: "正在保存维修项目默认成本…" });
    try {
      await saveMutation.mutateAsync({
        expectedStoreId: storeId,
        expectedVersion: draftState.version,
        values: draftState.values,
      });
      return true;
    } catch {
      return false;
    }
  };

  const discardChanges = () => {
    if (!draftState) return;
    setDraftState({ ...draftState, values: { ...draftState.baseline } });
    setNotice({ kind: "info", message: "未保存的默认成本修改已撤销。" });
  };

  const reloadLatest = async () => {
    setNotice({ kind: "info", message: "正在重新加载最新默认成本…" });
    const result = await defaultsQuery.refetch();
    if (result.isError || !result.data) {
      setNotice({ kind: "error", message: "重新加载失败，请稍后重试。" });
      return;
    }
    setDraftState(draftStateFromResult(storeId, result.data));
    setHasSaveConflict(false);
    saveMutation.reset();
    setNotice({ kind: "success", message: "已加载最新默认成本。" });
  };

  if (defaultsQuery.isError && !draftState) {
    return (
      <section
        aria-label="维修项目默认成本"
        className={cn(repairOs.adminSection, "p-2.5 sm:p-3", className)}
      >
        <RepairOsSectionHeader icon={Coins} iconFrame={false} title="维修项目默认成本" />
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2.5 text-status-danger-foreground sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-xs leading-5">无法读取默认成本，请确认网络和当前权限后重试。</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-10 shrink-0 bg-card"
            onClick={() => void defaultsQuery.refetch()}
          >
            <RefreshCcw className="size-3.5" /> 重新加载
          </Button>
        </div>
      </section>
    );
  }

  if (defaultsQuery.isLoading || !draftState) {
    return (
      <section
        aria-label="维修项目默认成本"
        aria-busy="true"
        className={cn(repairOs.adminSection, "space-y-3 p-2.5 sm:p-3", className)}
      >
        <RepairOsSectionHeader
          icon={Coins}
          iconFrame={false}
          title="维修项目默认成本"
          description="正在读取当前店铺配置"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="h-14 animate-pulse rounded-xl bg-muted" />
          <div className="h-14 animate-pulse rounded-xl bg-muted" />
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="维修项目默认成本"
      aria-busy={saveMutation.isPending}
      className={cn(repairOs.adminSection, "p-2.5 sm:p-3", className)}
    >
      <UnsavedSettingsGuard
        id={`settings-order-cost-defaults-${storeId}`}
        dirty={isDirty}
        busy={saveMutation.isPending}
        canSave={canSave}
        saveUnavailableReason={
          isConflict
            ? "默认成本版本已变化，请先重新加载最新值"
            : Object.keys(validation.errors).length > 0
              ? "请先修正标记的成本金额"
              : "当前默认成本暂时无法保存"
        }
        label="维修项目默认成本"
        onSave={async () => ((await save()) ? { status: "resolved" } : { status: "blocked" })}
        onDiscard={() => {
          discardChanges();
          return { status: "resolved" };
        }}
        onFocusFallback={() => document.getElementById("repair-cost-display-main")?.focus()}
      />
      <RepairOsSectionHeader
        icon={Coins}
        iconFrame={false}
        title="维修项目默认成本"
        description="仅作为之后新建订单项目的成本快照"
        action={
          <Badge variant="outline" className="font-mono text-[10px] tabular-nums">
            {configuredCount}/{repairServiceCatalogItems.length} 已设置
          </Badge>
        }
      />

      <div className="mb-3 rounded-xl border border-status-warn-foreground/20 bg-status-warn/10 px-3 py-2.5 text-status-warn-foreground">
        <p className="text-xs font-semibold">成本仅供获授权管理人员查看</p>
        <p className="mt-1 text-[11px] leading-4">
          空白表示成本未知，输入 0
          表示明确零成本。保存后只影响之后新建的维修项目，不会改写已有订单。
        </p>
      </div>

      {isConflict ? (
        <div
          role="alert"
          className="mb-3 flex flex-col gap-2 rounded-xl border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2.5 text-status-danger-foreground sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-xs leading-5">
            默认成本版本已变化。为避免覆盖他人的更新，请重新加载后再编辑。
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-10 shrink-0 bg-card"
            disabled={defaultsQuery.isFetching}
            onClick={() => void reloadLatest()}
          >
            {defaultsQuery.isFetching ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="size-3.5" />
            )}
            重新加载最新值
          </Button>
        </div>
      ) : null}

      <Accordion
        type="multiple"
        defaultValue={repairServiceCatalogGroups[0] ? [repairServiceCatalogGroups[0].key] : []}
        className="overflow-hidden rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]"
      >
        {repairServiceCatalogGroups.map((group) => {
          const items = repairServiceCatalogItemsForGroup(group);
          const groupConfiguredCount = items.reduce((count, item) => {
            const parsed = parseCostDraft(values[item.catalogKey] ?? "");
            return count + (parsed.value !== null && !parsed.error ? 1 : 0);
          }, 0);
          return (
            <AccordionItem
              key={group.key}
              value={group.key}
              className="border-[var(--border-panel)] last:border-b-0"
            >
              <AccordionTrigger className="min-h-9 px-3 py-2 text-xs hover:no-underline sm:text-sm">
                <span className="flex min-w-0 items-center gap-2 text-left">
                  <span className="truncate font-semibold">{group.label}</span>
                  <span className="hidden truncate text-[10px] font-normal text-muted-foreground sm:inline">
                    {group.italian}
                  </span>
                  <Badge variant="outline" className="shrink-0 text-[9px]">
                    {groupConfiguredCount}/{items.length}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-2 sm:px-3 sm:pb-3">
                <div className="grid gap-1.5 xl:grid-cols-2">
                  {items.map((item) => {
                    const inputId = `repair-cost-${item.groupKey}-${item.optionKey}`;
                    const error = validation.errors[item.catalogKey];
                    const descriptionId = `${inputId}-description`;
                    const errorId = `${inputId}-error`;
                    return (
                      <div
                        key={item.catalogKey}
                        className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(112px,140px)] items-center gap-2 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel)] px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <Label
                            htmlFor={inputId}
                            className="block truncate text-[11px] font-medium"
                          >
                            {item.isMain ? `${item.label}默认成本` : item.label}
                          </Label>
                          <p
                            id={descriptionId}
                            className="mt-0.5 truncate text-[9px] leading-3 text-muted-foreground"
                          >
                            {item.isMain ? `主项目 · ${item.italian}` : item.italian}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <div className="relative">
                            <Input
                              id={inputId}
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              maxLength={12}
                              placeholder="空白"
                              className="h-10 pr-8 text-right font-mono text-base tabular-nums sm:h-9 sm:text-sm"
                              value={values[item.catalogKey] ?? ""}
                              disabled={saveMutation.isPending || isConflict}
                              aria-label={`${item.name}默认成本`}
                              aria-invalid={Boolean(error)}
                              aria-describedby={
                                error ? `${descriptionId} ${errorId}` : descriptionId
                              }
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setDraftState((current) =>
                                  current?.storeId === storeId
                                    ? {
                                        ...current,
                                        values: {
                                          ...current.values,
                                          [item.catalogKey]: nextValue,
                                        },
                                      }
                                    : current,
                                );
                                if (notice?.kind === "success") setNotice(undefined);
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter") return;
                                event.preventDefault();
                                void save();
                              }}
                            />
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-y-0 right-2.5 grid place-items-center text-[10px] font-semibold text-muted-foreground"
                            >
                              EUR
                            </span>
                          </div>
                          {error ? (
                            <p
                              id={errorId}
                              className="mt-1 text-[9px] leading-3 text-status-danger-foreground"
                            >
                              {error}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {notice ? (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={cn(
            "mt-3 text-[11px] leading-4",
            notice.kind === "error"
              ? "text-status-danger-foreground"
              : notice.kind === "success"
                ? "text-status-success-foreground"
                : "text-muted-foreground",
          )}
        >
          {notice.message}
        </p>
      ) : null}

      <div className="mt-3 flex min-w-0 flex-col gap-2 border-t border-[var(--border-panel)] pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] leading-4 text-muted-foreground">
          {isDirty ? "存在未保存的默认成本修改。" : "当前默认成本已与服务器同步。"}
        </p>
        <div className="flex min-w-0 flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="min-h-9"
            disabled={!isDirty || saveMutation.isPending}
            onClick={discardChanges}
          >
            <RotateCcw className="size-3.5" /> 撤销未保存修改
          </Button>
          <Button
            type="button"
            className="min-h-10 border-0 text-primary-foreground sm:min-h-9"
            style={brandGradientStyle}
            disabled={!canSave}
            onClick={() => void save()}
          >
            {saveMutation.isPending ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            {saveMutation.isPending ? "保存中…" : "保存默认成本"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function draftStateFromResult(
  storeId: string,
  result: StoreFaultCostDefaultsResult,
): CostDraftState {
  const amounts = new Map(
    result.items.map((item) => [item.catalog_key, item.default_cost_amount] as const),
  );
  const values = Object.fromEntries(
    repairServiceCatalogItems.map((item) => {
      const amount = amounts.get(item.catalogKey);
      return [item.catalogKey, amount === null || amount === undefined ? "" : String(amount)];
    }),
  );
  return {
    storeId,
    version: result.version,
    baseline: values,
    values: { ...values },
  };
}

function areCostDraftsEqual(left: CostDraft, right: CostDraft) {
  return repairServiceCatalogItems.every(
    (item) => (left[item.catalogKey] ?? "") === (right[item.catalogKey] ?? ""),
  );
}

function validateCostDraft(values: CostDraft) {
  const amounts: Record<string, number | null> = {};
  const errors: Record<string, string> = {};
  for (const item of repairServiceCatalogItems) {
    const parsed = parseCostDraft(values[item.catalogKey] ?? "");
    amounts[item.catalogKey] = parsed.value;
    if (parsed.error) errors[item.catalogKey] = parsed.error;
  }
  return { amounts, errors };
}

function parseCostDraft(value: string): { value: number | null; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { value: null };
  const normalized = trimmed.replace(",", ".");
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) {
    return { value: null, error: "请输入最多两位小数" };
  }
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric > 999_999.99) {
    return { value: null, error: "金额不能超过 999999.99" };
  }
  return { value: numeric };
}
