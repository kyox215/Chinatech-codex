"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type SetStateAction,
  type SyntheticEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Filter, LoaderCircle, Plus, Printer, Search, X } from "lucide-react";

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
import { DesktopOrderQueueRow } from "@/features/orders/components/order-list-desktop-row";
import { orderQueueDesktopGrid } from "@/features/orders/components/order-list-layout";
import { OrderResultGroupHeader } from "@/features/orders/components/order-result-group-header";
import { OrderSearchFeedback } from "@/features/orders/components/order-search-feedback";
import { OrderListSkeleton } from "@/features/orders/components/order-list-skeleton";
import { OrderListViewMode } from "@/features/orders/components/order-list-view-mode";
import { OrderListTransitionFeedback } from "@/features/orders/components/order-list-transition-feedback";
import {
  FiltersPanel,
  OrderStatusFilterControls,
} from "@/features/orders/components/order-list-filters";
import { MobileOrdersFloatingHeader } from "@/features/orders/components/order-list-mobile-header";
import {
  ScanSearchButton,
  consumeScanSearchIntent,
  subscribeScanSearchIntent,
} from "@/features/capture";
import { useRealtimeSync } from "@/features/realtime";
import {
  EmptyOrdersState,
  OrdersErrorState,
  PaginationBar,
} from "@/features/orders/components/order-list-states";
import { OrderDetailScreen } from "@/features/orders/screens/order-detail-screen";
import { NewOrderScreen } from "@/features/orders/screens/new-order-screen";
import {
  batchTransition,
  patchOrder,
  type OrderListFilters,
  type OrderListItem,
} from "@/lib/repairdesk/api";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { OrderListPageInput, OrderListView, OrderQueueGroup } from "@/lib/repairdesk/types";
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
  orderQueueGroupMeta,
  orderQueueGroups,
} from "@/features/orders/model/order-queue-classification";
import {
  createOrderResultGroupCounts,
  groupOrderListItems,
  orderResultGroupMeta,
} from "@/features/orders/model/order-list-grouping";
import { useOrderSearchInput } from "@/features/orders/model/use-order-search-input";
import { ordersKeys } from "@/features/orders/api/query-keys";
import {
  ORDER_QUEUE_PAGE_SIZE,
  orderDetailQueryOptions,
  orderListPageQueryOptions,
  orderOptionsQueryOptions,
  orderWorkflowQueryOptions,
} from "@/features/orders/api/query-options";
import {
  BoundedPreloadScheduler,
  getOrderDetailAutomaticPreloadLimit,
  ORDER_DETAIL_PRELOAD_GC_TIME,
} from "@/features/preload/model/order-detail-preload";
import { isRepairDeskPreloadEnabled } from "@/features/preload/model/preload-plan";
import { storeSettingsQueryOptions } from "@/features/messages/api/query-options";
import { resolveStoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import {
  invalidateOrderReadCaches,
  isOrderVersionConflict,
  patchOrderReadCaches,
  restoreOrderReadCaches,
  snapshotOrderReadCaches,
} from "@/features/orders/api/cache-sync";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { StoreShellUnavailableState } from "@/features/stores/components/store-shell-unavailable-state";
import { REPAIRDESK_NEW_ORDER_EVENT } from "@/lib/app-events";
import { CACHE_TIMES } from "@/lib/query-performance";
import { cn } from "@/lib/utils";

const emptyOrderOptions = {
  suppliers: [],
  technicians: [],
  permissions: {
    canReadSuppliers: false,
    canAssignSuppliers: false,
    canManageSuppliers: false,
    canSearchOrderArchive: false,
    canBrowseOrderArchive: false,
    canExportOrders: false,
    canBatchTransitionOrders: false,
  },
};

const orderStageHints: Record<OrderQueueGroup | "all", string> = {
  all: "全部客户队列",
  processing: orderQueueGroupMeta.processing.hint,
  ordered: orderQueueGroupMeta.ordered.hint,
  arrived: orderQueueGroupMeta.arrived.hint,
  arrived_notified: orderQueueGroupMeta.arrived_notified.hint,
  repaired: orderQueueGroupMeta.repaired.hint,
  repaired_notified: orderQueueGroupMeta.repaired_notified.hint,
};

type ActiveFilterChip = {
  key: string;
  label: string;
};

type OrderListSelection = {
  statusGroup: "all" | OrderQueueGroup;
  statusCode: string;
  filters: OrderListFilters;
  page: number;
};

type OrderListIntent = {
  id: number;
  kind: "queue" | "view" | "page";
  key: string;
  label: string;
  requestHash: string;
  requested: OrderListSelection;
  rollback: OrderListSelection;
};

function orderListInputForSelection(selection: OrderListSelection): OrderListPageInput {
  return {
    ...selection.filters,
    queueGroups:
      selection.statusGroup === "all" ? selection.filters.queueGroups : [selection.statusGroup],
    page: selection.page,
    pageSize: ORDER_QUEUE_PAGE_SIZE,
  };
}

function orderListRequestHash(input: OrderListPageInput) {
  return JSON.stringify(input);
}

export function OrderListScreen() {
  const [statusGroup, setStatusGroup] = useState<"all" | OrderQueueGroup>("all");
  const [statusCode, setStatusCode] = useState<string>("all");
  const [filters, setFilters] = useState<OrderListFilters>({});
  const [page, setPage] = useState(1);
  const [pendingListIntent, setPendingListIntent] = useState<OrderListIntent | null>(null);
  const [failedListIntent, setFailedListIntent] = useState<OrderListIntent | null>(null);
  const listIntentSequenceRef = useRef(0);
  const lastResolvedSelectionRef = useRef<OrderListSelection>({
    statusGroup: "all",
    statusCode: "all",
    filters: {},
    page: 1,
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [printOrders, setPrintOrders] = useState<OrderListItem[]>([]);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const mobileHeaderCleanupRef = useRef<() => void>(() => undefined);
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext();
  const activeStoreId = shell.activeStore?.id;
  const canLoadOrderData = Boolean(activeStoreId) && !shell.isRefreshing;
  const { coordinator } = useRealtimeSync();
  const detailPreloadScheduler = useMemo(() => new BoundedPreloadScheduler(1), []);
  const detailPreloadEnabled = isRepairDeskPreloadEnabled();
  const commitSearch = useCallback(
    (value: string) => {
      if (!isOnline) return;
      setPendingListIntent(null);
      setFailedListIntent(null);
      const nextSearch = value || undefined;
      setFilters((current) =>
        current.search === nextSearch ? current : { ...current, search: nextSearch },
      );
      setPage(1);
    },
    [isOnline],
  );
  const searchInput = useOrderSearchInput({
    value: filters.search,
    onCommit: commitSearch,
  });

  useEffect(() => {
    document.body.dataset.mobileWorkspaceActive = "true";
    return () => {
      delete document.body.dataset.mobileWorkspaceActive;
    };
  }, []);

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);
    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  const setMobileHeaderRef = useCallback((header: HTMLDivElement | null) => {
    mobileHeaderCleanupRef.current();

    if (!header) {
      mobileHeaderCleanupRef.current = () => undefined;
      return;
    }

    const updateHeight = () => {
      setMobileHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
    };
    const observer = new ResizeObserver(updateHeight);

    updateHeight();
    observer.observe(header);
    window.addEventListener("resize", updateHeight);
    mobileHeaderCleanupRef.current = () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  useEffect(
    () => () => {
      mobileHeaderCleanupRef.current();
    },
    [],
  );
  useEffect(() => {
    const query = searchParams.get("q");
    if (!isOnline || !query) return;
    setFilters((current) => (current.search === query ? current : { ...current, search: query }));
    setPage(1);
  }, [isOnline, searchParams]);

  useEffect(() => {
    const applyIntent = (value: string) => {
      if (!value) return;
      setFilters((current) => (current.search === value ? current : { ...current, search: value }));
      setPage(1);
    };

    applyIntent(consumeScanSearchIntent("orders"));
    return subscribeScanSearchIntent("orders", applyIntent);
  }, []);

  const effectiveFilters = useMemo<OrderListFilters>(() => {
    return {
      ...filters,
      queueGroups: statusGroup === "all" ? filters.queueGroups : [statusGroup],
    };
  }, [filters, statusGroup]);

  const currentSelection = useMemo<OrderListSelection>(
    () => ({ statusGroup, statusCode, filters, page }),
    [filters, page, statusCode, statusGroup],
  );
  const queueInput = useMemo(
    () => orderListInputForSelection(currentSelection),
    [currentSelection],
  );
  const queueRequestHash = useMemo(() => orderListRequestHash(queueInput), [queueInput]);

  const {
    data: listResult,
    isPending: listIsPending,
    isFetching,
    isPlaceholderData,
    isError: listIsError,
    error: listError,
    refetch: refetchOrders,
  } = useQuery({
    ...orderListPageQueryOptions(queueInput, activeStoreId),
    enabled: canLoadOrderData,
    placeholderData: keepPreviousData,
  });
  const { data: workflow, isError: workflowIsError } = useQuery({
    ...orderWorkflowQueryOptions(activeStoreId),
    enabled: canLoadOrderData,
  });
  const { data: orderOptions, isError: optionsIsError } = useQuery({
    ...orderOptionsQueryOptions(activeStoreId),
    enabled: canLoadOrderData,
  });
  const storeSettingsQuery = useQuery({
    ...storeSettingsQueryOptions(activeStoreId),
    enabled: canLoadOrderData,
  });
  const storeSettings = storeSettingsQuery.data;
  const storeOutputIdentity = useMemo(
    () =>
      resolveStoreOutputIdentity({
        activeStore: shell.activeStore,
        settings: storeSettings,
        settingsState: storeSettingsQuery.isLoading
          ? "loading"
          : storeSettingsQuery.isError
            ? "error"
            : "ready",
      }),
    [shell.activeStore, storeSettings, storeSettingsQuery.isError, storeSettingsQuery.isLoading],
  );

  const options = orderOptions ?? emptyOrderOptions;
  const canReadSuppliers = options.permissions.canReadSuppliers;
  const canAssignSuppliers = options.permissions.canAssignSuppliers;
  const canBrowseOrderArchive = options.permissions.canBrowseOrderArchive === true;
  const canSearchOrderArchive = options.permissions.canSearchOrderArchive === true;
  const canExportOrders = options.permissions.canExportOrders === true;
  const canBatchTransitionOrders = options.permissions.canBatchTransitionOrders === true;
  const canUseBulkActions = canExportOrders || canBatchTransitionOrders;
  useEffect(() => {
    if (!canUseBulkActions) setSelected([]);
  }, [canUseBulkActions]);
  const visibleSuppliers = useMemo(
    () => (canReadSuppliers ? options.suppliers : []),
    [canReadSuppliers, options.suppliers],
  );
  const workflowErrorMessage = "状态流配置暂时不可用。";
  const optionsErrorMessage = "筛选选项暂时不可用。";
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
  const groupedData = useMemo(() => groupOrderListItems(data), [data]);
  const totalOrders = listResult?.total ?? 0;
  const pageCount = listResult?.pageCount ?? 1;
  const resultGroupCounts = listResult?.resultGroupCounts ?? createOrderResultGroupCounts();
  const statusGroups = useMemo(() => {
    const activeView = (filters.view ?? "active") === "active";
    const queueCounts = listResult?.queueCounts ?? {
      all: totalOrders,
      processing: 0,
      ordered: 0,
      arrived: 0,
      arrived_notified: 0,
      repaired: 0,
      repaired_notified: 0,
    };
    if (!activeView) {
      return [
        {
          key: "all" as const,
          label: filters.view === "archive" ? "全部历史" : "全部订单",
          shortLabel: "全",
          tone: "neutral" as const,
          count: totalOrders,
          hint: filters.view === "archive" ? "已归档订单" : "全部订单",
        },
      ];
    }
    return [
      {
        key: "all" as const,
        label: "全部待办",
        shortLabel: "全",
        tone: "neutral" as const,
        count: queueCounts.all,
        hint: orderStageHints.all,
      },
      ...orderQueueGroups.map((key) => ({
        key,
        label: orderQueueGroupMeta[key].label,
        shortLabel: orderQueueGroupMeta[key].shortLabel,
        tone: orderQueueGroupMeta[key].tone,
        count: queueCounts[key],
        hint: orderStageHints[key],
      })),
    ];
  }, [filters.view, listResult?.queueCounts, totalOrders]);
  const listErrorMessage =
    listError instanceof Error ? listError.message : "请检查网络、登录状态或数据库迁移。";
  const applyOrderListSelection = useCallback((selection: OrderListSelection) => {
    setStatusGroup(selection.statusGroup);
    setStatusCode(selection.statusCode);
    setFilters(selection.filters);
    setPage(selection.page);
    setSelected([]);
  }, []);
  const setFiltersWhenOnline = useCallback(
    (update: SetStateAction<OrderListFilters>) => {
      if (!isOnline) return;
      setFilters(update);
    },
    [isOnline],
  );
  const activePendingListIntent =
    pendingListIntent?.requestHash === queueRequestHash ? pendingListIntent : null;
  const listTransitionPending = Boolean(activePendingListIntent);
  const listInteractionBlocked = listTransitionPending;
  const backgroundRefreshing =
    isOnline &&
    isFetching &&
    !isPlaceholderData &&
    !listTransitionPending &&
    !searchInput.isDebouncing &&
    !searchInput.committedValue;

  useEffect(() => {
    if (!pendingListIntent || pendingListIntent.requestHash !== queueRequestHash || !listIsError) {
      return;
    }
    const failedIntent = pendingListIntent;
    setFailedListIntent(failedIntent);
    setPendingListIntent((current) => (current?.id === failedIntent.id ? null : current));
    applyOrderListSelection(failedIntent.rollback);
  }, [applyOrderListSelection, listIsError, pendingListIntent, queueRequestHash]);

  useEffect(() => {
    if (isOnline || !pendingListIntent) return;
    const interruptedIntent = pendingListIntent;
    setPendingListIntent((current) => (current?.id === interruptedIntent.id ? null : current));
    setFailedListIntent(null);
    applyOrderListSelection(interruptedIntent.rollback);
  }, [applyOrderListSelection, isOnline, pendingListIntent]);

  useEffect(() => {
    if (!pendingListIntent || pendingListIntent.requestHash === queueRequestHash) return;
    setPendingListIntent(null);
  }, [pendingListIntent, queueRequestHash]);

  useEffect(() => {
    if (!listResult || isFetching || isPlaceholderData || listIsError) return;
    if (pendingListIntent) {
      if (pendingListIntent.requestHash !== queueRequestHash) return;
      lastResolvedSelectionRef.current = pendingListIntent.requested;
      setPendingListIntent((current) => (current?.id === pendingListIntent.id ? null : current));
      setFailedListIntent(null);
      return;
    }
    lastResolvedSelectionRef.current = currentSelection;
  }, [
    currentSelection,
    isFetching,
    isPlaceholderData,
    listIsError,
    listResult,
    pendingListIntent,
    queueRequestHash,
  ]);

  const searchBusy =
    searchInput.isDebouncing ||
    (isFetching && Boolean(searchInput.committedValue) && !listTransitionPending);
  const searchHasError = listIsError && Boolean(searchInput.committedValue);
  const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    const statusLabels = new Map(workflowStatuses.map((status) => [status.code, status.label]));
    const activeGroup = statusGroups.find((group) => group.key === statusGroup);

    if (filters.search?.trim()) {
      chips.push({
        key: "search",
        label: `搜索：${filters.search}${canSearchOrderArchive ? "（含历史）" : ""}`,
      });
    }
    if (filters.view && filters.view !== "active") {
      chips.push({
        key: "view",
        label: filters.view === "archive" ? "范围：历史归档" : "范围：全部订单",
      });
    }
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
        label: `队列：${activeGroup?.label ?? statusGroup}`,
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
    canSearchOrderArchive,
    filters,
    statusCode,
    statusGroup,
    statusGroups,
    visibleSuppliers,
    workflowStatuses,
  ]);
  const hasActiveFilters = activeFilterChips.length > 0;
  const mobileHiddenFilterCount = activeFilterChips.filter(
    (chip) => !["phase", "search", "view"].includes(chip.key),
  ).length;
  const isPageOutOfRange = Boolean(
    listResult && listResult.total > 0 && !listResult.items.length && page > pageCount,
  );

  const runOrderDetailPrefetch = useCallback(
    (orderId: string) => {
      if (!detailPreloadEnabled || !activeStoreId || !coordinator) return Promise.resolve();
      const detailOptions = orderDetailQueryOptions(orderId, activeStoreId);
      return coordinator.prefetch({
        group: "orders.all",
        queryKey: detailOptions.queryKey,
        queryFn: detailOptions.queryFn!,
        staleTime: CACHE_TIMES.detail,
        gcTime: ORDER_DETAIL_PRELOAD_GC_TIME,
      });
    },
    [activeStoreId, coordinator, detailPreloadEnabled],
  );

  const scheduleOrderDetailPrefetch = useCallback(
    (orderId: string, priority: "background" | "intent" = "intent") => {
      if (!detailPreloadEnabled || !activeStoreId || !coordinator) return false;
      return detailPreloadScheduler.schedule(
        `${activeStoreId}:${orderId}`,
        () => runOrderDetailPrefetch(orderId),
        priority,
      );
    },
    [
      activeStoreId,
      coordinator,
      detailPreloadEnabled,
      detailPreloadScheduler,
      runOrderDetailPrefetch,
    ],
  );

  const cancelOrderDetailPrefetch = useCallback(
    (orderId: string) => {
      if (!activeStoreId) return false;
      return detailPreloadScheduler.cancel(`${activeStoreId}:${orderId}`);
    },
    [activeStoreId, detailPreloadScheduler],
  );

  useEffect(() => {
    detailPreloadScheduler.clear();
  }, [activeStoreId, detailPreloadScheduler]);

  useEffect(() => {
    return () => detailPreloadScheduler.clear();
  }, [detailPreloadScheduler]);

  useEffect(() => {
    if (!data.length || isPlaceholderData || typeof navigator === "undefined") return;
    const connection = (
      navigator as Navigator & {
        connection?: { effectiveType?: string; saveData?: boolean };
      }
    ).connection;
    const limit = getOrderDetailAutomaticPreloadLimit({
      online: navigator.onLine,
      effectiveType: connection?.effectiveType,
      saveData: connection?.saveData,
    });
    data.slice(0, limit).forEach((order) => scheduleOrderDetailPrefetch(order.id, "background"));
  }, [data, isPlaceholderData, scheduleOrderDetailPrefetch]);

  const invalidate = (orderId?: string) => {
    invalidateOrderReadCaches(queryClient, orderId);
  };

  const refreshOrderData = (orderId?: string) => {
    if (coordinator) {
      void coordinator.refreshGroups(["orders.all", "customers.all"]);
      return;
    }
    invalidate(orderId);
  };

  const bulk = useMutation({
    mutationFn: ({ ids, to }: { ids: string[]; to: RepairOrderStatus }) => batchTransition(ids, to),
    onSuccess: (r, vars) => {
      toast.success(
        `已将 ${r.count} 条流转为「${getWorkflowStatusLabel(workflow, vars.to)}」` +
          (r.failures.length ? `（${r.failures.length} 条失败）` : ""),
      );
      setSelected([]);
      refreshOrderData();
    },
  });

  const partsSupplierMutation = useMutation({
    mutationFn: ({ order, supplierId }: { order: OrderListItem; supplierId: string | null }) =>
      patchOrder(order.id, {
        expected_updated_at: order.updated_at,
        changes: { parts_supplier_id: supplierId },
      }),
    onMutate: async (vars) => {
      const freshnessGuard = coordinator?.beginMutation(["orders.all"]);
      await queryClient.cancelQueries({ queryKey: ordersKeys.all });
      const snapshot = snapshotOrderReadCaches(queryClient, vars.order.id);
      patchOrderReadCaches(queryClient, vars.order.id, { parts_supplier_id: vars.supplierId });
      return { freshnessGuard, snapshot };
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
      refreshOrderData(vars.order.id);
    },
    onError: (error, vars, context) => {
      if (!coordinator || coordinator.canRestoreMutationSnapshot(context?.freshnessGuard)) {
        restoreOrderReadCaches(queryClient, context?.snapshot);
      }
      if (isOrderVersionConflict(error)) {
        refreshOrderData(vars.order.id);
        toast.error("工单已被更新，已刷新最新数据，请确认后重新选择供应商");
        return;
      }
      toast.error(error instanceof Error ? error.message : "保存配件供应商失败");
    },
    onSettled: (_data, _error, _vars, context) => {
      coordinator?.endMutation(context?.freshnessGuard);
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

  const beginListIntent = useCallback(
    ({
      requested,
      kind,
      key,
      label,
    }: {
      requested: OrderListSelection;
      kind: OrderListIntent["kind"];
      key: string;
      label: string;
    }) => {
      if (!isOnline) {
        setPendingListIntent(null);
        setFailedListIntent(null);
        return;
      }
      const requestHash = orderListRequestHash(orderListInputForSelection(requested));
      if (requestHash === queueRequestHash && !listIsError) return;
      const intent: OrderListIntent = {
        id: ++listIntentSequenceRef.current,
        kind,
        key,
        label,
        requestHash,
        requested,
        rollback: lastResolvedSelectionRef.current,
      };
      setFailedListIntent(null);
      setPendingListIntent(intent);
      applyOrderListSelection(requested);
    },
    [applyOrderListSelection, isOnline, listIsError, queueRequestHash],
  );

  const clearAllFilters = () => {
    if (!isOnline) return;
    setPendingListIntent(null);
    setFailedListIntent(null);
    setStatusGroup("all");
    setStatusCode("all");
    setFilters((current) => ({ view: current.view }));
    setPage(1);
  };

  const clearMobileHiddenFilters = () => {
    if (!isOnline) return;
    setPendingListIntent(null);
    setFailedListIntent(null);
    setStatusCode("all");
    setFilters((current) => ({ search: current.search, view: current.view }));
    setPage(1);
  };

  const removeFilterChip = (key: string) => {
    if (!isOnline) return;
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
      if (key === "view") return { ...current, view: "active" };
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
    if (!isOnline) return;
    setStatusGroup("all");
    setStatusCode("all");
  };

  const handleStatusGroupChange = (nextGroup: string) => {
    const nextStatusGroup = nextGroup as "all" | OrderQueueGroup;
    const nextFilters = {
      ...filters,
      statuses: undefined,
      workflowStatuses: undefined,
      queueGroups: undefined,
      overdue: undefined,
    };
    const label = statusGroups.find((group) => group.key === nextStatusGroup)?.label ?? "目标队列";
    beginListIntent({
      requested: {
        statusGroup: nextStatusGroup,
        statusCode: "all",
        filters: nextFilters,
        page: 1,
      },
      kind: "queue",
      key: nextStatusGroup,
      label,
    });
  };

  const handleStatusCodeChange = (nextStatus: string) => {
    if (!isOnline) return;
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
    if (canBrowseOrderArchive || !filters.view || filters.view === "active") return;
    setFilters((current) => ({ ...current, view: "active" }));
  }, [canBrowseOrderArchive, filters.view]);

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
    if (!storeOutputIdentity.canOutput) {
      toast.error(storeOutputIdentity.blockReason ?? "请先补齐当前店铺资料后再打印");
      return;
    }
    setPrintOrders(rows);
    window.requestAnimationFrame(() => window.print());
  };
  const openDetail = (id: string) => {
    scheduleOrderDetailPrefetch(id, "intent");
    setDetailOrderId(id);
  };
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
    searchInput.commitNow(value);
  };
  const orderListView = filters.view ?? "active";
  const changeOrderListView = (view: OrderListView) => {
    const label = view === "active" ? "待处理订单" : view === "archive" ? "历史订单" : "全部订单";
    beginListIntent({
      requested: {
        statusGroup: "all",
        statusCode: "all",
        filters: { ...filters, view, queueGroups: undefined },
        page: 1,
      },
      kind: "view",
      key: view,
      label,
    });
  };
  const changeOrderListPage = (nextPage: number) => {
    beginListIntent({
      requested: { ...currentSelection, page: nextPage },
      kind: "page",
      key: String(nextPage),
      label: `第 ${nextPage} 页`,
    });
  };
  const retryFailedListIntent = () => {
    if (!failedListIntent) {
      void refetchOrders();
      return;
    }
    beginListIntent({
      requested: failedListIntent.requested,
      kind: failedListIntent.kind,
      key: failedListIntent.key,
      label: failedListIntent.label,
    });
  };

  if (!isOnline && !listResult) {
    return (
      <OrdersErrorState
        message="当前离线，暂无可用订单缓存。恢复网络后请重试。"
        onRetry={() => refreshOrderData()}
      />
    );
  }
  if (
    !listResult &&
    !listIsError &&
    (shell.status === "loading" || (Boolean(activeStoreId) && listIsPending))
  ) {
    return <OrderListSkeleton />;
  }
  if (!activeStoreId) {
    return <StoreShellUnavailableState shell={shell} onRetry={shell.retry} />;
  }

  return (
    <div
      className={cn(repairOs.mobileListFloatingPage, "md:pb-8")}
      data-order-list-refreshing={isFetching ? "true" : "false"}
      aria-busy={listTransitionPending || isFetching}
      style={
        mobileHeaderHeight > 0
          ? ({
              "--orders-mobile-header-offset": `${mobileHeaderHeight + 8}px`,
            } as CSSProperties)
          : undefined
      }
    >
      <MobileOrdersFloatingHeader
        headerRef={setMobileHeaderRef}
        groups={statusGroupItems}
        groupValue={statusGroup}
        pendingGroupValue={
          activePendingListIntent?.kind === "queue" ? activePendingListIntent.key : undefined
        }
        pendingLabel={activePendingListIntent?.label}
        totalOrders={totalOrders}
        onGroupChange={handleStatusGroupChange}
        onCreateOrder={() => setNewOrderOpen(true)}
        searchValue={searchInput.draftValue}
        searchBusy={searchBusy}
        interactionDisabled={!isOnline}
        onSearchChange={searchInput.setDraftValue}
        onSearchSubmit={() => searchInput.commitNow()}
        onSearchClear={searchInput.clearSearch}
        scanAction={
          <ScanSearchButton
            scope="orders"
            disabled={!isOnline}
            onSearch={applyScanSearch}
            className="size-10 rounded-xl bg-card"
            iconClassName="size-3.5"
          />
        }
        viewModeControl={
          <OrderListViewMode
            value={orderListView}
            canBrowseArchive={canBrowseOrderArchive}
            compact
            disabled={!isOnline}
            onChange={changeOrderListView}
          />
        }
      />

      <OrderListTransitionFeedback
        pendingLabel={activePendingListIntent?.label}
        offlineMessage={!isOnline ? "当前离线，显示最近数据。" : undefined}
        errorMessage={
          failedListIntent ? `加载${failedListIntent.label}失败，已恢复上一次成功队列。` : undefined
        }
        backgroundRefreshing={backgroundRefreshing}
        onRetry={retryFailedListIntent}
      />

      {isOnline && !listTransitionPending && !failedListIntent ? (
        <div className="md:hidden">
          <OrderSearchFeedback
            compact
            draftValue={searchInput.draftValue}
            committedValue={searchInput.committedValue}
            isDebouncing={searchInput.isDebouncing}
            isFetching={isFetching}
            isPlaceholderData={isPlaceholderData}
            hasError={searchHasError}
            total={totalOrders}
            resultGroupCounts={listResult?.resultGroupCounts}
            canSearchArchive={canSearchOrderArchive}
            onRetry={() => void refetchOrders()}
          />
        </div>
      ) : null}

      {mobileHiddenFilterCount > 0 ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border/60 bg-surface/70 px-3 py-2 text-xs text-muted-foreground md:hidden">
          <Filter className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">已应用 {mobileHiddenFilterCount} 项高级筛选</span>
          <Button
            type="button"
            disabled={!isOnline}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-primary"
            onClick={clearMobileHiddenFilters}
          >
            清除
          </Button>
        </div>
      ) : null}

      {workflowIsError || optionsIsError ? (
        <div className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-status-warn-foreground/25 bg-status-warn/10 px-3 py-2 text-xs text-status-warn-foreground md:hidden">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {workflowIsError ? workflowErrorMessage : optionsErrorMessage}
          </span>
        </div>
      ) : null}

      {/* Desktop stage and search toolbar */}
      <div
        data-order-desktop-unified-toolbar="true"
        className={cn(
          repairOs.mobileInfoCard,
          "mb-3 mt-3 hidden min-w-0 flex-col gap-2 p-2.5 md:flex",
        )}
      >
        <OrderStatusFilterControls
          embedded
          className="min-w-0"
          groups={statusGroupItems}
          subTabs={statusSubTabs}
          groupValue={statusGroup}
          statusValue={statusCode}
          onGroupChange={handleStatusGroupChange}
          onStatusChange={handleStatusCodeChange}
        />

        <div className={cn(layoutGuards.wrapRow, "min-w-0 items-stretch justify-end")}>
          <OrderListViewMode
            value={orderListView}
            canBrowseArchive={canBrowseOrderArchive}
            disabled={!isOnline}
            onChange={changeOrderListView}
          />
          <div className="relative min-w-0 flex-[1_1_260px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput.draftValue}
              disabled={!isOnline}
              onChange={(event) => searchInput.setDraftValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                searchInput.commitNow();
              }}
              placeholder="搜索工单号、客户姓名、电话或 IMEI"
              aria-label="搜索工单、客户、电话或 IMEI"
              className={cn(controls.searchInput, "pr-16")}
              aria-busy={searchBusy}
            />
            <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              {searchBusy ? (
                <LoaderCircle
                  className="pointer-events-none size-4 shrink-0 animate-spin text-primary"
                  aria-hidden="true"
                />
              ) : null}
              {searchInput.draftValue ? (
                <button
                  type="button"
                  disabled={!isOnline}
                  onClick={searchInput.clearSearch}
                  className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  aria-label="清除搜索"
                  title="清除搜索"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
          <ScanSearchButton
            scope="orders"
            disabled={!isOnline}
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
                disabled={!isOnline}
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
                setFilters={setFiltersWhenOnline}
                options={options}
                statuses={workflowStatuses}
                onClose={() => setMobileFiltersOpen(false)}
                onStatusFilterChange={resetWorkflowFilters}
              />
            </SheetContent>
          </Sheet>
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
        {isOnline && !listTransitionPending && !failedListIntent ? (
          <OrderSearchFeedback
            draftValue={searchInput.draftValue}
            committedValue={searchInput.committedValue}
            isDebouncing={searchInput.isDebouncing}
            isFetching={isFetching}
            isPlaceholderData={isPlaceholderData}
            hasError={searchHasError}
            total={totalOrders}
            resultGroupCounts={listResult?.resultGroupCounts}
            canSearchArchive={canSearchOrderArchive}
            onRetry={() => void refetchOrders()}
          />
        ) : null}
        {(workflowIsError || optionsIsError) && (
          <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-status-warn-foreground/25 bg-status-warn/10 px-2.5 py-2 text-xs text-status-warn-foreground">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              {workflowIsError
                ? `状态流未加载，正在使用默认状态。${workflowErrorMessage}`
                : `筛选选项未加载。${optionsErrorMessage}`}
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
                disabled={!isOnline}
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
              disabled={!isOnline}
              className="h-7 px-2 text-xs"
              onClick={clearAllFilters}
            >
              清除全部
            </Button>
          </div>
        )}
      </div>

      {isOnline && listIsError && listResult && !searchInput.committedValue && !failedListIntent ? (
        <div
          role="status"
          className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-status-warn-foreground/25 bg-status-warn/10 px-3 py-2 text-xs text-status-warn-foreground"
        >
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">工单刷新失败，正在显示上次数据。</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={() => refreshOrderData()}
          >
            重试
          </Button>
        </div>
      ) : null}

      {/* List */}
      <div
        className={cn(
          "pb-8 transition-opacity",
          listInteractionBlocked && "pointer-events-none select-none opacity-50",
        )}
        inert={listInteractionBlocked ? true : undefined}
        data-order-list-blocked={listInteractionBlocked ? "true" : "false"}
      >
        {isPageOutOfRange ? (
          <div className="space-y-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : listIsError && !listResult ? (
          <OrdersErrorState message={listErrorMessage} onRetry={() => refreshOrderData()} />
        ) : !data.length ? (
          <EmptyOrdersState
            hasActiveFilters={hasActiveFilters}
            searchQuery={searchInput.committedValue}
            onClearFilters={clearAllFilters}
          />
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
                    {canUseBulkActions
                      ? "点击查看详情，勾选后可执行批量操作。"
                      : "点击任意工单查看详情。"}
                  </div>
                </div>
                {canUseBulkActions ? (
                  <span className="text-xs text-muted-foreground">
                    选中 <span className="text-foreground">{selected.length}</span>
                  </span>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <div
                  className={cn(
                    orderQueueDesktopGrid,
                    "rounded-lg border border-border/40 bg-surface/45 px-1 text-[11px] font-medium text-muted-foreground",
                  )}
                >
                  <label className="flex min-w-0 items-center justify-center py-1.5">
                    {canUseBulkActions ? (
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(v) => setSelected(v ? data.map((o) => o.id) : [])}
                        aria-label="选择当前页全部工单"
                      />
                    ) : null}
                  </label>
                  <div className="min-w-0 px-2 py-1.5">阶段 / 下一步</div>
                  <div className="min-w-0 px-2 py-1.5">工单 / 客户</div>
                  <div className="min-w-0 px-2 py-1.5">设备 / 故障</div>
                  <div className="px-2 py-1.5 text-right">金额 / 风险</div>
                  <div className="px-2 py-1.5">负责人 / 时间</div>
                  <div className="px-2 py-1.5 text-right">{data.length}</div>
                </div>
                <div className="space-y-3">
                  {groupedData.map((section) => (
                    <section
                      key={section.group}
                      className="space-y-1.5"
                      aria-labelledby={`desktop-order-group-${section.group}`}
                    >
                      <OrderResultGroupHeader
                        headingId={`desktop-order-group-${section.group}`}
                        group={section.group}
                        pageCount={section.items.length}
                        totalCount={resultGroupCounts[section.group]}
                        oldestCreatedAt={section.items[0].created_at}
                      />
                      <motion.div
                        role="list"
                        aria-label={`${orderResultGroupMeta[section.group].label}工单分组`}
                        variants={stagger(0.025)}
                        initial="hidden"
                        animate="show"
                        className="space-y-1.5"
                      >
                        {section.items.map((order) => {
                          const checked = selected.includes(order.id);
                          return (
                            <div key={order.id} role="listitem">
                              <DesktopOrderQueueRow
                                order={order}
                                workflow={workflow}
                                checked={checked}
                                selectable={canUseBulkActions}
                                onOpen={() => openDetail(order.id)}
                                onPrefetch={() => scheduleOrderDetailPrefetch(order.id, "intent")}
                                onCancelPrefetch={() => cancelOrderDetailPrefetch(order.id)}
                                onCheckedChange={(value) =>
                                  setSelected((previous) =>
                                    value
                                      ? [...previous, order.id]
                                      : previous.filter((id) => id !== order.id),
                                  )
                                }
                                onPrint={() => printRows([order])}
                                canPrint={canExportOrders}
                                onStopInteraction={stopRowClick}
                                suppliers={visibleSuppliers}
                                onPartsSupplierChange={
                                  canAssignSuppliers
                                    ? (supplierId) =>
                                        partsSupplierMutation.mutate({ order, supplierId })
                                    : undefined
                                }
                                isPartsSupplierUpdating={
                                  partsSupplierMutation.isPending &&
                                  partsSupplierMutation.variables?.order.id === order.id
                                }
                              />
                            </div>
                          );
                        })}
                      </motion.div>
                    </section>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile and tablet cards */}
            <div data-order-mobile-list="true" className="space-y-3 lg:hidden">
              {groupedData.map((section) => (
                <section
                  key={section.group}
                  className="space-y-1.5"
                  aria-labelledby={`mobile-order-group-${section.group}`}
                >
                  <OrderResultGroupHeader
                    headingId={`mobile-order-group-${section.group}`}
                    group={section.group}
                    pageCount={section.items.length}
                    totalCount={resultGroupCounts[section.group]}
                    oldestCreatedAt={section.items[0].created_at}
                  />
                  <div className="space-y-1.5" role="list">
                    {section.items.map((order) => (
                      <div key={order.id} role="listitem">
                        <OrderMobileCard
                          order={order}
                          onPrefetch={() => scheduleOrderDetailPrefetch(order.id, "intent")}
                          onCancelPrefetch={() => cancelOrderDetailPrefetch(order.id)}
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
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <PaginationBar
              page={page}
              pageCount={pageCount}
              pageSize={ORDER_QUEUE_PAGE_SIZE}
              total={totalOrders}
              visible={data.length}
              onPageChange={changeOrderListPage}
            />
          </>
        )}
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {canUseBulkActions && selected.length > 0 && (
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
              {canBatchTransitionOrders ? (
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
                      <DropdownMenuItem
                        key={s}
                        onClick={() => bulk.mutate({ ids: selected, to: s })}
                      >
                        {getWorkflowStatusLabel(workflow, s)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {canExportOrders ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => printRows(data.filter((order) => selected.includes(order.id)))}
                >
                  <Printer className="size-3.5" /> 打印
                </Button>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <OrderListPrintSheet
        orders={printOrders}
        storeSettings={storeSettings}
        activeStore={shell.activeStore}
      />
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
