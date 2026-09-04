"use client";

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
}: {
  value?: string | null;
  onChange: (value: string) => void;
  compact?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
}) {
  const { t } = useLocale();
  const parsed = parseAccessoryNotes(value);
  const customSelected = parsed.selected.includes("其他");

  const updateSelection = (nextSelected: AccessoryNoteOption[]) => {
    onChange(
      formatAccessoryNotes({
        selected: nextSelected,
        customText: nextSelected.includes("其他") ? parsed.customText : "",
      }),
    );
  };

  return (
    <div className={cn("min-w-0 space-y-1.5", compact && "space-y-1")}>
      <MultiSelectDropdown<AccessoryNoteOption>
        options={ACCESSORY_NOTE_OPTIONS.map((option) => ({
          value: option,
          label: localizeAccessoryNoteOption(option, t),
        }))}
        value={parsed.selected}
        onChange={updateSelection}
        placeholder={t("orders2b1.accessory.select")}
        compact={compact}
        className={triggerClassName}
        contentClassName={contentClassName}
        exclusiveValues={["无"]}
        renderSummary={(selectedOptions) => {
          if (!selectedOptions.length) return t("orders2b1.accessory.select");
          if (selectedOptions.length === 1) return selectedOptions[0]?.label;
          return t("orders2b1.accessory.summary", {
            first: selectedOptions[0]?.label ?? "",
            count: selectedOptions.length,
          });
        }}
      />
      {customSelected && (
        <Input
          value={parsed.customText}
          onChange={(event) =>
            onChange(
              formatAccessoryNotes({
                selected: parsed.selected,
                customText: event.target.value,
              }),
            )
          }
          placeholder={t("orders2b1.accessory.customPlaceholder")}
          className={cn("h-8 text-xs", compact && "h-7")}
        />
      )}
    </div>
  );
}
