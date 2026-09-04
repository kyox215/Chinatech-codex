"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, LockKeyhole, PencilLine, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UnsavedNavigationGuard } from "@/components/unsaved-navigation-guard";
import { getOrderLineCosts, RepairDeskApiError, updateOrderLineCosts } from "@/lib/repairdesk/api";
import type { FaultPriceItem, OrderLineCostsResult } from "@/lib/repairdesk/types";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { getOrderDetailSafeErrorMessage } from "@/features/orders/model/order-detail-i18n";
import {
  buildOrderLineCostUpdates,
  parseOrderCostDraftAmount,
} from "@/features/orders/model/order-cost-draft";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { OrderPartsAllocationPanel } from "@/features/orders/components/order-parts-allocation-panel";
import { formatCurrency } from "@/shared/i18n/format";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey } from "@/shared/i18n/messages";

const costSourceKeys: Record<string, MessageKey> = {
  store_default: "orders2b2.internalCost.source.storeDefault",
  manual: "orders2b2.internalCost.source.manual",
  manual_blank: "orders2b2.internalCost.source.manualBlank",
  historical_unknown: "orders2b2.internalCost.source.historicalUnknown",
  purchase_lot: "orders2b2.internalCost.source.purchaseLot",
  supplier_document: "orders2b2.internalCost.source.supplierDocument",
  backfill_estimate: "orders2b2.internalCost.source.backfillEstimate",
};

interface OrderCostDraftState {
  orderId: string;
  result: OrderLineCostsResult;
  values: Record<string, string>;
}

