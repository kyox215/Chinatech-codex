"use client";

import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { orderQueueGroups } from "@/features/orders/model/order-queue-classification";
import type { OrderResultGroup } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";

export function OrderSearchFeedback({
  draftValue,
  committedValue,
  isDebouncing,
  isFetching,
  isPlaceholderData,
  hasError,
  total,
  resultGroupCounts,
  canSearchArchive,
  onRetry,
  compact = false,
}: {
  draftValue: string;
  committedValue: string;
  isDebouncing: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
  hasError: boolean;
  total: number;
  resultGroupCounts?: Record<OrderResultGroup, number>;
  canSearchArchive: boolean;
  onRetry: () => void;
  compact?: boolean;
}) {
  const query = (isDebouncing ? draftValue : committedValue).trim();
  const isRetainingResults = isFetching && isPlaceholderData;
  if (!query && !isRetainingResults) return null;

  const activeCount = orderQueueGroups.reduce(
    (sum, group) => sum + (resultGroupCounts?.[group] ?? 0),
    0,
  );
  const historyCount = (resultGroupCounts?.completed ?? 0) + (resultGroupCounts?.cancelled ?? 0);
  const busy = isDebouncing || isFetching;

  return (
    <div
      data-order-search-feedback="true"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md border px-2.5 text-xs",
        compact ? "min-h-7 py-1" : "min-h-8 py-1.5",
        hasError
          ? "border-status-danger-foreground/25 bg-status-danger/10 text-status-danger-foreground"
          : busy
            ? "border-primary/25 bg-primary/10 text-primary"
            : "border-status-success-foreground/20 bg-status-success/10 text-status-success-foreground",
      )}
    >
      {hasError ? (
        <AlertTriangle className="size-3.5 shrink-0" />
      ) : busy ? (
        <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
      ) : total > 0 ? (
        <CheckCircle2 className="size-3.5 shrink-0" />
      ) : (
        <Search className="size-3.5 shrink-0" />
      )}

      <span className="min-w-0 flex-1 break-words">
        {hasError ? (
          <>搜索“{committedValue}”失败，仍显示上次结果</>
        ) : isDebouncing ? (
          <>准备搜索“{draftValue.trim()}”…</>
        ) : !query ? (
          <>正在更新订单… 上次结果暂时保留</>
        ) : isFetching ? (
          <>
            正在搜索“{committedValue}”…{isPlaceholderData ? " 上次结果暂时保留" : ""}
          </>
        ) : (
          <>
            “{committedValue}”找到 {total} 条
            {resultGroupCounts ? ` · 待办 ${activeCount} · 历史 ${historyCount}` : ""}
            {canSearchArchive ? "" : " · 历史结果按权限显示"}
          </>
        )}
      </span>

      {hasError ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 gap-1 px-1.5 text-[11px]"
          onClick={onRetry}
        >
          <RefreshCw className="size-3" /> 重试
        </Button>
      ) : null}
    </div>
  );
}
