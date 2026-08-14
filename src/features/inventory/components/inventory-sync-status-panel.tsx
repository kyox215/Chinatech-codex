"use client";

import { CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InventorySyncStatus =
  | "committed-refreshing"
  | "committed-refresh-failed"
  | "committed-context-stale"
  | "recovered"
  | "offline-draft";

export type InventorySyncStatusPanelProps = {
  status: InventorySyncStatus;
  onRetry?: () => void | Promise<void>;
  onOpenCommitted?: () => void | Promise<void>;
  pending?: boolean;
  privacyRedacted?: boolean;
  className?: string;
};

const copy = {
  "committed-refreshing": {
    title: "写入已完成，正在同步最新状态",
    description: "请不要重复提交。正在读取服务端最新状态；此过程不会再次写入。",
    role: "status" as const,
    tone: "pending" as const,
  },
  "committed-refresh-failed": {
    title: "写入已完成，但同步最新状态失败",
    description: "请不要重复提交。重试同步只读取最新状态，不会再次写入。",
    role: "alert" as const,
    tone: "failed" as const,
  },
  "committed-context-stale": {
    title: "写入已完成，但当前门店上下文已变化",
    description:
      "请不要重复提交。为保护门店边界，当前页面不会打开或重试旧记录；请返回当前库存后重新读取。",
    role: "alert" as const,
    tone: "failed" as const,
  },
  recovered: {
    title: "已读取最新状态",
    description: "写入已完成；当前页面已恢复可用。后续提交会使用新的状态和写入标识。",
    role: "status" as const,
    tone: "success" as const,
  },
  "offline-draft": {
    title: "当前仍是离线草稿",
    description: "尚未写入服务端。恢复联网后再保存；不要把草稿当成已完成写入。",
    role: "status" as const,
    tone: "offline" as const,
  },
} as const;

function toneClasses(tone: (typeof copy)[InventorySyncStatus]["tone"]) {
  if (tone === "success") return "border-status-success/40 bg-status-success/10";
  if (tone === "failed") return "border-destructive/40 bg-destructive/5";
  if (tone === "offline") return "border-status-warn/40 bg-status-warn/10";
  return "border-primary/30 bg-primary/5";
}

export function InventorySyncStatusPanel({
  status,
  onRetry,
  onOpenCommitted,
  pending = false,
  privacyRedacted = false,
  className,
}: InventorySyncStatusPanelProps) {
  const stateCopy = copy[status];
  const isSyncFailure = status === "committed-refresh-failed";
  const isCommitted = status !== "offline-draft";

  return (
    <section
      data-ui="inventory-sync-status-panel"
      data-sync-status={status}
      role={stateCopy.role}
      aria-live={stateCopy.role === "alert" ? "assertive" : "polite"}
      aria-busy={pending || status === "committed-refreshing"}
      className={cn(
        "grid min-w-0 gap-2 rounded-xl border p-3 text-foreground sm:p-4",
        toneClasses(stateCopy.tone),
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-background/80"
        >
          {status === "committed-refreshing" ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : status === "committed-refresh-failed" ? (
            <ShieldAlert className="size-4 text-destructive" />
          ) : status === "recovered" ? (
            <CheckCircle2 className="size-4 text-status-success-foreground" />
          ) : (
            <RefreshCw className="size-4 text-status-warn-foreground" />
          )}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{stateCopy.title}</h2>
          <p className="mt-1 text-xs leading-5 text-foreground">{stateCopy.description}</p>
        </div>
      </div>
      {isCommitted ? (
        <p className="text-xs leading-5 text-muted-foreground">
          {privacyRedacted
            ? "为保护隐私，此状态不显示商品、金额或设备标识。"
            : "恢复动作只读取缓存或服务端最新状态，不会自动重放刚才的写入。"}
        </p>
      ) : null}
      {isSyncFailure && onRetry ? (
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-fit"
            disabled={pending}
            onClick={() => void onRetry()}
          >
            {pending ? "正在读取最新状态…" : "重试同步"}
          </Button>
          {onOpenCommitted ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full sm:w-fit"
              disabled={pending}
              onClick={() => void onOpenCommitted()}
            >
              打开已完成记录
            </Button>
          ) : null}
        </div>
      ) : null}
      {status === "committed-refreshing" ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          正在读取最新状态；原写入按钮已暂时停用。
        </p>
      ) : null}
    </section>
  );
}
