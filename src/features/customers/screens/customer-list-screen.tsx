"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  CUSTOMER_LIST_PAGE_SIZE,
  customerListPageQueryOptions,
} from "@/features/customers/api/query-options";
import { customersKeys } from "@/features/customers/api/query-keys";
import {
  CustomerMobileCard,
  CustomerRow,
} from "@/features/customers/components/customer-list-items";
import { CustomerListSkeleton } from "@/features/customers/components/customer-list-skeleton";
import { CustomerFilters } from "@/features/customers/forms/customer-filters";
import type { CustomerCreateIntent } from "@/features/customers/forms/customer-form-dialog";
import {
  applyCustomerQuickGroup,
  buildCustomerQuickGroupChips,
  clampCustomerPageAfterLoad,
  defaultCustomerForm,
  getCustomerActiveFilterCount,
  getCustomerDetailHref,
  getCustomerListSubtitle,
  getCustomerPageRange,
  getCustomerQuickGroup,
  parseCustomerListUrlState,
  sanitizeCustomerListFilters,
  serializeCustomerListUrlState,
  type CustomerQuickGroup,
} from "@/features/customers/model/customer-list";
import { buildNewOrderWorkspaceHref } from "@/features/orders/model/order-workspace-intent";
import {
  ScanSearchButton,
  consumeScanSearchIntent,
  subscribeScanSearchIntent,
} from "@/features/capture";
import { useRealtimeSync } from "@/features/realtime";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { StoreShellUnavailableState } from "@/features/stores/components/store-shell-unavailable-state";
import { componentOverlay } from "@/lib/component-patterns";
import {
  createCustomer,
  type CustomerCreateInput,
  type CustomerListFilters,
} from "@/lib/repairdesk/api";
import { controls, density, layoutGuards } from "@/lib/ui-patterns";
import {
  RepairOsBusinessCard,
  RepairOsHeaderActionButton,
  RepairOsListScaffold,
} from "@/shared/ui";
import { cn } from "@/lib/utils";

