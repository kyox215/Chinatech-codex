"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { Check, Delete, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  applyPhoneKeypadKey,
  normalizePhoneKeypadDraft,
  type PhoneKeypadKey,
} from "@/shared/lib/mobile-input";

const phoneKeypadRows: PhoneKeypadKey[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["+39", "0", "backspace"],
  ["clear"],
];

export interface PhoneKeypadInputProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  valueClassName?: string;
  contentClassName?: string;
  side?: "top" | "bottom";
  avoidCollisions?: boolean;
  ariaControls?: string;
  ariaExpanded?: boolean;
  ariaActiveDescendant?: string;
  onOpenChange?: (open: boolean) => void;
}

export function PhoneKeypadInput({
  value,
  onChange,
  ariaLabel,
  placeholder = "输入电话号码",
  disabled,
  className,
  triggerClassName,
  valueClassName,
  contentClassName,
  side = "bottom",
  avoidCollisions = true,
  ariaControls,
  ariaExpanded,
  ariaActiveDescendant,
  onOpenChange,
}: PhoneKeypadInputProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => normalizePhoneKeypadDraft(value));

  useEffect(() => {
    if (!open) setDraft(normalizePhoneKeypadDraft(value));
  }, [open, value]);

  const displayDraft = open ? draft : normalizePhoneKeypadDraft(value);
  const displayValue = displayDraft || placeholder;

  const setOpenState = (nextOpen: boolean) => {
    if (disabled) return;
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
    if (nextOpen) setDraft(normalizePhoneKeypadDraft(value));
  };

  const updateDraft = (key: PhoneKeypadKey) => {
    const nextDraft = applyPhoneKeypadKey(draft, key);
    setDraft(nextDraft);
    onChange(nextDraft);
  };

  const handlePhysicalKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      updateDraft(event.key as PhoneKeypadKey);
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      updateDraft("backspace");
      return;
    }
    if (event.key === "Delete") {
      event.preventDefault();
      updateDraft("clear");
      return;
    }
    if (event.key === "Enter") setOpenState(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpenState}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-phone-keypad-trigger="true"
          aria-label={ariaLabel}
          aria-controls={ariaControls}
          aria-expanded={ariaExpanded}
          aria-activedescendant={ariaActiveDescendant}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full min-w-0 items-center rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className,
            triggerClassName,
          )}
          onKeyDown={handlePhysicalKey}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-left font-mono tabular-nums",
              displayDraft ? "text-foreground" : "text-muted-foreground",
              valueClassName,
            )}
          >
            {displayValue}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side={side}
        sideOffset={6}
        collisionPadding={12}
        avoidCollisions={avoidCollisions}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className={cn(
          "z-[120] w-[min(19rem,calc(100vw-24px))] rounded-xl border-[var(--border-panel)] bg-card p-2 shadow-[var(--shadow-overlay)]",
          contentClassName,
        )}
        data-phone-keypad="true"
      >
        <div className="mb-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-right font-mono text-sm font-semibold tabular-nums">
          {draft || "0"}
        </div>
        <div className="grid gap-1.5" role="group" aria-label={`${ariaLabel} 虚拟数字键盘`}>
          {phoneKeypadRows.map((row, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-3 gap-1.5">
              {row.map((key) => (
                <PhoneKeypadButton key={key} keypadKey={key} onClick={() => updateDraft(key)} />
              ))}
              {row.length === 1 ? (
                <Button
                  type="button"
                  size="sm"
                  className="col-span-2 h-10 rounded-lg text-xs font-semibold"
                  onClick={() => setOpenState(false)}
                  data-phone-keypad-done="true"
                >
                  <Check className="mr-1 size-3.5" />
                  完成
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PhoneKeypadButton({
  keypadKey,
  onClick,
}: {
  keypadKey: PhoneKeypadKey;
  onClick: () => void;
}) {
  if (keypadKey === "backspace") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 rounded-lg"
        onClick={onClick}
        aria-label="删除最后一位电话号码"
        data-phone-keypad-key={keypadKey}
      >
        <Delete className="size-4" />
      </Button>
    );
  }

  if (keypadKey === "clear") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 rounded-lg text-xs font-semibold"
        onClick={onClick}
        data-phone-keypad-key={keypadKey}
      >
        <RotateCcw className="mr-1 size-3.5" />
        清空
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-10 rounded-lg font-mono text-base font-semibold tabular-nums"
      onClick={onClick}
      data-phone-keypad-key={keypadKey}
    >
      {keypadKey}
    </Button>
  );
}
