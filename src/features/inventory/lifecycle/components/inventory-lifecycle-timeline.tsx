"use client";

import { History, Loader2 } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/utils";
import { repairOs } from "@/lib/ui-patterns";
import { useLocale } from "@/shared/i18n/locale-provider";

import type {
  InventoryLifecycleTimelineEntry,
  InventoryLifecycleTimelineResult,
  InventoryLifecycleTimelineSource,
} from "../model/inventory-lifecycle-timeline";
import {
  formatInventoryLifecycleDate,
  localizeInventoryTimeline,
} from "../model/inventory-lifecycle-i18n";

export type InventoryLifecycleTimelineProps = {
  source: InventoryLifecycleTimelineSource;
  items?: readonly InventoryLifecycleTimelineEntry[];
  result?: InventoryLifecycleTimelineResult;
  title?: string;
  status?: "ready" | "loading";
  privacyRedacted?: boolean;
  className?: string;
};

export function InventoryLifecycleTimeline({
  source,
  items,
  result,
  title,
  status = "ready",
  privacyRedacted = false,
  className,
}: InventoryLifecycleTimelineProps) {
  const { locale, t } = useLocale();
  const headingId = useId();
  const rawItems = result?.items ?? items ?? [];
  const localized = localizeInventoryTimeline(
    result ?? {
      items: [...rawItems],
      scope: {
        source,
        totalValid: rawItems.length,
        displayedCount: rawItems.length,
        label: "",
      },
    },
    t,
  );
  const resolvedItems = localized.items;
  const scope = localized.scope;
  const isLoading = status === "loading";
  const displayTitle =
    title ??
    t(
      source === "milestone-summary"
        ? "inventory2b4.timeline.title.milestones"
        : "inventory2b4.timeline.title.events",
    );

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
          {t(
            source === "milestone-summary"
              ? "inventory2b4.timeline.source.milestones"
              : "inventory2b4.timeline.source.events",
          )}
        </span>
      </div>

      {isLoading ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-2 text-[10px] leading-4 text-muted-foreground"
        >
          {t("inventory2b4.timeline.loading")}
        </p>
      ) : privacyRedacted ? (
        <p role="status" className="mt-2 text-[10px] leading-4 text-muted-foreground">
          {t("inventory2b4.timeline.redacted")}
        </p>
      ) : resolvedItems.length ? (
        <>
          <ol
            className="mt-2 grid min-w-0 gap-1.5"
            aria-label={t("inventory2b4.timeline.listAria", { title: displayTitle })}
          >
            {resolvedItems.map((item) => (
              <li
                key={item.id}
                className="grid min-w-0 gap-1 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px]"
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <strong className="min-w-0 break-words font-semibold">{item.label}</strong>
                  <time dateTime={item.at} className="shrink-0 text-muted-foreground">
                    {formatInventoryLifecycleDate(item.at, locale, t)}
                  </time>
                </div>
                {item.fromStatusLabel || item.toStatusLabel ? (
                  <p className="break-words text-[10px] leading-4 text-muted-foreground">
                    {item.fromStatusLabel ?? t("inventory2b4.timeline.createdState")} →{" "}
                    {item.toStatusLabel ?? t("inventory2b4.timeline.currentState")}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">{scope.label}</p>
        </>
      ) : (
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
          {t(
            source === "milestone-summary"
              ? "inventory2b4.timeline.empty.milestones"
              : "inventory2b4.timeline.empty.events",
          )}
        </p>
      )}
    </section>
  );
}
