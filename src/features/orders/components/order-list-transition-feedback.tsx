"use client";

import { AlertTriangle, LoaderCircle, RefreshCw, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { OrderWorkflow } from "@/lib/repairdesk/types";
import type { OrderBulkTransitionRecovery } from "@/features/orders/model/order-bulk-transition";
import {
  localizeBulkTransitionFeedback,
  localizeOrderTransitionFailure,
} from "@/features/orders/model/order-i18n";
import { useLocale } from "@/shared/i18n/locale-provider";

export function OrderBulkTransitionFeedback({
  recovery,
  workflow,
  pending,
  retryDisabled,
  onRetry,
}: {
  recovery: OrderBulkTransitionRecovery;
  workflow?: OrderWorkflow;
  pending: boolean;
  retryDisabled?: boolean;
  onRetry: () => void;
}) {
  const { t } = useLocale();
  return (
    <Alert className="mb-3 min-w-0" data-order-bulk-feedback="true" aria-busy={pending}>
      <AlertTriangle className="size-4" aria-hidden="true" />
      <AlertTitle>{t("orders.bulkRecoveryTitle")}</AlertTitle>
      <AlertDescription>
        <p>
          {recovery.requestFailed
            ? t("orders.bulkRequestFailed", { count: recovery.failures.length })
            : recovery.successCount === 0
              ? t("orders.bulkAllFailed", { count: recovery.failures.length })
              : localizeBulkTransitionFeedback(
                  {
                    count: recovery.successCount,
                    failures: recovery.failures.length,
                    to: recovery.to,
                  },
                  workflow,
                  t,
                )}
        </p>
        <ul className="mt-2 space-y-1 text-xs">
          {recovery.failures.map((failure, index) => (
            <li key={failure.id} className="flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 break-words">
              <span className="font-medium">
                {(failure.publicNo !== failure.id && failure.publicNo?.trim()) ||
                  t("orders.bulkFailureOrder", { index: index + 1 })}
              </span>
              <span>{localizeOrderTransitionFailure(failure.reason, t)}</span>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 h-auto min-h-9 max-w-full whitespace-normal"
          disabled={pending || retryDisabled}
          onClick={onRetry}
        >
          {pending ? t("orders.bulkRetrying") : t("orders.bulkRetry")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

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
  const { t } = useLocale();
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
          {t("orders.retry")}
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
        <span className="min-w-0 flex-1">{t("orders.pendingList", { group: pendingLabel })}</span>
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
        {t("orders.backgroundRefreshing")}
      </div>
    );
  }

  return null;
}
