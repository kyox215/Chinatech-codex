"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Download,
  Filter,
  MoreHorizontal,
  Printer,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fadeUp, stagger } from "@/lib/motion";
import { AnimatedNumber } from "@/components/animated-number";

import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

import { MoneyText, OrderTypeBadge, PhoneText, StatusBadge } from "@/components/orders/badges";
import { OrderListPrintSheet } from "@/features/orders/components/order-list-print-sheet";
import {
  batchTransition,
  getRepairDeskOptions,
  getOrderStats,
  listOrdersPage,
  transitionOrder,
  type OrderListFilters,
  type OrderListItem,
  type RepairDeskOptions,
} from "@/lib/repairdesk/api";
import {
  repairOrderStatus,
  repairOrderType,
  statusGroups,
  statusMeta,
  type RepairOrderStatus,
} from "@/lib/mock/enums";
import { getCommonValidTargets, getNextActions } from "@/lib/mock/workflow";
import { cn } from "@/lib/utils";

const tabs: { key: string; label: string; statuses?: RepairOrderStatus[] }[] = [
  { key: "all", label: "全部" },
  { key: "in_progress", label: "进行中", statuses: statusGroups.in_progress },
  { key: "awaiting_approval", label: "待审批", statuses: statusGroups.awaiting_approval },
  { key: "awaiting_pickup", label: "待取机", statuses: statusGroups.awaiting_pickup },
  { key: "completed", label: "已完成", statuses: statusGroups.completed },
  { key: "cancelled", label: "已取消", statuses: statusGroups.cancelled },
];

const ORDER_LIST_PAGE_SIZE = 50;

