"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type Ref,
  type SetStateAction,
  type SyntheticEvent,
} from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Download,
  Filter,
  ListChecks,
  MoreHorizontal,
  Plus,
  Printer,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fadeUp, floatingBar, indicatorSpring, stagger } from "@/lib/motion";
import {
  brandGradientStyle,
  controls,
  density,
  layoutGuards,
  repairOs,
  stateBlocks,
} from "@/lib/ui-patterns";
import { componentOverlay } from "@/lib/component-patterns";

import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

import { MoneyText, OrderTypeBadge, PhoneText, StatusBadge } from "@/components/orders/badges";
import { OrderMobileCard } from "@/features/orders/components/order-list-items";
import { OrderListPrintSheet } from "@/features/orders/components/order-list-print-sheet";
import { OrderDetailScreen } from "@/features/orders/screens/order-detail-screen";
import { NewOrderScreen } from "@/features/orders/screens/new-order-screen";
import {
  batchTransition,
  getRepairDeskOptions,
  listOrderWorkflow,
  listOrdersPage,
  transitionOrder,
  type OrderListFilters,
  type OrderListItem,
  type OrderWorkflow,
  type RepairDeskOptions,
} from "@/lib/repairdesk/api";
import { repairOrderType, type RepairOrderStatus } from "@/lib/mock/enums";
import {
  getCommonWorkflowTargets,
  getWorkflowNextActions,
  getWorkflowStatusLabel,
  getWorkflowStatuses,
  type OrderListStatusTab,
} from "@/features/orders/model/order-workflow";
import { orderTransitionRequiresReason } from "@/features/orders/model/order-transition-reasons";
import {
  orderExceptionMeta,
  orderWorkflowMeta,
  orderWorkflowStatuses,
  workflowStatusFromLegacyStatus,
} from "@/features/orders/model/canonical-order-status";
import type { OrderWorkflowStatusCode } from "@/lib/repairdesk/types";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { REPAIRDESK_NEW_ORDER_EVENT } from "@/lib/app-events";
import { cn } from "@/lib/utils";

const ORDER_LIST_PAGE_SIZE = 50;

const orderStageHints: Record<OrderWorkflowStatusCode | "all", string> = {
  all: "全部客户队列",
  intake: "刚收机/待受理",
  diagnosis: "检测诊断中",
  quote: "报价待确认",
  parts: "订件/等到货",
  repair: "维修执行中",
  pickup: "通知/待取机",
  closed: "已完成归档",
};

type ActiveFilterChip = {
  key: string;
  label: string;
};

