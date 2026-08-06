"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardPlus, Recycle, ScanLine, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RepairOsBusinessCard, RepairOsSectionHeader } from "@/shared/ui";
import { brandGradientStyle, controls, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { createNewOrderSessionId } from "@/features/orders/model/new-order-intent";
import { buildNewOrderWorkspaceHref } from "@/features/orders/model/order-workspace-intent";
import { ScanSearchSheet } from "@/features/capture";

const quickStartActions = [
  {
    id: "new-order",
    label: "快速接单",
    description: "客户维修 · 新建工单",
    href: buildNewOrderWorkspaceHref({ source: "dashboard" }),
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

export function DashboardDesktopQuickStart({ onCreateOrder }: { onCreateOrder?: () => void }) {
  const router = useRouter();
  const startNewOrder = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
      return;
    }
    event.preventDefault();
    if (onCreateOrder) {
      onCreateOrder();
      return;
    }
    router.push(
      buildNewOrderWorkspaceHref({
        source: "dashboard",
        sessionId: createNewOrderSessionId(),
      }),
    );
  };
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
            onClick={action.id === "new-order" ? startNewOrder : undefined}
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

export function DashboardMobileQuickStart({ onCreateOrder }: { onCreateOrder?: () => void }) {
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(false);
  const startNewOrder = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
      return;
    }
    event.preventDefault();
    if (onCreateOrder) {
      onCreateOrder();
      return;
    }
    router.push(
      buildNewOrderWorkspaceHref({
        source: "dashboard",
        sessionId: createNewOrderSessionId(),
      }),
    );
  };
  return (
    <section
      data-ui="dashboard-quick-start-mobile"
      className={cn(repairOs.adminSection, "p-2 md:hidden")}
    >
      <RepairOsSectionHeader title="快速开始" description="选择要办理的业务" />
      <div className={repairOs.dashboardMobileQuickGrid}>
        {quickStartActions.slice(0, 1).map((action) => (
          <Link
            key={action.id}
            href={action.href}
            onClick={action.id === "new-order" ? startNewOrder : undefined}
            data-dashboard-quick-start={action.id}
            aria-label={`${action.label}，${action.description}`}
            className={repairOs.dashboardMobileQuickAction}
          >
            <RepairOsBusinessCard
              as="div"
              bodyClassName="grid w-full min-w-0 place-items-center gap-0.5"
              className={cn(
                "h-full min-h-14 grid-cols-1 place-items-center gap-0.5 rounded-xl px-1 py-1.5 text-center shadow-none transition-transform active:scale-[0.98] min-[400px]:min-h-16",
                action.primary
                  ? "border-0 text-primary-foreground hover:bg-transparent"
                  : "border-[var(--border-panel)] bg-card hover:bg-accent/60",
              )}
              style={action.primary ? brandGradientStyle : undefined}
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-lg",
                  action.primary
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-primary/10 text-primary",
                )}
              >
                <action.icon className="size-3.5" aria-hidden />
              </span>
              <span className="block whitespace-nowrap text-[11px] font-semibold leading-4 min-[360px]:text-xs lg:text-xs lg:leading-4">
                {action.label}
              </span>
              <span
                className={cn(
                  "mt-0.5 hidden truncate text-[10px] leading-3.5 min-[400px]:block lg:text-[11px] lg:leading-4",
                  action.primary ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {action.description}
              </span>
            </RepairOsBusinessCard>
          </Link>
        ))}

        <button
          type="button"
          data-dashboard-quick-start="scan-order"
          aria-label="扫码查单，扫描工单二维码或输入订单信息"
          onClick={() => setScannerOpen(true)}
          className={repairOs.dashboardMobileQuickAction}
        >
          <RepairOsBusinessCard
            as="div"
            bodyClassName="grid w-full min-w-0 place-items-center gap-0.5"
            className="h-full min-h-14 grid-cols-1 place-items-center gap-0.5 rounded-xl border-[var(--border-panel)] bg-card px-1 py-1.5 text-center shadow-none transition-transform active:scale-[0.98] min-[400px]:min-h-16"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <ScanLine className="size-3.5" aria-hidden />
            </span>
            <span className="block whitespace-nowrap text-[11px] font-semibold leading-4 min-[360px]:text-xs lg:text-xs lg:leading-4">
              扫码查单
            </span>
            <span className="mt-0.5 hidden truncate text-[10px] leading-3.5 text-muted-foreground min-[400px]:block lg:text-[11px] lg:leading-4">
              二维码 · IMEI
            </span>
          </RepairOsBusinessCard>
        </button>

        {quickStartActions.slice(1).map((action) => (
          <Link
            key={action.id}
            href={action.href}
            data-dashboard-quick-start={action.id}
            aria-label={`${action.label}，${action.description}`}
            className={repairOs.dashboardMobileQuickAction}
          >
            <RepairOsBusinessCard
              as="div"
              bodyClassName="grid w-full min-w-0 place-items-center gap-0.5"
              className="h-full min-h-14 grid-cols-1 place-items-center gap-0.5 rounded-xl border-[var(--border-panel)] bg-card px-1 py-1.5 text-center shadow-none transition-transform active:scale-[0.98] min-[400px]:min-h-16"
            >
              <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                <action.icon className="size-3.5" aria-hidden />
              </span>
              <span className="block whitespace-nowrap text-[11px] font-semibold leading-4 min-[360px]:text-xs lg:text-xs lg:leading-4">
                回收估价
              </span>
              <span className="mt-0.5 hidden truncate text-[10px] leading-3.5 text-muted-foreground min-[400px]:block lg:text-[11px] lg:leading-4">
                iPhone 旧机
              </span>
            </RepairOsBusinessCard>
          </Link>
        ))}
      </div>
      <ScanSearchSheet open={scannerOpen} onOpenChange={setScannerOpen} scope="orders" />
    </section>
  );
}
