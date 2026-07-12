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
  onChange,
}: {
  value: OrderListView;
  canBrowseArchive: boolean;
  compact?: boolean;
  onChange: (value: OrderListView) => void;
}) {
  if (!canBrowseArchive) return null;

  return (
    <div
      className="grid shrink-0 grid-cols-3 gap-1 rounded-md border border-border/60 bg-surface/55 p-1"
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
            size="sm"
            variant={active ? "default" : "ghost"}
            className={cn("h-7 gap-1 px-2 text-xs", compact && "min-w-0 px-1.5 text-[11px]")}
            aria-pressed={active}
            title={option.label}
            onClick={() => onChange(option.value)}
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