export function OrderInternalCostCard({
  orderId,
  storeId,
  faultPrices,
  canManage,
  canAllocatePartsCosts = false,
  onRepairQuoteLines,
}: {
  orderId: string;
  storeId: string;
  faultPrices: FaultPriceItem[];
  canManage: boolean;
  canAllocatePartsCosts?: boolean;
  onRepairQuoteLines?: () => void;
}) {
  const { locale, t } = useLocale();
  const queryClient = useQueryClient();
  const queryKey = [...ordersKeys.detail(orderId, storeId), "internal-costs"] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => getOrderLineCosts(orderId),
    retry: false,
  });
  const [draftState, setDraftState] = useState<OrderCostDraftState>();
  const [hasSaveConflict, setHasSaveConflict] = useState(false);
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!query.data) return;
    setDraftState((current) => {
      if (!current || current.orderId !== orderId) {
        return orderCostDraftStateFromResult(orderId, query.data);
      }
      if (isOrderCostDraftDirty(current)) return current;
      return orderCostDraftStateFromResult(orderId, query.data);
    });
  }, [orderId, query.data]);

  const drafts = draftState?.values ?? {};
  const result = draftState?.result;
  const isDirty = Boolean(draftState && isOrderCostDraftDirty(draftState));
  const hasRemoteConflict = Boolean(result && query.data && query.data.version !== result.version);
  const isConflict = hasSaveConflict || hasRemoteConflict;

  const quotes = useMemo(
    () =>
      new Map(faultPrices.flatMap((item) => (item.line_id ? [[item.line_id, item.price]] : []))),
    [faultPrices],
  );
  const total =
    result?.items.reduce((sum, item) => {
      const text = drafts[item.line_id];
      if (text === undefined || text.trim() === "") return sum;
      const amount = parseOrderCostDraftAmount(text);
      return amount === null ? sum : sum + amount;
    }, 0) ?? 0;
  const unknownCount =
    result?.items.filter((item) => (drafts[item.line_id] ?? "").trim() === "").length ?? 0;

  const save = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("成本数据尚未加载");
      if (!isDirty) throw new Error("内部成本没有变化");
      if (isConflict) throw new Error("成本版本已变化，请先重新加载最新值");
      if (!isOnline) {
        throw new Error("内部成本仅支持联网保存，请恢复网络后重试");
      }
      return updateOrderLineCosts(orderId, {
        expected_store_id: storeId,
        expected_version: result.version,
        items: buildOrderLineCostUpdates(result.items, drafts),
      });
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
      setDraftState(orderCostDraftStateFromResult(orderId, result));
      setHasSaveConflict(false);
      toast.success(t("orders2b2.internalCost.saved"));
    },
    onError: (error: Error) => {
      if (error instanceof RepairDeskApiError && error.status === 409) {
        setHasSaveConflict(true);
        toast.error(t("orders2b2.internalCost.saveConflict"));
        void query.refetch();
        return;
      }
      toast.error(getOrderDetailSafeErrorMessage(error, "save", t));
    },
  });

  const reloadLatest = async () => {
    const refreshed = await query.refetch();
    if (refreshed.isError || !refreshed.data) {
      toast.error(t("orders2b2.internalCost.reloadFailed"));
      return;
    }
    setDraftState(orderCostDraftStateFromResult(orderId, refreshed.data));
    setHasSaveConflict(false);
    save.reset();
    toast.success(t("orders2b2.internalCost.reloaded"));
  };

  if (query.isPending && !draftState) {
    return (
      <section
        aria-busy="true"
        className={cn(repairOs.mobileInfoCard, "mt-2 p-3 text-xs text-muted-foreground")}
      >
        {t("orders2b2.internalCost.loading")}
      </section>
    );
  }
  if (query.isError && !draftState) {
    return (
      <section
        role="alert"
        className={cn(
          repairOs.mobileInfoCard,
          "mt-2 flex items-center justify-between gap-2 p-3 text-xs text-destructive",
        )}
      >
        <span>{getOrderDetailSafeErrorMessage(query.error, "load", t)}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
          {t("orders2b2.internalCost.reload")}
        </Button>
      </section>
    );
  }
  if (!result) return null;

  return (
    <section
      data-order-internal-costs="true"
      className={cn(repairOs.mobileInfoCard, "mt-2 min-w-0 space-y-2 p-2.5 sm:p-3")}
    >
      <UnsavedNavigationGuard
        id={`order-internal-costs-${orderId}`}
        dirty={isDirty}
        busy={save.isPending}
        canSave={isOnline && !isConflict}
        saveUnavailableReason={
          isConflict
            ? t("orders2b2.internalCost.conflictReason")
            : t("orders2b2.internalCost.offlineReason")
        }
        label={t("orders2b2.internalCost.guardLabel")}
        onSave={async () => {
          try {
            await save.mutateAsync();
            return { status: "resolved" };
          } catch {
            return { status: "blocked" };
          }
        }}
        onDiscard={() => {
          setDraftState(orderCostDraftStateFromResult(orderId, query.data ?? result));
          setHasSaveConflict(false);
          return { status: "resolved" };
        }}
        onFocusFallback={() =>
          document
            .querySelector<HTMLInputElement>(
              `[data-order-internal-costs='true'] input[data-order-cost-input='true']`,
            )
            ?.focus()
        }
      />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
            <LockKeyhole className="size-3.5 text-primary" />
            {t("orders2b2.internalCost.title")}
          </div>
          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground lg:text-xs lg:leading-[18px]">
            {t("orders2b2.internalCost.help")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[9px] text-muted-foreground lg:text-[11px] lg:leading-4">
            {t("orders2b2.internalCost.total")}
          </div>
          <div className="font-mono text-sm font-semibold">
            {result.items.length > 0 && unknownCount === result.items.length
              ? t("orders2b2.internalCost.unknown")
              : unknownCount > 0
                ? t("orders2b2.internalCost.plusUnknown", {
                    amount: formatCurrency(total, locale),
                  })
                : formatCurrency(total, locale)}
          </div>
        </div>
      </div>

      {result.unidentified_line_count > 0 ? (
        <div className="grid gap-2 rounded-lg bg-status-warn/35 px-2 py-1.5 text-[10px] text-status-warn-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center lg:text-xs lg:leading-[18px]">
          <span className="flex gap-1.5">
            <CircleAlert className="mt-0.5 size-3 shrink-0" />
            {t(
              onRepairQuoteLines
                ? "orders2b2.internalCost.unidentifiedRepair"
                : "orders2b2.internalCost.unidentifiedReadonly",
              { count: result.unidentified_line_count },
            )}
          </span>
          {onRepairQuoteLines ? (
            <Button
              type="button"
              variant="outline"
              className="h-[38px] bg-background lg:h-9"
              onClick={onRepairQuoteLines}
            >
              <PencilLine className="mr-1.5 size-3.5" />
              {t("orders2b2.internalCost.repair")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {isConflict ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-lg border border-status-warn-foreground/20 bg-status-warn/35 px-2 py-1.5 text-[10px] text-status-warn-foreground lg:text-xs lg:leading-[18px]"
        >
          <span>{t("orders2b2.internalCost.conflict")}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void reloadLatest()}>
            {t("orders2b2.internalCost.reloadLatest")}
          </Button>
        </div>
      ) : null}

      <div className="min-w-0 space-y-1.5">
        {result.items.length === 0 ? (
          <div className="rounded-lg bg-muted/45 px-2.5 py-2 text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
            {t("orders2b2.internalCost.empty")}
          </div>
        ) : (
          result.items.map((item) => {
            const text = drafts[item.line_id] ?? "";
            const numeric = parseOrderCostDraftAmount(text);
            const quote = quotes.get(item.line_id);
            const belowCost = numeric !== null && quote !== undefined && numeric > quote;
            return (
              <div
                key={item.line_id}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(100px,0.42fr)] items-center gap-2 rounded-lg border border-[var(--border-panel)] bg-card px-2 py-1.5"
              >
                <div className="min-w-0">
                  <div
                    className="truncate text-[11px] font-medium lg:text-xs lg:leading-4"
                    title={item.name}
                  >
                    {item.name}
                  </div>
                  <div className="text-[9px] text-muted-foreground lg:text-[11px] lg:leading-4">
                    {costSourceKeys[item.source] ? t(costSourceKeys[item.source]) : item.source}
                  </div>
                  {belowCost ? (
                    <div className="text-[9px] font-medium text-status-warn-foreground lg:text-xs lg:leading-4">
                      {t("orders2b2.internalCost.aboveQuote")}
                    </div>
                  ) : null}
                </div>
                {canManage ? (
                  <Input
                    value={text}
                    inputMode="decimal"
                    autoComplete="off"
                    data-order-cost-input="true"
                    placeholder={t("orders2b2.internalCost.blank")}
                    aria-label={t("orders2b2.internalCost.inputLabel", { name: item.name })}
                    className="h-[38px] bg-[var(--surface-panel-muted)] px-2 text-right font-mono text-base lg:h-8 lg:text-sm"
                    onChange={(event) =>
                      setDraftState((current) =>
                        current
                          ? {
                              ...current,
                              values: { ...current.values, [item.line_id]: event.target.value },
                            }
                          : current,
                      )
                    }
                    disabled={!isOnline || isConflict}
                  />
                ) : (
                  <div className="text-right font-mono text-xs">
                    {item.cost_amount === null
                      ? t("orders2b2.internalCost.unfilled")
                      : formatCurrency(item.cost_amount, locale)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {canManage && !isOnline ? (
        <div className="rounded-lg bg-status-warn/35 px-2 py-1.5 text-[10px] text-status-warn-foreground lg:text-xs lg:leading-[18px]">
          {t("orders2b2.internalCost.offline")}
        </div>
      ) : null}

      {canManage && result.items.length > 0 ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            className="h-9 text-xs lg:h-8"
            disabled={save.isPending || !isDirty || isConflict || !isOnline}
            onClick={() => save.mutate()}
          >
            <Save className="mr-1.5 size-3.5" />
            {save.isPending ? t("orders2b2.internalCost.saving") : t("orders2b2.internalCost.save")}
          </Button>
        </div>
      ) : null}
      {canAllocatePartsCosts ? (
        <OrderPartsAllocationPanel orderId={orderId} storeId={storeId} faultPrices={faultPrices} />
      ) : null}
    </section>
  );
}

function orderCostValuesFromResult(result: OrderLineCostsResult) {
  return Object.fromEntries(
    result.items.map((item) => [
      item.line_id,
      item.cost_amount === null ? "" : String(item.cost_amount),
    ]),
  );
}

function orderCostDraftStateFromResult(
  orderId: string,
  result: OrderLineCostsResult,
): OrderCostDraftState {
  return { orderId, result, values: orderCostValuesFromResult(result) };
}

function isOrderCostDraftDirty(state: OrderCostDraftState) {
  const baseline = orderCostValuesFromResult(state.result);
  return state.result.items.some((item) => state.values[item.line_id] !== baseline[item.line_id]);
}
