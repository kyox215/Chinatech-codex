"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { useTouchSafeDropdownTrigger } from "@/shared/lib/touch-safe-dropdown-trigger";

export function DenseOptionMenu({
  label,
  value,
  options,
  emptyText,
  onSelect,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly string[];
  emptyText?: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const normalizedValue = value.trim().toLowerCase();
  const touchSafeTrigger = useTouchSafeDropdownTrigger(setOpen);

  return (
    <DropdownMenu open={open && !disabled} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors [touch-action:pan-y] hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={t("orders2b1.new.chooseField", { label })}
          {...touchSafeTrigger}
        >
          <ChevronDown className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        collisionPadding={12}
        side="top"
        sideOffset={6}
        className="z-[90] max-h-[min(18rem,calc(100dvh_-_var(--rd-overlay-avoid-bottom,0px)_-_1rem))] w-[min(18rem,calc(100vw-24px))] overflow-y-auto rounded-xl p-1 shadow-[var(--shadow-overlay)]"
      >
        {options.length ? (
          options.map((option) => {
            const selected = option.trim().toLowerCase() === normalizedValue;
            return (
              <DropdownMenuItem
                key={option}
                disabled={disabled}
                onSelect={() => {
                  if (!disabledRef.current) onSelect(option);
                }}
                className={cn(
                  "min-h-9 gap-2 rounded-lg px-2.5 py-1 text-xs",
                  selected && "bg-primary/10 text-primary focus:bg-primary/10 focus:text-primary",
                )}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{option}</span>
                {selected ? <Check className="size-3.5 shrink-0" /> : null}
              </DropdownMenuItem>
            );
          })
        ) : (
          <DropdownMenuItem disabled className="min-h-9 rounded-lg px-2.5 py-1.5 text-xs">
            {emptyText ?? t("orders2b1.new.noOptions")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
