"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, Delete, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { VirtualKeyboardDock } from "@/components/ui/virtual-keyboard-dock";
import { useKeypadControlGuard } from "@/hooks/use-keypad-control-guard";
import { useVirtualKeyboardSurface } from "@/hooks/use-virtual-keyboard-surface";
import { cn } from "@/lib/utils";
import {
  applyMoneyKeypadKey,
  decimalKeyboardProps,
  normalizeMoneyKeypadDraft,
  type MoneyKeypadKey,
} from "@/shared/lib/mobile-input";
import { useLocale } from "@/shared/i18n/locale-provider";

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
  readOnly?: boolean;
  invalid?: boolean;
  align?: "left" | "right";
  currencySymbol?: string;
  className?: string;
  triggerClassName?: string;
  valueClassName?: string;
  contentClassName?: string;
  keyboardMode?: "native";
  layout?: "default" | "quote-editor";
}

export function MoneyKeypadInput({
  value,
  onChange,
  ariaLabel,
  placeholder = "0",
  disabled,
  readOnly,
  invalid,
  align = "right",
  currencySymbol = "€",
  className,
  triggerClassName,
  valueClassName,
  contentClassName,
  keyboardMode,
  layout = "default",
}: MoneyKeypadInputProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => normalizeMoneyKeypadDraft(value));
  const [nativeEditing, setNativeEditing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const nativeInputRef = useRef<HTMLInputElement | null>(null);
  const preferredKeyboardSurface = useVirtualKeyboardSurface();
  const keyboardSurface = keyboardMode === "native" ? "native" : preferredKeyboardSurface;
  const quoteEditorLayout = layout === "quote-editor";

  useEffect(() => {
    if (!open && !nativeEditing) setDraft(normalizeMoneyKeypadDraft(value));
  }, [nativeEditing, open, value]);

  useEffect(() => {
    if (keyboardSurface !== "native" || !open) return;
    setOpen(false);
    queueMicrotask(() => nativeInputRef.current?.focus());
  }, [keyboardSurface, open]);

  const canEdit = useKeypadControlGuard({
    controlRef: triggerRef,
    open,
    disabled,
    readOnly,
    onClose: () => setOpen(false),
  });

  const displayDraft = open ? draft : normalizeMoneyKeypadDraft(value);
  const displayValue = displayDraft || placeholder;

  const updateDraft = (key: MoneyKeypadKey) => {
    if (!canEdit()) return;
    const nextDraft = applyMoneyKeypadKey(draft, key);
    setDraft(nextDraft);
    onChange(nextDraft);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && !canEdit()) return;
    setOpen(nextOpen);
    if (nextOpen) setDraft(normalizeMoneyKeypadDraft(value));
  };

  const handlePhysicalKey = (event: KeyboardEvent<HTMLElement>) => {
    if (!canEdit() || event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (open && (event.key === "Enter" || event.key === "Escape")) {
      event.preventDefault();
      event.stopPropagation();
      handleOpenChange(false);
      triggerRef.current?.focus();
      return;
    }

    const key: MoneyKeypadKey | undefined = /^\d$/.test(event.key)
      ? (event.key as MoneyKeypadKey)
      : event.key === "." || event.key === ","
        ? "."
        : event.key === "Backspace"
          ? "backspace"
          : event.key === "Delete"
            ? "clear"
            : undefined;
    if (!key) return;

    event.preventDefault();
    event.stopPropagation();
    updateDraft(key);
  };

  if (keyboardSurface === "native") {
    return (
      <div
        data-money-keypad-native-input="true"
        className={cn(
          "grid h-9 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-1 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-within:outline-none focus-within:ring-1 focus-within:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          invalid && "border-status-danger-foreground/50",
          className,
          triggerClassName,
        )}
      >
        <span className="shrink-0 font-mono text-muted-foreground">{currencySymbol}</span>
        <input
          ref={nativeInputRef}
          {...decimalKeyboardProps}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          readOnly={readOnly}
          value={nativeEditing ? draft : normalizeMoneyKeypadDraft(value)}
          placeholder={placeholder}
          className={cn(
            "h-full w-full min-w-0 border-0 bg-transparent px-0 font-mono tabular-nums shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
            align === "right" ? "text-right" : "text-left",
            valueClassName,
          )}
          onFocus={() => {
            setDraft(normalizeMoneyKeypadDraft(value));
            setNativeEditing(true);
          }}
          onBlur={() => setNativeEditing(false)}
          onChange={(event) => {
            const next = normalizeMoneyKeypadDraft(event.target.value);
            setDraft(next);
            onChange(next);
          }}
        />
      </div>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-money-keypad-trigger="true"
        data-keypad-active={open || undefined}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        disabled={disabled || readOnly}
        className={cn(
          "data-[keypad-active=true]:border-primary data-[keypad-active=true]:bg-primary/5 data-[keypad-active=true]:ring-1 data-[keypad-active=true]:ring-primary/25",
          "grid h-9 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-1 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          invalid && "border-status-danger-foreground/50",
          className,
          triggerClassName,
        )}
        onClick={() => {
          triggerRef.current?.focus();
          handleOpenChange(!open);
        }}
        onKeyDown={handlePhysicalKey}
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
        label={t("orders2b1.keypad.moneyLabel", { label: ariaLabel })}
        triggerRef={triggerRef}
        panelClassName={cn(
          quoteEditorLayout &&
            "w-[min(100%,calc(100vw-8px))] max-w-full rounded-2xl p-2.5 sm:w-[min(620px,calc(100vw-32px))] sm:p-3",
          contentClassName,
        )}
      >
        <div
          data-money-keypad="true"
          data-money-keypad-layout={layout}
          onKeyDown={handlePhysicalKey}
          onClick={() => triggerRef.current?.focus()}
        >
          <div
            className={cn(
              "mb-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-1 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5",
              quoteEditorLayout && "mb-2.5 min-h-10 rounded-xl px-3 py-2 sm:min-h-11",
            )}
          >
            <span
              className={cn(
                "font-mono text-xs text-muted-foreground",
                quoteEditorLayout && "text-sm",
              )}
            >
              {currencySymbol}
            </span>
            <span
              className={cn(
                "truncate text-right font-mono text-sm font-semibold tabular-nums",
                quoteEditorLayout && "text-base sm:text-lg",
              )}
            >
              {draft || placeholder}
            </span>
          </div>
          <div
            className={cn("grid gap-1.5", quoteEditorLayout && "gap-2 sm:gap-2.5")}
            role="group"
            aria-label={t("orders2b1.keypad.moneyLabel", { label: ariaLabel })}
          >
            {moneyKeypadRows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className={cn("grid grid-cols-3 gap-1.5", quoteEditorLayout && "gap-2 sm:gap-2.5")}
              >
                {row.map((key) => (
                  <KeypadButton
                    key={key}
                    keypadKey={key}
                    spacious={quoteEditorLayout}
                    onClick={() => updateDraft(key)}
                  />
                ))}
                {row.length === 2 ? (
                  <Button
                    type="button"
                    size="sm"
                    className={cn(
                      "h-10 rounded-lg text-xs font-semibold",
                      quoteEditorLayout && "h-12 rounded-xl text-sm sm:h-14 sm:text-base",
                    )}
                    onClick={() => handleOpenChange(false)}
                    data-money-keypad-done="true"
                  >
                    <Check className={cn("mr-1 size-3.5", quoteEditorLayout && "size-4")} />
                    {t("orders2b1.keypad.done")}
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

function KeypadButton({
  keypadKey,
  spacious,
  onClick,
}: {
  keypadKey: MoneyKeypadKey;
  spacious?: boolean;
  onClick: () => void;
}) {
  const { t } = useLocale();
  if (keypadKey === "backspace") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("h-10 rounded-lg", spacious && "h-12 rounded-xl sm:h-14")}
        onClick={onClick}
        aria-label={t("orders2b1.keypad.deleteAmount")}
        data-money-keypad-key={keypadKey}
      >
        <Delete className={cn("size-4", spacious && "sm:size-5")} />
      </Button>
    );
  }

  if (keypadKey === "clear") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "h-10 rounded-lg text-xs font-semibold",
          spacious && "h-12 rounded-xl text-sm sm:h-14 sm:text-base",
        )}
        onClick={onClick}
        data-money-keypad-key={keypadKey}
      >
        <RotateCcw className={cn("mr-1 size-3.5", spacious && "size-4")} />
        {t("orders2b1.keypad.clear")}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "h-10 rounded-lg font-mono text-base font-semibold tabular-nums",
        spacious && "h-12 rounded-xl text-lg sm:h-14 sm:text-xl",
      )}
      onClick={onClick}
      data-money-keypad-key={keypadKey}
    >
      {keypadKey}
    </Button>
  );
}
