"use client";

import { useRef } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  ACCESSORY_NOTE_OPTIONS,
  formatAccessoryNotes,
  parseAccessoryNotes,
  type AccessoryNoteOption,
} from "@/features/orders/model/order-accessory-notes";
import { localizeAccessoryNoteOption } from "@/features/orders/model/order-i18n";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export function AccessoryNotesPills({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  const { t } = useLocale();
  const parsed = parseAccessoryNotes(value);
  const labels = [
    ...parsed.selected
      .filter((option) => option !== "其他")
      .map((option) => localizeAccessoryNoteOption(option, t)),
    ...(parsed.customText
      ? [t("orders2b1.accessory.otherValue", { value: parsed.customText })]
      : parsed.selected.includes("其他")
        ? [localizeAccessoryNoteOption("其他", t)]
        : []),
  ];
  if (!labels.length) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("flex min-w-0 flex-wrap gap-1", className)}>
      {labels.map((label) => (
        <span
          key={label}
          className="max-w-full truncate rounded-full border border-border/70 bg-surface-muted/70 px-1.5 py-0.5 text-[11px] font-medium"
          title={label}
        >
          {label}
        </span>
      ))}
    </span>
  );
}

export function AccessoryNotesPicker({
  value,
  onChange,
  compact = false,
  disabled = false,
}: {
  value?: string | null;
  onChange: (value: string) => void;
  compact?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
  quickChoices?: boolean;
}) {
  const { t } = useLocale();
  const parsed = parseAccessoryNotes(value);
  const selectedOptions =
    parsed.customText && !parsed.selected.includes("其他")
      ? [...parsed.selected, "其他" as const]
      : parsed.selected;
  const customSelected = selectedOptions.includes("其他");
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const updateSelection = (nextSelected: AccessoryNoteOption[]) => {
    if (disabledRef.current) return;
    onChange(
      formatAccessoryNotes({
        selected: nextSelected,
        customText: nextSelected.includes("其他") ? parsed.customText : "",
      }),
    );
  };

  return (
    <div className={cn("min-w-0 space-y-2", compact && "space-y-1.5")}>
      <div
        data-accessory-choices="true"
        role="group"
        aria-label={t("orders2b1.new.accessories")}
        className="flex min-w-0 flex-wrap gap-1.5"
      >
        {ACCESSORY_NOTE_OPTIONS.map((option) => {
          const selected = selectedOptions.includes(option);
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              data-accessory-choice={option}
              aria-pressed={selected}
              className={cn(
                "flex min-h-11 min-w-0 max-w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border-panel)] px-2 py-1.5 text-xs leading-4 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 lg:min-h-9",
                selected && "border-primary/25 bg-primary/5 text-primary",
              )}
              onClick={() =>
                updateSelection(
                  selected
                    ? selectedOptions.filter((value) => value !== option)
                    : option === "无"
                      ? ["无"]
                      : [...selectedOptions.filter((value) => value !== "无"), option],
                )
              }
            >
              <span
                className={cn(
                  "grid size-3 shrink-0 place-items-center rounded border border-current",
                  selected && "bg-primary text-primary-foreground",
                )}
              >
                {selected ? <Check className="size-2.5" /> : null}
              </span>
              <span className="min-w-0 break-words">{localizeAccessoryNoteOption(option, t)}</span>
            </button>
          );
        })}
      </div>
      {customSelected && (
        <Input
          disabled={disabled}
          value={parsed.customText}
          onChange={(event) =>
            !disabledRef.current &&
            onChange(
              formatAccessoryNotes({
                selected: selectedOptions,
                customText: event.target.value,
              }),
            )
          }
          placeholder={t("orders2b1.accessory.customPlaceholder")}
          aria-label={t("orders2b1.accessory.customPlaceholder")}
          className="h-11 text-base lg:h-9"
        />
      )}
    </div>
  );
}
