"use client";

import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getOrderFactConfig,
  ORDER_FACT_CATALOG_REVISION,
  type OrderFactField,
} from "@/features/orders/model/order-fact-catalog";
import { cn } from "@/lib/utils";

export function OrderFactPicker({
  field,
  codes,
  otherNote,
  catalogRevision = ORDER_FACT_CATALOG_REVISION,
  disabled = false,
  onChange,
}: {
  field: OrderFactField;
  codes: string[];
  otherNote: string;
  catalogRevision?: string;
  disabled?: boolean;
  onChange: (value: { codes: string[]; otherNote: string; catalogRevision: string }) => void;
}) {
  const config = getOrderFactConfig(field);
  const stale = catalogRevision !== ORDER_FACT_CATALOG_REVISION;
  const unknownCodes = codes.filter(
    (code) => !config.options.some((option) => option.code === code),
  );

  if (stale || unknownCodes.length) {
    return (
      <div className="rounded-lg border border-status-warn-foreground/25 bg-status-warn/40 p-2 text-xs text-status-warn-foreground">
        <p>已恢复的点选目录已更新，原选择已保留但不会自动替换。</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2 h-7 text-[10px]"
          disabled={disabled}
          onClick={() =>
            onChange({ codes: [], otherNote: "", catalogRevision: ORDER_FACT_CATALOG_REVISION })
          }
        >
          清除后重新选择
        </Button>
      </div>
    );
  }

  return (
    <fieldset className="min-w-0 space-y-1.5" disabled={disabled}>
      <legend className="text-[10px] font-semibold text-muted-foreground">
        常见{config.label}（可多选）
      </legend>
      <div className="grid min-w-0 grid-cols-2 gap-1 sm:grid-cols-3">
        {config.options.map((option) => {
          const selected = codes.includes(option.code);
          return (
            <button
              key={option.code}
              type="button"
              aria-pressed={selected}
              className={cn(
                "flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                selected
                  ? "border-primary/45 bg-primary/10 text-primary"
                  : "border-[var(--border-panel)] bg-card hover:bg-accent/35",
              )}
              onClick={() =>
                onChange({
                  codes: selected
                    ? codes.filter((code) => code !== option.code)
                    : [...codes, option.code],
                  otherNote: option.code === "other" && selected ? "" : otherNote,
                  catalogRevision: ORDER_FACT_CATALOG_REVISION,
                })
              }
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {selected ? <Check className="size-3 shrink-0" /> : null}
            </button>
          );
        })}
      </div>
      {codes.includes("other") ? (
        <Textarea
          value={otherNote}
          rows={2}
          maxLength={500}
          disabled={disabled}
          placeholder={`填写其他${config.label}`}
          className="min-h-16 resize-none text-xs"
          onChange={(event) =>
            onChange({
              codes,
              otherNote: event.target.value,
              catalogRevision: ORDER_FACT_CATALOG_REVISION,
            })
          }
        />
      ) : null}
    </fieldset>
  );
}
