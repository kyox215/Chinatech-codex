"use client";

import { useState } from "react";
import { Archive, Check, ChevronDown, Layers, List, ListTodo } from "lucide-react";

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
import type { OrderListView } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export function OrderListViewMode({
  value,
  canBrowseArchive,
  compact = false,
  disclosure = false,
  disabled = false,
  onChange,
}: {
  value: OrderListView;
  canBrowseArchive: boolean;
  compact?: boolean;
  disclosure?: boolean;
  disabled?: boolean;
  onChange: (value: OrderListView) => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const viewOptions = [
    { value: "active", label: t("orders.range.active"), icon: ListTodo },
    { value: "archive", label: t("orders.range.archive"), icon: Archive },
    { value: "all", label: t("orders.range.all"), icon: List },
  ] as const;

  if (disclosure) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            disabled={disabled}
            className="h-auto min-h-11 min-w-0 gap-1 px-1 py-1 text-[11px] font-normal text-muted-foreground"
            aria-label={`${t("orders.displayRange")}：${t(`orders.range.${value}`)}`}
            data-order-range-trigger="true"
          >
            <Layers className="size-3 shrink-0" />
            <span className="min-w-0 whitespace-normal break-words text-left leading-4">
              {t(`orders.range.${value}`)}
            </span>
            <ChevronDown className="size-3 shrink-0" />
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
          <DialogHeader className={componentOverlay.denseEditorHeader}>
            <div>
              <DialogTitle className="text-sm">{t("orders.displayRange")}</DialogTitle>
              <DialogDescription className="mt-1 text-[11px]">
                {t("orders.rangeMenuHelp")}
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogBody className="grid gap-2 p-3" role="group" aria-label={t("orders.displayRange")}>
            {viewOptions
              .filter((option) => canBrowseArchive || option.value === "active")
              .map((option) => (
                <Button
                  key={option.value}
                  variant="outline"
                  disabled={disabled}
                  className={cn(
                    "h-12 justify-start gap-2 text-xs",
                    value === option.value && "border-primary/30 bg-primary/5 text-primary",
                  )}
                  aria-pressed={value === option.value}
                  onClick={() => {
                    setOpen(false);
                    onChange(option.value);
                  }}
                >
                  <option.icon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 whitespace-normal text-left">{option.label}</span>
                  {value === option.value ? <Check className="size-4" /> : null}
                </Button>
              ))}
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

  return (
    <div
      className={cn(
        "grid shrink-0 grid-cols-3 rounded-md border border-border/60 bg-surface/55",
        compact ? "gap-px rounded-[var(--order-mobile-radius,0.625rem)] border-0 p-0" : "gap-1 p-1",
      )}
      role="group"
      aria-label={t("orders.displayRange")}
    >
      {viewOptions
        .filter((option) => canBrowseArchive || option.value === "active")
        .map((option) => {
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
                "h-11 gap-1 px-2 text-xs",
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
