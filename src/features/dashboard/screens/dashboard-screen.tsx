"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Euro,
  Package,
  Recycle,
  Smartphone,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { AnimatedNumber } from "@/components/animated-number";
import { MoneyText, OrderTypeBadge, PhoneText, StatusBadge } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ordersKeys } from "@/features/orders/api/query-keys";
import {
  orderWorkflowMeta,
  workflowStatusFromLegacyStatus,
} from "@/features/orders/model/canonical-order-status";
import { fadeUp, stagger } from "@/lib/motion";
import { statusGroups } from "@/lib/mock/enums";
import { getOrderStats, listOrdersPage, type OrderListItem } from "@/lib/repairdesk/api";
import { RepairOsMetricStrip, type RepairOsMetric } from "@/shared/ui";
import { pageShell, repairOs, stateBlocks } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const RECENT_PAGE_SIZE = 6;

const quickModules = [
  {
    title: "订单管理",
    description: "接单、流转、收款",
    href: "/orders",
    icon: ClipboardList,
  },
  {
    title: "客户管理",
    description: "档案、设备、回访",
    href: "/customers",
    icon: Users,
  },
  {
    title: "回收管理",
    description: "旧机估价与检测",
    href: "/buyback",
    icon: Recycle,
  },
  {
    title: "库存商品",
    description: "配件与商品库存",
    href: "/inventory",
    icon: Package,
  },
] satisfies Array<{
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}>;

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function deriveFallbackStats(items: OrderListItem[], total: number) {
  return {
    total,
    today: items.filter((order) => isToday(order.created_at)).length,
    inProgress: items.filter((order) => statusGroups.in_progress.includes(order.status)).length,
    unpaid: items.filter((order) => !order.is_paid).length,
    approvalOverdue: items.filter((order) => order.approval_overdue).length,
    pickupOverdue: items.filter((order) => order.pickup_overdue).length,
  };
}

