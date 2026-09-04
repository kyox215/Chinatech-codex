"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import type { SettingsSectionDefinition } from "@/features/settings/model/settings-section-registry";
import type {
  SettingsSectionAccess,
  SettingsSectionKey,
} from "@/features/settings/model/settings-section-access";
import { sortSettingsCoreSections } from "@/features/settings/model/settings-section-registry";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export interface SettingsNavigationItem extends SettingsSectionDefinition {
  access: SettingsSectionAccess;
  dirty: boolean;
  summary?: string;
}

export interface SettingsNavigationGroup {
  key: SettingsSectionDefinition["group"];
  label: string;
  items: readonly SettingsNavigationItem[];
}

export interface SettingsNavigationProps {
  groups: readonly SettingsNavigationGroup[];
  activeSection: SettingsSectionKey | null;
  /** @deprecated Kept for callers that still own an overview search state. */
  searchValue?: string;
  /** @deprecated Search is no longer rendered in the settings rail. */
  onSearchValueChange?: (value: string) => void;
  onBeforeNavigate?: (section: SettingsSectionKey) => boolean;
}

/**
 * The settings rail intentionally has only one visible level. Historical
 * group labels and denied capabilities remain in the registry for deep links
 * and access checks, but they are not rendered as noisy disabled rows.
 */
export function SettingsNavigation({
  groups,
  activeSection,
  onBeforeNavigate,
}: SettingsNavigationProps) {
  const { t } = useLocale();
  const items = groups
    .flatMap((group) => group.items)
    .filter(
      (item) =>
        item.showInDefaultNavigation && (item.access === "editable" || item.access === "readonly"),
    );
  const coreItems = sortSettingsCoreSections(items.filter((item) => item.tier === "core"));
  const advancedItems = items.filter((item) => item.tier === "advanced");
  const activeAdvanced = advancedItems.some((item) => item.key === activeSection);
  const [advancedOpen, setAdvancedOpen] = useState(activeAdvanced);

  useEffect(() => {
    if (activeAdvanced) setAdvancedOpen(true);
  }, [activeAdvanced]);

  return (
    <nav
      aria-label={t("settings.navigation.aria")}
      data-settings-navigation
      className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-card p-2 shadow-[var(--shadow-card)]"
    >
      <div className="space-y-0.5">
        {coreItems.map((item) => (
          <SettingsNavigationRow
            key={item.key}
            item={item}
            active={activeSection === item.key}
            onBeforeNavigate={onBeforeNavigate}
            unsavedLabel={t("settings.navigation.unsaved")}
            readonlyLabel={t("settings.navigation.readonly")}
          />
        ))}
      </div>

      {advancedItems.length > 0 ? (
        <div className="mt-2 border-t border-[var(--border-panel)] pt-2">
          <button
            type="button"
            data-settings-more-toggle
            aria-expanded={advancedOpen}
            aria-controls="settings-advanced-navigation"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="flex min-h-9 w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 flex-1 truncate">{t("settings.navigation.more")}</span>
            <ChevronDown
              aria-hidden="true"
              className={cn("size-4 shrink-0 transition-transform", advancedOpen && "rotate-180")}
            />
          </button>
          <div
            id="settings-advanced-navigation"
            hidden={!advancedOpen}
            className="mt-0.5 space-y-0.5"
          >
            {advancedOpen
              ? advancedItems.map((item) => (
                  <SettingsNavigationRow
                    key={item.key}
                    item={item}
                    active={activeSection === item.key}
                    onBeforeNavigate={onBeforeNavigate}
                    unsavedLabel={t("settings.navigation.unsaved")}
                    readonlyLabel={t("settings.navigation.readonly")}
                  />
                ))
              : null}
          </div>
        </div>
      ) : null}
    </nav>
  );
}

function SettingsNavigationRow({
  item,
  active,
  onBeforeNavigate,
  unsavedLabel,
  readonlyLabel,
}: {
  item: SettingsNavigationItem;
  active: boolean;
  onBeforeNavigate?: (section: SettingsSectionKey) => boolean;
  unsavedLabel: string;
  readonlyLabel: string;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      scroll={false}
      data-navigation-scroll="preserve"
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        if (onBeforeNavigate && !onBeforeNavigate(item.key)) event.preventDefault();
      }}
      className={cn(
        "flex min-h-9 min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium">{item.label}</span>
          {item.dirty ? (
            <span className="shrink-0 text-[9px] font-semibold text-status-warn-foreground lg:text-[11px] lg:leading-4">
              {unsavedLabel}
            </span>
          ) : null}
          {item.access === "readonly" ? (
            <span className="shrink-0 text-[9px] text-muted-foreground lg:text-[11px] lg:leading-4">
              {readonlyLabel}
            </span>
          ) : null}
        </span>
        {item.summary ? (
          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
            {item.summary}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
