"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  Layers,
  ListTodo,
  LoaderCircle,
  PackageCheck,
  PackagePlus,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { componentOverlay } from "@/lib/component-patterns";
import type { StatusTone } from "@/lib/mock/enums";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export interface OrderQueueChoice {
  key: string;
  label: string;
  shortLabel?: string;
  count: number;
  hint?: string;
  tone?: StatusTone;
}

const groupIcons: Record<string, LucideIcon> = {
  all: ListTodo,
  processing: Wrench,
  ordered: PackagePlus,
  arrived: PackageCheck,
  arrived_notified: Bell,
  repaired: CheckCircle2,
  repaired_notified: BadgeCheck,
};

export function OrderListQueueMenu({
  groups,
  value,
  pendingValue,
  total,
  rangeLabel,
  disabled,
  onChange,
}: {
  groups: OrderQueueChoice[];
  value: string;
  pendingValue?: string;
  total: number;
  rangeLabel?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const active = groups.find((group) => group.key === value);
  if (groups.length === 0) {
    return (
      <span
        className="flex min-h-11 min-w-0 items-center px-1 text-[11px] font-medium text-muted-foreground"
        data-order-static-results="true"
      >
        {t("orders.queueResults", { count: total })}
      </span>
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          className="h-auto min-h-11 min-w-0 justify-start gap-1 px-1 py-1 text-xs font-semibold"
          data-order-queue-trigger="true"
          aria-busy={Boolean(pendingValue)}
          aria-label={t("orders.chooseQueue", { queue: active?.label ?? t("orders.allStatuses") })}
        >
          <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-4">
            {value === "all" ? t("orders.allQueues") : active?.shortLabel || active?.label}
          </span>
          {pendingValue ? (
            <LoaderCircle className="size-3 shrink-0 animate-spin text-primary" />
          ) : (
            <span
              className="shrink-0 rounded bg-primary/10 px-1 font-mono text-[10px] tabular-nums text-primary"
              title={t("orders.queueResults", { count: total })}
            >
              {total > 999 ? "999+" : total}
            </span>
          )}
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent
        mobileEditor
        editorLayout
        initialFocus="container"
        closeLabel={t("common.close")}
        closeClassName="!size-11"
        className={cn(componentOverlay.content, "gap-0 p-0 sm:p-0 max-lg:!max-w-lg")}
      >
        <DialogHeader className={cn(componentOverlay.denseEditorHeader, "pr-14")}>
          <span className={componentOverlay.denseEditorIcon}>
            <Layers className="size-4" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-sm">{t("orders.workQueues")}</DialogTitle>
            <DialogDescription className="mt-1 text-[11px] leading-4">
              {t("orders.queueMenuHelp")}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogBody className="space-y-2 px-3 py-3">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Layers className="size-3" />
            <span>
              {t("orders.displayRange")} ·{" "}
              <strong className="font-medium text-foreground">{rangeLabel}</strong>
            </span>
          </p>
          <div className="grid gap-1.5" role="group" aria-label={t("orders.workQueues")}>
            {groups.map((group) => {
              const Icon = groupIcons[group.key] ?? ListTodo;
              const selected = value === group.key;
              return (
                <button
                  key={group.key}
                  type="button"
                  disabled={disabled}
                  data-order-queue-option={group.key}
                  aria-pressed={selected}
                  aria-busy={pendingValue === group.key}
                  aria-label={t("orders.queueOption", { queue: group.label, count: group.count })}
                  onClick={() => {
                    setOpen(false);
                    onChange(group.key);
                  }}
                  className={cn(
                    "flex min-h-[52px] min-w-0 items-center gap-3 rounded-lg border border-[var(--border-panel)] bg-card px-3 py-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50",
                    selected && "border-primary/30 bg-primary/5 text-primary",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted-foreground",
                      selected && "bg-card text-primary",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 break-words leading-4">
                    {group.key === "all" ? t("orders.allQueues") : group.label}
                  </span>
                  <span className="shrink-0 font-mono font-semibold tabular-nums">
                    {group.count}
                  </span>
                  <Check
                    className={cn("size-4 shrink-0", !selected && "invisible")}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </DialogBody>
        <DialogFooter className={cn(componentOverlay.denseEditorFooter, "!grid-cols-1")}>
          <Button variant="outline" className="h-11 w-full" onClick={() => setOpen(false)}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
