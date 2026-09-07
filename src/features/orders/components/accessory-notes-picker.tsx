"use client";

import { useRef } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";
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
  triggerClassName,
  contentClassName,
  disabled = false,
  quickChoices = false,
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
  const customSelected = parsed.selected.includes("其他");
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
    <div className={cn("relative min-w-0 space-y-1.5", compact && "space-y-1")}>
      {quickChoices ? (
        <div
          data-accessory-quick-choices
          className="grid grid-cols-2 gap-1 min-[360px]:grid-cols-4"
        >
          {(["SIM卡", "手机壳", "充电器", "数据线"] as const).map((option) => {
            const selected = parsed.selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                className={cn(
                  "flex min-h-8 min-w-0 items-center justify-center gap-1 rounded-md border border-[var(--border-panel)] px-1 py-1 text-[11px] leading-4 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                  selected && "border-primary/25 bg-primary/5 text-primary",
                )}
                onClick={() =>
                  updateSelection(
                    selected
                      ? parsed.selected.filter((value) => value !== option)
                      : [...parsed.selected.filter((value) => value !== "无"), option],
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
                <span className="min-w-0 break-words">
                  {localizeAccessoryNoteOption(option, t)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <MultiSelectDropdown<AccessoryNoteOption>
        options={ACCESSORY_NOTE_OPTIONS.map((option) => ({
          value: option,
          label: localizeAccessoryNoteOption(option, t),
        }))}
        disabled={disabled}
        value={parsed.selected}
        onChange={updateSelection}
        placeholder={t("orders2b1.accessory.select")}
        compact={compact}
        className={cn(
          quickChoices &&
            "absolute -top-6 right-0 h-5 max-w-[60%] border-0 bg-transparent px-0 text-[10px] text-primary shadow-none",
          triggerClassName,
        )}
        contentClassName={contentClassName}
        exclusiveValues={["无"]}
        renderSummary={(selectedOptions) => {
          if (quickChoices) return t("orders2b1.accessory.select");
          if (!selectedOptions.length) return t("orders2b1.accessory.select");
          if (selectedOptions.length === 1) return selectedOptions[0]?.label;
          return t("orders2b1.accessory.summary", {
            first: selectedOptions[0]?.label ?? "",
            count: selectedOptions.length,
          });
        }}
      />
      {quickChoices &&
      (parsed.selected.some(
        (option) => !["SIM卡", "手机壳", "充电器", "数据线", "其他"].includes(option),
      ) ||
        parsed.customText) ? (
        <AccessoryNotesPills value={value} />
      ) : null}
      {customSelected && (
        <Input
          disabled={disabled}
          value={parsed.customText}
          onChange={(event) =>
            !disabledRef.current &&
            onChange(
              formatAccessoryNotes({
                selected: parsed.selected,
                customText: event.target.value,
              }),
            )
          }
          placeholder={t("orders2b1.accessory.customPlaceholder")}
          className={cn("h-8 text-base", compact && "h-7", quickChoices && "h-9")}
        />
      )}
    </div>
  );
}
