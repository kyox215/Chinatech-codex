import Link from "next/link";
import { LayoutGrid, LockKeyhole, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import type {
  SettingsSectionDefinition,
  SettingsSectionGroupKey,
} from "@/features/settings/model/settings-section-registry";
import type {
  SettingsSectionAccess,
  SettingsSectionKey,
} from "@/features/settings/model/settings-section-access";
import { cn } from "@/lib/utils";

export interface SettingsNavigationItem extends SettingsSectionDefinition {
  access: SettingsSectionAccess;
  dirty: boolean;
  summary?: string;
}

export interface SettingsNavigationGroup {
  key: SettingsSectionGroupKey;
  label: string;
  items: readonly SettingsNavigationItem[];
}

export interface SettingsNavigationProps {
  groups: readonly SettingsNavigationGroup[];
  activeSection: SettingsSectionKey | null;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onBeforeNavigate?: (section: SettingsSectionKey) => boolean;
}

export function SettingsNavigation({
  groups,
  activeSection,
  searchValue,
  onSearchValueChange,
  onBeforeNavigate,
}: SettingsNavigationProps) {
  const visibleGroups = filterNavigationGroups(groups, searchValue);

  return (
    <nav
      aria-label="设置导航"
      className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-card p-2 shadow-[var(--shadow-card)]"
    >
      <div className="relative mb-2 min-w-0">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <label htmlFor="settings-rail-search" className="sr-only">
          搜索设置
        </label>
        <Input
          id="settings-rail-search"
          value={searchValue}
          onChange={(event) => onSearchValueChange(event.target.value)}
          placeholder="搜索设置"
          className="h-9 pl-8 text-sm"
        />
      </div>

      <Link
        href="/settings"
        scroll={false}
        data-navigation-scroll="preserve"
        aria-current={activeSection === null ? "page" : undefined}
        className={cn(
          "mb-2 flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
          activeSection === null ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent",
        )}
      >
        <LayoutGrid className="size-4 shrink-0" />
        <span className="truncate">设置总览</span>
      </Link>

      <div className="space-y-3">
        {visibleGroups.map((group) => (
          <section key={group.key} aria-labelledby={`settings-nav-${group.key}`}>
            <h2
              id={`settings-nav-${group.key}`}
              className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {group.label}
            </h2>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SettingsNavigationRow
                  key={item.key}
                  item={item}
                  active={activeSection === item.key}
                  onBeforeNavigate={onBeforeNavigate}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {visibleGroups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border-panel)] px-2.5 py-3 text-center text-[11px] text-muted-foreground">
          没有匹配的设置
        </p>
      ) : null}
    </nav>
  );
}

function SettingsNavigationRow({
  item,
  active,
  onBeforeNavigate,
}: {
  item: SettingsNavigationItem;
  active: boolean;
  onBeforeNavigate?: (section: SettingsSectionKey) => boolean;
}) {
  const Icon = item.icon;
  const content = (
    <>
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium">{item.label}</span>
          {item.dirty ? (
            <span className="shrink-0 text-[9px] font-semibold text-status-warn-foreground">
              未保存
            </span>
          ) : null}
        </span>
        {item.summary ? (
          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
            {item.summary}
          </span>
        ) : null}
      </span>
    </>
  );

  if (item.access === "blocked" || item.access === "unavailable") {
    return (
      <div
        aria-disabled="true"
        className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground"
      >
        {content}
        <LockKeyhole className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="sr-only">
          {item.access === "blocked" ? "需要店铺权限" : "权限状态不可用"}
        </span>
      </div>
    );
  }

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
        "flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors",
        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent",
      )}
    >
      {content}
    </Link>
  );
}

function filterNavigationGroups(
  groups: readonly SettingsNavigationGroup[],
  searchValue: string,
): readonly SettingsNavigationGroup[] {
  const query = searchValue.trim().toLocaleLowerCase();
  if (!query) return groups;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        [item.label, item.shortLabel, item.description, ...item.keywords]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
