"use client";

import { Input } from "@/components/ui/input";
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";
import {
  ACCESSORY_NOTE_OPTIONS,
  formatAccessoryNotes,
  parseAccessoryNotes,
  type AccessoryNoteOption,
} from "@/features/orders/model/order-accessory-notes";
import { cn } from "@/lib/utils";

export function AccessoryNotesPills({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  const parsed = parseAccessoryNotes(value);
  const labels = [
    ...parsed.selected.filter((option) => option !== "其他"),
    ...(parsed.customText
      ? [`其他：${parsed.customText}`]
      : parsed.selected.includes("其他")
        ? ["其他"]
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
}: {
  value?: string | null;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
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
        options={ACCESSORY_NOTE_OPTIONS.map((option) => ({ value: option, label: option }))}
        value={parsed.selected}
        onChange={updateSelection}
        placeholder="选择留存物品"
        compact={compact}
        exclusiveValues={["无"]}
        renderSummary={(selectedOptions) => {
          if (!selectedOptions.length) return "选择留存物品";
          if (selectedOptions.length === 1) return selectedOptions[0]?.label;
          return `${selectedOptions[0]?.label}等${selectedOptions.length}项`;
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
          placeholder="补充其他留存物品"
          className={cn("h-8 text-xs", compact && "h-7")}
        />
      )}
    </div>
  );
}
