"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Search, ShieldCheck, type LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { RepairOsBadge, RepairOsBusinessCard } from "@/shared/ui";
import type { SettingsNavigationGroup } from "@/features/settings/components/settings-navigation";
import type { SettingsSectionKey } from "@/features/settings/model/settings-section-access";
import { sortSettingsCoreSections } from "@/features/settings/model/settings-section-registry";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export interface SettingsOverviewReadiness {
  state: "loading" | "ready" | "error" | "unavailable";
  score?: number;
}

export interface SettingsOverviewScreenProps {
  groups: readonly SettingsNavigationGroup[];
  isPlatformAdmin?: boolean;
  /** Compatibility props retained while the overview no longer renders metrics. */
  activeStoreName?: string;
  accessibleSectionCount?: number;
  totalSectionCount?: number;
  readiness?: SettingsOverviewReadiness;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onBeforeNavigate?: (section: SettingsSectionKey) => boolean;
}

export function SettingsOverviewScreen({
  groups,
  isPlatformAdmin = false,
  searchValue,
  onSearchValueChange,
  onBeforeNavigate,
}: SettingsOverviewScreenProps) {
  const { t } = useLocale();
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(searchValue.trim()));
  const allItems = groups.flatMap((group) => group.items);
  const coreItems = filterItems(
    sortSettingsCoreSections(
      allItems.filter(
        (item) =>
          item.tier === "core" &&
          item.showInDefaultNavigation &&
          (item.access === "editable" || item.access === "readonly"),
      ),
    ),
    searchValue,
  ).slice(0, 4);
  const advancedItems = filterItems(
    allItems.filter(
      (item) =>
        item.tier === "advanced" &&
        item.showInDefaultNavigation &&
        (item.access === "editable" || item.access === "readonly"),
    ),
    searchValue,
  );
  const visiblePlatformTools = filterOverviewDestinations(
    isPlatformAdmin
      ? [
          {
            label: t("settings.overview.platformApproval"),
            description: t("settings.overview.platformApprovalDescription"),
            href: "/platform",
            icon: ShieldCheck,
            keywords: t("settings.overview.platformApprovalKeywords").split("|"),
          },
        ]
      : [],
    searchValue,
  );

  useEffect(() => {
    if (searchValue.trim()) setAdvancedOpen(true);
  }, [searchValue]);

  const hasResults =
    coreItems.length > 0 || advancedItems.length > 0 || visiblePlatformTools.length > 0;

  return (
    <div data-settings-overview className="min-w-0 space-y-3">
      <p data-settings-overview-guide className="px-1 text-xs leading-5 text-muted-foreground">
        {t("settings.overview.guide")}
      </p>

      <div className="relative min-w-0 lg:hidden">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <label htmlFor="settings-overview-search" className="sr-only">
          {t("settings.overview.search")}
        </label>
        <Input
          id="settings-overview-search"
          value={searchValue}
          onChange={(event) => onSearchValueChange(event.target.value)}
          placeholder={t("settings.overview.search")}
          className="h-[38px] pl-9 text-base"
        />
      </div>

      {coreItems.length > 0 ? (
        <SettingsOverviewGroup
          id="settings-overview-core"
          title={t("settings.overview.core")}
          items={coreItems}
          onBeforeNavigate={onBeforeNavigate}
        />
      ) : null}

      {advancedItems.length > 0 ? (
        <section aria-labelledby="settings-overview-advanced">
          <button
            type="button"
            id="settings-overview-advanced"
            data-settings-overview-more-toggle
            aria-expanded={advancedOpen}
            aria-controls="settings-overview-advanced-content"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-[var(--border-panel)] bg-card px-3 py-2 text-left text-sm font-semibold text-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 flex-1">{t("settings.overview.more")}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {t("settings.overview.availableCount", { count: advancedItems.length })}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn("size-4 shrink-0 transition-transform", advancedOpen && "rotate-180")}
            />
          </button>
          <div id="settings-overview-advanced-content" hidden={!advancedOpen} className="mt-2">
            {advancedOpen ? (
              <SettingsOverviewCards items={advancedItems} onBeforeNavigate={onBeforeNavigate} />
            ) : null}
          </div>
        </section>
      ) : null}

      {visiblePlatformTools.length > 0 ? (
        <SettingsOverviewGroup
          id="settings-overview-platform"
          title={t("settings.overview.platformTools")}
          items={visiblePlatformTools}
          onBeforeNavigate={onBeforeNavigate}
        />
      ) : null}

      {!hasResults ? (
        <RepairOsBusinessCard as="div" className="min-h-24 place-items-center text-center">
          <span className="text-sm font-medium">{t("settings.overview.noMatches")}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {t("settings.overview.tryOther")}
          </span>
        </RepairOsBusinessCard>
      ) : null}
    </div>
  );
}

function SettingsOverviewGroup({
  id,
  title,
  items,
  onBeforeNavigate,
}: {
  id: string;
  title: string;
  items: readonly OverviewItem[];
  onBeforeNavigate?: (section: SettingsSectionKey) => boolean;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-1.5 px-1 text-xs font-semibold text-foreground">
        {title}
      </h2>
      <SettingsOverviewCards items={items} onBeforeNavigate={onBeforeNavigate} />
    </section>
  );
}

type OverviewItem =
  | SettingsNavigationGroup["items"][number]
  | {
      label: string;
      description: string;
      href: string;
      icon: LucideIcon;
      keywords: readonly string[];
    };

function SettingsOverviewCards({
  items,
  onBeforeNavigate,
}: {
  items: readonly OverviewItem[];
  onBeforeNavigate?: (section: SettingsSectionKey) => boolean;
}) {
  const { t } = useLocale();
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
      {items.map((item) => {
        const isSettingsItem = "key" in item;
        const Icon = item.icon;
        const href = item.href;
        return (
          <Link
            key={href}
            href={href}
            scroll={false}
            data-navigation-scroll="preserve"
            className="block min-h-11 min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => {
              if (isSettingsItem && onBeforeNavigate && !onBeforeNavigate(item.key)) {
                event.preventDefault();
              }
            }}
          >
            <RepairOsBusinessCard
              as="div"
              className="min-h-16 gap-2 px-3 py-2.5 transition-colors hover:bg-accent"
              leading={
                <span className="grid size-9 place-items-center rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-foreground">
                  <Icon className="size-4" />
                </span>
              }
              trailing={<ArrowRight className="size-4 text-muted-foreground" />}
              trailingClassName="self-center"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{item.label}</span>
                {isSettingsItem && item.access === "readonly" ? (
                  <RepairOsBadge className="shrink-0">
                    {t("settings.overview.readonly")}
                  </RepairOsBadge>
                ) : null}
              </span>
              <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
                {item.description}
              </span>
            </RepairOsBusinessCard>
          </Link>
        );
      })}
    </div>
  );
}

function filterOverviewDestinations(
  destinations: ReadonlyArray<Extract<OverviewItem, { href: string }>>,
  searchValue: string,
) {
  const query = searchValue.trim().toLocaleLowerCase();
  if (!query) return destinations;
  return destinations.filter((item) =>
    [item.label, item.description, ...item.keywords].join(" ").toLocaleLowerCase().includes(query),
  );
}

function filterItems<
  T extends {
    label: string;
    shortLabel?: string;
    description: string;
    keywords: readonly string[];
  },
>(items: readonly T[], searchValue: string) {
  const query = searchValue.trim().toLocaleLowerCase();
  if (!query) return items;
  return items.filter((item) =>
    [item.label, item.shortLabel, item.description, ...item.keywords]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(query),
  );
}
