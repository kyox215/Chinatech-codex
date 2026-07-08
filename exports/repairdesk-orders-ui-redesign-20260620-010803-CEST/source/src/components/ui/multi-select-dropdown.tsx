"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type MultiSelectOption<TValue extends string = string> = {
  value: TValue;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type MultiSelectDropdownProps<TValue extends string = string> = {
  options: readonly MultiSelectOption<TValue>[];
  value: readonly TValue[];
  onChange: (value: TValue[]) => void;
  placeholder?: string;
  compact?: boolean;
  disabled?: boolean;
  exclusiveValues?: readonly TValue[];
  renderSummary?: (
    selectedOptions: MultiSelectOption<TValue>[],
    selectedValues: readonly TValue[],
  ) => ReactNode;
  className?: string;
  contentClassName?: string;
};

export function MultiSelectDropdown<TValue extends string = string>({
  options,
  value,
  onChange,
  placeholder = "请选择",
  compact = false,
  disabled = false,
  exclusiveValues = [],
  renderSummary,
  className,
  contentClassName,
}: MultiSelectDropdownProps<TValue>) {
  const selectedSet = new Set(value);
  const exclusiveSet = new Set(exclusiveValues);
  const selectedOptions = options.filter((option) => selectedSet.has(option.value));
  const summary =
    renderSummary?.(selectedOptions, value) ??
    (selectedOptions.length
      ? selectedOptions.map((option) => option.label).join("、")
      : placeholder);

  const toggleValue = (optionValue: TValue, checked: boolean) => {
    if (!checked) {
      onChange(value.filter((item) => item !== optionValue));
      return;
    }

    if (exclusiveSet.has(optionValue)) {
      onChange([optionValue]);
      return;
    }

    const next = value.filter((item) => !exclusiveSet.has(item) && item !== optionValue);
    onChange([...next, optionValue]);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "min-w-0 justify-between gap-2 px-2.5 text-left font-normal",
            compact ? "h-8 text-xs" : "h-9 text-sm",
            className,
          )}
        >
          <span
            className={cn("min-w-0 truncate", !selectedOptions.length && "text-muted-foreground")}
          >
            {summary}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn("w-[min(18rem,calc(100vw-24px))]", contentClassName)}
      >
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedSet.has(option.value)}
            disabled={option.disabled}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) => toggleValue(option.value, Boolean(checked))}
            className="min-h-8 gap-2"
          >
            <span className="min-w-0">
              <span className="block truncate">{option.label}</span>
              {option.description ? (
                <span className="block truncate text-[11px] text-muted-foreground">
                  {option.description}
                </span>
              ) : null}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
