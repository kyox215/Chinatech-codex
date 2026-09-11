"use client";

import { Columns3, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrderListPresentationView } from "../model/order-list-presentation";
import { useLocale } from "@/shared/i18n/locale-provider";
import { cn } from "@/lib/utils";

export interface OrderListPresentationSwitchProps {
  value: OrderListPresentationView;
  onChange: (view: OrderListPresentationView) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

export function OrderListPresentationSwitch({
  value,
  onChange,
  disabled,
  compact = false,
  className,
}: OrderListPresentationSwitchProps) {
  const { t } = useLocale();
  return (
    <div
      role="group"
      aria-label={t("orders.queue.presentationLabel")}
      className={cn(
        "inline-flex min-w-0 items-center gap-1 rounded-lg border border-border bg-card p-1",
        compact && "shrink-0 gap-0 border-0 bg-transparent p-0",
        className,
      )}
    >
      {(
        [
          { value: "list", icon: List, label: "orders.queue.listView" },
          { value: "cards", icon: LayoutGrid, label: "orders.queue.cardsView" },
          { value: "board", icon: Columns3, label: "orders.queue.boardView" },
        ] as const
      ).map(({ value: mode, icon: Icon, label }) => (
        <Button
          key={mode}
          type="button"
          variant="ghost"
          data-order-presentation-control={mode}
          aria-pressed={value === mode}
          disabled={disabled}
          onClick={() => onChange(mode)}
          className={cn(
            "min-h-11 gap-1.5 rounded-md px-3 text-xs",
            compact && "gap-1 px-1.5 text-[11px]",
            value === mode && "bg-primary/10 text-primary hover:bg-primary/15",
          )}
        >
          <Icon className={cn("size-3.5", compact && "max-[359px]:hidden")} aria-hidden="true" />
          {t(label)}
        </Button>
      ))}
    </div>
  );
}
