"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { rankDeviceSuggestions, type DeviceSuggestion } from "../model/device-autocomplete";
import { useLocale } from "@/shared/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function DeviceIdentityAutocomplete({
  id,
  value,
  label,
  placeholder,
  className,
  options,
  onChange,
  onSelect,
}: {
  id: string;
  value: string;
  label: string;
  placeholder: string;
  className?: string;
  options: readonly DeviceSuggestion[];
  onChange: (value: string) => void;
  onSelect: (option: DeviceSuggestion) => void;
}) {
  const { t } = useLocale();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [active, setActive] = useState(0);
  const composing = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const choices = rankDeviceSuggestions(options, showAll ? "" : value).slice(0, 40);
  const activeIndex = Math.min(active, Math.max(0, choices.length - 1));
  useEffect(() => {
    if (open)
      document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, listId, open]);
  const choose = (option: DeviceSuggestion) => {
    if (input.current?.matches(":disabled")) return;
    onSelect(option);
    setOpen(false);
    input.current?.focus({ preventScroll: true });
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative flex h-full min-w-0 items-center">
          <Input
            ref={input}
            id={id}
            value={value}
            placeholder={placeholder}
            className={cn(className, "min-w-0 pr-9")}
            role="combobox"
            aria-label={label}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open && choices.length ? `${listId}-${activeIndex}` : undefined}
            autoComplete="off"
            onFocus={() => {
              setShowAll(false);
              setOpen(Boolean(value.trim()));
            }}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              onChange(event.currentTarget.value);
              setActive(0);
              setOpen(true);
            }}
            onChange={(event) => {
              onChange(event.target.value);
              setShowAll(false);
              setActive(0);
              if (!composing.current) setOpen(Boolean(event.target.value.trim()));
            }}
            onKeyDown={(event) => {
              if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229)
                return;
              if (event.key === "Escape" && open) {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                return;
              }
              if (event.key === "Tab") {
                setOpen(false);
                return;
              }
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setOpen(true);
                setActive((current) =>
                  !open
                    ? 0
                    : Math.max(
                        0,
                        Math.min(
                          choices.length - 1,
                          current + (event.key === "ArrowDown" ? 1 : -1),
                        ),
                      ),
                );
              }
              if (event.key === "Enter" && open) {
                event.preventDefault();
                event.stopPropagation();
                if (choices[activeIndex]) choose(choices[activeIndex]);
                else setOpen(false);
              }
            }}
          />
          <button
            type="button"
            aria-label={t("orders2b1.new.chooseField", { label })}
            aria-expanded={open}
            className="absolute right-0 grid size-9 place-items-center rounded-lg text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              const nextOpen = !open;
              input.current?.focus({ preventScroll: true });
              setShowAll(true);
              setActive(0);
              setOpen(nextOpen);
            }}
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        collisionPadding={12}
        className="z-[90] max-h-[min(18rem,var(--radix-popover-content-available-height))] w-[max(var(--radix-popover-trigger-width),16rem)] max-w-[calc(100vw-24px)] overflow-y-auto p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (event.target === input.current) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
      >
        <div id={listId} role="listbox" aria-label={label}>
          {choices.length ? (
            choices.map((option, index) => (
              <button
                id={`${listId}-${index}`}
                key={option.value}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                tabIndex={-1}
                className={cn(
                  "flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm",
                  index === activeIndex && "bg-primary/10 text-primary",
                )}
                onPointerDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
              >
                {option.value}
              </button>
            ))
          ) : (
            <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
              {t("orders2b1.new.noModelMatch")}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
