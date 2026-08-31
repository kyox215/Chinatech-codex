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
  const scrollPositionRef = useRef({ x: 0, y: 0 });
  const restoreScrollPosition = () => {
    const scrollPosition = scrollPositionRef.current;
    window.requestAnimationFrame(() => {
      window.scrollTo(scrollPosition.x, scrollPosition.y);
      window.requestAnimationFrame(() => window.scrollTo(scrollPosition.x, scrollPosition.y));
    });
  };
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) scrollPositionRef.current = { x: window.scrollX, y: window.scrollY };
    setOpen(nextOpen);
    if (!nextOpen) restoreScrollPosition();
  };

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-11 shrink-0", className)}
          aria-label={t("locale.menuLabel")}
          title={t("locale.menuLabel")}
          data-language-switcher-trigger="true"
        >
          <Languages className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 max-w-[calc(100vw-24px)]">
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
