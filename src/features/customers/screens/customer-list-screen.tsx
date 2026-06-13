"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Bell,
  ChevronLeft,
  ChevronRight,
  Filter,
  Mail,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createCustomer,
  getCustomerDetail,
  listCustomersPage,
  type CustomerCreateInput,
  type CustomerListFilters,
} from "@/lib/repairdesk/api";
import { customersKeys } from "@/features/customers/api/query-keys";
import {
  CustomerKpiCard,
  CustomerMobileCard,
  CustomerRow,
} from "@/features/customers/components/customer-list-items";
import { CustomerFilters } from "@/features/customers/forms/customer-filters";
import { CustomerFormDialog } from "@/features/customers/forms/customer-form-dialog";
import { defaultCustomerForm } from "@/features/customers/model/customer-list";
import { fadeUp, stagger } from "@/lib/motion";
import { RepairOsChipRow, RepairOsMetricStrip, RepairOsModuleHeader } from "@/shared/ui";
import {
  brandGradientStyle,
  controls,
  dataDisplay,
  density,
  layoutGuards,
  pageShell,
  repairOs,
} from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const CUSTOMER_PAGE_SIZE = 50;
const CUSTOMER_SEARCH_DEBOUNCE_MS = 280;

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debounced;
}

export function CustomerListScreen() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [baseFilters, setBaseFilters] = useState<CustomerListFilters>({
    marketing: "all",
    followup: "all",
  });
  const [searchDraft, setSearchDraft] = useState("");
  const debouncedSearch = useDebouncedValue(searchDraft, CUSTOMER_SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") setCreateOpen(true);
  }, [searchParams]);

  const filters = useMemo<CustomerListFilters>(() => {
    const search = debouncedSearch.trim();
    return {
      ...baseFilters,
      ...(search ? { search } : {}),
    };
  }, [baseFilters, debouncedSearch]);

  const queryInput = useMemo(
    () => ({
      ...filters,
      page,
      pageSize: CUSTOMER_PAGE_SIZE,
    }),
    [filters, page],
  );

  const { data, isFetching, isPending, isPlaceholderData } = useQuery({
    queryKey: customersKeys.listPage(queryInput),
    queryFn: () => listCustomersPage(queryInput),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const updateFilters = useCallback((next: CustomerListFilters) => {
    setBaseFilters({
      tagIds: next.tagIds,
      marketing: next.marketing ?? "all",
      followup: next.followup ?? "all",
    });
    setPage(1);
  }, []);

  const prefetchCustomerDetail = useCallback(
    (customerId: string) => {
      queryClient.prefetchQuery({
        queryKey: customersKeys.detail(customerId),
        queryFn: () => getCustomerDetail(customerId),
        staleTime: 60_000,
      });
    },
    [queryClient],
  );

  const create = useMutation({
    mutationFn: (input: CustomerCreateInput) => createCustomer(input),
    onSuccess: () => {
      toast.success("客户已创建");
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const customers = data?.items ?? [];
  const tags = data?.tags ?? [];
  const stats = data?.stats;
  const total = data?.total ?? 0;
  const pageCount = data?.pageCount ?? 1;
  const displayPage = data?.page ?? page;
  const pageStart = total === 0 ? 0 : (displayPage - 1) * CUSTOMER_PAGE_SIZE + 1;
  const pageEnd = Math.min(total, displayPage * CUSTOMER_PAGE_SIZE);

  const activeFilterCount = useMemo(() => {
    return (
      (baseFilters.tagIds?.length ?? 0) +
      (baseFilters.marketing && baseFilters.marketing !== "all" ? 1 : 0) +
      (baseFilters.followup && baseFilters.followup !== "all" ? 1 : 0)
    );
  }, [baseFilters]);

  return (
    <div className={cn(pageShell.list, "pb-8 pt-3 sm:pt-5")}>
      <motion.div
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
        className="mb-3 space-y-3 sm:mb-5 sm:space-y-4"
      >
        <motion.div variants={fadeUp}>
          <RepairOsModuleHeader
            action={
              <Button
                className={cn("h-9 gap-1.5", controls.brandButton)}
                style={brandGradientStyle}
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4" /> 新建客户
              </Button>
            }
          />
        </motion.div>

        <motion.div variants={fadeUp} className="sm:hidden">
          <RepairOsMetricStrip
            metrics={[
              { label: "总客户", value: stats?.total ?? 0, hint: "全部档案", icon: Users },
              {
                label: "待回访",
                value: stats?.dueFollowups ?? 0,
                hint: "今日/逾期",
                icon: Bell,
                tone: "amber",
              },
              {
                label: "可营销",
                value: stats?.marketable ?? 0,
                hint: "已授权",
                icon: Mail,
                tone: "green",
              },
            ]}
          />
        </motion.div>

        <motion.div variants={fadeUp} className={dataDisplay.kpiGrid}>
          <CustomerKpiCard icon={Users} label="总客户" value={stats?.total ?? 0} />
          <CustomerKpiCard icon={ArrowUpRight} label="复购客户" value={stats?.repeat ?? 0} />
          <CustomerKpiCard icon={Bell} label="待回访" value={stats?.dueFollowups ?? 0} />
          <CustomerKpiCard icon={Mail} label="可营销" value={stats?.marketable ?? 0} />
        </motion.div>
      </motion.div>

      <div
        className={cn(
          repairOs.toolbar,
          "mb-3 flex-col items-stretch gap-2 sm:mb-4 sm:gap-3 sm:p-3",
          layoutGuards.noPageOverflow,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="搜索姓名、电话、邮箱或设备"
              className="h-8 border-0 bg-transparent pl-8 pr-14 text-sm shadow-none focus-visible:ring-0 sm:h-9 sm:border-border/60 sm:bg-surface/60 sm:shadow-sm"
            />
            {isFetching && (
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                更新中
              </span>
            )}
          </div>
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 sm:h-9">
                <Filter className="size-3.5" /> 筛选
                {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[min(22rem,calc(100vw-16px))] max-w-[calc(100vw-16px)] p-0"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>客户筛选</SheetTitle>
              </SheetHeader>
              <CustomerFilters
                filters={filters}
                tags={tags}
                onChange={updateFilters}
                onClose={() => setFilterOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>
        <RepairOsChipRow
          chips={[
            ...(["all", "allowed", "blocked"] as const).map((value) => ({
              label: value === "all" ? "全部营销" : value === "allowed" ? "可营销" : "不可营销",
              active: (baseFilters.marketing ?? "all") === value,
              onClick: () => updateFilters({ ...baseFilters, marketing: value }),
            })),
            ...(["all", "due", "overdue"] as const).map((value) => ({
              label: value === "all" ? "全部回访" : value === "due" ? "今天到期" : "已逾期",
              active: (baseFilters.followup ?? "all") === value,
              onClick: () => updateFilters({ ...baseFilters, followup: value }),
            })),
          ]}
        />
      </div>

      {isPending ? (
        <div className={cn("space-y-2", layoutGuards.noPageOverflow)}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="mx-auto mt-8 max-w-sm rounded-lg border border-[var(--border-panel)] bg-card p-5 text-center shadow-[var(--shadow-card)]">
          <Search className="mx-auto size-8 text-muted-foreground" />
          <h3 className="mt-3 text-base font-semibold">暂无符合条件的客户</h3>
          <p className="mt-1 text-xs text-muted-foreground">调整筛选条件，或新建客户档案。</p>
        </div>
      ) : (
        <>
          <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              筛选结果 {total} 位{total > 0 && ` · ${pageStart}-${pageEnd}`}
            </span>
            {isPlaceholderData && <span>保留上一页数据中…</span>}
          </div>
          <div className="glass-card hidden min-w-0 max-w-full overflow-hidden lg:block">
            <div className="max-w-full overflow-x-auto">
              <table className={cn(density.tableDense, "min-w-[900px] table-fixed")}>
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border/40">
                    <th className="w-[220px] px-3 py-2 text-left font-medium">客户</th>
                    <th className="w-[180px] px-2 py-2 text-left font-medium">标签</th>
                    <th className="w-[160px] px-2 py-2 text-left font-medium">设备/工单</th>
                    <th className="w-[112px] px-2 py-2 text-right font-medium">已结清营收</th>
                    <th className="w-[112px] px-2 py-2 text-right font-medium">未结清</th>
                    <th className="w-[112px] px-2 py-2 text-left font-medium">下次回访</th>
                    <th className="w-[72px] px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <CustomerRow
                      key={customer.id}
                      customer={customer}
                      onPrefetch={() => prefetchCustomerDetail(customer.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-2 lg:hidden">
            {customers.map((customer) => (
              <CustomerMobileCard
                key={customer.id}
                customer={customer}
                onPrefetch={() => prefetchCustomerDetail(customer.id)}
              />
            ))}
          </div>
          <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-surface/70 px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              第 {displayPage} / {pageCount} 页 · 每页 {CUSTOMER_PAGE_SIZE}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={page <= 1 || isPlaceholderData}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="size-3.5" /> 上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={page >= pageCount || isPlaceholderData}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              >
                下一页 <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}

      <CustomerFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建客户"
        busy={create.isPending}
        initial={defaultCustomerForm}
        onSave={(input) => create.mutateAsync(input)}
      />
    </div>
  );
}
