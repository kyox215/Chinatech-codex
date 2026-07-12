"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  ClipboardPlus,
  Clock3,
  Euro,
  Package,
  Recycle,
  RefreshCw,
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
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import {
  orderWorkflowMeta,
  workflowStatusFromLegacyStatus,
} from "@/features/orders/model/canonical-order-status";
import { getWorkflowNextActions } from "@/features/orders/model/order-workflow";
import { orderTransitionRequiresReason } from "@/features/orders/model/order-transition-reasons";
import {
  buildDashboardWorkInsight,
  type DashboardWorkInsight,
} from "@/features/dashboard/model/dashboard-work-insights";
import { fadeUp, stagger } from "@/lib/motion";
import { statusGroups } from "@/lib/mock/enums";
import { CACHE_TIMES } from "@/lib/query-performance";
import {
  getDashboardSummary,
  getOrderQueueSummary,
  type OrderListItem,
} from "@/lib/repairdesk/api";
import {
  RepairOsBusinessCard,
  RepairOsInfoTile,
  RepairOsListScaffold,
  RepairOsSectionHeader,
  type RepairOsMetric,
} from "@/shared/ui";
import { brandGradientStyle, controls, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const RECENT_PAGE_SIZE = 6;
const QUEUE_OVERVIEW_PAGE_SIZE = 50;

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
  const shell = useStoreShellContext();
  const activeStoreId = shell.activeStore?.id;
  const dashboardQuery = useQuery({
    queryKey: ordersKeys.dashboardSummary({ pageSize: RECENT_PAGE_SIZE }, activeStoreId),
    queryFn: ({ signal }) => getDashboardSummary({ pageSize: RECENT_PAGE_SIZE }, { signal }),
    staleTime: CACHE_TIMES.stats,
  });
  const queueOverviewQuery = useQuery({
    queryKey: ordersKeys.queueSummary(
      { page: 1, pageSize: QUEUE_OVERVIEW_PAGE_SIZE },
      activeStoreId,
    ),
    queryFn: ({ signal }) =>
      getOrderQueueSummary({ page: 1, pageSize: QUEUE_OVERVIEW_PAGE_SIZE }, { signal }),
    staleTime: CACHE_TIMES.hotList,
  });

  const recentOrders = useMemo(
    () => dashboardQuery.data?.recentOrders.items ?? [],
    [dashboardQuery.data?.recentOrders.items],
  );
  const fallbackStats = useMemo(
    () =>
      deriveFallbackStats(
        recentOrders,
        dashboardQuery.data?.recentOrders.total ??
          queueOverviewQuery.data?.list.total ??
          recentOrders.length,
      ),
    [dashboardQuery.data?.recentOrders.total, queueOverviewQuery.data?.list.total, recentOrders],
  );
  const stats = dashboardQuery.data?.stats ?? fallbackStats;
  const canReadAggregateFinance =
    queueOverviewQuery.data?.options.permissions.canReadAggregateFinance === true;
  const dashboardIsLoading = dashboardQuery.isLoading && !dashboardQuery.data;
  const dashboardHasHardError = dashboardQuery.isError && !dashboardQuery.data;
  const queueHasHardError = queueOverviewQuery.isError && !queueOverviewQuery.data;
  const workInsight = useMemo(
    () => buildDashboardWorkInsight(stats, recentOrders),
    [recentOrders, stats],
  );
  const recentPaidRevenue = canReadAggregateFinance
    ? recentOrders
        .filter((order) => order.is_paid && !order.finance_redacted)
        .reduce((sum, order) => sum + order.quotation_amount, 0)
    : 0;
  const hasPartialError =
    Boolean(dashboardQuery.data?.partialErrors) ||
    (dashboardQuery.isError && Boolean(dashboardQuery.data));
  const queueOverviewItems = queueOverviewQuery.data?.list.items ?? recentOrders;
  const quickActionCount = useMemo(() => {
    const workflow = queueOverviewQuery.data?.workflow;
    if (!workflow) return 0;
    return queueOverviewItems.filter((order) => {
      const next = getWorkflowNextActions(workflow, order.status);
      return [next.primary, ...next.secondary].some(
        (action) => action && !orderTransitionRequiresReason(action.to),
      );
    }).length;
  }, [queueOverviewItems, queueOverviewQuery.data?.workflow]);
  const queueOverview = {
    totalOrders: queueOverviewQuery.data?.list.total ?? stats.total,
    pageTotal: queueOverviewQuery.data?.list.items.length ?? recentOrders.length,
    unpaidCount: stats.unpaid,
    exceptionCount: stats.approvalOverdue + stats.pickupOverdue,
    quickActionCount,
    isLoading: queueOverviewQuery.isLoading && !queueOverviewQuery.data,
    hasError: queueHasHardError,
    onRetry: () => {
      void queueOverviewQuery.refetch();
    },
  };

  const mobileMetrics = [
    { label: "待处理", value: stats.total, hint: "当前队列", icon: ClipboardList, tone: "blue" },
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
    <RepairOsListScaffold
      title="概览"
      subtitle={
        dashboardIsLoading
          ? "正在读取今日任务"
          : dashboardHasHardError
            ? "今日统计暂时不可用"
            : `今日任务 · 待处理 ${stats.total} 单`
      }
      eyebrow="工作台 / 概览"
      chips={mobileMetrics.map((metric) => ({
        key: metric.label,
        label: metric.label,
        shortLabel: metric.label.slice(0, 1),
        count:
          dashboardIsLoading || dashboardHasHardError ? (
            <span
              aria-label={
                dashboardIsLoading ? `${metric.label}正在加载` : `${metric.label}暂时不可用`
              }
            >
              —
            </span>
          ) : (
            <AnimatedNumber value={metric.value} />
          ),
      }))}
      desktopAction={<DashboardDesktopQuickStart />}
    >
      <motion.div variants={stagger(0.035)} initial="hidden" animate="show" className="space-y-3">
        <DashboardMobileQuickStart />

        <motion.div
          variants={stagger(0.025)}
          className="hidden min-w-0 gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4"
        >
          <DashboardMetricCard
            label="待处理工单"
            value={stats.total}
            hint="当前工作队列"
            icon={ClipboardList}
            tone="info"
            isLoading={dashboardIsLoading}
            isUnavailable={dashboardHasHardError}
          />
          <DashboardMetricCard
            label="进行中"
            value={stats.inProgress}
            hint="检测、维修、配件中"
            icon={Wrench}
            tone="progress"
            isLoading={dashboardIsLoading}
            isUnavailable={dashboardHasHardError}
          />
          <DashboardMetricCard
            label="未结清"
            value={stats.unpaid}
            hint="仍需确认收款"
            icon={Euro}
            tone="warn"
            isLoading={dashboardIsLoading}
            isUnavailable={dashboardHasHardError}
          />
          {canReadAggregateFinance ? (
            <DashboardMetricCard
              label="活跃单已收"
              value={<MoneyText amount={recentPaidRevenue} />}
              hint="当前工作队列"
              icon={CheckCircle2}
              tone="success"
              isLoading={dashboardIsLoading}
              isUnavailable={dashboardHasHardError}
            />
          ) : (
            <DashboardMetricCard
              label="今日新建"
              value={stats.today}
              hint="今天录入的工单"
              icon={Clock3}
              tone="neutral"
              isLoading={dashboardIsLoading}
              isUnavailable={dashboardHasHardError}
            />
          )}
        </motion.div>

        {hasPartialError ? (
          <motion.div variants={fadeUp}>
            <RepairOsBusinessCard
              as="div"
              data-ui="dashboard-partial-data-warning"
              className="grid-cols-[auto_minmax(0,1fr)] items-center rounded-xl border-status-warn-foreground/25 bg-status-warn/10 px-3 py-2.5 text-status-warn-foreground shadow-none hover:bg-status-warn/10"
              leading={
                <span className="grid size-8 place-items-center rounded-lg bg-status-warn/20">
                  <AlertTriangle className="size-4" />
                </span>
              }
              leadingClassName="self-center"
              aria-live="polite"
            >
              <span className="block text-sm font-semibold">部分统计暂时不可用</span>
              <span className="mt-0.5 block truncate text-[11px] leading-4 text-status-warn-foreground/80">
                已显示可读取的最近工单数据。
              </span>
            </RepairOsBusinessCard>
          </motion.div>
        ) : null}

        <motion.section variants={fadeUp}>
          {dashboardIsLoading ? (
            <WorkInsightSkeleton />
          ) : dashboardHasHardError ? (
            <DashboardDataUnavailable
              dataUi="dashboard-summary-error"
              title="今日统计读取失败"
              description="快速接单和回收报价仍可使用；请重试读取工单数据。"
              onRetry={() => {
                void dashboardQuery.refetch();
              }}
            />
          ) : (
            <WorkInsightCard insight={workInsight} />
          )}
        </motion.section>

        <motion.section variants={fadeUp}>
          <QueueOverviewSection overview={queueOverview} />
        </motion.section>

        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <motion.section variants={fadeUp} className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
            <RepairOsSectionHeader
              title="今日任务"
              description="优先处理超期、未收款和待推进事项"
              action={
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 gap-1 px-2 text-xs"
                >
                  <Link href="/orders">
                    进入工单
                    <ArrowUpRight className="size-3" />
                  </Link>
                </Button>
              }
            />
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-3 lg:grid-cols-3">
              {tasks.map((task) => (
                <TaskCard
                  key={task.label}
                  task={task}
                  isLoading={dashboardIsLoading}
                  isUnavailable={dashboardHasHardError}
                />
              ))}
            </div>
          </motion.section>

          <motion.section variants={fadeUp} className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
            <RepairOsSectionHeader title="业务模块" description="查看业务列表与历史记录" />
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {quickModules.map((module) => (
                <QuickModuleLink key={module.href} module={module} />
              ))}
            </div>
          </motion.section>
        </div>

        <motion.section variants={fadeUp} className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
          <RepairOsSectionHeader
            title="最新工单"
            description="最近接入的维修业务"
            action={
              <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-2 text-xs">
                <Link href="/orders">
                  查看全部
                  <ArrowUpRight className="size-3" />
                </Link>
              </Button>
            }
          />
          <div className="mt-3 grid min-w-0 gap-2 xl:grid-cols-2">
            {dashboardQuery.isLoading ? (
              <RecentOrdersSkeleton />
            ) : dashboardHasHardError ? (
              <RepairOsBusinessCard
                as="div"
                data-ui="dashboard-recent-orders-error"
                className="xl:col-span-2 grid-cols-[auto_minmax(0,1fr)] items-center rounded-xl border-status-danger-foreground/25 bg-status-danger/10 px-3 py-3 text-status-danger-foreground shadow-none"
                leading={
                  <span className="grid size-8 place-items-center rounded-lg bg-status-danger/20">
                    <AlertTriangle className="size-4" />
                  </span>
                }
                leadingClassName="self-center"
                role="alert"
              >
                <span className="block text-sm font-semibold">最近工单暂时不可用</span>
                <span className="mt-0.5 block truncate text-[11px] leading-4">
                  统计恢复后会自动显示最近接入的维修业务。
                </span>
              </RepairOsBusinessCard>
            ) : recentOrders.length > 0 ? (
              recentOrders.map((order) => <RecentOrderCard key={order.id} order={order} />)
            ) : (
              <RepairOsBusinessCard
                as="div"
                data-ui="dashboard-recent-orders-empty"
                className="xl:col-span-2 grid-cols-[auto_minmax(0,1fr)] items-center rounded-xl border-dashed px-3 py-3 text-muted-foreground shadow-none"
                leading={
                  <span className="grid size-8 place-items-center rounded-lg bg-[var(--surface-panel-muted)] text-primary">
                    <ClipboardList className="size-4" />
                  </span>
                }
                leadingClassName="self-center"
              >
                <span className="block text-sm font-semibold text-foreground">暂无最近工单</span>
                <span className="mt-0.5 block truncate text-[11px] leading-4">
                  新接入的维修业务会显示在这里。
                </span>
              </RepairOsBusinessCard>
            )}
          </div>
        </motion.section>
      </motion.div>
    </RepairOsListScaffold>
  );
}

