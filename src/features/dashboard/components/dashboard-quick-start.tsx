import Link from "next/link";
import { ArrowUpRight, ClipboardPlus, Recycle, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RepairOsBusinessCard, RepairOsSectionHeader } from "@/shared/ui";
import { brandGradientStyle, controls, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const quickStartActions = [
  {
    id: "new-order",
    label: "快速接单",
    description: "客户维修 · 新建工单",
    href: "/orders/new",
    icon: ClipboardPlus,
    primary: true,
  },
  {
    id: "buyback-quote",
    label: "快速回收报价",
    description: "iPhone 旧机估价",
    href: "/buyback?new=1",
    icon: Recycle,
    primary: false,
  },
] satisfies Array<{
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  primary: boolean;
}>;

export function DashboardDesktopQuickStart() {
  return (
    <div
      data-ui="dashboard-quick-start-desktop"
      className="flex min-w-0 flex-wrap justify-end gap-2"
    >
      {quickStartActions.map((action) => (
        <Button
          key={action.id}
          asChild
          size="sm"
          variant={action.primary ? "default" : "outline"}
          className={cn(
            "h-11 gap-1.5 rounded-xl px-3 text-xs",
            action.primary
              ? controls.brandButton
              : "border-[var(--border-panel)] bg-card hover:bg-accent/60",
          )}
          style={action.primary ? brandGradientStyle : undefined}
        >
          <Link
            href={action.href}
            data-dashboard-quick-start={action.id}
            aria-label={`${action.label}，${action.description}`}
          >
            <action.icon className="size-3.5" aria-hidden />
            {action.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}

export function DashboardMobileQuickStart() {
  return (
    <section
      data-ui="dashboard-quick-start-mobile"
      className={cn(repairOs.adminSection, "p-2.5 md:hidden")}
    >
      <RepairOsSectionHeader title="快速开始" description="选择要办理的业务" />
      <div className="mt-2 grid min-w-0 grid-cols-2 gap-2">
        {quickStartActions.map((action) => (
          <Link
            key={action.id}
            href={action.href}
            data-dashboard-quick-start={action.id}
            aria-label={`${action.label}，${action.description}`}
            className="block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <RepairOsBusinessCard
              as="div"
              leading={
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-lg",
                    action.primary
                      ? "bg-primary-foreground/15 text-primary-foreground"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  <action.icon className="size-4" aria-hidden />
                </span>
              }
              trailing={
                <ArrowUpRight
                  className={cn(
                    "size-3.5",
                    action.primary ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
              }
              className={cn(
                "min-h-20 items-center rounded-xl px-2.5 py-2 shadow-none transition-transform active:scale-[0.98]",
                action.primary
                  ? "border-0 text-primary-foreground hover:bg-transparent"
                  : "border-[var(--border-panel)] bg-card hover:bg-accent/60",
              )}
              style={action.primary ? brandGradientStyle : undefined}
            >
              <span className="block text-xs font-semibold leading-4">{action.label}</span>
              <span
                className={cn(
                  "mt-1 block text-[10px] leading-3.5",
                  action.primary ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {action.description}
              </span>
            </RepairOsBusinessCard>
          </Link>
        ))}
      </div>
    </section>
  );
}
