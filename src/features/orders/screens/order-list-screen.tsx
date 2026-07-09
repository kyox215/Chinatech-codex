"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type SyntheticEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Download, Filter, Plus, Printer, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

import { fadeUp, floatingBar, stagger } from "@/lib/motion";
import { brandGradientStyle, controls, layoutGuards, repairOs } from "@/lib/ui-patterns";
import { componentOverlay } from "@/lib/component-patterns";
import { OrderMobileCard } from "@/features/orders/components/order-list-items";
import { OrderListPrintSheet } from "@/features/orders/components/order-list-print-sheet";
import {
  DesktopOrderQueueRow,
  orderQueueDesktopGrid,
} from "@/features/orders/components/order-list-desktop-row";
import {
  FiltersPanel,
  OrderStatusFilterControls,
} from "@/features/orders/components/order-list-filters";
import { MobileOrdersFloatingHeader } from "@/features/orders/components/order-list-mobile-header";
import { ScanSearchButton } from "@/features/capture";
import {
  EmptyOrdersState,
  OrdersErrorState,
  PaginationBar,
} from "@/features/orders/components/order-list-states";
import { buildOrdersCsv } from "@/features/orders/model/order-list-export";
import { OrderDetailScreen } from "@/features/orders/screens/order-detail-screen";
import { NewOrderScreen } from "@/features/orders/screens/new-order-screen";
import {
  batchTransition,
  getStoreSettings,
  getOrderQueueSummary,
  patchOrder,
  type OrderListFilters,
  type OrderListItem,
} from "@/lib/repairdesk/api";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import {
  getCommonWorkflowTargets,
  getWorkflowStatusLabel,
  getWorkflowStatuses,
  type OrderListStatusTab,
} from "@/features/orders/model/order-workflow";
import { orderTransitionRequiresReason } from "@/features/orders/model/order-transition-reasons";
import {
  orderExceptionMeta,
  orderWorkflowMeta,
} from "@/features/orders/model/canonical-order-status";
import {
  getSimpleOrderFlowCounts,
  getSimpleOrderFlowWorkflowStatuses,
  simpleOrderFlowStages,
  type SimpleOrderFlowStageKey,
} from "@/features/orders/model/order-simple-flow";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import {
  invalidateOrderReadCaches,
  isOrderVersionConflict,
  patchOrderReadCaches,
  restoreOrderReadCaches,
  snapshotOrderReadCaches,
} from "@/features/orders/api/cache-sync";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { REPAIRDESK_NEW_ORDER_EVENT } from "@/lib/app-events";
import { CACHE_TIMES } from "@/lib/query-performance";
import { cn } from "@/lib/utils";

const ORDER_LIST_PAGE_SIZE = 50;
const emptyOrderOptions = {
  suppliers: [],
  technicians: [],
  permissions: {
    canReadSuppliers: false,
    canAssignSuppliers: false,
    canManageSuppliers: false,
  },
};

const orderStageHints: Record<SimpleOrderFlowStageKey | "all", string> = {
  all: "全部客户队列",
  intake: "接单资料待补齐",
  quote: "检测、报价与客户确认",
  repair: "配件、外修和维修执行",
  pickup: "通知、尾款和交付",
  closed: "已收款完成归档",
};

type ActiveFilterChip = {
  key: string;
  label: string;
};

