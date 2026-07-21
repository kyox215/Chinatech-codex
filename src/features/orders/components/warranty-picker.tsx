"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

import { OrderReasonField } from "@/features/orders/components/order-reason-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatWarrantyText,
  normalizeWarrantyMonths,
  ORDER_WARRANTY_OPTIONS,
  parseWarrantyMonths,
  warrantyReasonRequired,
} from "@/features/orders/model/order-warranty";
import {
  createEmptyOrderReasonDraft,
  getOrderReasonCatalog,
  getOrderReasonLegacyPreview,
  getWarrantyReasonContext,
} from "@/features/orders/model/order-reason-catalog";
import { cn } from "@/lib/utils";

export type WarrantyDraftValue = {
  warranty_months: number;
  warranty_text: string;
  warranty_change_reason?: string;
};

export function WarrantyTag({
  months,
  text,
  className,
}: {
  months?: number | null;
  text?: string | null;
  className?: string;
}) {
  const label =
    typeof months === "number"
      ? formatWarrantyText(normalizeWarrantyMonths(months))
      : text
        ? formatWarrantyText(parseWarrantyMonths(text))
        : "—";
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary",
        className,
      )}
      title={label}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

export function WarrantyPicker({
  valueMonths,
  valueText,
  reason,
  defaultMonths = 6,
  onChange,
  compact = false,
  appearance = "outlined",
  triggerClassName,
  contentClassName,
  reasonFieldTarget,
  originalMonths,
}: {
  valueMonths?: number | null;
  valueText?: string | null;
  reason?: string | null;
  defaultMonths?: number;
  onChange: (value: WarrantyDraftValue) => void;
  compact?: boolean;
  appearance?: "outlined" | "quiet";
  triggerClassName?: string;
  contentClassName?: string;
  reasonFieldTarget?: string;
  originalMonths?: number;
}) {
  const quiet = appearance === "quiet";
  const normalizedDefault = normalizeWarrantyMonths(defaultMonths);
  const months =
    typeof valueMonths === "number"
      ? normalizeWarrantyMonths(valueMonths, normalizedDefault)
      : parseWarrantyMonths(valueText, normalizedDefault);
  const needsReason = warrantyReasonRequired(months, normalizedDefault);
  const baselineMonths = normalizeWarrantyMonths(originalMonths ?? normalizedDefault);
  const reasonContext = needsReason ? getWarrantyReasonContext(baselineMonths, months) : undefined;
  const reasonCatalog = reasonContext ? getOrderReasonCatalog(reasonContext) : undefined;
  const [reasonDraft, setReasonDraft] = useState(createEmptyOrderReasonDraft);

  useEffect(() => {
    if (!reasonCatalog) {
      setReasonDraft(createEmptyOrderReasonDraft());
      return;
    }
    const cleanReason = reason?.trim() ?? "";
    if (!cleanReason) {
      setReasonDraft((current) =>
        current.primaryCode === "other" ? current : createEmptyOrderReasonDraft(),
      );
      return;
    }
    const preset = reasonCatalog.options.find((entry) => entry.legacyText === cleanReason);
    setReasonDraft(
      preset ? { primaryCode: preset.code, note: "" } : { primaryCode: "other", note: cleanReason },
    );
  }, [reason, reasonCatalog]);

  const updateMonths = (nextMonths: number) => {
    const normalized = normalizeWarrantyMonths(nextMonths, normalizedDefault);
    onChange({
      warranty_months: normalized,
      warranty_text: formatWarrantyText(normalized),
      warranty_change_reason: warrantyReasonRequired(normalized, normalizedDefault)
        ? ""
        : undefined,
    });
  };

  const updateReason = (nextReason: string) => {
    onChange({
      warranty_months: months,
      warranty_text: formatWarrantyText(months),
      warranty_change_reason: nextReason,
    });
  };

  return (
    <div className={cn("min-w-0 space-y-1.5", compact && "space-y-1")}>
      <Select value={String(months)} onValueChange={(value) => updateMonths(Number(value))}>
        <SelectTrigger
          className={cn(
            compact ? "h-8 text-xs" : "h-9",
            quiet &&
              "!h-6 !rounded-none !border-0 !border-b !border-transparent !bg-transparent !px-0 !py-0 !shadow-none focus:!ring-0 focus-visible:!border-primary/45",
            triggerClassName,
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className={contentClassName}>
          {ORDER_WARRANTY_OPTIONS.map((option) => {
            const isDefault = normalizedDefault === option.months;
            return (
              <SelectItem
                key={option.months}
                value={String(option.months)}
                className={cn(compact && "text-xs")}
              >
                {option.label}
                {isDefault ? "（默认）" : ""}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {needsReason && (
        <div className="space-y-1">
          {reasonCatalog ? (
            <div data-new-order-field={reasonFieldTarget}>
              <OrderReasonField
                catalog={reasonCatalog}
                value={reasonDraft}
                onChange={(nextDraft) => {
                  setReasonDraft(nextDraft);
                  updateReason(getOrderReasonLegacyPreview(reasonCatalog, nextDraft));
                }}
                compact
              />
            </div>
          ) : null}
          <p className="flex items-center gap-1 text-[11px] text-status-warn-foreground">
            <AlertCircle className="size-3 shrink-0" />
            非默认质保会记录原因、员工和时间。
          </p>
        </div>
      )}
    </div>
  );
}
