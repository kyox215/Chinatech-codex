"use client";

import { CheckCircle2, LoaderCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { useRealtimeSync, type RealtimeConnectionState } from "./realtime-sync-context";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey } from "@/shared/i18n/messages";

const stateMeta: Record<
  Exclude<RealtimeConnectionState, "disabled">,
  { icon: typeof Wifi; labelKey: MessageKey; className: string; spin?: boolean }
> = {
  connecting: {
    icon: LoaderCircle,
    labelKey: "realtime.connecting",
    className: "text-status-info-foreground",
    spin: true,
  },
  live: {
    icon: Wifi,
    labelKey: "realtime.live",
    className: "text-status-success-foreground",
  },
  reconnecting: {
    icon: RefreshCw,
    labelKey: "realtime.reconnecting",
    className: "text-status-warn-foreground",
    spin: true,
  },
  offline: {
    icon: WifiOff,
    labelKey: "realtime.offline",
    className: "text-muted-foreground",
  },
  synced: {
    icon: CheckCircle2,
    labelKey: "realtime.synced",
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
  const { t } = useLocale();
  const { connectionState } = useRealtimeSync();
  if (connectionState === "disabled") return null;

  const meta = stateMeta[connectionState];
  const Icon = meta.icon;
  const indicator = (
    <span
      data-realtime-sync-state={connectionState}
      role="status"
      aria-live="polite"
      aria-label={t(meta.labelKey)}
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
        <TooltipContent>{t(meta.labelKey)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
