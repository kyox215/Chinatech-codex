"use client";

import { appShell } from "@/lib/ui-patterns";
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
    <div className="workbench-brand-search" data-scheme-three-brand-search="true">
      <div className={appShell.sidebarBrand} title={activeStoreName}>
        <span className="scheme-three-brandmark" aria-hidden="true">
          R
        </span>
        <strong className="scheme-three-brandname group-data-[collapsible=icon]:hidden">
          RepairDesk
        </strong>
      </div>
      <button
        type="button"
        aria-label={t("shell.openSearch")}
        title={t("shell.openSearchWithShortcut")}
        onClick={onOpenCommand}
        data-workspace-search-trigger="true"
        className="scheme-three-global-search min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span>{t("shell.searchLabel")}</span>
        <kbd className="group-data-[collapsible=icon]:hidden" aria-hidden="true">
          ⌘ K
        </kbd>
      </button>
    </div>
  );
}
