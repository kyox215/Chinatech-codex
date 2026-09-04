"use client";

import { CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey } from "@/shared/i18n/messages";

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

const copy: Record<
  InventorySyncStatus,
  {
    title: MessageKey;
    description: MessageKey;
    role: "status" | "alert";
    tone: "pending" | "failed" | "success" | "offline";
  }
> = {
  "committed-refreshing": {
    title: "inventory2b4.sync.refreshing.title",
    description: "inventory2b4.sync.refreshing.description",
    role: "status" as const,
    tone: "pending" as const,
  },
  "committed-refresh-failed": {
    title: "inventory2b4.sync.failed.title",
    description: "inventory2b4.sync.failed.description",
    role: "alert" as const,
    tone: "failed" as const,
  },
  "committed-context-stale": {
    title: "inventory2b4.sync.context.title",
    description: "inventory2b4.sync.context.description",
    role: "alert" as const,
    tone: "failed" as const,
  },
  recovered: {
    title: "inventory2b4.sync.recovered.title",
    description: "inventory2b4.sync.recovered.description",
    role: "status" as const,
    tone: "success" as const,
  },
  "offline-draft": {
    title: "inventory2b4.sync.offline.title",
    description: "inventory2b4.sync.offline.description",
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
  const { t } = useLocale();
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
          <h2 className="text-sm font-semibold">{t(stateCopy.title)}</h2>
          <p className="mt-1 text-xs leading-5 text-foreground">{t(stateCopy.description)}</p>
        </div>
      </div>
      {isCommitted ? (
        <p className="text-xs leading-5 text-muted-foreground">
          {privacyRedacted
            ? t("inventory2b4.common.privacyRedacted")
            : t("inventory2b4.sync.readOnlyRecovery")}
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
            {pending ? t("inventory2b4.sync.reading") : t("inventory2b4.sync.retry")}
          </Button>
          {onOpenCommitted ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full sm:w-fit"
              disabled={pending}
              onClick={() => void onOpenCommitted()}
            >
              {t("inventory2b4.sync.openCommitted")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {status === "committed-refreshing" ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {t("inventory2b4.sync.pending")}
        </p>
      ) : null}
    </section>
  );
}