export function DashboardScreen() {
  const ordersQuery = useQuery({
    queryKey: [...ordersKeys.lists(), "dashboard", { page: 1, pageSize: RECENT_PAGE_SIZE }],
    queryFn: () => listOrdersPage({ page: 1, pageSize: RECENT_PAGE_SIZE }),
  });

  const statsQuery = useQuery({
    queryKey: ordersKeys.stats(),
    queryFn: getOrderStats,
  });

  const recentOrders = useMemo(() => ordersQuery.data?.items ?? [], [ordersQuery.data?.items]);
  const fallbackStats = useMemo(
    () => deriveFallbackStats(recentOrders, ordersQuery.data?.total ?? recentOrders.length),
    [ordersQuery.data?.total, recentOrders],
  );
  const stats = statsQuery.data ?? fallbackStats;
  const recentPaidRevenue = recentOrders
    .filter((order) => order.is_paid)
    .reduce((sum, order) => sum + order.quotation_amount, 0);
  const hasError = ordersQuery.isError || statsQuery.isError;

  const mobileMetrics = [
    { label: "总工单", value: stats.total, hint: "当前门店", icon: ClipboardList, tone: "blue" },
    { label: "进行中", value: stats.inProgress, hint: "需跟进", icon: Wrench, tone: "amber" },
    { label: "未结清", value: stats.unpaid, hint: "待收款", icon: Euro, tone: "green" },
  ] satisfies RepairOsMetric[];

  const tasks = [
    {
      label: "今日新建",
      value: stats.today,
      hint: "今天录入的维修单",
      icon: Clock3,
      tone: "info",
      href: "/orders",
    },
    {
      label: "报价超期",
      value: stats.approvalOverdue,
      hint: "需要催客户确认",
      icon: Wrench,
      tone: stats.approvalOverdue > 0 ? "danger" : "neutral",
      href: "/orders",
    },
    {
      label: "取件超期",
      value: stats.pickupOverdue,
      hint: "已完成但未取机",
      icon: CheckCircle2,
      tone: stats.pickupOverdue > 0 ? "warn" : "success",
      href: "/orders",
    },
  ] satisfies Array<DashboardTask>;

  return (
    <div className={cn(pageShell.list, "pb-8 pt-3 sm:pt-5")}>
      <motion.div variants={stagger(0.035)} initial="hidden" animate="show" className="space-y-3">
        <motion.div variants={fadeUp} className="sm:hidden">
          <RepairOsMetricStrip
            metrics={mobileMetrics.map((metric) => ({
              ...metric,
              value: <AnimatedNumber value={metric.value} />,
            }))}
          />
        </motion.div>

        <motion.div
          variants={stagger(0.025)}
          className="hidden min-w-0 gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4"
        >
          <DashboardMetricCard
            label="总工单"
            value={stats.total}
            hint="当前门店全部工单"
            icon={ClipboardList}
            tone="info"
          />
          <DashboardMetricCard
            label="进行中"
            value={stats.inProgress}
            hint="检测、维修、配件中"
            icon={Wrench}
            tone="progress"
          />
          <DashboardMetricCard
            label="未结清"
            value={stats.unpaid}
            hint="仍需确认收款"
            icon={Euro}
            tone="warn"
          />
          <DashboardMetricCard
            label="近期已结清"
            value={<MoneyText amount={recentPaidRevenue} />}
            hint="最近工单收入"
            icon={CheckCircle2}
            tone="success"
          />
        </motion.div>

        {hasError ? (
          <motion.div
            variants={fadeUp}
            className={cn(repairOs.adminSection, stateBlocks.errorText)}
          >
            部分统计暂时不可用，已显示可读取的最近工单数据。
          </motion.div>
        ) : null}

        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <motion.section variants={fadeUp} className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
            <SectionTitle
              title="今日任务"
              description="优先处理超期、未收款和待推进事项"
              actionHref="/orders"
              actionLabel="进入工单"
            />
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {tasks.map((task) => (
                <TaskCard key={task.label} task={task} />
              ))}
            </div>
          </motion.section>

          <motion.section variants={fadeUp} className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
            <SectionTitle title="快捷模块" description="常用业务入口" />
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {quickModules.map((module) => (
                <QuickModuleLink key={module.href} module={module} />
              ))}
            </div>
          </motion.section>
        </div>

        <motion.section variants={fadeUp} className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
          <SectionTitle
            title="最新工单"
            description="最近接入的维修业务"
            actionHref="/orders"
            actionLabel="查看全部"
          />
          <div className="mt-3 grid min-w-0 gap-2">
            {ordersQuery.isLoading ? (
              <RecentOrdersSkeleton />
            ) : recentOrders.length > 0 ? (
              recentOrders.map((order) => <RecentOrderCard key={order.id} order={order} />)
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border-panel)] px-3 py-6 text-center text-sm text-muted-foreground">
                暂无最近工单
              </div>
            )}
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}

type Tone = "neutral" | "info" | "progress" | "warn" | "success" | "danger";

const toneClasses: Record<Tone, { card: string; icon: string; marker: string; value: string }> = {
  neutral: {
    card: "border-border/60 bg-card",
    icon: "bg-surface-muted text-muted-foreground",
    marker: "bg-muted-foreground/40",
    value: "text-foreground",
  },
  info: {
    card: "border-status-info-foreground/25 bg-status-info/30",
    icon: "bg-status-info text-status-info-foreground",
    marker: "bg-status-info-foreground",
    value: "text-status-info-foreground",
  },
  progress: {
    card: "border-status-progress-foreground/25 bg-status-progress/30",
    icon: "bg-status-progress text-status-progress-foreground",
    marker: "bg-status-progress-foreground",
    value: "text-status-progress-foreground",
  },
  warn: {
    card: "border-status-warn-foreground/25 bg-status-warn/30",
    icon: "bg-status-warn text-status-warn-foreground",
    marker: "bg-status-warn-foreground",
    value: "text-status-warn-foreground",
  },
  success: {
    card: "border-status-success-foreground/25 bg-status-success/30",
    icon: "bg-status-success text-status-success-foreground",
    marker: "bg-status-success-foreground",
    value: "text-status-success-foreground",
  },
  danger: {
    card: "border-status-danger-foreground/25 bg-status-danger/25",
    icon: "bg-status-danger text-status-danger-foreground",
    marker: "bg-status-danger-foreground",
    value: "text-status-danger-foreground",
  },
};

