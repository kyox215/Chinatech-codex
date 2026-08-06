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
import { formatMoney } from "@/lib/money";
import { ordersKeys } from "@/features/orders/api/query-keys";
import {
  buildOrderLineCostUpdates,
  parseOrderCostDraftAmount,
} from "@/features/orders/model/order-cost-draft";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { OrderPartsAllocationPanel } from "@/features/orders/components/order-parts-allocation-panel";

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
      toast.success("内部成本已保存");
    },
    onError: (error: Error) => {
      if (error instanceof RepairDeskApiError && error.status === 409) {
        setHasSaveConflict(true);
        toast.error("成本或报价项目已变化，请重新加载最新值后再修改");
        void query.refetch();
        return;
      }
      toast.error(error.message);
    },
  });

  const reloadLatest = async () => {
    const refreshed = await query.refetch();
    if (refreshed.isError || !refreshed.data) {
      toast.error("重新加载内部成本失败，请稍后重试");
      return;
    }
    setDraftState(orderCostDraftStateFromResult(orderId, refreshed.data));
    setHasSaveConflict(false);
    save.reset();
    toast.success("已加载最新内部成本");
  };

  if (query.isPending && !draftState) {
    return (
      <section
        aria-busy="true"
        className={cn(repairOs.mobileInfoCard, "mt-2 p-3 text-xs text-muted-foreground")}
      >
        正在读取内部成本…
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
        <span>内部成本读取失败：{query.error.message}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
          重新加载
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
            ? "成本版本已变化，请先重新加载最新值。"
            : "内部成本仅支持联网保存，请恢复网络后重试。"
        }
        label="工单内部成本草稿"
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
              `[data-order-internal-costs='true'] input[aria-label$='内部成本']`,
            )
            ?.focus()
        }
      />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
            <LockKeyhole className="size-3.5 text-primary" /> 内部成本
          </div>
          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground lg:text-xs lg:leading-[18px]">
            仅获授权人员可见；空白表示未知，0 表示明确无成本。
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[9px] text-muted-foreground lg:text-[11px] lg:leading-4">
            当前合计
          </div>
          <div className="font-mono text-sm font-semibold">
            {result.items.length > 0 && unknownCount === result.items.length
              ? "未知"
              : `${formatMoney(total)}${unknownCount > 0 ? " + 未知" : ""}`}
          </div>
        </div>
      </div>

      {result.unidentified_line_count > 0 ? (
        <div className="grid gap-2 rounded-lg bg-status-warn/35 px-2 py-1.5 text-[10px] text-status-warn-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center lg:text-xs lg:leading-[18px]">
          <span className="flex gap-1.5">
            <CircleAlert className="mt-0.5 size-3 shrink-0" />
            旧报价中有 {result.unidentified_line_count} 个项目尚无稳定标识；
            {onRepairQuoteLines
              ? "重新保存报价后才能录入成本。"
              : "当前工单或账号不可编辑报价，请由有权人员通过更正流程处理。"}
          </span>
          {onRepairQuoteLines ? (
            <Button
              type="button"
              variant="outline"
              className="h-[38px] bg-background lg:h-9"
              onClick={onRepairQuoteLines}
            >
              <PencilLine className="mr-1.5 size-3.5" /> 修复报价项目
            </Button>
          ) : null}
        </div>
      ) : null}

      {isConflict ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-lg border border-status-warn-foreground/20 bg-status-warn/35 px-2 py-1.5 text-[10px] text-status-warn-foreground lg:text-xs lg:leading-[18px]"
        >
          <span>内部成本已在其他会话变化；当前未保存输入已保留。</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void reloadLatest()}>
            重新加载最新值
          </Button>
        </div>
      ) : null}

      <div className="min-w-0 space-y-1.5">
        {result.items.length === 0 ? (
          <div className="rounded-lg bg-muted/45 px-2.5 py-2 text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
            暂无可录入成本的报价项目。
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
                    {item.source === "store_default"
                      ? "新建时默认成本快照"
                      : item.source === "manual"
                        ? "手动录入"
                        : item.source === "purchase_lot"
                          ? "采购批次自动成本"
                          : item.source === "supplier_document"
                            ? "供应商凭证成本"
                            : item.source === "backfill_estimate"
                              ? "历史回填成本"
                              : "手动留空"}
                  </div>
                  {belowCost ? (
                    <div className="text-[9px] font-medium text-status-warn-foreground lg:text-xs lg:leading-4">
                      成本高于客户报价，请确认
                    </div>
                  ) : null}
                </div>
                {canManage ? (
                  <Input
                    value={text}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="留空"
                    aria-label={`${item.name} 内部成本`}
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
                    {item.cost_amount === null ? "未填写" : formatMoney(item.cost_amount)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {canManage && !isOnline ? (
        <div className="rounded-lg bg-status-warn/35 px-2 py-1.5 text-[10px] text-status-warn-foreground lg:text-xs lg:leading-[18px]">
          当前离线：内部成本只读，恢复网络后可继续编辑。
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
            <Save className="mr-1.5 size-3.5" /> {save.isPending ? "保存中…" : "保存内部成本"}
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
