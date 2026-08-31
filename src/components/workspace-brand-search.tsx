"use client";

import { Search, Wrench } from "lucide-react";

import { appShell, brandGradientStyle } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export function WorkspaceBrandSearch({
  activeStoreName,
  onOpenCommand,
}: {
  activeStoreName: string;
  onOpenCommand: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="flex min-w-0 items-center gap-1">
      <div className={cn(appShell.sidebarBrand, "group-data-[collapsible=icon]:hidden")}>
        <div
          className="relative flex size-8 shrink-0 items-center justify-center rounded-lg text-primary-foreground shadow-[var(--shadow-action)]"
          style={brandGradientStyle}
        >
          <Wrench className="size-4" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
          <span className="truncate font-display text-sm font-semibold leading-5 tracking-tight">
            RepairDesk
          </span>
          <span className="truncate text-[11px] leading-4 text-muted-foreground">
            {activeStoreName}
          </span>
        </div>
      </div>
      <button
        type="button"
        aria-label={t("shell.openSearch")}
        title={t("shell.openSearchWithShortcut")}
        onClick={onOpenCommand}
        data-workspace-search-trigger="true"
        className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 group-data-[collapsible=icon]:mx-auto"
      >
        <Search className="size-4" aria-hidden="true" />
        <kbd className="sr-only">⌘K</kbd>
      </button>
    </div>
  );
}
