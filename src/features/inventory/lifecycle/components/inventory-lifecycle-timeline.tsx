"use client";

import { History, Loader2 } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/utils";
import { repairOs } from "@/lib/ui-patterns";

import type {
  InventoryLifecycleTimelineEntry,
  InventoryLifecycleTimelineResult,
  InventoryLifecycleTimelineSource,
} from "../model/inventory-lifecycle-timeline";

export type InventoryLifecycleTimelineProps = {
  source: InventoryLifecycleTimelineSource;
  items?: readonly InventoryLifecycleTimelineEntry[];
  result?: InventoryLifecycleTimelineResult;
  title?: string;
  status?: "ready" | "loading";
  privacyRedacted?: boolean;
  className?: string;
};

const sourceLabels: Record<InventoryLifecycleTimelineSource, string> = {
  "milestone-summary": "摘要里程碑",
  "ledger-event": "服务端事件账",
};

function formatTimelineDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function InventoryLifecycleTimeline({
  source,
  items,
  result,
  title,
  status = "ready",
  privacyRedacted = false,
  className,
}: InventoryLifecycleTimelineProps) {
  const headingId = useId();
  const resolvedItems = result?.items ?? items ?? [];
  const scope = result?.scope;
  const isLoading = status === "loading";
  const displayTitle =
    title ?? (source === "milestone-summary" ? "关键里程碑（摘要）" : "案件历史（服务端事件账）");

  return (
    <section
      data-ui="inventory-lifecycle-timeline"
      data-timeline-source={source}
      data-timeline-state={isLoading ? "loading" : resolvedItems.length ? "ready" : "empty"}
      className={cn(repairOs.mobileInfoCard, "min-w-0 p-2.5 sm:p-3", className)}
      aria-labelledby={headingId}
      aria-busy={isLoading}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {isLoading ? (
          <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
        ) : (
          <History className="size-3.5 text-primary" aria-hidden="true" />
        )}
        <h2 id={headingId} className="min-w-0 text-[11px] font-semibold lg:text-sm">
          {displayTitle}
        </h2>
        <span className="ml-auto shrink-0 rounded-full bg-[var(--surface-panel-muted)] px-2 py-1 text-[9px] text-muted-foreground">
          {sourceLabels[source]}
        </span>
      </div>

      {isLoading ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-2 text-[10px] leading-4 text-muted-foreground"
        >
          正在读取时间线；当前不会把未读到的事件当作事实。
        </p>
      ) : privacyRedacted ? (
        <p role="status" className="mt-2 text-[10px] leading-4 text-muted-foreground">
          时间线详情已按隐私边界裁剪；请只读核对当前页面。
        </p>
      ) : resolvedItems.length ? (
        <>
          <ol className="mt-2 grid min-w-0 gap-1.5" aria-label={`${displayTitle}列表`}>
            {resolvedItems.map((item) => (
              <li
                key={item.id}
                className="grid min-w-0 gap-1 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px]"
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <strong className="min-w-0 break-words font-semibold">{item.label}</strong>
                  <time dateTime={item.at} className="shrink-0 text-muted-foreground">
                    {formatTimelineDate(item.at)}
                  </time>
                </div>
                {item.fromStatusLabel || item.toStatusLabel ? (
                  <p className="break-words text-[10px] leading-4 text-muted-foreground">
                    {item.fromStatusLabel ?? "新建"} → {item.toStatusLabel ?? "当前状态"}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">
            {scope?.label ??
              (source === "milestone-summary"
                ? `当前摘要确认 ${resolvedItems.length} 项关键里程碑（不是完整审计历史）`
                : `服务端返回范围内 ${resolvedItems.length} 项事件`)}
          </p>
        </>
      ) : (
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
          {source === "milestone-summary"
            ? "当前摘要没有可显示的关键里程碑。"
            : "服务端返回范围内暂无可显示事件。"}
        </p>
      )}
    </section>
  );
}