const CUSTOMER_SEARCH_DEBOUNCE_MS = 280;
const MANAGED_LIST_PARAMS = ["q", "group", "work", "tags", "marketing", "followup", "page"];
const CustomerFormDialog = lazy(() =>
  import("@/features/customers/forms/customer-form-dialog").then((module) => ({
    default: module.CustomerFormDialog,
  })),
);
const CustomerDetailScreen = lazy(() =>
  import("@/features/customers/screens/customer-detail-screen").then((module) => ({
    default: module.CustomerDetailScreen,
  })),
);

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const shell = useStoreShellContext();
  const activeStoreId = shell.activeStore?.id;
  const realtimeSync = useRealtimeSync();
  const initialUrlStateRef = useRef<ReturnType<typeof parseCustomerListUrlState> | null>(null);
  if (!initialUrlStateRef.current) {
    initialUrlStateRef.current = parseCustomerListUrlState(searchParams);
  }
  const initialUrlState = initialUrlStateRef.current;
  const [baseFilters, setBaseFilters] = useState<CustomerListFilters>(initialUrlState.filters);
  const [searchDraft, setSearchDraft] = useState(initialUrlState.search);
  const debouncedSearch = useDebouncedValue(searchDraft, CUSTOMER_SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(initialUrlState.page);
  const [filterSurface, setFilterSurface] = useState<"mobile" | "desktop">();
  const [createOpen, setCreateOpen] = useState(false);
  const [previewCustomerId, setPreviewCustomerId] = useState<string>();
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);

  const updateSearchDraft = useCallback((value: string) => {
    setSearchDraft(value);
    setPage(1);
  }, []);

  useEffect(() => {
    if (searchParams.get("new") === "1") setCreateOpen(true);
  }, [searchParams]);

  useEffect(() => {
    const restored = parseCustomerListUrlState(new URLSearchParams(searchParamsKey));
    setSearchDraft((current) => (current === restored.search ? current : restored.search));
    setBaseFilters((current) =>
      JSON.stringify(sanitizeCustomerListFilters(current)) === JSON.stringify(restored.filters)
        ? current
        : restored.filters,
    );
    setPage((current) => (current === restored.page ? current : restored.page));
  }, [searchParamsKey]);

  useEffect(() => {
    const applyIntent = (value: string) => {
      if (value) updateSearchDraft(value);
    };
    applyIntent(consumeScanSearchIntent("customers"));
    return subscribeScanSearchIntent("customers", applyIntent);
  }, [updateSearchDraft]);

  useEffect(() => {
    const current = new URLSearchParams(searchParamsKey);
    MANAGED_LIST_PARAMS.forEach((key) => current.delete(key));
    const managed = serializeCustomerListUrlState({
      search: debouncedSearch,
      filters: baseFilters,
      page,
    });
    managed.forEach((value, key) => current.set(key, value));
    const next = current.toString();
    if (next === searchParamsKey) return;
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [baseFilters, debouncedSearch, page, pathname, router, searchParamsKey]);

  const filters = useMemo<CustomerListFilters>(() => {
    const search = debouncedSearch.trim();
    return { ...baseFilters, ...(search ? { search } : {}) };
  }, [baseFilters, debouncedSearch]);
  const queryInput = useMemo(
    () => ({ ...filters, page, pageSize: CUSTOMER_LIST_PAGE_SIZE }),
    [filters, page],
  );
  const { data, isError, isFetching, isPending, isPlaceholderData, refetch } = useQuery({
    ...customerListPageQueryOptions(queryInput, activeStoreId),
    enabled: Boolean(activeStoreId),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const refreshCustomerData = useCallback(() => {
    if (realtimeSync.coordinator) {
      void realtimeSync.coordinator.refreshGroups(["customers.all"]);
      return;
    }
    void refetch();
  }, [realtimeSync.coordinator, refetch]);

  const updateFilters = useCallback((next: CustomerListFilters) => {
    setBaseFilters(sanitizeCustomerListFilters(next));
    setPage(1);
  }, []);

  const changeQuickGroup = useCallback(
    (group: CustomerQuickGroup) => updateFilters(applyCustomerQuickGroup(baseFilters, group)),
    [baseFilters, updateFilters],
  );
  const openPreview = useCallback((customerId: string, trigger?: HTMLButtonElement) => {
    previewTriggerRef.current = trigger ?? null;
    setPreviewCustomerId(customerId);
  }, []);
  const closePreview = useCallback(() => {
    setPreviewCustomerId(undefined);
    window.requestAnimationFrame(() => previewTriggerRef.current?.focus());
  }, []);

  const create = useMutation({
    mutationFn: ({ input }: { input: CustomerCreateInput; intent: CustomerCreateIntent }) =>
      createCustomer(input),
    onSuccess: ({ id }, { intent }) => {
      toast.success("客户已创建");
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: customersKeys.detail(id, activeStoreId) });
      router.push(
        intent === "new_order"
          ? buildNewOrderWorkspaceHref({ source: "customer", customerId: id })
          : getCustomerDetailHref(id),
      );
    },
    onError: () => toast.error("客户保存失败，请检查后重试"),
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
    pageSize: data?.pageSize ?? CUSTOMER_LIST_PAGE_SIZE,
  });
  const activeFilterCount = useMemo(() => getCustomerActiveFilterCount(baseFilters), [baseFilters]);
  const activeQuickGroup = getCustomerQuickGroup(baseFilters);
  const hasCustomerConstraints =
    activeFilterCount > 0 || Boolean(searchDraft.trim()) || activeQuickGroup !== "all";
  const customerHeaderChips = buildCustomerQuickGroupChips(stats);

  useEffect(() => {
    const nextPage = clampCustomerPageAfterLoad({
      page,
      pageCount: data?.pageCount,
      isPlaceholderData,
    });
    if (nextPage !== page) setPage(nextPage);
  }, [data?.pageCount, isPlaceholderData, page]);

  useEffect(() => {
    if (!stats?.financeRedacted || baseFilters.work !== "unpaid") return;
    updateFilters(applyCustomerQuickGroup(baseFilters, "all"));
  }, [baseFilters, stats?.financeRedacted, updateFilters]);

  if (!data && !isError && (shell.status === "loading" || (Boolean(activeStoreId) && isPending))) {
    return <CustomerListSkeleton />;
  }
  if (!activeStoreId) return <StoreShellUnavailableState shell={shell} onRetry={shell.retry} />;

  const quickChips = customerHeaderChips.map((chip) => ({
    key: chip.value,
    label: chip.label,
    shortLabel: chip.shortLabel,
    count: chip.count,
    active: activeQuickGroup === chip.value,
    onClick: () => changeQuickGroup(chip.value),
  }));

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
      onSearchChange={updateSearchDraft}
      searchPlaceholder="姓名、电话或设备"
      searchAction={
        <ScanSearchButton
          scope="customers"
          onSearch={updateSearchDraft}
          className="size-10 rounded-xl bg-card"
          iconClassName="size-4"
        />
      }
      filterAction={
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative size-10 rounded-xl bg-card"
          aria-label="更多筛选"
          onClick={() => setFilterSurface("mobile")}
        >
          <Filter className="size-4" />
          {activeFilterCount > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold leading-4 text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      }
      chips={quickChips}
      chipsLabel="客户分组"
      chipsVariant="underline"
      desktopHeader={
        <section className="sticky top-14 z-20 mb-3 rounded-xl border border-border/60 bg-background/95 p-3 shadow-sm backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchDraft}
                onChange={(event) => updateSearchDraft(event.target.value)}
                placeholder="搜索姓名、电话或设备"
                className="h-9 pl-9"
              />
            </div>
            <ScanSearchButton
              scope="customers"
              onSearch={updateSearchDraft}
              size="sm"
              showLabel
              className="h-9 shrink-0 gap-1.5"
              iconClassName="size-3.5"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5"
              onClick={() => setFilterSurface("desktop")}
            >
              <Filter className="size-3.5" /> 更多筛选
              {activeFilterCount > 0 ? (
                <Badge variant="secondary">{activeFilterCount}</Badge>
              ) : null}
            </Button>
            <Button
              className={cn("h-9 shrink-0 gap-1.5", controls.brandButton)}
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" /> 新建客户
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2" aria-label="客户分组">
            {customerHeaderChips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                aria-pressed={activeQuickGroup === chip.value}
                onClick={() => changeQuickGroup(chip.value)}
                className={cn(
                  "flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-medium transition-colors",
                  activeQuickGroup === chip.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 bg-card text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <span className="truncate">{chip.label}</span>
                <span className="font-mono tabular-nums">{chip.count}</span>
              </button>
            ))}
          </div>
        </section>
      }
    >
      <Sheet
        open={Boolean(filterSurface)}
        onOpenChange={(open) => !open && setFilterSurface(undefined)}
      >
        <SheetContent
          side="right"
          className="w-[min(22rem,calc(100vw-16px))] max-w-[calc(100vw-16px)] p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>更多客户筛选</SheetTitle>
          </SheetHeader>
          <CustomerFilters
            filters={baseFilters}
            tags={tags}
            financeRedacted={stats?.financeRedacted}
            onChange={updateFilters}
            onClose={() => setFilterSurface(undefined)}
          />
        </SheetContent>
      </Sheet>

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
              onClick={refreshCustomerData}
            >
              <RefreshCw className="size-3" /> 重试
            </Button>
          }
          className="mb-2 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border-status-warn-foreground/25 bg-status-warn/10 px-3 py-2 text-xs text-status-warn-foreground shadow-none hover:bg-status-warn/10"
          bodyClassName="min-w-0"
        >
          <span className="min-w-0 truncate">更新没有成功，当前仍显示上次结果。</span>
        </RepairOsBusinessCard>
      ) : null}

      {isError && !data ? (
        <CustomerLoadError onRetry={refreshCustomerData} />
      ) : customers.length === 0 ? (
        <RepairOsBusinessCard
          as="div"
          data-ui="customer-list-empty-state"
          className="mx-auto mt-4 !flex max-w-sm flex-col items-center rounded-xl px-3 py-3 text-center sm:mt-8 sm:px-5 sm:py-5"
          bodyClassName="flex min-w-0 flex-col items-center"
        >
          <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <Search className="size-5" />
          </span>
          <h3 className="mt-3 text-base font-semibold leading-5">
            {hasCustomerConstraints ? "没有找到符合条件的客户" : "还没有客户档案"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasCustomerConstraints
              ? "换个分组或清除条件后再试。"
              : "先新建客户，之后可直接创建维修工单。"}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {hasCustomerConstraints ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  updateSearchDraft("");
                  updateFilters({ work: "all" });
                }}
              >
                清除条件
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" /> 新建客户
            </Button>
          </div>
        </RepairOsBusinessCard>
      ) : (
        <>
          <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              共 {total} 位{total > 0 && ` · ${pageRange.start}-${pageRange.end}`}
            </span>
            {isFetching ? (
              <LoaderCircle
                data-ui="customer-list-refreshing"
                className="size-3.5 animate-spin text-primary"
                aria-hidden="true"
              />
            ) : null}
            <span className="sr-only" role="status" aria-live="polite">
              {isFetching ? "正在更新客户数据" : ""}
            </span>
          </div>
          <div className="glass-card hidden min-w-0 max-w-full overflow-hidden lg:block">
            <table
              className={cn(density.tableDense, "w-full table-fixed", layoutGuards.noPageOverflow)}
            >
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border/40">
                  <th scope="col" className="w-[29%] px-3 py-2 text-left font-medium">
                    客户
                  </th>
                  <th scope="col" className="w-[21%] px-2 py-2 text-left font-medium">
                    设备
                  </th>
                  <th scope="col" className="w-[13%] px-2 py-2 text-right font-medium">
                    金额
                  </th>
                  <th scope="col" className="w-[29%] px-2 py-2 text-left font-medium">
                    现在要做什么
                  </th>
                  <th scope="col" className="w-[8%] px-2 py-2 text-right font-medium">
                    查看
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <CustomerRow key={customer.id} customer={customer} onOpenDetail={openPreview} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 lg:hidden">
            {customers.map((customer) => (
              <CustomerMobileCard key={customer.id} customer={customer} />
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
              第 {displayPage} / {pageCount} 页 · 每页 {CUSTOMER_LIST_PAGE_SIZE}
            </span>
          </RepairOsBusinessCard>
        </>
      )}

      {createOpen ? (
        <Suspense fallback={null}>
          <CustomerFormDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            title="新建客户"
            busy={create.isPending}
            activeStoreId={activeStoreId}
            initial={defaultCustomerForm}
            onSave={(input, intent) => create.mutateAsync({ input, intent })}
            onOpenExisting={(customerId) => {
              setCreateOpen(false);
              router.push(getCustomerDetailHref(customerId));
            }}
            onStartOrderForExisting={(customerId) => {
              setCreateOpen(false);
              router.push(buildNewOrderWorkspaceHref({ source: "customer", customerId }));
            }}
          />
        </Suspense>
      ) : null}
      <Dialog open={Boolean(previewCustomerId)} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent showCloseButton={false} className={componentOverlay.detailWorkspace}>
          <DialogHeader className="sr-only">
            <DialogTitle>客户详情预览</DialogTitle>
            <DialogDescription>查看客户资料、设备、历史工单和回访记录。</DialogDescription>
          </DialogHeader>
          {previewCustomerId ? (
            <Suspense
              fallback={
                <div className="grid min-h-48 place-items-center text-muted-foreground">
                  <LoaderCircle className="size-5 animate-spin" aria-label="正在加载客户详情" />
                </div>
              }
            >
              <CustomerDetailScreen
                id={previewCustomerId}
                surface="dialog"
                onClose={closePreview}
              />
            </Suspense>
          ) : null}
        </DialogContent>
      </Dialog>
    </RepairOsListScaffold>
  );
}

function CustomerLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <RepairOsBusinessCard
      as="div"
      data-ui="customer-list-load-error"
      className="mx-auto mt-4 !flex max-w-sm flex-col items-center rounded-xl border-status-danger-foreground/25 px-3 py-3 text-center sm:mt-8 sm:px-5 sm:py-5"
      bodyClassName="flex min-w-0 flex-col items-center"
    >
      <span className="mx-auto grid size-10 place-items-center rounded-full bg-status-danger/10 text-status-danger-foreground">
        <AlertTriangle className="size-5" />
      </span>
      <h3 className="mt-3 text-base font-semibold">客户暂时无法加载</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        请检查网络后重新加载，已有客户资料不会受影响。
      </p>
      <Button className="mt-4 h-9 gap-1.5" onClick={onRetry}>
        <RefreshCw className="size-3.5" /> 重新加载
      </Button>
    </RepairOsBusinessCard>
  );
}
