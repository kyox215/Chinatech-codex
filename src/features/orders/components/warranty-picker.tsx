"use client";

import { AlertCircle } from "lucide-react";

import { Input } from "@/components/ui/input";
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
}: {
  valueMonths?: number | null;
  valueText?: string | null;
  reason?: string | null;
  defaultMonths?: number;
  onChange: (value: WarrantyDraftValue) => void;
  compact?: boolean;
}) {
  const normalizedDefault = normalizeWarrantyMonths(defaultMonths);
  const months =
    typeof valueMonths === "number"
      ? normalizeWarrantyMonths(valueMonths, normalizedDefault)
      : parseWarrantyMonths(valueText, normalizedDefault);
  const needsReason = warrantyReasonRequired(months, normalizedDefault);

  const updateMonths = (nextMonths: number) => {
    const normalized = normalizeWarrantyMonths(nextMonths, normalizedDefault);
    onChange({
      warranty_months: normalized,
      warranty_text: formatWarrantyText(normalized),
      warranty_change_reason: warrantyReasonRequired(normalized, normalizedDefault)
        ? reason?.trim() || ""
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
        <SelectTrigger className={cn(compact ? "h-8 text-xs" : "h-9")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
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
          <Input
            value={reason ?? ""}
            onChange={(event) => updateReason(event.target.value)}
            placeholder="请输入非默认质保原因"
            className={cn("h-8 text-xs", compact && "h-7")}
          />
          <p className="flex items-center gap-1 text-[11px] text-status-warn-foreground">
            <AlertCircle className="size-3 shrink-0" />
            非默认质保会记录原因、员工和时间。
          </p>
        </div>
      )}
    </div>
  );
}
