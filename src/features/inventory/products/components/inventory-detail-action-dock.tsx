"use client";

import {
  ArrowRight,
  ClipboardCheck,
  Eye,
  Loader2,
  Pencil,
  ReceiptText,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { InventoryDetailNextAction } from "@/features/inventory/model/inventory-detail-next-action";

export function InventoryDetailActionDock({
  action,
  onAction,
  className,
}: {
  action: InventoryDetailNextAction;
  onAction?: () => void;
  className?: string;
}) {
  if (action.kind === "none") return null;

  if (action.kind === "loading") {
    return (
      <div
        data-ui="inventory-detail-action-dock"
        data-action-state="loading"
        className={cn(dockClassName, className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className={dockInnerClassName}>
          <div className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-muted/70 px-3 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {action.label}
          </div>
        </div>
      </div>
    );
  }

  const Icon = actionIcon(action.id);
  return (
    <div
      data-ui="inventory-detail-action-dock"
      data-action-state="ready"
      data-action-id={action.id}
      data-action-readonly={action.readOnly ? "true" : "false"}
      className={cn(dockClassName, className)}
    >
      <div className={dockInnerClassName}>
        <Button
          type="button"
          className="min-h-11 w-full rounded-xl text-xs"
          onClick={onAction}
          aria-label={action.label}
        >
          <Icon className="mr-2 size-4" aria-hidden="true" />
          {action.label}
          <ArrowRight className="ml-auto size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

const dockClassName =
  "fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-panel)] bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-1.5 shadow-[0_-10px_30px_color-mix(in_oklch,var(--foreground)_10%,transparent)] backdrop-blur-xl lg:hidden";
const dockInnerClassName = "mx-auto max-w-[430px]";

function actionIcon(
  action: Exclude<InventoryDetailNextAction, { kind: "loading" | "none" }>["id"],
) {
  switch (action) {
    case "after-sales-work":
      return Wrench;
    case "view-after-sales":
      return Eye;
    case "sale-collection":
      return ReceiptText;
    case "sale-pickup":
      return ClipboardCheck;
    case "sale-warranty":
      return Wrench;
    case "view-sale":
      return Eye;
    case "reserve-product":
      return ReceiptText;
    case "inspection-editor":
      return ClipboardCheck;
    case "edit-product":
      return Pencil;
  }
}
