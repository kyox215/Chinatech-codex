"use client";

import { CheckCircle2, LoaderCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { useRealtimeSync, type RealtimeConnectionState } from "./realtime-sync-context";

const stateMeta: Record<
  Exclude<RealtimeConnectionState, "disabled">,
  { icon: typeof Wifi; label: string; className: string; spin?: boolean }
> = {
  connecting: {
    icon: LoaderCircle,
    label: "实时连接中",
    className: "text-status-info-foreground",
    spin: true,
  },
  live: {
    icon: Wifi,
    label: "实时同步中",
    className: "text-status-success-foreground",
  },
  reconnecting: {
    icon: RefreshCw,
    label: "正在恢复同步",
    className: "text-status-warn-foreground",
    spin: true,
  },
  offline: {
    icon: WifiOff,
    label: "离线，联网后自动同步",
    className: "text-muted-foreground",
  },
  synced: {
    icon: CheckCircle2,
    label: "数据已同步",
    className: "text-status-success-foreground",
  },
};

export function RealtimeSyncIndicator({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { connectionState } = useRealtimeSync();
  if (connectionState === "disabled") return null;

  const meta = stateMeta[connectionState];
  const Icon = meta.icon;
  const indicator = (
    <span
      data-realtime-sync-state={connectionState}
      role="status"
      aria-live="polite"
      aria-label={meta.label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        compact ? "size-4" : "size-9 rounded-md bg-surface/60",
        meta.className,
        className,
      )}
    >
      <Icon className={cn(compact ? "size-3" : "size-4", meta.spin && "animate-spin")} />
    </span>
  );

  if (compact) return indicator;

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{indicator}</TooltipTrigger>
        <TooltipContent>{meta.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
