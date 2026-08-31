import Link from "next/link";
import { ArrowUpRight, ClipboardList, Package, Recycle, Users } from "lucide-react";

import type { DashboardSummary } from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { RepairOsSectionHeader } from "@/shared/ui";
import { useLocale } from "@/shared/i18n/locale-provider";

export function DashboardPrioritySidebar({ summary }: { summary: DashboardSummary }) {
  return (
    <aside className="min-w-0 space-y-3">
      <DashboardAttentionSummary summary={summary} />
      <DashboardBusinessLinks />
    </aside>
  );
}

export function DashboardAttentionSummary({ summary }: { summary: DashboardSummary }) {
  const { t } = useLocale();
  const metrics = [
    { label: t("dashboard.filterOverdue"), value: summary.counts.overdue, tone: "danger" },
    {
      label: t("dashboard.filterActionable"),
      value: summary.counts.ready + summary.counts.active,
      tone: "primary",
    },
    { label: t("dashboard.filterWaiting"), value: summary.counts.waiting, tone: "warn" },
  ] as const;

  return (
    <section className={cn(repairOs.adminSection, "min-w-0 p-2 lg:p-3")}>
      <RepairOsSectionHeader
        title={t("dashboard.attention")}
        description={t("dashboard.attentionDescription")}
      />
      <div className="mt-1.5 grid min-w-0 grid-cols-3 gap-1.5 lg:mt-3 lg:grid-cols-1 lg:gap-2">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={cn(
              "min-w-0 rounded-xl border px-2 py-1.5 lg:px-2.5 lg:py-2",
              metric.tone === "danger" && "border-status-danger-foreground/20 bg-status-danger/10",
              metric.tone === "primary" && "border-primary/20 bg-primary/10",
              metric.tone === "warn" && "border-status-warn-foreground/20 bg-status-warn/10",
            )}
          >
            <p className="truncate text-[10px] font-medium text-muted-foreground lg:text-xs lg:leading-4">
              {metric.label}
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums lg:mt-1 lg:text-lg">
              {metric.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function DashboardBusinessLinks() {
  const { t } = useLocale();
  const businessLinks = [
    {
      label: t("dashboard.allOrders"),
      description: t("dashboard.allOrdersDescription"),
      href: "/orders",
      icon: ClipboardList,
    },
    {
      label: t("dashboard.customers"),
      description: t("dashboard.customersDescription"),
      href: "/customers",
      icon: Users,
    },
    {
      label: t("dashboard.buyback"),
      description: t("dashboard.buybackDescriptionFull"),
      href: "/buyback",
      icon: Recycle,
    },
    {
      label: t("dashboard.inventory"),
      description: t("dashboard.inventoryDescription"),
      href: "/inventory",
      icon: Package,
    },
  ] as const;
  return (
    <section className={cn(repairOs.adminSection, "min-w-0 p-2 lg:p-3")}>
      <RepairOsSectionHeader
        title={t("dashboard.businessLinks")}
        description={t("dashboard.businessLinksDescription")}
      />
      <div className="mt-1.5 grid min-w-0 grid-cols-2 gap-1.5 lg:mt-3 lg:grid-cols-1 lg:gap-2">
        {businessLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="grid min-h-11 min-w-0 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-1.5 rounded-xl border border-[var(--border-panel)] bg-card px-2 py-1.5 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:grid-cols-[36px_minmax(0,1fr)_auto] lg:gap-2 lg:px-2.5 lg:py-2"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary lg:size-9">
              <item.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">{item.label}</span>
              <span className="block truncate text-[10px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
                {item.description}
              </span>
            </span>
            <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}