function FiltersPanel({
  filters,
  setFilters,
  options,
  onClose,
}: {
  filters: OrderListFilters;
  setFilters: (f: OrderListFilters) => void;
  options: RepairDeskOptions;
  onClose?: () => void;
}) {
  const toggle = <K extends keyof OrderListFilters>(key: K, value: string) => {
    const arr = (filters[key] as string[] | undefined) ?? [];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    setFilters({ ...filters, [key]: next });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4" />
          <span className="text-sm font-semibold">高级筛选</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters({ search: filters.search })}
          className="h-7 text-xs"
        >
          重置
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          <FilterGroup label="工单状态">
            <div className="flex flex-wrap gap-1.5">
              {repairOrderStatus.map((s) => {
                const active = filters.statuses?.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggle("statuses", s)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-surface hover:bg-accent",
                    )}
                  >
                    {statusMeta[s].label}
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
        <div className="border-t p-3">
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

function KpiPill({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="glass-card group relative overflow-hidden px-3 py-2"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 size-16 rounded-full opacity-50 blur-2xl transition-opacity group-hover:opacity-80"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
      />
      <div className="relative flex items-center gap-3">
        <span className="size-1.5 rounded-full" style={{ background: accent }} />
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
            {label}
          </div>
          <div className="font-display text-lg font-semibold tabular-nums leading-none">
            <AnimatedNumber value={value} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function OrdersListPage() {
  const [tab, setTab] = useState("all");
  const [filters, setFilters] = useState<OrderListFilters>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [printOrders, setPrintOrders] = useState<OrderListItem[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const queryClient = useQueryClient();

  const effectiveFilters = useMemo<OrderListFilters>(() => {
    const tabConf = tabs.find((t) => t.key === tab);
    return {
      ...filters,
      statuses:
        filters.statuses && filters.statuses.length > 0 ? filters.statuses : tabConf?.statuses,
    };
  }, [filters, tab]);

  const {
    data: listResult,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["orders", "page", effectiveFilters, page, ORDER_LIST_PAGE_SIZE],
    queryFn: () => listOrdersPage({ ...effectiveFilters, page, pageSize: ORDER_LIST_PAGE_SIZE }),
    staleTime: 15_000,
  });

  const { data: options = { suppliers: [], technicians: [] } } = useQuery({
    queryKey: ["repairdesk-options"],
    queryFn: () => getRepairDeskOptions(),
  });

  const { data: stats } = useQuery({
    queryKey: ["order-stats"],
    queryFn: () => getOrderStats(),
  });

  const data = useMemo(() => listResult?.items ?? [], [listResult?.items]);
  const totalOrders = listResult?.total ?? stats?.total ?? 0;
  const pageCount = listResult?.pageCount ?? 1;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["order-stats"] });
  };

  const transition = useMutation({
    mutationFn: ({ id, to }: { id: string; to: RepairOrderStatus }) => transitionOrder(id, to),
    onSuccess: (_r, vars) => {
      toast.success(`已流转为「${statusMeta[vars.to].label}」`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: ({ ids, to }: { ids: string[]; to: RepairOrderStatus }) => batchTransition(ids, to),
    onSuccess: (r, vars) => {
      toast.success(
        `已将 ${r.count} 条流转为「${statusMeta[vars.to].label}」` +
          (r.failures.length ? `（${r.failures.length} 条失败）` : ""),
      );
      setSelected([]);
      invalidate();
    },
  });

  const allSelected = data.length > 0 && selected.length === data.length;

  // Targets allowed across ALL selected rows (for bulk dropdown).
  const bulkTargets = useMemo(() => {
    if (!selected.length) return [] as RepairOrderStatus[];
    const currents = data.filter((o) => selected.includes(o.id)).map((o) => o.status);
    return getCommonValidTargets(currents);
  }, [selected, data]);

  const setOverdueFilter = (kind: OrderListFilters["overdue"]) =>
    setFilters((f) => ({ ...f, overdue: f.overdue === kind ? undefined : kind }));

  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [effectiveFilters]);

  useEffect(() => {
    const cleanupPrint = () => setPrintOrders([]);
    window.addEventListener("afterprint", cleanupPrint);
    return () => window.removeEventListener("afterprint", cleanupPrint);
  }, []);

  const printRows = (rows: OrderListItem[]) => {
    if (!rows.length) {
      toast.error("没有可打印的工单");
      return;
    }
    setPrintOrders(rows);
    window.requestAnimationFrame(() => window.print());
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 md:px-6 lg:px-8">
      {/* Hero */}
      <motion.div
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
        className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <motion.div variants={fadeUp}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
            工作台 / 工单
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            <span className="gradient-text">工单</span>
            <span className="ml-2 align-middle text-base font-normal text-muted-foreground">
              共 {totalOrders} 条
            </span>
            {isFetching && !isLoading && (
              <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">
                更新中
              </span>
            )}
          </h1>
        </motion.div>
        <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2">
          <KpiPill label="今日新建" value={stats?.today ?? 0} accent="oklch(0.7 0.2 285)" />
          <KpiPill label="进行中" value={stats?.inProgress ?? 0} accent="oklch(0.78 0.16 200)" />
          <KpiPill label="未结清" value={stats?.unpaid ?? 0} accent="oklch(0.78 0.18 75)" />
          {(stats?.approvalOverdue ?? 0) > 0 && (
            <button
              onClick={() => setOverdueFilter("approval")}
              className={cn(
                "transition-transform hover:-translate-y-0.5",
                filters.overdue === "approval" && "scale-105",
              )}
            >
              <KpiPill
                label="报价超期"
                value={stats!.approvalOverdue}
                accent="oklch(0.7 0.22 30)"
              />
            </button>
          )}
          {(stats?.pickupOverdue ?? 0) > 0 && (
            <button
              onClick={() => setOverdueFilter("pickup")}
              className={cn(
                "transition-transform hover:-translate-y-0.5",
                filters.overdue === "pickup" && "scale-105",
              )}
            >
              <KpiPill label="取件超期" value={stats!.pickupOverdue} accent="oklch(0.72 0.2 50)" />
            </button>
          )}
        </motion.div>
      </motion.div>

      {/* Toolbar */}
      <div className="glass-card mb-4 flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search ?? ""}
              onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
              placeholder="搜索工单号、客户姓名、电话或 IMEI"
              className="h-9 border-border/60 bg-surface/60 pl-8 backdrop-blur transition-all focus-visible:border-primary/50 focus-visible:shadow-[0_0_0_4px_oklch(0.7_0.2_285_/_0.18)]"
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
                onClose={() => setMobileFiltersOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <Button
            variant="outline"
            size="sm"
            className="hidden h-9 gap-1.5 border-border/60 bg-surface/60 backdrop-blur sm:inline-flex"
          >
            <Download className="size-3.5" /> 导出
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <SegmentedTabs value={tab} onChange={setTab} />
          <span className="hidden text-xs text-muted-foreground sm:inline">
            选中 <span className="text-foreground">{selected.length}</span>
          </span>
        </div>
      </div>

      {/* List */}
      <div className="pb-8">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !data.length ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-auto mt-16 flex max-w-sm flex-col items-center justify-center text-center"
          >
            <div
              className="mb-4 grid size-16 place-items-center rounded-2xl text-white shadow-[0_8px_28px_-8px_oklch(0.7_0.2_285_/_0.6)]"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Search className="size-7" />
            </div>
            <h3 className="font-display text-lg font-semibold">暂无符合条件的工单</h3>
            <p className="mt-1 text-sm text-muted-foreground">试试调整搜索词或重置筛选条件。</p>
          </motion.div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="glass-card hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1180px] table-fixed text-[13px]">
                <colgroup>
                  <col className="w-9" />
                  <col className="w-[210px]" />
                  <col className="w-[190px]" />
                  <col className="w-[170px]" />
                  <col />
                  <col className="w-[126px]" />
                  <col className="w-[104px]" />
                  <col className="w-[116px]" />
                  <col className="w-[112px]" />
                  <col className="w-9" />
                </colgroup>
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border/40">
                    <th className="px-3 py-2">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(v) => setSelected(v ? data.map((o) => o.id) : [])}
                      />
                    </th>
                    <th className="px-2 py-2 text-left font-medium">工单号</th>
                    <th className="px-2 py-2 text-left font-medium">客户</th>
                    <th className="px-2 py-2 text-left font-medium">设备</th>
                    <th className="px-2 py-2 text-left font-medium">故障</th>
                    <th className="px-2 py-2 text-left font-medium">状态</th>
                    <th className="px-2 py-2 text-right font-medium">报价</th>
                    <th className="px-2 py-2 text-left font-medium">技师</th>
                    <th className="px-2 py-2 text-left font-medium">创建</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <motion.tbody variants={stagger(0.025)} initial="hidden" animate="show">
                  {data.map((o) => {
                    const checked = selected.includes(o.id);
                    return (
                      <motion.tr
                        key={o.id}
                        variants={fadeUp}
                        className={cn(
                          "group relative border-b border-border/30 align-top transition-colors hover:bg-accent/30",
                          checked && "bg-accent/40",
                        )}
                      >
                        <td className="relative px-3 py-2">
                          <span
                            className={cn(
                              "absolute inset-y-0 left-0 w-[2px] origin-top transition-transform duration-300",
                              checked ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100",
                            )}
                            style={{ background: "var(--gradient-brand)" }}
                          />
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              setSelected((prev) =>
                                v ? [...prev, o.id] : prev.filter((x) => x !== o.id),
                              )
                            }
                          />
                        </td>
                        <td className="min-w-0 px-2 py-2">
                          <Link
                            href={`/orders/${o.id}`}
                            className="block truncate font-mono text-xs font-medium leading-5 text-primary hover:underline"
                            title={o.public_no}
                          >
                            {o.public_no}
                          </Link>
                          <div className="mt-0.5 flex min-w-0 items-center gap-1 overflow-hidden">
                            <OrderTypeBadge type={o.order_type} />
                            {o.internal_tag && (
                              <span
                                className="min-w-0 truncate whitespace-nowrap rounded border border-status-warn-foreground/20 bg-status-warn px-1.5 py-0.5 text-[10px] leading-none text-status-warn-foreground"
                                title={o.internal_tag}
                              >
                                {o.internal_tag}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="min-w-0 px-2 py-2">
                          <div className="truncate font-medium leading-5" title={o.customer_name}>
                            {o.customer_name}
                          </div>
                          <PhoneText value={o.customer_phone} className="block truncate" />
                        </td>
                        <td className="min-w-0 px-2 py-2">
                          <div className="truncate leading-5" title={o.device_label}>
                            {o.device_label}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {o.device_imei.slice(-8)}
                          </div>
                        </td>
                        <td
                          className="truncate px-2 py-2 leading-5 text-muted-foreground"
                          title={o.issue_description}
                        >
                          {o.issue_description}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1">
                            <StatusBadge status={o.status} />
                            {(o.approval_overdue || o.pickup_overdue) && (
                              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded bg-status-danger/15 px-1.5 py-0.5 text-[10px] font-medium leading-none text-status-danger-foreground ring-1 ring-inset ring-status-danger-foreground/30">
                                <AlertTriangle className="size-2.5" />
                                {o.approval_overdue ? "报价超期" : "取件超期"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <MoneyText amount={o.quotation_amount} className="whitespace-nowrap" />
                          <div className="whitespace-nowrap text-[11px] text-muted-foreground">
                            {o.is_paid ? "已结清" : "未结清"}
                          </div>
                        </td>
                        <td
                          className="truncate px-2 py-2 text-muted-foreground"
                          title={o.technician_name}
                        >
                          {o.technician_name}
                        </td>
                        <td className="px-2 py-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <Clock className="size-3" />
                            {new Date(o.created_at).toLocaleDateString("zh-CN")}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          {(() => {
                            const next = getNextActions(o.status);
                            return (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="size-7">
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/orders/${o.id}`}>查看详情</Link>
                                  </DropdownMenuItem>
                                  {next.primary && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                        下一步
                                      </DropdownMenuLabel>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          transition.mutate({ id: o.id, to: next.primary!.to })
                                        }
                                        className="font-medium text-primary"
                                      >
                                        <ArrowRight className="mr-2 size-3.5" />
                                        {next.primary.label}
                                      </DropdownMenuItem>
                                      {next.secondary.map((a) => (
                                        <DropdownMenuItem
                                          key={a.to}
                                          onClick={() => transition.mutate({ id: o.id, to: a.to })}
                                        >
                                          {a.label}
                                        </DropdownMenuItem>
                                      ))}
                                    </>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => printRows([o])}>
                                    <Printer className="mr-2 size-3.5" /> 打印
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            );
                          })()}
                        </td>
                      </motion.tr>
                    );
                  })}
                </motion.tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <motion.div
              variants={stagger(0.04)}
              initial="hidden"
              animate="show"
              className="space-y-2 md:hidden"
            >
              {data.map((o) => (
                <motion.div key={o.id} variants={fadeUp}>
                  <Link
                    href={`/orders/${o.id}`}
                    className="glass-card group relative block overflow-hidden px-3 py-2.5 transition-transform active:scale-[0.99]"
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-[3px]"
                      style={{ background: "var(--gradient-brand)" }}
                    />
                    <div className="space-y-1.5 pl-2">
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                          <span className="truncate font-mono text-xs font-medium text-primary">
                            {o.public_no}
                          </span>
                          <OrderTypeBadge type={o.order_type} className="text-[11px]" />
                          {o.internal_tag && (
                            <span className="truncate whitespace-nowrap rounded border border-status-warn-foreground/20 bg-status-warn px-1.5 py-0.5 text-[10px] leading-none text-status-warn-foreground">
                              {o.internal_tag}
                            </span>
                          )}
                        </div>
                        <StatusBadge status={o.status} />
                      </div>

                      <div className="grid min-w-0 grid-cols-[1fr_auto] items-start gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium leading-5">
                            {o.customer_name || "-"}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              · {o.device_label}
                            </span>
                          </div>
                          <PhoneText value={o.customer_phone} className="block truncate" />
                        </div>
                        <div className="text-right">
                          <MoneyText
                            amount={o.quotation_amount}
                            className="text-sm font-semibold"
                          />
                          <div className="text-[10px] leading-4 text-muted-foreground">
                            {o.is_paid ? "已结清" : "未结清"}
                          </div>
                        </div>
                      </div>

                      <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="min-w-0 truncate">{o.issue_description}</span>
                        <span className="shrink-0 whitespace-nowrap">
                          {o.technician_name || "-"} ·{" "}
                          {new Date(o.created_at).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                    </div>
                  </Link>
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
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="pointer-events-none fixed bottom-20 left-0 right-0 z-30 flex justify-center px-3 md:bottom-6"
          >
            <div className="glass-strong pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl px-2 py-2 shadow-elevated">
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
                    {bulkTargets.length ? "可用目标状态" : "所选工单状态不一致，无共同流转目标"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {bulkTargets.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => bulk.mutate({ ids: selected, to: s })}>
                      {statusMeta[s].label}
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
              <Button
                size="sm"
                className="border-0 text-white"
                style={{ background: "var(--gradient-brand)" }}
              >
                发送通知
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <OrderListPrintSheet orders={printOrders} />
    </div>
  );
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

function SegmentedTabs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 overflow-x-auto rounded-lg border border-border/60 bg-surface/60 p-1 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "relative whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="orders-tab-indicator"
                className="absolute inset-0 -z-10 rounded-md"
                style={{
                  background:
                    "linear-gradient(120deg, oklch(0.7 0.2 285 / 0.25), oklch(0.78 0.16 200 / 0.18))",
                  boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.08)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
