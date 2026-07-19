import Link from "next/link";
import { ArrowRight, LockKeyhole, Search, Store } from "lucide-react";

import { Input } from "@/components/ui/input";
import { RepairOsBadge, RepairOsBusinessCard, RepairOsSectionHeader } from "@/shared/ui";
import type { SettingsNavigationGroup } from "@/features/settings/components/settings-navigation";
import type { SettingsSectionKey } from "@/features/settings/model/settings-section-access";
import { cn } from "@/lib/utils";

export interface SettingsOverviewReadiness {
  state: "loading" | "ready" | "error" | "unavailable";
  score?: number;
}

export interface SettingsOverviewScreenProps {
  groups: readonly SettingsNavigationGroup[];
  activeStoreName?: string;
  accessibleSectionCount: number;
  totalSectionCount: number;
  readiness: SettingsOverviewReadiness;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onBeforeNavigate?: (section: SettingsSectionKey) => boolean;
}

export function SettingsOverviewScreen({
  groups,
  activeStoreName,
  accessibleSectionCount,
  totalSectionCount,
  readiness,
  searchValue,
  onSearchValueChange,
  onBeforeNavigate,
}: SettingsOverviewScreenProps) {
  const visibleGroups = filterOverviewGroups(groups, searchValue);

  return (
    <div data-settings-overview className="min-w-0 space-y-3">
      <section className="rounded-xl border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)] sm:p-4">
        <RepairOsSectionHeader
          icon={Store}
          iconFrame={false}
          title="设置总览"
          description="按业务分组进入设置；只会加载当前页面需要的数据。"
        />

        <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
          <OverviewMetric label="当前店铺" value={activeStoreName || "未选择"} />
          <OverviewMetric
            label="可访问功能"
            value={`${accessibleSectionCount} / ${totalSectionCount}`}
          />
          <OverviewMetric
            label="店铺资料"
            value={readinessLabel(readiness)}
            className="col-span-2 sm:col-span-1"
            status
          />
        </div>
      </section>

      <div className="relative min-w-0 lg:hidden">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <label htmlFor="settings-overview-search" className="sr-only">
          搜索设置
        </label>
        <Input
          id="settings-overview-search"
          value={searchValue}
          onChange={(event) => onSearchValueChange(event.target.value)}
          placeholder="搜索设置"
          className="h-11 pl-9 text-base"
        />
      </div>

      {visibleGroups.map((group) => (
        <section key={group.key} aria-labelledby={`settings-overview-${group.key}`}>
          <h2
            id={`settings-overview-${group.key}`}
            className="mb-1.5 px-1 text-xs font-semibold text-foreground"
          >
            {group.label}
          </h2>
          <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
            {group.items.map((item) => {
              const Icon = item.icon;
              const blocked = item.access === "blocked" || item.access === "unavailable";
              const card = (
                <RepairOsBusinessCard
                  as="div"
                  className="min-h-16 gap-2 px-3 py-2.5 transition-colors hover:bg-accent"
                  leading={
                    <span className="grid size-9 place-items-center rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-foreground">
                      <Icon className="size-4" />
                    </span>
                  }
                  trailing={
                    blocked ? (
                      <LockKeyhole className="size-4 text-muted-foreground" />
                    ) : (
                      <ArrowRight className="size-4 text-muted-foreground" />
                    )
                  }
                  trailingClassName="self-center"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{item.label}</span>
                    {item.access === "readonly" ? (
                      <RepairOsBadge className="shrink-0">只读</RepairOsBadge>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                    {blocked ? item.summary || "当前账号无法访问此设置。" : item.description}
                  </span>
                </RepairOsBusinessCard>
              );

              if (blocked) {
                return (
                  <div key={item.key} aria-disabled="true" className="min-w-0 opacity-70">
                    {card}
                  </div>
                );
              }

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  scroll={false}
                  data-navigation-scroll="preserve"
                  className="min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(event) => {
                    if (onBeforeNavigate && !onBeforeNavigate(item.key)) event.preventDefault();
                  }}
                >
                  {card}
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {visibleGroups.length === 0 ? (
        <RepairOsBusinessCard as="div" className="min-h-24 place-items-center text-center">
          <span className="text-sm font-medium">没有匹配的设置</span>
          <span className="mt-1 block text-xs text-muted-foreground">请尝试其他关键词。</span>
        </RepairOsBusinessCard>
      ) : null}
    </div>
  );
}

function OverviewMetric({
  label,
  value,
  className,
  status = false,
}: {
  label: string;
  value: string;
  className?: string;
  status?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2",
        className,
      )}
      role={status ? "status" : undefined}
      aria-live={status ? "polite" : undefined}
    >
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function readinessLabel(readiness: SettingsOverviewReadiness) {
  if (readiness.state === "loading") return "读取中…";
  if (readiness.state === "error") return "读取失败";
  if (readiness.state === "unavailable") return "不可用";
  return `${readiness.score ?? 0}% 完整`;
}

function filterOverviewGroups(
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