interface DashboardTask {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  href: string;
}

function DashboardMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | ReactNode;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
}) {
  const toneClass = toneClasses[tone];
  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        "min-w-0 rounded-2xl border px-2.5 py-2 shadow-[var(--shadow-card)]",
        toneClass.card,
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground/70">
            {label}
          </p>
          <p
            className={cn(
              "mt-1 truncate font-mono text-xl font-semibold tabular-nums leading-none",
              toneClass.value,
            )}
          >
            {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
          </p>
        </div>
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", toneClass.icon)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 truncate text-[11px] leading-4 text-muted-foreground">{hint}</p>
    </motion.div>
  );
}

function SectionTitle({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className={repairOs.adminSectionHeader}>
      <div className="min-w-0">
        <h2 className={repairOs.adminSectionTitle}>{title}</h2>
        <p className="truncate text-[11px] text-muted-foreground">{description}</p>
      </div>
      {actionHref && actionLabel ? (
        <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-2 text-xs">
          <Link href={actionHref}>
            {actionLabel}
            <ArrowUpRight className="size-3" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function TaskCard({ task }: { task: DashboardTask }) {
  const toneClass = toneClasses[task.tone];
  return (
    <Link
      href={task.href}
      className={cn(
        "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border px-3 py-2 transition-colors hover:bg-accent/60",
        toneClass.card,
      )}
    >
      <span className={cn("grid size-8 place-items-center rounded-md", toneClass.icon)}>
        <task.icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-5">{task.label}</span>
        <span className="block truncate text-[11px] leading-4 text-muted-foreground">
          {task.hint}
        </span>
      </span>
      <span className={cn("font-mono text-lg font-semibold tabular-nums", toneClass.value)}>
        <AnimatedNumber value={task.value} />
      </span>
    </Link>
  );
}

function QuickModuleLink({ module }: { module: (typeof quickModules)[number] }) {
  return (
    <Link
      href={module.href}
      className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-[var(--border-panel)] bg-card px-3 py-2 shadow-[var(--shadow-card)] transition-colors hover:bg-accent/60"
    >
      <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
        <module.icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-5">{module.title}</span>
        <span className="block truncate text-[11px] leading-4 text-muted-foreground">
          {module.description}
        </span>
      </span>
      <ArrowUpRight className="size-3.5 text-muted-foreground" />
    </Link>
  );
}

function RecentOrderCard({ order }: { order: OrderListItem }) {
  const workflowStatus = order.workflow_status ?? workflowStatusFromLegacyStatus(order.status);
  const workflowMeta = orderWorkflowMeta[workflowStatus];
  return (
    <Link
      href={`/orders/${order.id}`}
      className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] gap-2 rounded-2xl border border-[var(--border-panel)] bg-card px-3 py-2 shadow-[var(--shadow-card)] transition-colors hover:bg-accent/60"
    >
      <span className="mt-0.5 grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
        <Smartphone className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-mono text-xs font-semibold text-primary">
            {order.public_no}
          </span>
          <StatusBadge
            status={order.status}
            label={workflowMeta.shortLabel}
            tone={workflowMeta.tone}
            className="text-[10px]"
          />
          <OrderTypeBadge type={order.order_type} className="text-[10px]" />
        </span>
        <span className="mt-1 block truncate text-sm font-semibold leading-5">
          {order.customer_name || "-"}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            · {order.device_label}
          </span>
        </span>
        <PhoneText value={order.customer_phone} className="block truncate" />
      </span>
      <span className="min-w-0 text-right">
        <MoneyText amount={order.quotation_amount} className="text-sm font-semibold" />
        <span
          className={cn(
            "mt-1 block truncate text-[10px] leading-4",
            order.is_paid ? "text-status-success-foreground" : "text-muted-foreground",
          )}
        >
          {order.is_paid ? "已结清" : "未结清"}
        </span>
      </span>
    </Link>
  );
}

function RecentOrdersSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] gap-2 rounded-2xl border border-[var(--border-panel)] bg-card px-3 py-2"
        >
          <Skeleton className="size-8 rounded-md" />
          <span className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-24" />
          </span>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </>
  );
}
