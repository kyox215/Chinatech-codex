"use client";

import { Languages } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_LOCALES, localeDisplayNames, type AppLocale } from "@/shared/i18n/locales";
import { useLocale } from "@/shared/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const scrollPositionRef = useRef({ x: 0, y: 0 });
  const openingScrollCapturedRef = useRef(false);
  const interactedOutsideRef = useRef(false);
  const captureOpeningScrollPosition = () => {
    if (open) return;
    scrollPositionRef.current = { x: window.scrollX, y: window.scrollY };
    openingScrollCapturedRef.current = true;
  };
  const restoreScrollPosition = () => {
    const scrollPosition = { ...scrollPositionRef.current };
    window.requestAnimationFrame(() => {
      window.scrollTo(scrollPosition.x, scrollPosition.y);
      window.requestAnimationFrame(() => window.scrollTo(scrollPosition.x, scrollPosition.y));
    });
  };
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) interactedOutsideRef.current = false;
    if (nextOpen && !openingScrollCapturedRef.current) captureOpeningScrollPosition();
    setOpen(nextOpen);
    if (!nextOpen) {
      if (!interactedOutsideRef.current) restoreScrollPosition();
      openingScrollCapturedRef.current = false;
    }
  };

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-11 shrink-0", className)}
          aria-label={t("locale.menuLabel")}
          title={t("locale.menuLabel")}
          data-language-switcher-trigger="true"
          onPointerDownCapture={(event) => {
            if (event.button === 0 && !event.ctrlKey) captureOpeningScrollPosition();
          }}
          onKeyDownCapture={(event) => {
            if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
              captureOpeningScrollPosition();
            }
          }}
        >
          <Languages className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 max-w-[calc(100vw-24px)]"
        onInteractOutside={() => {
          interactedOutsideRef.current = true;
        }}
        onCloseAutoFocus={(event) => {
          const interactedOutside = interactedOutsideRef.current;
          interactedOutsideRef.current = false;
          if (interactedOutside) return;
          event.preventDefault();
          triggerRef.current?.focus({ preventScroll: true });
        }}
      >
        <DropdownMenuLabel>{t("locale.menuLabel")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => setLocale(value as AppLocale)}
        >
          {APP_LOCALES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} className="min-h-11">
              <span lang={option}>{localeDisplayNames[option]}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