export function OrderListScreen() {
  const [statusGroup, setStatusGroup] = useState<"all" | SimpleOrderFlowStageKey>("all");
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
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext();
  const activeStoreId = shell.activeStore?.id;

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

  useEffect(() => {
    const query = searchParams.get("q");
    if (!query) return;
    setFilters((current) => (current.search === query ? current : { ...current, search: query }));
    setPage(1);
  }, [searchParams]);

  const effectiveFilters = useMemo<OrderListFilters>(() => {
    return {
      ...filters,
      workflowStatuses:
        statusGroup === "all"
          ? filters.workflowStatuses
          : getSimpleOrderFlowWorkflowStatuses(statusGroup),
    };
  }, [filters, statusGroup]);

  const {
    data: queueSummary,
    isLoading,
    isError: listIsError,
    error: listError,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ordersKeys.queueSummary(
      {
        ...effectiveFilters,
        page,
        pageSize: ORDER_LIST_PAGE_SIZE,
      },
      activeStoreId,
    ),
    queryFn: ({ signal }) =>
      getOrderQueueSummary(
        { ...effectiveFilters, page, pageSize: ORDER_LIST_PAGE_SIZE },
        { signal },
      ),
    placeholderData: keepPreviousData,
    staleTime: CACHE_TIMES.hotList,
  });
  const { data: storeSettings } = useQuery({
    queryKey: messageSettingsKeys.storeScoped(activeStoreId),
    queryFn: ({ signal }) => getStoreSettings({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId),
  });

  const listResult = queueSummary?.list;
  const workflow = queueSummary?.workflow;
  const options = queueSummary?.options ?? emptyOrderOptions;
  const canReadSuppliers = options.permissions.canReadSuppliers;
  const canAssignSuppliers = options.permissions.canAssignSuppliers;
  const visibleSuppliers = useMemo(
    () => (canReadSuppliers ? options.suppliers : []),
    [canReadSuppliers, options.suppliers],
  );
  const workflowIsError = Boolean(queueSummary?.partialErrors?.workflow);
  const workflowErrorMessage = queueSummary?.partialErrors?.workflow ?? "状态流配置暂时不可用。";
  const statusSubTabs = useMemo<OrderListStatusTab[]>(
    () => [{ key: "all", label: "全部状态" }],
    [],
  );
  const workflowStatuses = useMemo(
    () =>
      getWorkflowStatuses(workflow).map((status) => ({ code: status.code, label: status.label })),
    [workflow],
  );

  const data = useMemo(() => listResult?.items ?? [], [listResult?.items]);
  const totalOrders = listResult?.total ?? 0;
  const pageCount = listResult?.pageCount ?? 1;
  const statusGroups = useMemo(() => {
    const simpleCounts = getSimpleOrderFlowCounts(listResult?.workflowCounts);
    return [
      {
        key: "all" as const,
        label: "全部",
        shortLabel: "全",
        tone: "neutral" as const,
        count: simpleCounts.all,
        hint: orderStageHints.all,
      },
      ...simpleOrderFlowStages.map((stage) => ({
        key: stage.key,
        label: stage.label,
        shortLabel: stage.shortLabel,
        tone: stage.tone,
        count: simpleCounts[stage.key],
        hint: orderStageHints[stage.key],
      })),
    ];
  }, [listResult?.workflowCounts]);
  const listErrorMessage =
    listError instanceof Error ? listError.message : "请检查网络、登录状态或数据库迁移。";
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
        label: `流程：${activeGroup?.label ?? statusGroup}`,
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
    if (canReadSuppliers) {
      const supplierLabels = new Map(
        visibleSuppliers.map((supplier) => [supplier.id, supplier.short_name]),
      );
      filters.supplierIds?.forEach((supplierId) =>
        chips.push({
          key: `supplier:${supplierId}`,
          label: `外修：${supplierLabels.get(supplierId) ?? supplierId}`,
        }),
      );
    }
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
  }, [
    canReadSuppliers,
    filters,
    statusCode,
    statusGroup,
    statusGroups,
    visibleSuppliers,
    workflowStatuses,
  ]);
  const hasActiveFilters = activeFilterChips.length > 0;
  const isPageOutOfRange = Boolean(
    listResult && listResult.total > 0 && !listResult.items.length && page > pageCount,
  );

  const invalidate = (orderId?: string) => {
    invalidateOrderReadCaches(queryClient, orderId);
  };

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

  const partsSupplierMutation = useMutation({
    mutationFn: ({ order, supplierId }: { order: OrderListItem; supplierId: string | null }) =>
      patchOrder(order.id, {
        expected_updated_at: order.updated_at,
        changes: { parts_supplier_id: supplierId },
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ordersKeys.all });
      const snapshot = snapshotOrderReadCaches(queryClient, vars.order.id);
      patchOrderReadCaches(queryClient, vars.order.id, { parts_supplier_id: vars.supplierId });
      return { snapshot };
    },
    onSuccess: (result, vars) => {
      patchOrderReadCaches(queryClient, vars.order.id, {
        parts_supplier_id: vars.supplierId,
        updated_at: result.updated_at,
      });
      const supplierName =
        visibleSuppliers.find((supplier) => supplier.id === vars.supplierId)?.short_name ??
        visibleSuppliers.find((supplier) => supplier.id === vars.supplierId)?.name;
      toast.success(
        vars.supplierId ? `已标记配件供应商：${supplierName ?? "已选择"}` : "已清除配件供应商",
      );
      invalidate(vars.order.id);
    },
    onError: (error, vars, context) => {
      restoreOrderReadCaches(queryClient, context?.snapshot);
      if (isOrderVersionConflict(error)) {
        invalidate(vars.order.id);
        toast.error("工单已被更新，已刷新最新数据，请确认后重新选择供应商");
        return;
      }
      toast.error(error instanceof Error ? error.message : "保存配件供应商失败");
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
    setStatusGroup(nextGroup as "all" | SimpleOrderFlowStageKey);
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
    if (canReadSuppliers || !filters.supplierIds?.length) return;
    setFilters((current) => ({ ...current, supplierIds: undefined }));
  }, [canReadSuppliers, filters.supplierIds?.length]);

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
    shortLabel: group.shortLabel,
    count: group.count,
    hint: group.hint,
    tone: group.tone,
  }));
  const applyScanSearch = (value: string) => {
    setFilters((current) => ({ ...current, search: value || undefined }));
    setPage(1);
  };

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
        scanAction={
          <ScanSearchButton
            scope="orders"
            onSearch={applyScanSearch}
            className="size-10 rounded-xl bg-card"
            iconClassName="size-3.5"
          />
        }
      />

      {/* Desktop stage and search toolbar */}
      <div
        data-order-desktop-unified-toolbar="true"
        className={cn(
          repairOs.mobileInfoCard,
          "mb-3 mt-3 hidden min-w-0 flex-col gap-2 p-2.5 md:flex lg:flex-row lg:items-end xl:items-center",
        )}
      >
        <OrderStatusFilterControls
          embedded
          className="min-w-0 lg:flex-[1_1_520px] xl:flex-[1_1_560px]"
          groups={statusGroupItems}
          subTabs={statusSubTabs}
          groupValue={statusGroup}
          statusValue={statusCode}
          onGroupChange={handleStatusGroupChange}
          onStatusChange={handleStatusCodeChange}
        />

        <div
          className={cn(
            layoutGuards.wrapRow,
            "min-w-0 items-stretch lg:flex-[1_1_420px] lg:justify-end xl:flex-nowrap",
          )}
        >
          <div className="relative min-w-0 flex-[1_1_260px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search ?? ""}
              onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
              placeholder="搜索工单号、客户姓名、电话或 IMEI"
              className={controls.searchInput}
            />
          </div>
          <ScanSearchButton
            scope="orders"
            onSearch={applyScanSearch}
            size="sm"
            showLabel
            className="h-9 gap-1.5 border-border/60 bg-surface/60 backdrop-blur"
            iconClassName="size-3.5"
          />
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
            data-order-list-new-button="true"
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
                  <div className="min-w-0 px-2 py-1.5">阶段 / 下一步</div>
                  <div className="min-w-0 px-2 py-1.5">工单 / 客户</div>
                  <div className="min-w-0 px-2 py-1.5">设备 / 故障</div>
                  <div className="px-2 py-1.5 text-right">金额 / 风险</div>
                  <div className="px-2 py-1.5">负责人 / 时间</div>
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
                        onPrint={() => printRows([o])}
                        onStopInteraction={stopRowClick}
                        suppliers={visibleSuppliers}
                        onPartsSupplierChange={
                          canAssignSuppliers
                            ? (supplierId) => partsSupplierMutation.mutate({ order: o, supplierId })
                            : undefined
                        }
                        isPartsSupplierUpdating={
                          partsSupplierMutation.isPending &&
                          partsSupplierMutation.variables?.order.id === o.id
                        }
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
                  <OrderMobileCard
                    order={order}
                    suppliers={visibleSuppliers}
                    isPartsSupplierUpdating={
                      partsSupplierMutation.isPending &&
                      partsSupplierMutation.variables?.order.id === order.id
                    }
                    onPartsSupplierChange={
                      canAssignSuppliers
                        ? (supplierId) => partsSupplierMutation.mutate({ order, supplierId })
                        : undefined
                    }
                  />
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
      <OrderListPrintSheet orders={printOrders} storeSettings={storeSettings} />
      <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <DialogContent showCloseButton={false} className={componentOverlay.formWorkspace}>
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
          showCloseButton={false}
          className={componentOverlay.orderDetailWorkspace}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>工单详情</DialogTitle>
            <DialogDescription>在弹窗中查看和处理当前工单详情。</DialogDescription>
          </DialogHeader>
          {detailOrderId && (
            <OrderDetailScreen
              id={detailOrderId}
              surface="dialog"
              onClose={() => setDetailOrderId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