function FiltersPanel({
  filters,
  setFilters,
  options,
  statuses,
  onClose,
  onStatusFilterChange,
}: {
  filters: OrderListFilters;
  setFilters: Dispatch<SetStateAction<OrderListFilters>>;
  options: RepairDeskOptions;
  statuses: { code: RepairOrderStatus; label: string }[];
  onClose?: () => void;
  onStatusFilterChange?: () => void;
}) {
  const toggle = <K extends keyof OrderListFilters>(key: K, value: string) => {
    const arr = (filters[key] as string[] | undefined) ?? [];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    setFilters({ ...filters, [key]: next });
    if (key === "statuses") onStatusFilterChange?.();
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4 pt-5">
          <FilterGroup label="主流程">
            <div className="flex flex-wrap gap-1.5">
              {orderWorkflowStatuses.map((status) => {
                const active = filters.workflowStatuses?.includes(status);
                return (
                  <button
                    key={status}
                    onClick={() => {
                      toggle("workflowStatuses", status);
                      onStatusFilterChange?.();
                    }}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-surface hover:bg-accent",
                    )}
                  >
                    {orderWorkflowMeta[status].label}
                  </button>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup label="异常">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(orderExceptionMeta).map(([status, meta]) => {
                const active = filters.exceptionStatuses?.includes(status as never);
                return (
                  <button
                    key={status}
                    onClick={() => toggle("exceptionStatuses", status)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs transition-colors",
                      active
                        ? "border-status-danger-foreground/40 bg-status-danger/15 text-status-danger-foreground"
                        : "bg-surface hover:bg-accent",
                    )}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup label="工单状态">
            <div className="flex flex-wrap gap-1.5">
              {statuses.map((status) => {
                const active = filters.statuses?.includes(status.code);
                return (
                  <button
                    key={status.code}
                    onClick={() => toggle("statuses", status.code)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-surface hover:bg-accent",
                    )}
                  >
                    {status.label}
                  </button>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup label="工单类型">
            <div className="flex gap-1.5">
              {repairOrderType.map((t) => {
                const active = filters.types?.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggle("types", t)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-surface hover:bg-accent",
                    )}
                  >
                    {t === "quick_repair" ? "快修" : "送修"}
                  </button>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup label="付款状态">
            <div className="flex gap-1.5">
              {(["all", "paid", "unpaid"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setFilters({ ...filters, paid: p })}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs",
                    (filters.paid ?? "all") === p
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-surface hover:bg-accent",
                  )}
                >
                  {p === "all" ? "全部" : p === "paid" ? "已结清" : "未结清"}
                </button>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label="技师">
            <div className="space-y-1.5">
              {options.technicians.map((t) => (
                <label
                  key={t}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={filters.technicians?.includes(t) ?? false}
                    onCheckedChange={() => toggle("technicians", t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label="外修供应商">
            <div className="space-y-1.5">
              {options.suppliers.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={filters.supplierIds?.includes(s.id) ?? false}
                    onCheckedChange={() => toggle("supplierIds", s.id)}
                  />
                  <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                  {s.short_name}
                </label>
              ))}
            </div>
          </FilterGroup>
        </div>
      </ScrollArea>
      {onClose && (
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 border-t p-3">
          <Button
            variant="outline"
            onClick={() => {
              setFilters({ search: filters.search });
              onStatusFilterChange?.();
            }}
          >
            重置
          </Button>
          <Button className="w-full" onClick={onClose}>
            应用筛选
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function EmptyOrdersState({
  hasActiveFilters,
  onClearFilters,
}: {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mx-auto mt-16 flex max-w-sm flex-col items-center justify-center text-center"
    >
      <div className={stateBlocks.emptyIcon} style={brandGradientStyle}>
        <Search className="size-7" />
      </div>
      <h3 className="font-display text-lg font-semibold">
        {hasActiveFilters ? "暂无符合条件的工单" : "暂无工单"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasActiveFilters
          ? "当前有筛选条件生效，可以清除后再查看。"
          : "新建第一张维修工单后会显示在这里。"}
      </p>
      {hasActiveFilters && (
        <Button variant="outline" size="sm" className="mt-3 h-8" onClick={onClearFilters}>
          清除全部筛选
        </Button>
      )}
    </motion.div>
  );
}

const orderQueueDesktopGrid =
  "grid min-w-0 grid-cols-[32px_minmax(82px,0.7fr)_minmax(104px,0.82fr)_minmax(142px,1.12fr)_minmax(132px,1fr)_minmax(70px,0.48fr)_32px] items-center xl:grid-cols-[34px_minmax(92px,0.72fr)_minmax(104px,0.78fr)_minmax(140px,1.08fr)_minmax(132px,0.98fr)_minmax(76px,0.5fr)_minmax(82px,0.52fr)_minmax(58px,0.38fr)_34px]";

function DesktopOrderQueueRow({
  order,
  workflow,
  checked,
  onOpen,
  onCheckedChange,
  onTransition,
  onPrint,
  onStopInteraction,
}: {
  order: OrderListItem;
  workflow?: OrderWorkflow;
  checked: boolean;
  onOpen: () => void;
  onCheckedChange: (checked: boolean) => void;
  onTransition: (to: RepairOrderStatus) => void;
  onPrint: () => void;
  onStopInteraction: (event: SyntheticEvent) => void;
}) {
  const workflowStatus = order.workflow_status ?? workflowStatusFromLegacyStatus(order.status);
  const exceptionStatus = order.exception_status;
  const next = getWorkflowNextActions(workflow, order.status);
  const hasOverdueException = Boolean(order.approval_overdue || order.pickup_overdue);
  const createdDate = new Date(order.created_at).toLocaleDateString("zh-CN");
  const paymentLabel = order.is_paid ? "已结清" : order.deposit_amount > 0 ? "已付押金" : "未收款";
  const paymentClass = order.is_paid
    ? "text-status-success-foreground"
    : order.deposit_amount > 0
      ? "text-status-warn-foreground"
      : "text-status-danger-foreground";
  const primaryRepair = order.fault_prices[0];
  const extraRepairCount = Math.max(0, order.fault_prices.length - 1);
  const allNextActions = [next.primary, ...next.secondary].filter(
    (action): action is NonNullable<typeof next.primary> => Boolean(action),
  );
  const quickActions = allNextActions.filter((action) => !orderTransitionRequiresReason(action.to));
  const reasonRequiredCount = allNextActions.length - quickActions.length;
  const nextLabel = allNextActions[0]?.label ?? "暂无推荐流转";

  return (
    <motion.div
      data-order-row="true"
      variants={fadeUp}
      role="button"
      aria-label={`查看工单详情 ${order.public_no}`}
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpen();
      }}
      className={cn(
        orderQueueDesktopGrid,
        "group relative min-h-12 cursor-pointer overflow-hidden rounded-lg border border-border/55 bg-surface/80 text-xs shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/25 hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        checked && "border-primary/35 bg-primary/10",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px] transition-opacity",
          checked && "opacity-100",
        )}
        style={brandGradientStyle}
      />

      <div className="px-2 py-1.5 pl-3" onClick={onStopInteraction}>
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(Boolean(value))}
          aria-label={`选择工单 ${order.public_no}`}
        />
      </div>

      <div className="min-w-0 px-2 py-1.5">
        <span
          className="block truncate font-mono text-[11px] font-semibold leading-4 text-primary"
          title={order.public_no}
        >
          {order.public_no}
        </span>
        <div className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
          {createdDate} · {order.technician_name || "-"}
        </div>
        {order.accessory_notes ? (
          <div
            className="truncate text-[10px] leading-4 text-muted-foreground"
            title={order.accessory_notes}
          >
            留存：{order.accessory_notes}
          </div>
        ) : null}
      </div>

      <div className="min-w-0 px-2 py-1.5">
        <div className="truncate font-semibold leading-4" title={order.customer_name}>
          {order.customer_name || "-"}
        </div>
        <PhoneText value={order.customer_phone} className="block truncate text-[11px] leading-4" />
      </div>

      <div className="min-w-0 px-2 py-1.5">
        <div className="truncate font-medium leading-4" title={order.device_label}>
          {order.device_label || "-"}
        </div>
        <div
          className="truncate text-[11px] leading-4 text-muted-foreground"
          title={order.issue_description}
        >
          {order.issue_description || "-"}
        </div>
        {order.device_imei ? (
          <div
            className="truncate font-mono text-[10px] leading-4 text-muted-foreground"
            title={order.device_imei}
          >
            IMEI {order.device_imei.slice(-10)}
          </div>
        ) : null}
      </div>

      <div className="min-w-0 px-2 py-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <StatusBadge
            status={order.status}
            label={orderWorkflowMeta[workflowStatus].shortLabel}
            tone={orderWorkflowMeta[workflowStatus].tone}
            className="max-w-full text-[10px]"
          />
          {exceptionStatus ? (
            <StatusBadge
              status={order.status}
              label={orderExceptionMeta[exceptionStatus].shortLabel}
              tone={orderExceptionMeta[exceptionStatus].tone}
              className="max-w-full text-[10px]"
            />
          ) : null}
          {hasOverdueException ? (
            <span className="inline-flex max-w-full shrink-0 items-center gap-1 truncate whitespace-nowrap rounded bg-status-danger/15 px-1.5 py-0.5 text-[10px] font-medium leading-none text-status-danger-foreground ring-1 ring-inset ring-status-danger-foreground/30">
              <AlertTriangle className="size-2.5 shrink-0" />
              {order.approval_overdue ? "报价超期" : "取件超期"}
            </span>
          ) : null}
        </div>
        <div className="mt-1 truncate text-[11px] leading-4 text-muted-foreground">
          {reasonRequiredCount ? `详情处理：${nextLabel}` : `下一步：${nextLabel}`}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1 xl:hidden">
          <OrderTypeBadge type={order.order_type} className="max-w-[4.25rem] text-[10px]" />
          <span className="min-w-0 truncate text-[10px] leading-3 text-muted-foreground">
            {primaryRepair?.name || "待报价"}
            {extraRepairCount ? ` +${extraRepairCount}` : ""}
          </span>
        </div>
      </div>

      <div className="min-w-0 px-2 py-1.5 text-right">
        <MoneyText
          amount={order.quotation_amount}
          className="whitespace-nowrap text-sm font-semibold"
        />
        <div className={cn("whitespace-nowrap text-[11px] leading-4", paymentClass)}>
          {paymentLabel}
        </div>
      </div>

      <div className="hidden min-w-0 px-2 py-1.5 text-[11px] text-muted-foreground xl:block">
        <div className="flex min-w-0 items-center gap-1 whitespace-nowrap">
          <Clock className="size-3 shrink-0" />
          {createdDate}
        </div>
        <div className="truncate leading-4" title={order.technician_name}>
          {order.technician_name || "-"}
        </div>
      </div>

      <div className="hidden min-w-0 px-2 py-1.5 xl:block">
        <OrderTypeBadge type={order.order_type} className="max-w-full text-[10px]" />
        <div className="mt-1 truncate text-[10px] leading-3 text-muted-foreground">
          {primaryRepair?.name || "待报价"}
          {extraRepairCount ? ` +${extraRepairCount}` : ""}
        </div>
      </div>

      <div className="px-1.5 py-1.5" onClick={onStopInteraction}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label="更多工单操作">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link href={`/orders/${order.id}`}>在新页打开</Link>
            </DropdownMenuItem>
            {quickActions.length ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  下一步
                </DropdownMenuLabel>
                {quickActions.map((action, index) => (
                  <DropdownMenuItem
                    key={action.to}
                    onClick={() => onTransition(action.to)}
                    className={cn(index === 0 && "font-medium text-primary")}
                  >
                    {index === 0 ? <ArrowRight className="mr-2 size-3.5" /> : null}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </>
            ) : null}
            {reasonRequiredCount ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>需在详情记录原因</DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onPrint}>
              <Printer className="mr-2 size-3.5" /> 打印
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}

function OrdersErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto mt-16 flex max-w-lg flex-col items-center justify-center rounded-xl border border-status-danger-foreground/25 bg-status-danger/10 px-4 py-5 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-status-danger/15 text-status-danger-foreground">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="font-display text-lg font-semibold">工单加载失败</h3>
      <p className="mt-1 max-w-md break-words text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" className="mt-3 h-8 gap-1.5" onClick={onRetry}>
        <RefreshCw className="size-3.5" /> 重试
      </Button>
    </div>
  );
}

function MobileOrdersFloatingHeader({
  groups,
  groupValue,
  filters,
  setFilters,
  totalOrders,
  activeFilterChips,
  mobileFiltersOpen,
  setMobileFiltersOpen,
  options,
  statuses,
  workflowIsError,
  workflowErrorMessage,
  onGroupChange,
  onStatusFilterChange,
  onRemoveFilterChip,
  onClearAllFilters,
  onCreateOrder,
  headerRef,
}: {
  groups: { key: string; label: string; count: number; hint?: string }[];
  groupValue: string;
  filters: OrderListFilters;
  setFilters: Dispatch<SetStateAction<OrderListFilters>>;
  totalOrders: number;
  activeFilterChips: ActiveFilterChip[];
  mobileFiltersOpen: boolean;
  setMobileFiltersOpen: (open: boolean) => void;
  options: RepairDeskOptions;
  statuses: { code: RepairOrderStatus; label: string }[];
  workflowIsError: boolean;
  workflowErrorMessage: string;
  onGroupChange: (value: string) => void;
  onStatusFilterChange: () => void;
  onRemoveFilterChip: (key: string) => void;
  onClearAllFilters: () => void;
  onCreateOrder: () => void;
  headerRef?: Ref<HTMLDivElement>;
}) {
  const activeGroup = groups.find((group) => group.key === groupValue);
  const activeFilterCount = activeFilterChips.length;

  return (
    <div ref={headerRef} className={repairOs.mobileListHeaderShell}>
      <section className={repairOs.mobileFloatingHeaderCard}>
        <header className={repairOs.mobileFloatingHeaderNav}>
          <SidebarTrigger className="size-7 rounded-lg border border-[var(--border-panel)] bg-card shadow-none" />
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-semibold leading-5">订单管理</p>
            <p className="truncate text-[9px] leading-3 text-muted-foreground">
              {activeGroup?.label ?? "全部"} · 共 {totalOrders} 条
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            className="size-7 rounded-lg border-0 text-primary-foreground shadow-[var(--shadow-action)]"
            style={brandGradientStyle}
            onClick={onCreateOrder}
            aria-label="新建工单"
          >
            <Plus className="size-4" />
          </Button>
        </header>

        <div className={cn(repairOs.mobileFloatingHeaderBody, "space-y-1.5")}>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_32px] gap-1.5">
            <div className={cn(repairOs.searchBar, "h-8 rounded-xl px-2 shadow-none")}>
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <Input
                value={filters.search ?? ""}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value || undefined,
                  }))
                }
                placeholder="搜索订单、客户、手机"
                className={cn(repairOs.searchInput, "h-7 text-xs")}
              />
            </div>

            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="relative size-8 rounded-xl bg-card"
                  aria-label="筛选订单"
                >
                  <Filter className="size-3.5" />
                  {activeFilterCount > 0 ? (
                    <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold leading-4 text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-sm p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>筛选</SheetTitle>
                </SheetHeader>
                <FiltersPanel
                  filters={filters}
                  setFilters={setFilters}
                  options={options}
                  statuses={statuses}
                  onClose={() => setMobileFiltersOpen(false)}
                  onStatusFilterChange={onStatusFilterChange}
                />
              </SheetContent>
            </Sheet>
          </div>

          <div className="min-w-0 overflow-x-auto pb-0.5" aria-label="流程分组">
            <div className="relative grid min-w-[430px] grid-cols-8">
              <span
                aria-hidden
                className="absolute left-[calc(100%/16)] right-[calc(100%/16)] top-3 h-px bg-border"
              />
              {groups.map((group) => {
                const active = groupValue === group.key;
                const isAll = group.key === "all";
                const workflowKey = group.key as OrderWorkflowStatusCode;
                const shortLabel =
                  (isAll ? "全" : orderWorkflowMeta[workflowKey]?.shortLabel) ??
                  group.label.slice(0, 1);

                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => onGroupChange(group.key)}
                    className="relative z-10 grid min-w-0 justify-items-center gap-0.5 px-0.5 text-center"
                    aria-pressed={active}
                  >
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full border text-[11px] font-semibold leading-none transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-none"
                          : "border-border bg-surface-muted text-muted-foreground",
                      )}
                    >
                      {shortLabel}
                    </span>
                    <span
                      className={cn(
                        "flex max-w-full items-center justify-center gap-0.5 truncate text-[9px] leading-3",
                        active ? "font-semibold text-primary" : "text-muted-foreground",
                      )}
                    >
                      <span className="truncate">{group.label}</span>
                      <span
                        className={cn(
                          "font-mono text-[9px] tabular-nums",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {group.count}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeFilterChips.length > 0 ? (
            <div className="flex min-w-0 snap-x gap-1 overflow-x-auto pb-0.5">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => onRemoveFilterChip(chip.key)}
                  className="inline-flex h-6 max-w-[180px] shrink-0 snap-start items-center gap-1 rounded-full border border-[var(--border-panel)] bg-surface-muted px-2 text-[10px] font-medium text-muted-foreground"
                  title="点击移除此筛选"
                >
                  <span className="truncate">{chip.label}</span>
                  <X className="size-2.5 shrink-0" />
                </button>
              ))}
              <button
                type="button"
                onClick={onClearAllFilters}
                className="h-6 shrink-0 rounded-full px-2 text-[10px] font-medium text-primary"
              >
                清除
              </button>
            </div>
          ) : null}

          {workflowIsError ? (
            <div className="flex min-w-0 items-center gap-1 rounded-md border border-status-warn-foreground/25 bg-status-warn/10 px-2 py-1 text-[10px] text-status-warn-foreground">
              <AlertTriangle className="size-3 shrink-0" />
              <span className="min-w-0 truncate">状态流未加载：{workflowErrorMessage}</span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default function OrdersListPage() {
  const [statusGroup, setStatusGroup] = useState<"all" | OrderWorkflowStatusCode>("all");
  const [statusCode, setStatusCode] = useState<string>("all");
  const [filters, setFilters] = useState<OrderListFilters>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [printOrders, setPrintOrders] = useState<OrderListItem[]>([]);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const mobileHeaderRef = useRef<HTMLDivElement | null>(null);
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    document.body.dataset.mobileWorkspaceActive = "true";
    return () => {
      delete document.body.dataset.mobileWorkspaceActive;
    };
  }, []);

  useEffect(() => {
    const header = mobileHeaderRef.current;
    if (!header) return;

    const updateHeight = () => {
      setMobileHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  const {
    data: workflow,
    isError: workflowIsError,
    error: workflowError,
  } = useQuery({
    queryKey: ordersKeys.workflow(),
    queryFn: () => listOrderWorkflow(),
    staleTime: 60_000,
  });
  const statusSubTabs = useMemo<OrderListStatusTab[]>(
    () => [{ key: "all", label: "全部状态" }],
    [],
  );
  const workflowStatuses = useMemo(
    () =>
      getWorkflowStatuses(workflow).map((status) => ({ code: status.code, label: status.label })),
    [workflow],
  );

  const effectiveFilters = useMemo<OrderListFilters>(() => {
    return {
      ...filters,
      workflowStatuses: statusGroup === "all" ? filters.workflowStatuses : [statusGroup],
    };
  }, [filters, statusGroup]);

  const {
    data: listResult,
    isLoading,
    isError: listIsError,
    error: listError,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ["orders", "page", effectiveFilters, page, ORDER_LIST_PAGE_SIZE],
    queryFn: () => listOrdersPage({ ...effectiveFilters, page, pageSize: ORDER_LIST_PAGE_SIZE }),
    staleTime: 15_000,
  });

  const { data: options = { suppliers: [], technicians: [] } } = useQuery({
    queryKey: ["repairdesk-options"],
    queryFn: () => getRepairDeskOptions(),
  });

  const data = useMemo(() => listResult?.items ?? [], [listResult?.items]);
  const totalOrders = listResult?.total ?? 0;
  const pageCount = listResult?.pageCount ?? 1;
  const statusGroups = useMemo(
    () => [
      {
        key: "all" as const,
        label: "全部",
        count: listResult?.workflowCounts?.all ?? 0,
        hint: orderStageHints.all,
      },
      ...orderWorkflowStatuses.map((status) => ({
        key: status,
        label: orderWorkflowMeta[status].shortLabel,
        count: listResult?.workflowCounts?.[status] ?? 0,
        hint: orderStageHints[status],
      })),
    ],
    [listResult?.workflowCounts],
  );
  const listErrorMessage =
    listError instanceof Error ? listError.message : "请检查网络、登录状态或数据库迁移。";
  const workflowErrorMessage =
    workflowError instanceof Error ? workflowError.message : "状态流配置暂时不可用。";

  const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    const statusLabels = new Map(workflowStatuses.map((status) => [status.code, status.label]));
    const activeGroup = statusGroups.find((group) => group.key === statusGroup);

    if (filters.search?.trim()) chips.push({ key: "search", label: `搜索：${filters.search}` });
    if (filters.statuses?.length) {
      filters.statuses.forEach((status) =>
        chips.push({
          key: `status:${status}`,
          label: `状态：${statusLabels.get(status) ?? status}`,
        }),
      );
    } else if (filters.workflowStatuses?.length) {
      filters.workflowStatuses.forEach((status) =>
        chips.push({
          key: `workflow:${status}`,
          label: `流程：${orderWorkflowMeta[status].label}`,
        }),
      );
    } else if (statusCode !== "all") {
      chips.push({
        key: "substatus",
        label: `状态：${statusLabels.get(statusCode as RepairOrderStatus) ?? statusCode}`,
      });
    } else if (statusGroup !== "all") {
      chips.push({
        key: "phase",
        label: `流程：${activeGroup?.label ?? orderWorkflowMeta[statusGroup].label}`,
      });
    }
    filters.exceptionStatuses?.forEach((status) =>
      chips.push({
        key: `exception:${status}`,
        label: `异常：${orderExceptionMeta[status].label}`,
      }),
    );
    filters.types?.forEach((type) =>
      chips.push({
        key: `type:${type}`,
        label: `类型：${type === "quick_repair" ? "快修" : "送修"}`,
      }),
    );
    if (filters.paid && filters.paid !== "all") {
      chips.push({ key: "paid", label: `付款：${filters.paid === "paid" ? "已结清" : "未结清"}` });
    }
    filters.technicians?.forEach((technician) =>
      chips.push({ key: `technician:${technician}`, label: `技师：${technician}` }),
    );
    const supplierLabels = new Map(
      options.suppliers.map((supplier) => [supplier.id, supplier.short_name]),
    );
    filters.supplierIds?.forEach((supplierId) =>
      chips.push({
        key: `supplier:${supplierId}`,
        label: `外修：${supplierLabels.get(supplierId) ?? supplierId}`,
      }),
    );
    if (filters.overdue) {
      chips.push({
        key: "overdue",
        label:
          filters.overdue === "approval"
            ? "报价超期"
            : filters.overdue === "pickup"
              ? "取件超期"
              : "超期",
      });
    }

    return chips;
  }, [filters, options.suppliers, statusCode, statusGroup, statusGroups, workflowStatuses]);
  const hasActiveFilters = activeFilterChips.length > 0;
  const isPageOutOfRange = Boolean(
    listResult && listResult.total > 0 && !listResult.items.length && page > pageCount,
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["order-stats"] });
  };

  const transition = useMutation({
    mutationFn: ({ id, to }: { id: string; to: RepairOrderStatus }) => transitionOrder(id, to),
    onSuccess: (_r, vars) => {
      toast.success(`已流转为「${getWorkflowStatusLabel(workflow, vars.to)}」`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: ({ ids, to }: { ids: string[]; to: RepairOrderStatus }) => batchTransition(ids, to),
    onSuccess: (r, vars) => {
      toast.success(
        `已将 ${r.count} 条流转为「${getWorkflowStatusLabel(workflow, vars.to)}」` +
          (r.failures.length ? `（${r.failures.length} 条失败）` : ""),
      );
      setSelected([]);
      invalidate();
    },
  });

  const allSelected = data.length > 0 && selected.length === data.length;

  // Targets allowed across ALL selected rows (for bulk dropdown).
  const rawBulkTargets = useMemo(() => {
    if (!selected.length) return [] as RepairOrderStatus[];
    const currents = data.filter((o) => selected.includes(o.id)).map((o) => o.status);
    return getCommonWorkflowTargets(workflow, currents);
  }, [selected, data, workflow]);
  const bulkTargets = useMemo(
    () => rawBulkTargets.filter((status) => !orderTransitionRequiresReason(status)),
    [rawBulkTargets],
  );
  const hasReasonRequiredBulkTargets = rawBulkTargets.length > bulkTargets.length;

  const clearAllFilters = () => {
    setStatusGroup("all");
    setStatusCode("all");
    setFilters({});
    setPage(1);
  };

  const removeFilterChip = (key: string) => {
    if (key === "phase") {
      setStatusGroup("all");
      setStatusCode("all");
      return;
    }
    if (key === "substatus") {
      setStatusCode("all");
      return;
    }
    setFilters((current) => {
      if (key === "search") return { ...current, search: undefined };
      if (key === "paid") return { ...current, paid: undefined };
      if (key === "overdue") return { ...current, overdue: undefined };
      if (key.startsWith("status:")) {
        const status = key.slice("status:".length);
        return { ...current, statuses: current.statuses?.filter((item) => item !== status) };
      }
      if (key.startsWith("workflow:")) {
        const status = key.slice("workflow:".length);
        return {
          ...current,
          workflowStatuses: current.workflowStatuses?.filter((item) => item !== status),
        };
      }
      if (key.startsWith("exception:")) {
        const status = key.slice("exception:".length);
        return {
          ...current,
          exceptionStatuses: current.exceptionStatuses?.filter((item) => item !== status),
        };
      }
      if (key.startsWith("type:")) {
        const type = key.slice("type:".length);
        return { ...current, types: current.types?.filter((item) => item !== type) };
      }
      if (key.startsWith("technician:")) {
        const technician = key.slice("technician:".length);
        return {
          ...current,
          technicians: current.technicians?.filter((item) => item !== technician),
        };
      }
      if (key.startsWith("supplier:")) {
        const supplierId = key.slice("supplier:".length);
        return {
          ...current,
          supplierIds: current.supplierIds?.filter((item) => item !== supplierId),
        };
      }
      return current;
    });
  };

  const resetWorkflowFilters = () => {
    setStatusGroup("all");
    setStatusCode("all");
  };

  const handleStatusGroupChange = (nextGroup: string) => {
    setStatusGroup(nextGroup as "all" | OrderWorkflowStatusCode);
    setStatusCode("all");
    setFilters((current) => ({
      ...current,
      statuses: undefined,
      workflowStatuses: undefined,
      overdue: undefined,
    }));
    setPage(1);
  };

  const handleStatusCodeChange = (nextStatus: string) => {
    setStatusCode(nextStatus);
    setFilters((current) => ({ ...current, statuses: undefined, overdue: undefined }));
    setPage(1);
  };

  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [effectiveFilters]);

  useEffect(() => {
    if (!statusGroups.some((group) => group.key === statusGroup)) {
      setStatusGroup("all");
      setStatusCode("all");
    }
  }, [statusGroup, statusGroups]);

  useEffect(() => {
    if (statusSubTabs.some((item) => item.key === statusCode)) return;
    setStatusCode("all");
  }, [statusCode, statusSubTabs]);

  useEffect(() => {
    if (!listResult || listResult.total <= 0 || page <= listResult.pageCount) return;
    setPage(listResult.pageCount);
  }, [listResult, page]);

  useEffect(() => {
    const cleanupPrint = () => setPrintOrders([]);
    window.addEventListener("afterprint", cleanupPrint);
    return () => window.removeEventListener("afterprint", cleanupPrint);
  }, []);

  useEffect(() => {
    const openNewOrder = () => setNewOrderOpen(true);
    window.addEventListener(REPAIRDESK_NEW_ORDER_EVENT, openNewOrder);
    return () => window.removeEventListener(REPAIRDESK_NEW_ORDER_EVENT, openNewOrder);
  }, []);

  const printRows = (rows: OrderListItem[]) => {
    if (!rows.length) {
      toast.error("没有可打印的工单");
      return;
    }
    setPrintOrders(rows);
    window.requestAnimationFrame(() => window.print());
  };
  const exportRows = (rows: OrderListItem[]) => {
    if (!rows.length) {
      toast.error("没有可导出的工单");
      return;
    }
    const csv = buildOrdersCsv(rows, workflow);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `repairdesk-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${rows.length} 条工单`);
  };

  const openDetail = (id: string) => setDetailOrderId(id);
  const handleNewOrderCreated = (id: string) => {
    setNewOrderOpen(false);
    setDetailOrderId(id);
    invalidate();
  };

  const stopRowClick = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const statusGroupItems = statusGroups.map((group) => ({
    key: group.key,
    label: group.label,
    count: group.count,
    hint: group.hint,
  }));

  return (
    <div
      className={cn(repairOs.mobileListFloatingPage, "md:pb-8")}
      style={
        {
          "--orders-mobile-header-offset": `${mobileHeaderHeight + 8}px`,
        } as CSSProperties
      }
    >
      <MobileOrdersFloatingHeader
        headerRef={mobileHeaderRef}
        groups={statusGroupItems}
        groupValue={statusGroup}
        filters={filters}
        setFilters={setFilters}
        totalOrders={totalOrders}
        activeFilterChips={activeFilterChips}
        mobileFiltersOpen={mobileFiltersOpen}
        setMobileFiltersOpen={setMobileFiltersOpen}
        options={options}
        statuses={workflowStatuses}
        workflowIsError={workflowIsError}
        workflowErrorMessage={workflowErrorMessage}
        onGroupChange={handleStatusGroupChange}
        onStatusFilterChange={resetWorkflowFilters}
        onRemoveFilterChip={removeFilterChip}
        onClearAllFilters={clearAllFilters}
        onCreateOrder={() => setNewOrderOpen(true)}
      />

      <div className="hidden md:block">
        <OrderStatusFilterControls
          groups={statusGroupItems}
          subTabs={statusSubTabs}
          groupValue={statusGroup}
          statusValue={statusCode}
          onGroupChange={handleStatusGroupChange}
          onStatusChange={handleStatusCodeChange}
        />
      </div>

      {/* Toolbar */}
      <div
        className={cn(
          repairOs.mobileInfoCard,
          "mb-4 mt-3 hidden min-w-0 flex-col gap-2 p-2.5 sm:gap-3 sm:p-3 md:flex",
        )}
      >
        <div className={cn(layoutGuards.wrapRow, "items-stretch")}>
          <div className="relative min-w-0 flex-[1_1_260px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search ?? ""}
              onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
              placeholder="搜索工单号、客户姓名、电话或 IMEI"
              className={controls.searchInput}
            />
          </div>
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-border/60 bg-surface/60 backdrop-blur"
              >
                <Filter className="size-3.5" /> 筛选
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-sm p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>筛选</SheetTitle>
              </SheetHeader>
              <FiltersPanel
                filters={filters}
                setFilters={setFilters}
                options={options}
                statuses={workflowStatuses}
                onClose={() => setMobileFiltersOpen(false)}
                onStatusFilterChange={resetWorkflowFilters}
              />
            </SheetContent>
          </Sheet>
          <Button
            variant="outline"
            size="sm"
            className="hidden h-9 gap-1.5 border-border/60 bg-surface/60 backdrop-blur sm:inline-flex"
            disabled={!data.length}
            onClick={() =>
              exportRows(selected.length ? data.filter((o) => selected.includes(o.id)) : data)
            }
          >
            <Download className="size-3.5" /> {selected.length ? "导出选中" : "导出当前页"}
          </Button>
          <Button
            type="button"
            size="sm"
            className={cn("hidden h-9 gap-1.5 lg:inline-flex", controls.brandButton)}
            style={brandGradientStyle}
            onClick={() => setNewOrderOpen(true)}
          >
            <Plus className="size-3.5" /> 新建工单
          </Button>
        </div>
        {workflowIsError && (
          <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-status-warn-foreground/25 bg-status-warn/10 px-2.5 py-2 text-xs text-status-warn-foreground">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              状态流未加载，正在使用默认状态。{workflowErrorMessage}
            </span>
          </div>
        )}
        {activeFilterChips.length > 0 && (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">当前筛选</span>
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => removeFilterChip(chip.key)}
                className="inline-flex h-7 max-w-full items-center gap-1 rounded-md border border-border/60 bg-surface/70 px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="点击移除此筛选"
              >
                <span className="truncate">{chip.label}</span>
                <X className="size-3 shrink-0" />
              </button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={clearAllFilters}
            >
              清除全部
            </Button>
          </div>
        )}
      </div>

      {/* List */}
      <div className="pb-8">
        {isLoading || isPageOutOfRange ? (
          <div className="space-y-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : listIsError ? (
          <OrdersErrorState message={listErrorMessage} onRetry={() => void refetchOrders()} />
        ) : !data.length ? (
          <EmptyOrdersState hasActiveFilters={hasActiveFilters} onClearFilters={clearAllFilters} />
        ) : (
          <>
            {/* Desktop work queue */}
            <div
              data-order-desktop-list="true"
              className="hidden min-w-0 max-w-full overflow-x-hidden overflow-y-hidden pb-1 lg:block"
            >
              <div className="mb-2 flex min-w-0 items-center justify-between gap-2 px-1">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">工单工作队列</div>
                  <div className="text-[11px] text-muted-foreground">
                    点击任意工单查看详情，勾选后可批量流转。
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  选中 <span className="text-foreground">{selected.length}</span>
                </span>
              </div>
              <div className="space-y-1.5">
                <div
                  className={cn(
                    orderQueueDesktopGrid,
                    "rounded-lg border border-border/40 bg-surface/45 px-1 text-[11px] font-medium text-muted-foreground",
                  )}
                >
                  <label className="flex min-w-0 cursor-pointer items-center justify-center py-1.5">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(v) => setSelected(v ? data.map((o) => o.id) : [])}
                      aria-label="选择当前页全部工单"
                    />
                  </label>
                  <div className="min-w-0 px-2 py-1.5">工单</div>
                  <div className="min-w-0 px-2 py-1.5">客户</div>
                  <div className="min-w-0 px-2 py-1.5">设备 / 故障</div>
                  <div className="min-w-0 px-2 py-1.5">状态与下一步</div>
                  <div className="px-2 py-1.5 text-right">金额</div>
                  <div className="hidden px-2 py-1.5 xl:block">时间 / 技师</div>
                  <div className="hidden px-2 py-1.5 xl:block">类型 / 项目</div>
                  <div className="px-2 py-1.5 text-right">{data.length}</div>
                </div>
                <motion.div
                  role="list"
                  variants={stagger(0.025)}
                  initial="hidden"
                  animate="show"
                  className="space-y-1.5"
                >
                  {data.map((o) => {
                    const checked = selected.includes(o.id);
                    return (
                      <DesktopOrderQueueRow
                        key={o.id}
                        order={o}
                        workflow={workflow}
                        checked={checked}
                        onOpen={() => openDetail(o.id)}
                        onCheckedChange={(value) =>
                          setSelected((prev) =>
                            value ? [...prev, o.id] : prev.filter((id) => id !== o.id),
                          )
                        }
                        onTransition={(to) => transition.mutate({ id: o.id, to })}
                        onPrint={() => printRows([o])}
                        onStopInteraction={stopRowClick}
                      />
                    );
                  })}
                </motion.div>
              </div>
            </div>

            {/* Mobile and tablet cards */}
            <motion.div
              data-order-mobile-list="true"
              variants={stagger(0.04)}
              initial="hidden"
              animate="show"
              className="space-y-1.5 lg:hidden"
            >
              {data.map((order) => (
                <motion.div key={order.id} variants={fadeUp}>
                  <OrderMobileCard order={order} />
                </motion.div>
              ))}
            </motion.div>
            <PaginationBar
              page={page}
              pageCount={pageCount}
              pageSize={ORDER_LIST_PAGE_SIZE}
              total={totalOrders}
              visible={data.length}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            variants={floatingBar}
            initial="hidden"
            animate="show"
            exit="exit"
            className="pointer-events-none fixed bottom-20 left-0 right-0 z-30 flex justify-center px-3 md:bottom-6"
          >
            <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] px-2 py-2 shadow-[var(--shadow-overlay)]">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setSelected([])}
              >
                <X className="size-4" />
              </Button>
              <span className="text-sm font-medium">
                已选 <span className="gradient-text font-semibold">{selected.length}</span> 条
              </span>
              <Separator orientation="vertical" className="h-5" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={!bulkTargets.length}>
                    批量流转状态
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>
                    {bulkTargets.length
                      ? "可用目标状态"
                      : hasReasonRequiredBulkTargets
                        ? "需记录原因的状态请在详情处理"
                        : "所选工单状态不一致，无共同流转目标"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {bulkTargets.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => bulk.mutate({ ids: selected, to: s })}>
                      {getWorkflowStatusLabel(workflow, s)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => printRows(data.filter((order) => selected.includes(order.id)))}
              >
                <Printer className="size-3.5" /> 打印
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <OrderListPrintSheet orders={printOrders} />
      <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <DialogContent className={componentOverlay.formWorkspace}>
          <DialogHeader className="sr-only">
            <DialogTitle>新建维修订单</DialogTitle>
            <DialogDescription>在弹窗中填写客户、设备、故障与报价信息。</DialogDescription>
          </DialogHeader>
          <NewOrderScreen
            surface="dialog"
            onCancel={() => setNewOrderOpen(false)}
            onCreated={handleNewOrderCreated}
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(detailOrderId)}
        onOpenChange={(open) => !open && setDetailOrderId(null)}
      >
        <DialogContent
          data-order-detail-dialog-shell="true"
          className={cn(
            componentOverlay.detailWorkspace,
            "sm:h-[calc(100svh-48px)] sm:max-h-[calc(100svh-48px)] sm:w-[min(1320px,calc(100vw-32px))] sm:max-w-[calc(100vw-32px)]",
          )}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>工单详情</DialogTitle>
            <DialogDescription>在弹窗中查看和处理当前工单详情。</DialogDescription>
          </DialogHeader>
          {detailOrderId && <OrderDetailScreen id={detailOrderId} surface="dialog" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function buildOrdersCsv(rows: OrderListItem[], workflow?: OrderWorkflow) {
  const headers = [
    "工单号",
    "客户",
    "电话",
    "设备",
    "IMEI",
    "故障",
    "维修项目",
    "状态",
    "主流程",
    "异常",
    "总价",
    "定金",
    "尾款",
    "付款",
    "技师",
    "创建时间",
    "更新时间",
  ];
  const body = rows.map((order) => {
    const workflowStatus = order.workflow_status ?? workflowStatusFromLegacyStatus(order.status);
    const repairItems = order.fault_prices
      .map((item) => `${item.name}${item.price ? ` ${item.price}` : ""}`)
      .join(" | ");
    return [
      order.public_no,
      order.customer_name,
      order.customer_phone,
      order.device_label,
      order.device_imei,
      order.issue_description,
      repairItems,
      getWorkflowStatusLabel(workflow, order.status),
      orderWorkflowMeta[workflowStatus].label,
      order.exception_status ? orderExceptionMeta[order.exception_status].label : "",
      order.quotation_amount,
      order.deposit_amount,
      order.balance_amount,
      order.is_paid ? "已结清" : "未结清",
      order.technician_name,
      formatCsvDate(order.created_at),
      formatCsvDate(order.updated_at),
    ];
  });
  return [headers, ...body].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formatCsvDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PaginationBar({
  page,
  pageCount,
  pageSize,
  total,
  visible,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  visible: number;
  onPageChange: (page: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, (page - 1) * pageSize + visible);

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border/60 bg-surface/70 px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        显示 {start}-{end} / {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          上一页
        </Button>
        <span className="min-w-16 text-center tabular-nums">
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}

function OrderStatusFilterControls({
  groups,
  subTabs,
  groupValue,
  statusValue,
  onGroupChange,
  onStatusChange,
}: {
  groups: { key: string; label: string; count: number; hint?: string }[];
  subTabs: OrderListStatusTab[];
  groupValue: string;
  statusValue: string;
  onGroupChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}) {
  const showSubTabs = groupValue !== "all" && subTabs.length > 1;
  const activeGroup = groups.find((group) => group.key === groupValue);

  return (
    <div
      data-order-desktop-flow-filter="true"
      className={cn(repairOs.mobileInfoCard, "p-2.5 md:p-2")}
    >
      <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary md:size-6">
            <ListChecks className="size-3.5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-5">流程分组</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {groupValue === "all"
                ? "按客户当前所处阶段查看工单"
                : `当前：${activeGroup?.label ?? groupValue} · ${activeGroup?.count ?? 0} 条`}
            </div>
          </div>
        </div>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          点击阶段查看对应客户
        </span>
      </div>

      <div
        data-order-desktop-flow-rail="true"
        className="hidden min-w-0 gap-1 sm:grid sm:grid-cols-4 lg:grid-cols-8"
      >
        {groups.map((group, index) => {
          const active = groupValue === group.key;
          const isAll = group.key === "all";
          const workflowKey = group.key as OrderWorkflowStatusCode;
          const tone = isAll ? "neutral" : orderWorkflowMeta[workflowKey]?.tone;
          return (
            <button
              key={group.key}
              type="button"
              onClick={() => onGroupChange(group.key)}
              className={cn(
                "relative grid min-h-10 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 overflow-hidden rounded-md border px-2 py-1.5 text-left transition-all",
                active
                  ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                  : "border-border/50 bg-surface/65 text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="orders-flow-stage-card"
                  className="absolute inset-y-1 left-0 w-0.5 rounded-full"
                  style={brandGradientStyle}
                  transition={indicatorSpring}
                />
              )}
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-xs font-semibold">{group.label}</span>
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-semibold tabular-nums",
                      active
                        ? "bg-primary text-primary-foreground"
                        : tone === "success"
                          ? "bg-status-success text-status-success-foreground"
                          : tone === "warn"
                            ? "bg-status-warn text-status-warn-foreground"
                            : tone === "progress"
                              ? "bg-status-progress text-status-progress-foreground"
                              : "bg-surface-muted",
                    )}
                  >
                    {isAll ? "全" : index}
                  </span>
                </div>
                <span className="hidden truncate text-[10px] leading-3 text-muted-foreground xl:block">
                  {group.hint ?? "当前阶段"}
                </span>
              </div>
              <span className="shrink-0 font-mono text-sm font-semibold leading-none tabular-nums text-foreground">
                {group.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 snap-x gap-1.5 overflow-x-auto pb-1 sm:hidden">
        {groups.map((group) => {
          const active = groupValue === group.key;
          return (
            <button
              key={group.key}
              type="button"
              onClick={() => onGroupChange(group.key)}
              className={cn(
                "inline-flex h-9 shrink-0 snap-start items-center gap-2 rounded-full border px-2.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-[var(--border-panel)] bg-card text-muted-foreground shadow-[var(--shadow-card)]",
              )}
            >
              <span>{group.label}</span>
              <span
                className={cn(
                  "font-mono text-[10px] font-semibold leading-none tabular-nums",
                  active
                    ? "border-l border-primary-foreground/35 pl-2 text-primary-foreground"
                    : "rounded-full bg-surface-muted px-1.5 py-0.5 text-foreground",
                )}
              >
                {group.count}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {showSubTabs && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-2 hidden min-w-0 flex-wrap items-center gap-1.5 sm:flex"
          >
            {subTabs.map((status) => {
              const active = statusValue === status.key;
              return (
                <button
                  key={status.key}
                  type="button"
                  onClick={() => onStatusChange(status.key)}
                  className={cn(
                    "relative h-7 min-w-0 rounded-md border px-2.5 text-xs font-medium transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/50 bg-surface/70 text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {status.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
