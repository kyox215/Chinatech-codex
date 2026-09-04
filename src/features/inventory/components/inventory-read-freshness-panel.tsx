"use client";

import { CheckCircle2, Eye, Loader2, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";
import { formatInventoryLifecycleDate } from "@/features/inventory/lifecycle/model/inventory-lifecycle-i18n";

import type { InventoryReadFreshnessResolution } from "../model/inventory-read-freshness";

export type InventoryReadFreshnessPanelProps = {
  freshness: InventoryReadFreshnessResolution;
  onVerify?: () => void | Promise<void>;
  className?: string;
};

const copy: Record<
  Exclude<InventoryReadFreshnessResolution["state"], "fresh">,
  { title: MessageKey; description: MessageKey; role: "status" | "alert" }
> = {
  stale: {
    title: "inventory2b4.freshnessCard.stale.title",
    description: "inventory2b4.freshnessCard.stale.description",
    role: "alert" as const,
  },
  verifying: {
    title: "inventory2b4.freshnessCard.verifying.title",
    description: "inventory2b4.freshnessCard.verifying.description",
    role: "status" as const,
  },
  "verify-failed": {
    title: "inventory2b4.freshnessCard.failed.title",
    description: "inventory2b4.freshnessCard.failed.description",
    role: "alert" as const,
  },
  recovered: {
    title: "inventory2b4.freshnessCard.recovered.title",
    description: "inventory2b4.freshnessCard.recovered.description",
    role: "status" as const,
  },
  "privacy-redacted": {
    title: "inventory2b4.freshnessCard.redacted.title",
    description: "inventory2b4.freshnessCard.redacted.description",
    role: "alert" as const,
  },
} as const;

function localReadCopy(
  lastSuccessAt: number | undefined,
  redacted: boolean,
  locale: ReturnType<typeof useLocale>["locale"],
  t: (key: MessageKey, values?: MessageValues) => string,
) {
  if (redacted) return t("inventory2b4.freshnessCard.readTimeHidden");
  if (!lastSuccessAt) return t("inventory2b4.freshnessCard.readTimeUnavailable");
  return t("inventory2b4.freshnessCard.readTime", {
    date: formatInventoryLifecycleDate(lastSuccessAt, locale, t),
  });
}

export function InventoryReadFreshnessPanel({
  freshness,
  onVerify,
  className,
}: InventoryReadFreshnessPanelProps) {
  const { locale, t } = useLocale();
  if (freshness.hidden || freshness.state === "fresh") return null;
  const stateCopy = copy[freshness.state];
  const verifying = freshness.state === "verifying";
  const redacted = freshness.state === "privacy-redacted";

  return (
    <section
      data-ui="inventory-read-freshness-panel"
      data-read-freshness-state={freshness.state}
      role={stateCopy.role}
      aria-live={stateCopy.role === "alert" ? "assertive" : "polite"}
      aria-busy={verifying}
      className={cn(
        "grid min-w-0 gap-2 rounded-xl border p-3 text-foreground sm:p-4",
        stateCopy.role === "alert"
          ? "border-status-warn/40 bg-status-warn/10"
          : freshness.state === "recovered"
            ? "border-status-success/40 bg-status-success/10"
            : "border-primary/30 bg-primary/5",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-background/80"
        >
          {verifying ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : freshness.state === "recovered" ? (
            <CheckCircle2 className="size-4 text-status-success-foreground" />
          ) : (
            <ShieldAlert className="size-4 text-status-warn-foreground" />
          )}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{t(stateCopy.title)}</h2>
          <p className="mt-1 text-xs leading-5 text-foreground">{t(stateCopy.description)}</p>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {localReadCopy(freshness.lastSuccessAt, redacted, locale, t)}
      </p>
      {!redacted && freshness.state !== "recovered" ? (
        <p className="text-xs leading-5 text-muted-foreground">
          {t("inventory2b4.freshnessCard.recoveryHelp")}
        </p>
      ) : null}
      {freshness.state === "recovered" ? (
        <p role="status" aria-live="polite" className="text-xs leading-5 text-muted-foreground">
          {t("inventory2b4.freshnessCard.recoveredStatus")}
        </p>
      ) : null}
      {!redacted && onVerify ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full gap-2 sm:w-fit"
          disabled={verifying}
          onClick={() => void onVerify()}
        >
          <Eye className="size-4" aria-hidden="true" />
          {verifying
            ? t("inventory2b4.freshnessCard.verifyingAction")
            : t("inventory2b4.freshnessCard.verify")}
        </Button>
      ) : null}
    </section>
  );
}
