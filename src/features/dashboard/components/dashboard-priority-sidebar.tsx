import Link from "next/link";
import { ArrowUpRight, ClipboardList, Package, Recycle, Users } from "lucide-react";

import type { DashboardSummary } from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { RepairOsSectionHeader } from "@/shared/ui";

const businessLinks = [
  { label: "全部工单", description: "完整队列与历史", href: "/orders", icon: ClipboardList },
  { label: "客户管理", description: "客户档案与设备", href: "/customers", icon: Users },
  { label: "回收管理", description: "旧机估价与检测", href: "/buyback", icon: Recycle },
  { label: "库存商品", description: "配件与商品库存", href: "/inventory", icon: Package },
] as const;

export function DashboardPrioritySidebar({ summary }: { summary: DashboardSummary }) {
  return (
    <aside className="min-w-0 space-y-3">
      <AttentionSummary summary={summary} />
      <BusinessLinks />
    </aside>
  );
}

function AttentionSummary({ summary }: { summary: DashboardSummary }) {
  const metrics = [
    { label: "已超期", value: summary.counts.overdue, tone: "danger" },
    { label: "可立即处理", value: summary.counts.ready + summary.counts.active, tone: "primary" },
    { label: "等待跟进", value: summary.counts.waiting, tone: "warn" },
  ] as const;

  return (
    <section className={cn(repairOs.adminSection, "min-w-0 p-3")}>
      <RepairOsSectionHeader title="交接关注" description="只显示业务处理数量，不含财务数据" />
      <div className="mt-3 grid min-w-0 grid-cols-3 gap-2 lg:grid-cols-1">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={cn(
              "min-w-0 rounded-xl border px-2.5 py-2",
              metric.tone === "danger" && "border-status-danger-foreground/20 bg-status-danger/10",
              metric.tone === "primary" && "border-primary/20 bg-primary/10",
              metric.tone === "warn" && "border-status-warn-foreground/20 bg-status-warn/10",
            )}
          >
            <p className="truncate text-[10px] font-medium text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{metric.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BusinessLinks() {
  return (
    <section className={cn(repairOs.adminSection, "min-w-0 p-3")}>
      <RepairOsSectionHeader title="业务入口" description="查看完整资料与历史" />
      <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {businessLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="grid min-w-0 grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-[var(--border-panel)] bg-card px-2.5 py-2 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <item.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">{item.label}</span>
              <span className="block truncate text-[10px] leading-4 text-muted-foreground">
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
