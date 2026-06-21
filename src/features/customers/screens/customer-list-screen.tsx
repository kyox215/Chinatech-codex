"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { CustomerDetailScreen } from "@/features/customers/screens/customer-detail-screen";
import { CustomerFilters } from "@/features/customers/forms/customer-filters";
import { CustomerFormDialog } from "@/features/customers/forms/customer-form-dialog";
import {
  buildCustomerWorkFilterChips,
  defaultCustomerForm,
  getCustomerActiveFilterCount,
  getCustomerListSubtitle,
  getCustomerPageRange,
  sanitizeCustomerListFilters,
} from "@/features/customers/model/customer-list";
import { componentOverlay } from "@/lib/component-patterns";
import { fadeUp } from "@/lib/motion";
import {
  RepairOsBusinessCard,
  RepairOsChipRow,
  RepairOsHeaderActionButton,
  RepairOsListScaffold,
} from "@/shared/ui";
import {
  brandGradientStyle,
  controls,
  dataDisplay,
  density,
  layoutGuards,
  repairOs,
} from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const CUSTOMER_PAGE_SIZE = 30;
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
    work: "all",
  });
  const [searchDraft, setSearchDraft] = useState("");
  const debouncedSearch = useDebouncedValue(searchDraft, CUSTOMER_SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewCustomerId, setPreviewCustomerId] = useState<string>();

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

  const { data, error, isError, isFetching, isPending, isPlaceholderData, refetch } = useQuery({
    queryKey: customersKeys.listPage(queryInput),
    queryFn: () => listCustomersPage(queryInput),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const updateFilters = useCallback((next: CustomerListFilters) => {
    setBaseFilters(sanitizeCustomerListFilters(next));
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
  const pageRange = getCustomerPageRange({
    total,
    page: displayPage,
    pageSize: data?.pageSize ?? CUSTOMER_PAGE_SIZE,
  });

  const activeFilterCount = useMemo(() => getCustomerActiveFilterCount(baseFilters), [baseFilters]);
  const queryErrorMessage = error instanceof Error ? error.message : "客户加载失败";
  const activeWorkFilter = baseFilters.work ?? "all";
  const customerHeaderChips = buildCustomerWorkFilterChips(stats);

  return (
    <RepairOsListScaffold
      title="客户管理"
      subtitle={getCustomerListSubtitle(baseFilters, total)}
      eyebrow="工作台 / 客户"
      action={
        <RepairOsHeaderActionButton ariaLabel="新建客户" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
        </RepairOsHeaderActionButton>
      }
      searchValue={searchDraft}
      onSearchChange={setSearchDraft}
      searchPlaceholder="搜索姓名、电话或设备"
      filterAction={
        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="relative size-8 rounded-xl bg-card"
              aria-label="筛选客户"
            >
              <Filter className="size-3.5" />
              {activeFilterCount > 0 ? (
                <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold leading-4 text-primary-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
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
      }
      chips={customerHeaderChips.map((chip) => ({
        key: chip.value,
        label: chip.label,
        shortLabel: chip.shortLabel,
        count: chip.count,
        active: activeWorkFilter === chip.value,
        onClick: () => updateFilters({ ...baseFilters, work: chip.value }),
      }))}
      desktopAction={
        <Button
          className={cn("h-9 gap-1.5", controls.brandButton)}
          style={brandGradientStyle}
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" /> 新建客户
        </Button>
      }
      desktopHeaderAddon={
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className={dataDisplay.kpiGrid}
        >
          <CustomerKpiCard icon={Users} label="总客户" value={stats?.total ?? 0} />
          <CustomerKpiCard icon={Wrench} label="在修客户" value={stats?.activeRepairs ?? 0} />
          <CustomerKpiCard icon={CircleDollarSign} label="未结清" value={stats?.unpaid ?? 0} />
          <CustomerKpiCard icon={Smartphone} label="有设备" value={stats?.withDevices ?? 0} />
        </motion.div>
      }
    >
      <div
        className={cn(
          repairOs.toolbar,
          "mb-3 hidden flex-col items-stretch gap-2 sm:mb-4 sm:gap-3 sm:p-3 md:flex",
          layoutGuards.noPageOverflow,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="搜索姓名、电话或设备"
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
          chips={customerHeaderChips.map((chip) => ({
            label: `${chip.label} ${chip.count}`,
            active: (baseFilters.work ?? "all") === chip.value,
            onClick: () => updateFilters({ ...baseFilters, work: chip.value }),
          }))}
        />
      </div>

      {isError && data ? (
        <RepairOsBusinessCard
          as="div"
          data-ui="customer-list-refresh-warning"
          leading={<AlertTriangle className="size-3.5" />}
          trailing={
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1 px-2 text-xs"
              onClick={() => void refetch()}
            >
              <RefreshCw className="size-3" /> 重试
            </Button>
          }
          className="mb-2 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border-status-warn-foreground/25 bg-status-warn/10 px-3 py-2 text-xs text-status-warn-foreground shadow-none hover:bg-status-warn/10"
          bodyClassName="min-w-0"
        >
          <span className="min-w-0 truncate">客户数据刷新失败：{queryErrorMessage}</span>
        </RepairOsBusinessCard>
      ) : null}

      {isError && !data ? (
        <CustomerLoadError message={queryErrorMessage} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className={cn("space-y-2", layoutGuards.noPageOverflow)}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <RepairOsBusinessCard
          as="div"
          data-ui="customer-list-empty-state"
          className="mx-auto mt-8 !flex max-w-sm flex-col items-center rounded-xl px-5 py-5 text-center"
          bodyClassName="flex min-w-0 flex-col items-center"
        >
          <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <Search className="size-5" />
          </span>
          <h3 className="mt-3 text-base font-semibold leading-5">暂无符合条件的客户</h3>
          <p className="mt-1 text-xs text-muted-foreground">调整筛选条件，或新建客户档案。</p>
        </RepairOsBusinessCard>
      ) : (
        <>
          <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              筛选结果 {total} 位{total > 0 && ` · ${pageRange.start}-${pageRange.end}`}
            </span>
            {isPlaceholderData && <span>保留上一页数据中…</span>}
          </div>
          <div className="glass-card hidden min-w-0 max-w-full overflow-hidden lg:block">
            <div className="max-w-full overflow-x-auto">
              <table
                className={cn(density.tableDense, "min-w-[720px] table-fixed xl:min-w-[840px]")}
              >
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border/40">
                    <th className="w-[280px] px-3 py-2 text-left font-medium">客户</th>
                    <th className="w-[220px] px-2 py-2 text-left font-medium">设备/工单</th>
                    <th className="w-[104px] px-2 py-2 text-right font-medium">消费额</th>
                    <th className="w-[104px] px-2 py-2 text-right font-medium">尾款</th>
                    <th className="w-[112px] px-2 py-2 text-left font-medium">状态</th>
                    <th className="w-[72px] px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <CustomerRow
                      key={customer.id}
                      customer={customer}
                      onOpenDetail={setPreviewCustomerId}
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
          <RepairOsBusinessCard
            as="div"
            data-ui="customer-list-pagination"
            trailing={
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
            }
            className="mt-3 items-center rounded-md border-border/60 bg-surface/70 px-3 py-2 text-xs shadow-none hover:bg-surface/70"
            bodyClassName="min-w-0"
            trailingClassName="shrink-0"
          >
            <span className="text-muted-foreground">
              第 {displayPage} / {pageCount} 页 · 每页 {CUSTOMER_PAGE_SIZE}
            </span>
          </RepairOsBusinessCard>
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
      <Dialog
        open={Boolean(previewCustomerId)}
        onOpenChange={(open) => {
          if (!open) setPreviewCustomerId(undefined);
        }}
      >
        <DialogContent className={componentOverlay.detailWorkspace}>
          <DialogHeader className="sr-only">
            <DialogTitle>客户详情预览</DialogTitle>
            <DialogDescription>查看客户资料、设备、历史工单和回访记录。</DialogDescription>
          </DialogHeader>
          {previewCustomerId ? (
            <CustomerDetailScreen id={previewCustomerId} surface="dialog" />
          ) : null}
        </DialogContent>
      </Dialog>
    </RepairOsListScaffold>
  );
}

function CustomerLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <RepairOsBusinessCard
      as="div"
      data-ui="customer-list-load-error"
      className="mx-auto mt-8 !flex max-w-sm flex-col items-center rounded-xl border-status-danger-foreground/25 px-5 py-5 text-center"
      bodyClassName="flex min-w-0 flex-col items-center"
    >
      <span className="mx-auto grid size-10 place-items-center rounded-full bg-status-danger/10 text-status-danger-foreground">
        <AlertTriangle className="size-5" />
      </span>
      <h3 className="mt-3 text-base font-semibold">客户加载失败</h3>
      <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{message}</p>
      <Button className="mt-4 h-9 gap-1.5" onClick={onRetry}>
        <RefreshCw className="size-3.5" /> 重新加载
      </Button>
    </RepairOsBusinessCard>
  );
}
