"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Delete, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { VirtualKeyboardDock } from "@/components/ui/virtual-keyboard-dock";
import { cn } from "@/lib/utils";
import {
  applyMoneyKeypadKey,
  normalizeMoneyKeypadDraft,
  type MoneyKeypadKey,
} from "@/shared/lib/mobile-input";

const moneyKeypadRows: MoneyKeypadKey[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "backspace"],
  ["clear", "00"],
];

export interface MoneyKeypadInputProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  align?: "left" | "right";
  currencySymbol?: string;
  className?: string;
  triggerClassName?: string;
  valueClassName?: string;
  contentClassName?: string;
}

export function MoneyKeypadInput({
  value,
  onChange,
  ariaLabel,
  placeholder = "0",
  disabled,
  invalid,
  align = "right",
  currencySymbol = "€",
  className,
  triggerClassName,
  valueClassName,
  contentClassName,
}: MoneyKeypadInputProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => normalizeMoneyKeypadDraft(value));
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) setDraft(normalizeMoneyKeypadDraft(value));
  }, [open, value]);

  const displayDraft = open ? draft : normalizeMoneyKeypadDraft(value);
  const displayValue = displayDraft || placeholder;

  const updateDraft = (key: MoneyKeypadKey) => {
    const nextDraft = applyMoneyKeypadKey(draft, key);
    setDraft(nextDraft);
    onChange(nextDraft);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (disabled) return;
    setOpen(nextOpen);
    if (nextOpen) setDraft(normalizeMoneyKeypadDraft(value));
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-money-keypad-trigger="true"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        className={cn(
          "grid h-9 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-1 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          invalid && "border-status-danger-foreground/50",
          className,
          triggerClassName,
        )}
        onClick={() => handleOpenChange(!open)}
      >
        <span className="shrink-0 font-mono text-muted-foreground">{currencySymbol}</span>
        <span
          className={cn(
            "min-w-0 truncate font-mono tabular-nums",
            align === "right" ? "text-right" : "text-left",
            displayDraft ? "text-foreground" : "text-muted-foreground",
            valueClassName,
          )}
        >
          {displayValue}
        </span>
      </button>
      <VirtualKeyboardDock
        open={open}
        onOpenChange={handleOpenChange}
        label={`${ariaLabel} 虚拟金额键盘`}
        triggerRef={triggerRef}
        panelClassName={contentClassName}
      >
        <div data-money-keypad="true">
          <div className="mb-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-1 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
            <span className="font-mono text-xs text-muted-foreground">{currencySymbol}</span>
            <span className="truncate text-right font-mono text-sm font-semibold tabular-nums">
              {draft || "0"}
            </span>
          </div>
          <div className="grid gap-1.5" role="group" aria-label={`${ariaLabel} 虚拟金额键盘`}>
            {moneyKeypadRows.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-3 gap-1.5">
                {row.map((key) => (
                  <KeypadButton key={key} keypadKey={key} onClick={() => updateDraft(key)} />
                ))}
                {row.length === 2 ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 rounded-lg text-xs font-semibold"
                    onClick={() => handleOpenChange(false)}
                    data-money-keypad-done="true"
                  >
                    <Check className="mr-1 size-3.5" />
                    完成
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </VirtualKeyboardDock>
    </>
  );
}

function KeypadButton({ keypadKey, onClick }: { keypadKey: MoneyKeypadKey; onClick: () => void }) {
  if (keypadKey === "backspace") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 rounded-lg"
        onClick={onClick}
        aria-label="删除最后一位金额"
        data-money-keypad-key={keypadKey}
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
        data-money-keypad-key={keypadKey}
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
      data-money-keypad-key={keypadKey}
    >
      {keypadKey}
    </Button>
  );
}
