"use client";

import { useId, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type {
  OrderReasonCatalog,
  OrderReasonDraft,
} from "@/features/orders/model/order-reason-catalog";
import { getOrderReasonLegacyPreview } from "@/features/orders/model/order-reason-catalog";
import { isOrderPresetReasonUiEnabled } from "@/features/orders/model/order-preset-reason-feature";
import { cn } from "@/lib/utils";

const COLLAPSED_OPTION_COUNT = 6;

export function OrderReasonField({
  catalog,
  value,
  onChange,
  disabled = false,
  compact = false,
  error,
  presetEnabled = isOrderPresetReasonUiEnabled(),
}: {
  catalog: OrderReasonCatalog;
  value: OrderReasonDraft;
  onChange: (value: OrderReasonDraft) => void;
  disabled?: boolean;
  compact?: boolean;
  error?: string;
  presetEnabled?: boolean;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const selected = catalog.options.find((entry) => entry.code === value.primaryCode);
  const visibleOptions = useMemo(() => {
    if (expanded || catalog.options.length <= COLLAPSED_OPTION_COUNT) return catalog.options;
    const initial = catalog.options.slice(0, COLLAPSED_OPTION_COUNT);
    if (!selected || initial.some((entry) => entry.code === selected.code)) return initial;
    return [...initial.slice(0, COLLAPSED_OPTION_COUNT - 1), selected];
  }, [catalog.options, expanded, selected]);
  const showToggle = catalog.options.length > COLLAPSED_OPTION_COUNT;

  if (!presetEnabled) {
    const legacyValue =
      value.primaryCode === "other" ? value.note : getOrderReasonLegacyPreview(catalog, value);
    return (
      <label className="block min-w-0 space-y-1.5">
        <span className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>
          处理说明（必填）
        </span>
        <span
          className={cn(
            "block text-muted-foreground",
            compact ? "text-[10px] leading-4" : "text-xs",
          )}
        >
          当前门店仍使用原处理说明；启用原因点选灰度后会显示免打字选项。
        </span>
        <Textarea
          value={legacyValue}
          disabled={disabled}
          maxLength={500}
          rows={compact ? 3 : 4}
          placeholder="请填写实际处理原因"
          onChange={(event) => onChange({ primaryCode: "other", note: event.target.value })}
          className={cn("resize-none", compact && "min-h-20 text-xs")}
          aria-invalid={Boolean(error)}
        />
        {error ? (
          <span
            className="block rounded-md bg-status-danger px-2 py-1.5 text-xs text-status-danger-foreground"
            role="alert"
          >
            {error}
          </span>
        ) : null}
      </label>
    );
  }

  return (
    <fieldset className="min-w-0 space-y-2" disabled={disabled} aria-describedby={`${id}-help`}>
      <legend className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>
        {catalog.title}
      </legend>
      <p
        id={`${id}-help`}
        className={cn("text-muted-foreground", compact ? "text-[10px] leading-4" : "text-xs")}
      >
        {catalog.description}
      </p>

      <RadioGroup
        value={value.primaryCode}
        onValueChange={(primaryCode) =>
          onChange({ primaryCode, note: primaryCode === "other" ? value.note : "" })
        }
        disabled={disabled}
        aria-invalid={Boolean(error)}
        className="grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2"
      >
        {visibleOptions.map((entry) => {
          const selectedOption = entry.code === value.primaryCode;
          const optionId = `${id}-${entry.code}`;
          return (
            <label
              key={entry.code}
              htmlFor={optionId}
              className={cn(
                "flex min-h-11 min-w-0 cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors focus-within:ring-1 focus-within:ring-ring",
                selectedOption
                  ? "border-primary/55 bg-primary/10 text-primary"
                  : "border-[var(--border-panel)] bg-[var(--surface-panel)] hover:bg-accent/35",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <RadioGroupItem id={optionId} value={entry.code} className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-1 font-semibold",
                    compact ? "text-[11px]" : "text-xs",
                  )}
                >
                  <span className="truncate">{entry.staffLabel}</span>
                  {selectedOption ? (
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-semibold">
                      <Check className="size-3" aria-hidden="true" /> 已选
                    </span>
                  ) : null}
                </span>
                {entry.staffDescription ? (
                  <span
                    className={cn(
                      "mt-0.5 block text-muted-foreground",
                      compact ? "text-[10px] leading-3" : "text-[11px] leading-4",
                    )}
                  >
                    {entry.staffDescription}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </RadioGroup>

      {showToggle ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-full gap-1 text-xs"
          disabled={disabled}
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          {expanded ? "收起选项" : `查看全部（${catalog.options.length}）`}
        </Button>
      ) : null}

      {selected?.requiresNote ? (
        <label className="block min-w-0 space-y-1">
          <span
            className={cn("font-medium text-muted-foreground", compact ? "text-[10px]" : "text-xs")}
          >
            其他原因（必填）
          </span>
          <Textarea
            data-order-other-reason="true"
            value={value.note}
            disabled={disabled}
            maxLength={500}
            rows={compact ? 3 : 4}
            placeholder="请填写现有选项未覆盖的实际原因"
            onChange={(event) => onChange({ ...value, note: event.target.value })}
            className={cn("resize-none", compact && "min-h-20 text-xs")}
            aria-invalid={Boolean(error)}
          />
        </label>
      ) : null}

      {error ? (
        <p
          className="rounded-md bg-status-danger px-2 py-1.5 text-xs text-status-danger-foreground"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
