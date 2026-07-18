"use client";

import Link from "next/link";
import { ArrowLeft, Banknote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DeviceCustodyBadge } from "@/components/orders/badges";
import { cn } from "@/lib/utils";
import type { DeviceCustodyStatus } from "@/lib/repairdesk/types";

export function NewOrderSubmitBar({
  valid,
  pending,
  statusMessage,
  custodyStatus,
  onCancel,
  surface = "page",
}: {
  valid: boolean;
  pending: boolean;
  statusMessage?: string;
  custodyStatus: DeviceCustodyStatus | null;
  onCancel?: () => void;
  surface?: "page" | "dialog";
}) {
  const isDialog = surface === "dialog";

  return (
    <div
      data-new-order-submit-bar="true"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-background/85 px-2 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-1.5 backdrop-blur-xl md:pointer-events-auto md:sticky md:bottom-3 md:mt-3 md:px-0 md:pb-0 md:pt-0",
        isDialog ? "md:mx-0" : "md:mx-0 md:bg-transparent md:backdrop-blur-none",
      )}
    >
      <div
        data-new-order-submit-card="true"
        className={cn(
          "pointer-events-auto mx-auto grid max-w-[430px] min-w-0 grid-cols-1 items-center gap-2 rounded-xl border border-[var(--border-panel)] bg-card px-2 py-2 shadow-[var(--shadow-card)] md:flex md:max-w-none md:justify-between md:gap-2 md:bg-[var(--surface-panel)] md:py-2 md:shadow-[var(--shadow-workspace)]",
          isDialog ? "md:rounded-xl md:px-3" : "md:rounded-[var(--radius-lg)] md:px-3",
        )}
      >
        {onCancel ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="hidden h-8 gap-1.5 rounded-xl text-xs md:inline-flex"
            onClick={onCancel}
          >
            <ArrowLeft className="size-3.5" /> 返回工单
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="hidden h-8 gap-1.5 rounded-xl text-xs md:inline-flex"
            asChild
          >
            <Link href="/orders">
              <ArrowLeft className="size-3.5" /> 返回工单
            </Link>
          </Button>
        )}
        <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 md:ml-auto">
          <div className="flex min-w-0 items-center justify-between gap-2 md:justify-start">
            <span className="text-[10px] font-medium text-muted-foreground">设备保管</span>
            <DeviceCustodyBadge status={custodyStatus} className="text-[10px]" />
          </div>
          {statusMessage ? (
            <p
              role="status"
              aria-live="polite"
              className="max-w-[26rem] text-[10px] text-muted-foreground"
            >
              {statusMessage}
            </p>
          ) : null}
        </div>
        <div className="contents md:flex md:min-w-0 md:items-center">
          <Button
            type="submit"
            disabled={!valid || pending}
            className="h-11 w-full shrink-0 gap-1.5 rounded-xl border-0 px-4 text-sm font-semibold text-primary-foreground md:h-10 md:w-auto"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Banknote className="size-3.5" />
            {pending ? "处理中…" : "创建工单"}
          </Button>
        </div>
      </div>
    </div>
  );
}
