"use client";

import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DeviceCustodyStatus } from "@/lib/repairdesk/types";
import { formatCurrency } from "@/shared/i18n/format";
import { useLocale } from "@/shared/i18n/locale-provider";

export function NewOrderSubmitBar({
  valid,
  pending,
  statusMessage,
  total = 0,
  missingCount = 0,
  surface = "page",
  validationSummaryId,
}: {
  total?: number;
  missingCount?: number;
  valid: boolean;
  pending: boolean;
  statusMessage?: string;
  custodyStatus: DeviceCustodyStatus | null;
  onCancel?: () => void;
  surface?: "page" | "dialog";
  validationSummaryId?: string;
}) {
  const { t, locale } = useLocale();
  const isDialog = surface === "dialog";
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    const form = bar?.closest<HTMLElement>("[data-new-order-form='true']");
    if (!bar || !form) return;

    const updateOffset = () => {
      form.style.setProperty(
        "--new-order-submit-offset",
        `${Math.ceil(bar.getBoundingClientRect().height)}px`,
      );
    };

    updateOffset();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateOffset);
      return () => {
        window.removeEventListener("resize", updateOffset);
        form.style.removeProperty("--new-order-submit-offset");
      };
    }

    const observer = new ResizeObserver(updateOffset);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      form.style.removeProperty("--new-order-submit-offset");
    };
  }, []);

  return (
    <div
      ref={barRef}
      data-new-order-submit-bar="true"
      className={cn(
        isDialog
          ? "z-40 shrink-0 border-t border-border bg-card px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 sm:px-3 md:px-4"
          : "pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-3.5 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 md:pointer-events-auto md:sticky md:bottom-3 md:mx-0 md:mt-3 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:backdrop-blur-none",
      )}
    >
      <div
        data-new-order-submit-card="true"
        className={cn(
          "pointer-events-auto mx-auto grid max-w-[430px] min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-card py-0 shadow-none md:flex md:max-w-none md:justify-between md:gap-2 md:bg-[var(--surface-panel)] md:px-2 md:py-2 md:shadow-[var(--shadow-workspace)]",
          isDialog ? "md:rounded-xl md:px-3" : "md:rounded-[var(--radius-lg)] md:px-3",
        )}
      >
        <div className="min-w-0 px-1.5">
          <span className="block text-[10px] text-muted-foreground">
            {t(valid ? "orders.newFlow.ready" : "orders2b1.new.incomplete")}
          </span>
          <span className="font-mono text-xs font-medium text-muted-foreground">
            {formatCurrency(total, locale)}
          </span>
          {statusMessage ? (
            <p role="status" className="text-[10px] leading-3 text-muted-foreground">
              {statusMessage}
            </p>
          ) : null}
        </div>
        <div className="contents md:flex md:min-w-0 md:items-center">
          <Button
            type="submit"
            aria-label={t(pending ? "orders2b1.new.processing" : "orders2b1.new.create")}
            disabled={pending}
            aria-disabled={pending}
            aria-describedby={!valid ? validationSummaryId : undefined}
            className="h-11 min-h-11 w-full shrink-0 gap-1.5 rounded-lg border-0 px-4 whitespace-normal text-xs font-semibold leading-4 text-primary-foreground md:w-auto"
          >
            <Plus className="size-3.5" />
            {pending
              ? t("orders2b1.new.processing")
              : !valid
                ? t("orders.newFlow.missingAction", { count: missingCount || 1 })
                : t("orders2b1.new.create")}
          </Button>
        </div>
      </div>
    </div>
  );
}