interface QueueOverview {
  totalOrders: number;
  pageTotal: number;
  unpaidCount: number;
  exceptionCount: number;
  quickActionCount: number;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}

function DashboardDesktopQuickStart() {
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

function DashboardMobileQuickStart() {
  return (
    <motion.section
      variants={fadeUp}
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
    </motion.section>
  );
}

function QueueOverviewSection({ overview }: { overview: QueueOverview }) {
  const metrics = [
    {
      label: "当前队列",
      value: `全部 · ${overview.totalOrders}`,
      hint: `首屏 ${overview.pageTotal} 条工单`,
      icon: ClipboardList,
      tone: "info" as Tone,
    },
    {
      label: "待处理风险",
      value: `${overview.unpaidCount} 未结 · ${overview.exceptionCount} 异常`,
      hint: overview.exceptionCount
        ? "先处理超期/异常"
        : overview.unpaidCount
          ? "先看尾款和未收款"
          : "当前队列风险较低",
      icon: AlertTriangle,
      tone: overview.exceptionCount
        ? ("danger" as Tone)
        : overview.unpaidCount
          ? ("warn" as Tone)
          : ("neutral" as Tone),
    },
    {
      label: "可直接处理",
      value: `${overview.quickActionCount} 条`,
      hint: "不需要补充原因的下一步",
      icon: CheckCircle2,
      tone: overview.quickActionCount ? ("success" as Tone) : ("neutral" as Tone),
    },
  ];

  return (
    <section className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
      <RepairOsSectionHeader
        title="工单队列概览"
        description="队列风险和可直接推进事项"
        action={
          <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-2 text-xs">
            <Link href="/orders">
              打开队列
              <ArrowUpRight className="size-3" />
            </Link>
          </Button>
        }
      />
      {overview.hasError ? (
        <div className="mt-3">
          <DashboardDataUnavailable
            dataUi="dashboard-queue-error"
            title="工单队列读取失败"
            description="暂时无法判断队列风险和可直接处理数量。"
            onRetry={overview.onRetry}
          />
        </div>
      ) : (
        <div className="mt-3 grid min-w-0 gap-2 md:grid-cols-3">
          {metrics.map((metric) => (
            <QueueOverviewCard key={metric.label} metric={metric} isLoading={overview.isLoading} />
          ))}
        </div>
      )}
    </section>
  );
}

function DashboardDataUnavailable({
  dataUi,
  title,
  description,
  onRetry,
}: {
  dataUi: string;
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <div
      data-ui={dataUi}
      role="alert"
      className="grid min-w-0 gap-2 rounded-2xl border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2.5 text-status-danger-foreground shadow-[var(--shadow-card)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-5">{title}</p>
        <p className="mt-0.5 text-[11px] leading-4 text-status-danger-foreground/80">
          {description}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 rounded-xl border-status-danger-foreground/25 bg-card px-3 text-xs"
        onClick={onRetry}
      >
        <RefreshCw className="size-3" aria-hidden />
        重试
      </Button>
    </div>
  );
}

function QueueOverviewCard({
  metric,
  isLoading,
}: {
  metric: {
    label: string;
    value: string;
    hint: string;
    icon: LucideIcon;
    tone: Tone;
  };
  isLoading: boolean;
}) {
  const toneClass = toneClasses[metric.tone];
  return (
    <div className={cn("min-w-0 rounded-xl border px-2.5 py-2 shadow-sm", toneClass.card)}>
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", toneClass.icon)}>
          <metric.icon className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/75">
            {metric.label}
          </div>
          {isLoading ? (
            <Skeleton className="mt-1 h-4 w-20" />
          ) : (
            <div className={cn("truncate text-sm font-semibold leading-5", toneClass.value)}>
              {metric.value}
            </div>
          )}
        </div>
      </div>
      <div className="mt-1 truncate text-[11px] leading-4 text-muted-foreground">{metric.hint}</div>
    </div>
  );
}

function WorkInsightCard({ insight }: { insight: DashboardWorkInsight }) {
  const toneClass = toneClasses[insight.tone];

  return (
    <div
      className={cn(
        "grid min-w-0 gap-2 rounded-2xl border px-3 py-2.5 shadow-[var(--shadow-card)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
        toneClass.card,
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          今日优先级
        </p>
        <h2 className={cn("mt-1 truncate text-sm font-semibold leading-5", toneClass.value)}>
          {insight.headline}
        </h2>
        <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
          {insight.description}
        </p>
        <div className="mt-2 flex min-w-0 flex-wrap gap-1">
          {insight.reasons.map((reason) => (
            <span
              key={reason}
              className="rounded-full bg-[var(--surface-panel-muted)] px-2 py-0.5 text-[10px] leading-4 text-muted-foreground"
            >
              {reason}
            </span>
          ))}
        </div>
      </div>
      <Button
        asChild
        size="sm"
        className="h-8 justify-center gap-1.5 rounded-xl px-3 text-xs"
        variant={insight.tone === "danger" ? "default" : "outline"}
      >
        <Link href={insight.primaryHref}>
          {insight.primaryLabel}
          <ArrowUpRight className="size-3" />
        </Link>
      </Button>
    </div>
  );
}

function WorkInsightSkeleton() {
  return (
    <div
      data-ui="dashboard-work-insight-loading"
      role="status"
      aria-label="正在加载今日优先级"
      className="grid min-w-0 gap-2 rounded-2xl border border-[var(--border-panel)] bg-card px-3 py-2.5 shadow-[var(--shadow-card)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-48 max-w-full" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
      <Skeleton className="h-8 w-24 rounded-xl" />
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
  isLoading = false,
  isUnavailable = false,
}: {
  label: string;
  value: number | ReactNode;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  isLoading?: boolean;
  isUnavailable?: boolean;
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
        <RepairOsInfoTile
          label={label}
          value={
            isLoading ? (
              <Skeleton className="h-5 w-14" />
            ) : isUnavailable ? (
              <span aria-label={`${label}暂时不可用`}>—</span>
            ) : typeof value === "number" ? (
              <AnimatedNumber value={value} />
            ) : (
              value
            )
          }
          frame="plain"
          className="min-w-0"
          labelClassName="text-[10px] uppercase tracking-widest text-muted-foreground/70"
          valueClassName={cn(
            "mt-1 truncate font-mono text-xl font-semibold tabular-nums leading-none",
            toneClass.value,
          )}
        />
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", toneClass.icon)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 truncate text-[11px] leading-4 text-muted-foreground">{hint}</p>
    </motion.div>
  );
}

function TaskCard({
  task,
  isLoading = false,
  isUnavailable = false,
}: {
  task: DashboardTask;
  isLoading?: boolean;
  isUnavailable?: boolean;
}) {
  const toneClass = toneClasses[task.tone];
  return (
    <Link
      href={task.href}
      className="block min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <RepairOsBusinessCard
        leading={
          <span className={cn("grid size-8 place-items-center rounded-md", toneClass.icon)}>
            <task.icon className="size-4" />
          </span>
        }
        trailing={
          isLoading ? (
            <Skeleton className="h-5 w-8" />
          ) : isUnavailable ? (
            <span
              aria-label={`${task.label}暂时不可用`}
              className={cn("font-mono text-lg font-semibold tabular-nums", toneClass.value)}
            >
              —
            </span>
          ) : (
            <span className={cn("font-mono text-lg font-semibold tabular-nums", toneClass.value)}>
              <AnimatedNumber value={task.value} />
            </span>
          )
        }
        className={cn("items-center px-3 py-2 hover:bg-accent/60", toneClass.card)}
      >
        <span className="block truncate text-sm font-semibold leading-5">{task.label}</span>
        <span className="block truncate text-[11px] leading-4 text-muted-foreground">
          {task.hint}
        </span>
      </RepairOsBusinessCard>
    </Link>
  );
}

function QuickModuleLink({ module }: { module: (typeof quickModules)[number] }) {
  return (
    <Link
      href={module.href}
      className="block min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <RepairOsBusinessCard
        leading={
          <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
            <module.icon className="size-4" />
          </span>
        }
        trailing={<ArrowUpRight className="size-3.5 text-muted-foreground" />}
        className="items-center px-3 py-2 hover:bg-accent/60"
      >
        <span className="block truncate text-sm font-semibold leading-5">{module.title}</span>
        <span className="block truncate text-[11px] leading-4 text-muted-foreground">
          {module.description}
        </span>
      </RepairOsBusinessCard>
    </Link>
  );
}

function RecentOrderCard({ order }: { order: OrderListItem }) {
  const workflowStatus = order.workflow_status ?? workflowStatusFromLegacyStatus(order.status);
  const workflowMeta = orderWorkflowMeta[workflowStatus];
  return (
    <Link
      href={`/orders/${order.id}`}
      className="block min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <RepairOsBusinessCard
        leading={
          <span className="mt-0.5 grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
            <Smartphone className="size-4" />
          </span>
        }
        trailing={
          order.finance_redacted ? undefined : (
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
          )
        }
        className="px-3 py-2 hover:bg-accent/60"
      >
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
      </RepairOsBusinessCard>
    </Link>
  );
}

function RecentOrdersSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <RepairOsBusinessCard
          key={index}
          leading={<Skeleton className="size-8 rounded-md" />}
          trailing={<Skeleton className="h-4 w-14" />}
          className="px-3 py-2"
        >
          <span className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-24" />
          </span>
        </RepairOsBusinessCard>
      ))}
    </>
  );
}
