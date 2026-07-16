"use client";

import { AlertTriangle, LoaderCircle, RefreshCw, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export function OrderListTransitionFeedback({
  pendingLabel,
  offlineMessage,
  errorMessage,
  backgroundRefreshing,
  onRetry,
}: {
  pendingLabel?: string;
  offlineMessage?: string;
  errorMessage?: string;
  backgroundRefreshing?: boolean;
  onRetry: () => void;
}) {
  if (offlineMessage) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-surface/80 px-3 py-2 text-xs text-muted-foreground"
      >
        <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">{offlineMessage}</span>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        role="alert"
        className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-status-warn-foreground/25 bg-status-warn/10 px-3 py-2 text-xs text-status-warn-foreground"
      >
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">{errorMessage}</span>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onRetry}>
          重试
        </Button>
      </div>
    );
  }

  if (pendingLabel) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground"
      >
        <LoaderCircle className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1">正在加载{pendingLabel}，当前列表暂不可操作…</span>
      </div>
    );
  }

  if (backgroundRefreshing) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mb-2 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground"
      >
        <RefreshCw className="size-3 animate-spin" aria-hidden="true" />
        正在后台更新订单
      </div>
    );
  }

  return null;
}
