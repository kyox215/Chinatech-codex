"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DeviceCustodyBadge } from "@/components/orders/badges";
import { localizeDeviceCustody } from "@/features/orders/model/order-i18n";
import { cn } from "@/lib/utils";
import type { DeviceCustodyStatus } from "@/lib/repairdesk/types";
import { useLocale } from "@/shared/i18n/locale-provider";

export function NewOrderSubmitBar({
  valid,
  pending,
  statusMessage,
  custodyStatus,
  onCancel,
  surface = "page",
  validationSummaryId,
}: {
  valid: boolean;
  pending: boolean;
  statusMessage?: string;
  custodyStatus: DeviceCustodyStatus | null;
  onCancel?: () => void;
  surface?: "page" | "dialog";
  validationSummaryId?: string;
}) {
  const { t } = useLocale();
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
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-background/85 px-2 pb-[calc(env(safe-area-inset-bottom)+0.4rem)] pt-1 backdrop-blur-xl md:pointer-events-auto md:sticky md:bottom-3 md:mt-3 md:px-0 md:pb-0 md:pt-0",
        isDialog ? "md:mx-0" : "md:mx-0 md:bg-transparent md:backdrop-blur-none",
      )}
    >
      <div
        data-new-order-submit-card="true"
        className={cn(
          "pointer-events-auto mx-auto grid max-w-[430px] min-w-0 grid-cols-1 items-center gap-1 rounded-xl border border-[var(--border-panel)] bg-card px-1.5 py-1.5 shadow-[var(--shadow-card)] md:flex md:max-w-none md:justify-between md:gap-2 md:bg-[var(--surface-panel)] md:px-2 md:py-2 md:shadow-[var(--shadow-workspace)]",
          isDialog ? "md:rounded-xl md:px-3" : "md:rounded-[var(--radius-lg)] md:px-3",
        )}
      >
        {onCancel ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="hidden h-9 gap-1.5 rounded-lg text-xs md:inline-flex lg:h-8"
            onClick={onCancel}
          >
            <ArrowLeft className="size-3.5" /> {t("orders2b1.new.back")}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="hidden h-9 gap-1.5 rounded-lg text-xs md:inline-flex lg:h-8"
            asChild
          >
            <Link href="/orders">
              <ArrowLeft className="size-3.5" /> {t("orders2b1.new.back")}
            </Link>
          </Button>
        )}
        <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1 md:ml-auto">
          <div className="flex min-w-0 items-center justify-between gap-1.5 md:justify-start">
            <span className="text-[10px] font-medium text-muted-foreground lg:text-xs lg:leading-4">
              {t("orders2b1.new.custody")}
            </span>
            <DeviceCustodyBadge
              status={custodyStatus}
              label={localizeDeviceCustody(custodyStatus, undefined, t)}
              className="text-[10px] lg:text-xs lg:leading-4"
            />
          </div>
          {statusMessage ? (
            <p
              role="status"
              aria-live="polite"
              className="text-[10px] text-muted-foreground lg:text-xs lg:leading-4"
            >
              {statusMessage}
            </p>
          ) : null}
        </div>
        <div className="contents md:flex md:min-w-0 md:items-center">
          <Button
            type="submit"
            disabled={pending}
            aria-disabled={!valid || pending}
            aria-describedby={!valid ? validationSummaryId : undefined}
            className="h-10 w-full shrink-0 gap-1.5 rounded-lg border-0 px-4 text-sm font-semibold text-primary-foreground md:w-auto"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Banknote className="size-3.5" />
            {t(pending ? "orders2b1.new.processing" : "orders2b1.new.create")}
          </Button>
        </div>
      </div>
    </div>
  );
}
