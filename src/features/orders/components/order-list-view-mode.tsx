"use client";

import { Archive, List, ListTodo } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { OrderListView } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";

const viewOptions = [
  { value: "active", label: "待处理", icon: ListTodo },
  { value: "archive", label: "历史", icon: Archive },
  { value: "all", label: "全部", icon: List },
] as const;

export function OrderListViewMode({
  value,
  canBrowseArchive,
  compact = false,
  disabled = false,
  onChange,
}: {
  value: OrderListView;
  canBrowseArchive: boolean;
  compact?: boolean;
  disabled?: boolean;
  onChange: (value: OrderListView) => void;
}) {
  if (!canBrowseArchive) return null;

  return (
    <div
      className={cn(
        "grid shrink-0 grid-cols-3 rounded-md border border-border/60 bg-surface/55",
        compact ? "gap-px rounded-[var(--order-mobile-radius,0.625rem)] border-0 p-0" : "gap-1 p-1",
      )}
      role="group"
      aria-label="订单显示范围"
    >
      {viewOptions.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <Button
            key={option.value}
            type="button"
            disabled={disabled}
            size="sm"
            variant={active ? "default" : "ghost"}
            className={cn(
              "h-9 gap-1 px-2 text-xs",
              compact &&
                "h-8 min-w-0 gap-[var(--order-mobile-gap,0.25rem)] rounded-[var(--order-mobile-radius,0.625rem)] px-[var(--order-mobile-pad,0.375rem)] text-[length:var(--order-mobile-meta,0.625rem)]",
            )}
            aria-pressed={active}
            title={option.label}
            onClick={() => onChange(option.value)}
          >
            <Icon
              className={cn(
                "size-3.5 shrink-0",
                compact && "size-[var(--order-mobile-icon,0.875rem)]",
              )}
              aria-hidden="true"
            />
            <span className="truncate">{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
