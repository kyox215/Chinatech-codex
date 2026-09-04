"use client";

import { useCallback, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsCompactWorkspace } from "@/hooks/use-mobile";
import { componentDensity, componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export type InventorySelectableFieldMode = "auto" | "desktop" | "mobile";

export type InventorySelectableFieldOption = {
  value: string;
  label?: string;
  description?: string;
  disabled?: boolean;
  leading?: ReactNode;
};

export type InventorySelectableFieldProps = {
  id: string;
  label: string;
  value?: string;
  placeholder?: string;
  options: readonly InventorySelectableFieldOption[];
  onChange: (value: string) => void;
  mode?: InventorySelectableFieldMode;
  disabled?: boolean;
  pending?: boolean;
  pendingMessage?: string;
  emptyMessage?: string;
  helperText?: string;
  required?: boolean;
  invalid?: boolean;
  ariaDescribedBy?: string;
  className?: string;
};

/**
 * Inventory-only disclosure adapter. The desktop Popover and mobile Sheet
 * branches intentionally have separate markup so neither viewport inherits
 * the other's interaction model.
 */
export function InventorySelectableField({
  id,
  label,
  value = "",
  placeholder,
  options,
  onChange,
  mode = "auto",
  disabled = false,
  pending = false,
  pendingMessage,
  emptyMessage,
  helperText,
  required = false,
  invalid = false,
  ariaDescribedBy,
  className,
}: InventorySelectableFieldProps) {
  const { t } = useLocale();
  const resolvedPlaceholder = placeholder ?? t("inventory2b4.quick.select.placeholder");
  const resolvedEmptyMessage = emptyMessage ?? t("inventory2b4.quick.select.empty");
  const compactWorkspace = useIsCompactWorkspace();
  const resolvedMode = mode === "auto" ? (compactWorkspace ? "mobile" : "desktop") : mode;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const listboxId = `${id}-options-${generatedId.replace(/:/g, "")}`;
  const isUnavailable = disabled || pending;
  const selectedOption = options.find((option) => option.value === value);
  const summaryValue = selectedOption?.label ?? value;

  const focusTrigger = useCallback(() => {
    queueMicrotask(() => triggerRef.current?.focus({ preventScroll: true }));
  }, []);

  const focusDesktopOption = useCallback(() => {
    const focusOption = (attemptsRemaining: number) => {
      const listbox = listboxRef.current;
      if (!listbox) {
        if (attemptsRemaining > 0) {
          window.setTimeout(() => focusOption(attemptsRemaining - 1), 0);
        }
        return;
      }
      const enabledOptions = Array.from(
        listbox.querySelectorAll<HTMLButtonElement>('[role="option"]:not([disabled])'),
      );
      if (enabledOptions.length === 0 && attemptsRemaining > 0) {
        window.setTimeout(() => focusOption(attemptsRemaining - 1), 0);
        return;
      }
      const selectedOption = enabledOptions.find(
        (option) => option.getAttribute("aria-selected") === "true",
      );
      (selectedOption ?? enabledOptions[0] ?? listbox).focus({ preventScroll: true });
    };
    window.setTimeout(() => focusOption(1), 0);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) focusTrigger();
    },
    [focusTrigger],
  );

  const choose = useCallback(
    (option: InventorySelectableFieldOption) => {
      if (isUnavailable || option.disabled) return;
      onChange(option.value);
      handleOpenChange(false);
    },
    [handleOpenChange, isUnavailable, onChange],
  );

  const handleListboxKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      handleOpenChange(false);
      return;
    }

    if (!(["ArrowDown", "ArrowUp", "Home", "End"] as string[]).includes(event.key)) return;
    const listbox = listboxRef.current;
    if (!listbox) return;
    const enabledOptions = Array.from(
      listbox.querySelectorAll<HTMLButtonElement>('[role="option"]:not([disabled])'),
    );
    if (enabledOptions.length === 0) return;

    const activeElement = listbox.ownerDocument.activeElement;
    const currentIndex = enabledOptions.indexOf(activeElement as HTMLButtonElement);
    const fallbackIndex =
      event.key === "ArrowUp" || event.key === "End" ? enabledOptions.length - 1 : 0;
    let nextIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
    if (event.key === "ArrowDown") nextIndex = (nextIndex + 1) % enabledOptions.length;
    if (event.key === "ArrowUp")
      nextIndex = (nextIndex - 1 + enabledOptions.length) % enabledOptions.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = enabledOptions.length - 1;

    event.preventDefault();
    enabledOptions[nextIndex]?.focus({ preventScroll: true });
  };

  const trigger = (
    <button
      id={id}
      ref={triggerRef}
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      aria-invalid={invalid || undefined}
      aria-required={required || undefined}
      aria-label={
        summaryValue
          ? t("inventory2b4.quick.select.valueAria", { label, value: summaryValue })
          : resolvedPlaceholder
      }
      aria-describedby={ariaDescribedBy}
      disabled={isUnavailable}
      data-inventory-selectable-field-trigger
      data-inventory-selectable-field-mode={resolvedMode}
      className={cn(
        "inline-flex w-full items-center rounded-md border border-input bg-background text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        componentDensity.compactSelector.trigger,
        invalid && "border-destructive",
      )}
      onClick={() => setOpen(true)}
    >
      <span
        className={cn(
          componentDensity.compactSelector.triggerValue,
          !value && "text-muted-foreground",
        )}
      >
        {summaryValue || resolvedPlaceholder}
      </span>
      <ChevronDown aria-hidden="true" className="ml-2 size-4 shrink-0 text-muted-foreground" />
    </button>
  );

  const listbox = (
    <div
      id={listboxId}
      ref={listboxRef}
      role="listbox"
      aria-label={t("inventory2b4.quick.select.optionsAria", { label })}
      tabIndex={-1}
      data-inventory-selectable-field-listbox
      onKeyDown={handleListboxKeyDown}
      className="min-w-0 overflow-y-auto overscroll-contain"
    >
      {options.length > 0 ? (
        <div className="grid min-w-0 gap-1">
          {options.map((option) => {
            const selected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={option.label ?? option.value}
                disabled={isUnavailable || option.disabled}
                data-inventory-selectable-field-option
                className={cn(
                  "flex w-full min-w-0 items-start rounded-md border border-transparent px-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                  componentDensity.compactSelector.option,
                  selected && "border-primary bg-primary/10 text-foreground",
                )}
                onClick={() => choose(option)}
              >
                {option.leading ? <span className="mt-0.5 shrink-0">{option.leading}</span> : null}
                <span className={componentDensity.compactSelector.optionValue}>
                  {option.label ?? option.value}
                  {option.description ? (
                    <span className="block text-[11px] text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </span>
                {selected ? (
                  <Check aria-hidden="true" className="ml-auto size-4 shrink-0 text-primary" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <p role="status" className="px-3 py-4 text-sm text-muted-foreground">
          {pendingMessage ?? resolvedEmptyMessage}
        </p>
      )}
    </div>
  );

  return (
    <div className={cn("min-w-0 space-y-1.5", className)} data-inventory-selectable-field>
      <Label htmlFor={id}>{label}</Label>
      {resolvedMode === "mobile" ? (
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <div>{trigger}</div>
          <SheetContent
            side="bottom"
            className={cn(componentOverlay.bottomSheet, "flex min-h-0 flex-col gap-0")}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              queueMicrotask(() => listboxRef.current?.focus({ preventScroll: true }));
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              focusTrigger();
            }}
          >
            <SheetHeader className={componentOverlay.mobileHeader}>
              <SheetTitle className="text-left text-base">{label}</SheetTitle>
              <SheetDescription className="text-left">
                {pendingMessage ??
                  helperText ??
                  t("inventory2b4.quick.select.closesAfterSelection")}
              </SheetDescription>
            </SheetHeader>
            <div
              data-inventory-selectable-field-surface="mobile"
              className="min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
            >
              {listbox}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            align="start"
            aria-label={t("inventory2b4.quick.select.optionsAria", { label })}
            className={cn(
              componentOverlay.popoverContent,
              "max-h-72 w-[min(22rem,calc(100vw-24px))] p-2",
            )}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              focusDesktopOption();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              focusTrigger();
            }}
          >
            <div data-inventory-selectable-field-surface="desktop">{listbox}</div>
          </PopoverContent>
        </Popover>
      )}
      {pending || helperText ? (
        <p
          role={pending ? "status" : undefined}
          className={cn(
            componentDensity.compactSelector.helper,
            pending && "text-status-warn-foreground",
          )}
        >
          {pendingMessage ?? helperText}
        </p>
      ) : null}
    </div>
  );
}
