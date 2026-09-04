"use client";

import { CircleAlert, EyeOff, Loader2, LockKeyhole, PowerOff, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey } from "@/shared/i18n/messages";

import type { InventoryAvailabilityResolution } from "../model/inventory-availability";

export type InventoryAvailabilityStateCardProps = {
  availability: InventoryAvailabilityResolution;
  onRetry?: () => void | Promise<void>;
  onBack?: () => void;
  className?: string;
};

const copy: Record<
  Exclude<InventoryAvailabilityResolution["state"], "available">,
  { title: MessageKey; body: MessageKey; role: "status" | "alert" }
> = {
  loading: {
    title: "inventory2b4.availabilityCard.loading.title",
    body: "inventory2b4.availabilityCard.loading.body",
    role: "status" as const,
  },
  "no-permission": {
    title: "inventory2b4.availabilityCard.noPermission.title",
    body: "inventory2b4.availabilityCard.noPermission.body",
    role: "alert" as const,
  },
  "feature-off": {
    title: "inventory2b4.availabilityCard.featureOff.title",
    body: "inventory2b4.availabilityCard.featureOff.body",
    role: "status" as const,
  },
  "not-found-or-hidden": {
    title: "inventory2b4.availabilityCard.notFound.title",
    body: "inventory2b4.availabilityCard.notFound.body",
    role: "alert" as const,
  },
  "service-unavailable": {
    title: "inventory2b4.availabilityCard.unavailable.title",
    body: "inventory2b4.availabilityCard.unavailable.body",
    role: "alert" as const,
  },
  retrying: {
    title: "inventory2b4.availabilityCard.retrying.title",
    body: "inventory2b4.availabilityCard.retrying.body",
    role: "status" as const,
  },
} as const;

export function InventoryAvailabilityStateCard({
  availability,
  onRetry,
  onBack,
  className,
}: InventoryAvailabilityStateCardProps) {
  const { t } = useLocale();
  if (availability.state === "available") return null;
  const stateCopy = copy[availability.state];
  const isLoading = availability.state === "loading";
  const isRetrying = availability.state === "retrying";
  const Icon =
    isLoading || isRetrying
      ? Loader2
      : availability.state === "no-permission"
        ? LockKeyhole
        : availability.state === "feature-off"
          ? PowerOff
          : availability.state === "not-found-or-hidden"
            ? EyeOff
            : CircleAlert;

  return (
    <section
      data-ui="inventory-availability-state-card"
      data-availability-state={availability.state}
      role={stateCopy.role}
      aria-live={stateCopy.role === "alert" ? "assertive" : "polite"}
      aria-busy={isLoading || isRetrying}
      className={cn("grid min-w-0 gap-3 rounded-xl border p-4", className)}
    >
      {isLoading || isRetrying ? (
        <div aria-hidden="true" className="grid gap-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
        </div>
      ) : null}
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-background/80"
        >
          <Icon
            className={cn(
              "size-5",
              isLoading || isRetrying ? "animate-spin text-primary" : "text-status-warn-foreground",
            )}
          />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{t(stateCopy.title)}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t(stateCopy.body)}</p>
        </div>
      </div>
      {availability.state === "service-unavailable" && availability.retryable && onRetry ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full gap-2 sm:w-fit"
          onClick={() => void onRetry()}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {t("inventory2b4.availabilityCard.retry")}
        </Button>
      ) : null}
      {(availability.state === "no-permission" ||
        availability.state === "feature-off" ||
        availability.state === "not-found-or-hidden") &&
      onBack ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-fit"
          onClick={onBack}
        >
          {t("inventory2b4.detail.back")}
        </Button>
      ) : null}
    </section>
  );
}
