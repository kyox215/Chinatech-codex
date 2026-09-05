"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type SyntheticEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Filter,
  LoaderCircle,
  Plus,
  Printer,
  Search,
  Sparkles,
  X,
} from "lucide-react";

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
  OrderPrintPaperDialog,
  readOrderPrintPaperMode,
  rememberOrderPrintPaperMode,
} from "@/features/orders/components/order-print-paper-dialog";
import { FixedPdfReadyDialog } from "@/features/orders/components/fixed-pdf-ready-dialog";
import type { PrintPaperMode } from "@/features/orders/components/print-portal";
import { NewOrderDialog } from "@/features/orders/components/new-order-dialog";
import { DesktopOrderQueueRow } from "@/features/orders/components/order-list-desktop-row";
import { orderQueueDesktopGrid } from "@/features/orders/components/order-list-layout";
import { OrderResultGroupHeader } from "@/features/orders/components/order-result-group-header";
import { OrderSearchFeedback } from "@/features/orders/components/order-search-feedback";
import { OrderListSkeleton } from "@/features/orders/components/order-list-skeleton";
import { OrderListViewMode } from "@/features/orders/components/order-list-view-mode";
import { OrderListTransitionFeedback } from "@/features/orders/components/order-list-transition-feedback";
import { OrderStatusFilterControls } from "@/features/orders/components/order-list-filters";
import { MobileOrdersFloatingHeader } from "@/features/orders/components/order-list-mobile-header";
import { OrderQrScannerButton } from "@/features/orders/components/order-qr-scanner";
import { useRealtimeSync } from "@/features/realtime";
import {
  EmptyOrdersState,
  OrdersErrorState,
  PaginationBar,
} from "@/features/orders/components/order-list-states";
import { OrderDetailSkeleton } from "@/features/orders/components/order-detail-skeleton";
import { batchTransition, type OrderListFilters, type OrderListItem } from "@/lib/repairdesk/api";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { OrderListPageInput, OrderListView, OrderQueueGroup } from "@/lib/repairdesk/types";
import {
  getCommonWorkflowTargets,
  getWorkflowStatuses,
  type OrderListStatusTab,
} from "@/features/orders/model/order-workflow";
import { orderTransitionRequiresReason } from "@/features/orders/model/order-transition-reasons";
import {
  orderQueueGroupMeta,
  orderQueueGroups,
} from "@/features/orders/model/order-queue-classification";
import {
  localizeOrderResultGroup,
  localizeOrderException,
  localizeBulkTransitionFeedback,
  localizeWorkflowStatusLabel,
} from "@/features/orders/model/order-i18n";
import {
  createOrderResultGroupCounts,
  groupOrderListItems,
  orderResultGroupMeta,
} from "@/features/orders/model/order-list-grouping";
import { useOrderSearchInput } from "@/features/orders/model/use-order-search-input";
import {
  sanitizeOrderSearchDraft,
  sanitizeOrderSearchInput,
  sanitizeOrderSearchValue,
} from "@/features/orders/model/order-search-safety";
import { canRunExactArchiveOrderSearch } from "@/features/orders/model/order-search-query";
import {
  readOrderListRouteState,
  type OrderListRouteStateV1,
  writeOrderListRouteState,
} from "@/features/orders/model/order-list-route-state";
import { ordersKeys } from "@/features/orders/api/query-keys";
import {
  ORDER_QUEUE_PAGE_SIZE,
  orderDetailQueryOptions,
  orderQueueSummaryQueryOptions,
} from "@/features/orders/api/query-options";
import {
  BoundedPreloadScheduler,
  ORDER_DETAIL_PRELOAD_GC_TIME,
} from "@/features/preload/model/order-detail-preload";
import { isRepairDeskPreloadEnabled } from "@/features/preload/model/preload-plan";
import { storeSettingsQueryOptions } from "@/features/messages/api/query-options";
import { useFixedOrderPdfPrint } from "@/features/orders/print/use-fixed-order-pdf-print";
import { issueCustomerStatusLinks } from "@/features/customer-status/api/customer-status-client";
import { invalidateOrderReadCaches } from "@/features/orders/api/cache-sync";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { useAiAssistantWorkspace } from "@/features/ai-assistant";
import { StoreShellUnavailableState } from "@/features/stores/components/store-shell-unavailable-state";
import { REPAIRDESK_NEW_ORDER_EVENT } from "@/lib/app-events";
import { CACHE_TIMES } from "@/lib/query-performance";
import { cn } from "@/lib/utils";
import { useViewportMode } from "@/hooks/use-mobile";
import type { NewOrderPrefill } from "@/features/orders/model/new-order-intent";
import {
  buildOrderDetailWorkspaceHref,
  clearOrderWorkspaceIntentHref,
  parseOrderWorkspaceIntent,
} from "@/features/orders/model/order-workspace-intent";
import { useLocale } from "@/shared/i18n/locale-provider";
import { localizeOrderQueueGroup } from "@/features/orders/model/order-i18n";

const LazyOrderDetailScreen = lazy(() =>
  import("@/features/orders/screens/order-detail-screen").then((module) => ({
    default: module.OrderDetailScreen,
  })),
);

const emptyOrderOptions = {
  suppliers: [],
  technicians: [],
  permissions: {
    canReadSuppliers: false,
    canAssignSuppliers: false,
    canManageSuppliers: false,
    canSearchOrderArchive: false,
    canBrowseOrderArchive: false,
    canPrintSingleOrders: false,
    canBatchPrintOrders: false,
    canExportOrders: false,
    canBatchTransitionOrders: false,
  },
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
  pageSize: number;
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
    pageSize: selection.pageSize,
  };
}

function orderListRequestHash(input: OrderListPageInput) {
  return JSON.stringify(input);
}

export function OrderListScreen() {
  const { t } = useLocale();
  const [statusGroup, setStatusGroup] = useState<"all" | OrderQueueGroup>("all");
  const [statusCode, setStatusCode] = useState<string>("all");
  const [filters, setFilters] = useState<OrderListFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(ORDER_QUEUE_PAGE_SIZE);
  const [pendingListIntent, setPendingListIntent] = useState<OrderListIntent | null>(null);
  const [failedListIntent, setFailedListIntent] = useState<OrderListIntent | null>(null);
  const listIntentSequenceRef = useRef(0);
  const lastResolvedSelectionRef = useRef<OrderListSelection>({
    statusGroup: "all",
    statusCode: "all",
    filters: {},
    page: 1,
    pageSize: ORDER_QUEUE_PAGE_SIZE,
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [printOrders, setPrintOrders] = useState<OrderListItem[]>([]);
  const [pendingPrintOrders, setPendingPrintOrders] = useState<OrderListItem[]>([]);
  const [printPaperDialogOpen, setPrintPaperDialogOpen] = useState(false);
  const [printPaperMode, setPrintPaperMode] = useState<PrintPaperMode>(readOrderPrintPaperMode);
  const [customerStatusUrls, setCustomerStatusUrls] = useState<Record<string, string>>({});
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const detailCloseRequestRef = useRef<((reason: "close" | "escape" | "outside") => void) | null>(
    null,
  );
  const [detailFaultEditorActive, setDetailFaultEditorActive] = useState(false);
  const listInvokerRef = useRef<HTMLElement | null>(null);
  const detailReturnFocusRef = useRef<HTMLElement | null>(null);
  const rememberListInvoker = (event: SyntheticEvent) => {
    const target = event.target;
    if (!(target instanceof Element) || target.closest("[data-order-detail-dialog-shell]")) return;
    const control = target.closest('button, [role="button"], a[href]');
    if (control instanceof HTMLElement) listInvokerRef.current = control;
  };
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrderPrefill, setNewOrderPrefill] = useState<NewOrderPrefill>();
  const previousNewOrderOpenRef = useRef(false);
  const previousDetailOrderIdRef = useRef<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [newOrderSessionKey, setNewOrderSessionKey] = useState(0);
  const mobileHeaderCleanupRef = useRef<() => void>(() => undefined);
  const restoredListIdentityRef = useRef("");
  const pendingScrollRestoreRef = useRef<{ scrollY: number; anchorOrderId?: string } | null>(null);
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext();
  const viewportMode = useViewportMode();
  const workspaceIntent = useMemo(
    () => parseOrderWorkspaceIntent(new URLSearchParams(searchParamsKey)),
    [searchParamsKey],
  );
  const clearWorkspaceIntent = useCallback(() => {
    const href = clearOrderWorkspaceIntentHref({ toString: () => searchParamsKey });
    window.history.replaceState(window.history.state, "", href);
  }, [searchParamsKey]);
  const aiAssistant = useAiAssistantWorkspace();
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
      const nextSearch = sanitizeOrderSearchValue(value || undefined);
      setFilters((current) =>
        current.search === nextSearch && current.searchScope !== "archive_exact"
          ? current
          : { ...current, search: nextSearch, searchScope: "current" },
      );
      setPage(1);
    },
    [isOnline],
  );
  const searchInput = useOrderSearchInput({
    value: filters.search,
    onCommit: commitSearch,
    sanitize: sanitizeOrderSearchDraft,
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
    const safeQuery = sanitizeOrderSearchValue(query);
    setFilters((current) =>
      sanitizeOrderSearchInput({ ...current, search: safeQuery, searchScope: "current" }),
    );
    setPage(1);
    if (!safeQuery && typeof window !== "undefined") {
      const nextParams = new URLSearchParams(searchParamsKey);
      nextParams.delete("q");
      const nextQuery = nextParams.toString();
      router.replace(`${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`, {
        scroll: false,
      });
    }
  }, [isOnline, router, searchParams, searchParamsKey]);

  useEffect(() => {
    if (!workspaceIntent) return;
    if (workspaceIntent.kind === "new-order") {
      setDetailOrderId(null);
      setNewOrderPrefill(workspaceIntent.prefill);
      setNewOrderSessionKey((current) => current + 1);
      setNewOrderOpen(true);
      return;
    }
    setNewOrderOpen(false);
    setNewOrderPrefill(undefined);
    setDetailOrderId(workspaceIntent.orderId);
  }, [workspaceIntent]);

  useEffect(() => {
    const wasOpen = previousNewOrderOpenRef.current;
    previousNewOrderOpenRef.current = newOrderOpen;
    if (wasOpen && !newOrderOpen) clearWorkspaceIntent();
  }, [clearWorkspaceIntent, newOrderOpen]);

  useEffect(() => {
    const previousId = previousDetailOrderIdRef.current;
    previousDetailOrderIdRef.current = detailOrderId;
    if (previousId && !detailOrderId) clearWorkspaceIntent();
  }, [clearWorkspaceIntent, detailOrderId]);

  const effectiveFilters = useMemo<OrderListFilters>(() => {
    return {
      ...filters,
      queueGroups: statusGroup === "all" ? filters.queueGroups : [statusGroup],
    };
  }, [filters, statusGroup]);

  const currentSelection = useMemo<OrderListSelection>(
    () => ({ statusGroup, statusCode, filters, page, pageSize }),
    [filters, page, pageSize, statusCode, statusGroup],
  );
  const queueInput = useMemo(
    () => orderListInputForSelection(currentSelection),
    [currentSelection],
  );
  const queueRequestHash = useMemo(() => orderListRequestHash(queueInput), [queueInput]);

  const {
    data: queueSummary,
    isPending: listIsPending,
    isFetching,
    isPlaceholderData,
    isError: listIsError,
    refetch: refetchOrders,
  } = useQuery({
    ...orderQueueSummaryQueryOptions(queueInput, activeStoreId),
    enabled: canLoadOrderData,
    placeholderData: keepPreviousData,
  });
  const listResult = queueSummary?.list;
  const workflow = queueSummary?.workflow;
  const orderOptions = queueSummary?.options;
  const workflowIsError = Boolean(queueSummary?.partialErrors?.workflow);
  const optionsIsError = Boolean(queueSummary?.partialErrors?.options);
  const storeSettingsQuery = useQuery({
    ...storeSettingsQueryOptions(activeStoreId),
    enabled: canLoadOrderData,
  });
  const storeSettings = storeSettingsQuery.data;
  const {
    requestPrint,
    preparedPdf,
    generationPending,
    deliveryPending,
    deliveryError,
    dismissPreparedPdf,
    sharePreparedPdf,
    openPreparedPdf,
    downloadPreparedPdf,
  } = useFixedOrderPdfPrint(
    () => {
      setPrintOrders([]);
    },
    (error) => toast.error(error.message),
    {
      scopeKey: `${activeStoreId ?? "no-store"}:order-list`,
      onPdfReady: () => {
        setPrintOrders([]);
        setCustomerStatusUrls({});
      },
      onInvalidate: () => {
        setPrintOrders([]);
        setCustomerStatusUrls({});
      },
    },
  );

  const options = orderOptions ?? emptyOrderOptions;
  const canReadSuppliers = options.permissions.canReadSuppliers;
  const canBrowseOrderArchive = options.permissions.canBrowseOrderArchive === true;
  const canSearchOrderArchive = options.permissions.canSearchOrderArchive === true;
  const canExportOrders = options.permissions.canExportOrders === true;
  const canPrintSingleOrders = options.permissions.canPrintSingleOrders === true;
  const canBatchPrintOrders = options.permissions.canBatchPrintOrders === true;
  const canBatchTransitionOrders = options.permissions.canBatchTransitionOrders === true;
  const canUseBulkActions = canExportOrders || canBatchTransitionOrders;
  const singlePrintDisabledReason = generationPending ? t("orders.printPreparing") : undefined;
  useEffect(() => {
    if (!canUseBulkActions) setSelected([]);
  }, [canUseBulkActions]);
  const visibleSuppliers = useMemo(
    () => (canReadSuppliers ? options.suppliers : []),
    [canReadSuppliers, options.suppliers],
  );
  const workflowErrorMessage = t("orders.workflowUnavailable");
  const optionsErrorMessage = t("orders.filterOptionsUnavailable");
  const statusSubTabs = useMemo<OrderListStatusTab[]>(
    () => [{ key: "all", label: t("orders.allStatuses") }],
    [t],
  );
  const workflowStatuses = useMemo(
    () =>
      getWorkflowStatuses(workflow).map((status) => ({
        code: status.code,
        label: localizeWorkflowStatusLabel(workflow, status.code, t),
      })),
    [t, workflow],
  );

  const data = useMemo(() => listResult?.items ?? [], [listResult?.items]);
  const groupedData = useMemo(() => groupOrderListItems(data), [data]);
  const totalOrders = listResult?.total ?? 0;
  const pageCount = listResult?.pageCount ?? 1;
  const persistListContext = useCallback(
    (anchorOrderId?: string) => {
      if (!activeStoreId || !shell.userId || typeof window === "undefined") return;
      const routeState: OrderListRouteStateV1 = {
        version: 1,
        storeId: activeStoreId,
        userId: shell.userId,
        savedAt: Date.now(),
        statusGroup,
        statusCode,
        filters,
        page,
        pageSize,
        scrollY: window.scrollY,
        anchorOrderId,
      };
      const safeRouteState = writeOrderListRouteState(window.sessionStorage, routeState);
      window.history.replaceState(
        { ...window.history.state, repairdeskOrderListContext: safeRouteState },
        "",
      );
    },
    [activeStoreId, filters, page, pageSize, shell.userId, statusCode, statusGroup],
  );

  useEffect(() => {
    if (!activeStoreId || !shell.userId || typeof window === "undefined") return;
    const identityKey = `${activeStoreId}:${shell.userId}`;
    if (restoredListIdentityRef.current === identityKey) return;
    restoredListIdentityRef.current = identityKey;
    if (searchParams.get("q")?.trim()) return;
    const historyRouteState = window.history.state?.repairdeskOrderListContext as
      | OrderListRouteStateV1
      | undefined;
    if (historyRouteState) writeOrderListRouteState(undefined, historyRouteState);
    const restored = readOrderListRouteState(window.sessionStorage, {
      storeId: activeStoreId,
      userId: shell.userId,
    });
    if (!restored) return;
    setStatusGroup(restored.statusGroup);
    setStatusCode(restored.statusCode);
    setFilters(restored.filters);
    setPage(restored.page);
    setPageSize(restored.pageSize);
    pendingScrollRestoreRef.current = {
      scrollY: restored.scrollY,
      anchorOrderId: restored.anchorOrderId,
    };
  }, [activeStoreId, searchParams, shell.userId]);

  useEffect(() => {
    if (!activeStoreId || !shell.userId || typeof window === "undefined") return;
    const timer = window.setTimeout(() => persistListContext(), 180);
    return () => window.clearTimeout(timer);
  }, [activeStoreId, persistListContext, shell.userId]);

  useEffect(() => {
    const pending = pendingScrollRestoreRef.current;
    if (!pending || !data.length || isFetching) return;
    pendingScrollRestoreRef.current = null;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: pending.scrollY, behavior: "auto" });
      if (!pending.anchorOrderId) return;
      const anchor = document.querySelector<HTMLElement>(
        `[data-order-id="${CSS.escape(pending.anchorOrderId)}"] a[href^="/orders/"]`,
      );
      anchor?.focus({ preventScroll: true });
    });
  }, [data.length, isFetching]);
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
    if (!activeView) return [];
    return [
      {
        key: "all" as const,
        label: t("orders.allStatuses"),
        shortLabel: t("orders.allStatuses"),
        tone: "neutral" as const,
        count: queueCounts.all,
        hint: t("orders.allStatuses"),
      },
      ...orderQueueGroups.map((key) => {
        const localized = localizeOrderQueueGroup(key, t);
        return {
          key,
          label: localized.label,
          shortLabel: localized.shortLabel,
          tone: orderQueueGroupMeta[key].tone,
          count: queueCounts[key],
          hint: localized.hint,
        };
      }),
    ];
  }, [filters.view, listResult?.queueCounts, t, totalOrders]);
  const listErrorMessage = t("orders.safeListError");
  const applyOrderListSelection = useCallback((selection: OrderListSelection) => {
    setStatusGroup(selection.statusGroup);
    setStatusCode(selection.statusCode);
    setFilters(selection.filters);
    setPage(selection.page);
    setPageSize(selection.pageSize);
    setSelected([]);
  }, []);
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
    const statusLabels = new Map(
      workflowStatuses.map((status) => [
        status.code,
        localizeWorkflowStatusLabel(workflow, status.code, t),
      ]),
    );
    const activeGroup = statusGroups.find((group) => group.key === statusGroup);

    if (filters.search?.trim()) {
      chips.push({
        key: "search",
        label:
          filters.searchScope === "archive_exact"
            ? t("orders.chipSearchArchive", { value: filters.search })
            : t("orders.chipSearchCurrent", { value: filters.search }),
      });
    }
    if (filters.view && filters.view !== "active") {
      chips.push({
        key: "view",
        label: filters.view === "archive" ? t("orders.chipViewArchive") : t("orders.chipViewAll"),
      });
    }
    if (filters.statuses?.length) {
      filters.statuses.forEach((status) =>
        chips.push({
          key: `status:${status}`,
          label: t("orders.chipStatus", { value: statusLabels.get(status) ?? status }),
        }),
      );
    } else if (filters.workflowStatuses?.length) {
      filters.workflowStatuses.forEach((status) =>
        chips.push({
          key: `workflow:${status}`,
          label: t("orders.chipWorkflow", {
            value: localizeWorkflowStatusLabel(workflow, status, t),
          }),
        }),
      );
    } else if (statusCode !== "all") {
      chips.push({
        key: "substatus",
        label: t("orders.chipStatus", {
          value: statusLabels.get(statusCode as RepairOrderStatus) ?? statusCode,
        }),
      });
    } else if (statusGroup !== "all") {
      chips.push({
        key: "phase",
        label: t("orders.chipQueue", { value: activeGroup?.label ?? statusGroup }),
      });
    }
    filters.exceptionStatuses?.forEach((status) =>
      chips.push({
        key: `exception:${status}`,
        label: t("orders.chipException", { value: localizeOrderException(status, t).label }),
      }),
    );
    filters.types?.forEach((type) =>
      chips.push({
        key: `type:${type}`,
        label: t("orders.chipType", {
          value: type === "quick_repair" ? t("orders.quickRepair") : t("orders.dropoffRepair"),
        }),
      }),
    );
    if (filters.paid && filters.paid !== "all") {
      chips.push({
        key: "paid",
        label: t("orders.chipPayment", {
          value: filters.paid === "paid" ? t("orders.paid") : t("orders.unpaid"),
        }),
      });
    }
    filters.technicians?.forEach((technician) =>
      chips.push({
        key: `technician:${technician}`,
        label: t("orders.chipTechnician", { value: technician }),
      }),
    );
    if (canReadSuppliers) {
      const supplierLabels = new Map(
        visibleSuppliers.map((supplier) => [supplier.id, supplier.short_name]),
      );
      filters.supplierIds?.forEach((supplierId) =>
        chips.push({
          key: `supplier:${supplierId}`,
          label: t("orders.chipSupplier", { value: supplierLabels.get(supplierId) ?? supplierId }),
        }),
      );
    }
    if (filters.overdue) {
      chips.push({
        key: "overdue",
        label:
          filters.overdue === "approval"
            ? t("orders.chipOverdueApproval")
            : filters.overdue === "pickup"
              ? t("orders.chipOverduePickup")
              : t("orders.chipOverdueAny"),
      });
    }

    return chips;
  }, [
    canReadSuppliers,
    filters,
    statusCode,
    statusGroup,
    statusGroups,
    t,
    visibleSuppliers,
    workflow,
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
        localizeBulkTransitionFeedback(
          {
            count: r.count,
            failures: r.failures.length,
            to: vars.to,
          },
          workflow,
          t,
        ),
      );
      setSelected([]);
      refreshOrderData();
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

  const updateMobileFilters = (patch: Partial<OrderListFilters>) => {
    if (!isOnline) return;
    setPendingListIntent(null);
    setFailedListIntent(null);
    setFilters((current) => ({ ...current, ...patch }));
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
      if (key === "search") return { ...current, search: undefined, searchScope: "current" };
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

  const handleStatusGroupChange = (nextGroup: string) => {
    const nextStatusGroup = nextGroup as "all" | OrderQueueGroup;
    const nextFilters = {
      ...filters,
      statuses: undefined,
      workflowStatuses: undefined,
      queueGroups: undefined,
      overdue: undefined,
    };
    const label =
      statusGroups.find((group) => group.key === nextStatusGroup)?.label ?? t("orders.targetQueue");
    beginListIntent({
      requested: {
        statusGroup: nextStatusGroup,
        statusCode: "all",
        filters: nextFilters,
        page: 1,
        pageSize,
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

  const openNewOrder = useCallback(() => {
    if (newOrderOpen) {
      toast.info(t("orders.newOrderAlreadyOpen"));
      return;
    }
    setNewOrderPrefill(undefined);
    setNewOrderSessionKey((current) => current + 1);
    setNewOrderOpen(true);
  }, [newOrderOpen, t]);

  useEffect(() => {
    window.addEventListener(REPAIRDESK_NEW_ORDER_EVENT, openNewOrder);
    return () => window.removeEventListener(REPAIRDESK_NEW_ORDER_EVENT, openNewOrder);
  }, [openNewOrder]);

  const requestPrintRows = (rows: OrderListItem[]) => {
    if (!rows.length) {
      toast.error(t("orders.noPrintableOrders"));
      return;
    }
    setPendingPrintOrders(rows);
    setPrintPaperDialogOpen(true);
  };
  const printRows = async (rows: OrderListItem[], paperMode: PrintPaperMode) => {
    rememberOrderPrintPaperMode(paperMode);
    setPrintPaperMode(paperMode);
    setPrintPaperDialogOpen(false);
    const outcome = await requestPrint(
      paperMode,
      rows.length === 1 ? `${rows[0].public_no}.pdf` : `repair-orders-${rows.length}.pdf`,
      async (context) => {
        setPrintOrders(rows);
        setCustomerStatusUrls({});
        const links = await issueCustomerStatusLinks(
          rows.map((order) => order.id),
          { signal: context.signal },
        );
        if (!context.isCurrent()) return;
        if (links.length !== rows.length) throw new Error(t("orders.qrPrepareFailed"));
        setCustomerStatusUrls(Object.fromEntries(links.map((link) => [link.order_id, link.url])));
      },
    );
    if (outcome === "busy") toast.info(t("orders.printBusy"));
  };
  const openDetail = (id: string) => {
    detailReturnFocusRef.current =
      listInvokerRef.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    scheduleOrderDetailPrefetch(id, "intent");
    setDetailOrderId(id);
  };
  const handleNewOrderCreated = (id: string) => {
    setNewOrderOpen(false);
    setNewOrderPrefill(undefined);
    invalidate();
    setDetailOrderId(id);
    router.replace(buildOrderDetailWorkspaceHref(id, { source: "orders" }));
  };

  const handleNewOrderOpenChange = (open: boolean) => {
    setNewOrderOpen(open);
    if (open) return;
    setNewOrderPrefill(undefined);
  };

  const handleDetailOpenChange = (open: boolean) => {
    if (open) return;
    if (detailCloseRequestRef.current) {
      detailCloseRequestRef.current("close");
      return;
    }
    setDetailOrderId(null);
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
  const rememberListContext = (anchorOrderId: string) => {
    persistListContext(anchorOrderId);
  };
  const archiveSearchAvailable = canRunExactArchiveOrderSearch(searchInput.committedValue);
  const archiveSearchActive = filters.searchScope === "archive_exact";
  const changeArchiveSearchScope = (active: boolean) => {
    if (!isOnline || !searchInput.committedValue.trim()) return;
    setFilters((current) => ({
      ...current,
      searchScope: active ? "archive_exact" : "current",
    }));
    setPage(1);
  };
  const orderListView = filters.view ?? "active";
  const changeOrderListView = (view: OrderListView) => {
    const label =
      view === "active"
        ? t("orders.viewActive")
        : view === "archive"
          ? t("orders.viewArchive")
          : t("orders.viewAll");
    beginListIntent({
      requested: {
        statusGroup: "all",
        statusCode: "all",
        filters: { ...filters, view, queueGroups: undefined },
        page: 1,
        pageSize,
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
      label: t("orders.pageLabel", { page: nextPage }),
    });
  };
  const changeOrderListPageSize = (nextPageSize: number) => {
    beginListIntent({
      requested: { ...currentSelection, page: 1, pageSize: nextPageSize },
      kind: "page",
      key: `size-${nextPageSize}`,
      label: t("orders.pageSizeLabel", { size: nextPageSize }),
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
      <OrdersErrorState message={t("orders.offlineNoCache")} onRetry={() => refreshOrderData()} />
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
  if (viewportMode === "pending") {
    return <OrderListViewportPending />;
  }

  return (
    <div
      className={cn(repairOs.mobileListFloatingPage, "md:pb-8")}
      data-order-list-refreshing={isFetching ? "true" : "false"}
      onClickCapture={rememberListInvoker}
      onKeyDownCapture={rememberListInvoker}
      aria-busy={listTransitionPending || isFetching}
      style={
        mobileHeaderHeight > 0
          ? ({
              "--orders-mobile-header-offset": `${mobileHeaderHeight + 8}px`,
            } as CSSProperties)
          : undefined
      }
    >
      <h1 className="sr-only">{t("orders.title")}</h1>
      {viewportMode === "compact" ? (
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
          onCreateOrder={openNewOrder}
          aiAction={
            aiAssistant.canOpenOrderAssistant ? (
              <Button
                type="button"
                variant="outline"
                size="iconDense"
                className="size-9 rounded-lg border-primary/30 bg-primary/10 text-primary"
                aria-label={t("shell.openAi")}
                data-ai-assistant-trigger="mobile-orders"
                onClick={aiAssistant.openAssistant}
              >
                <Sparkles className="size-4" aria-hidden="true" />
              </Button>
            ) : undefined
          }
          searchValue={searchInput.draftValue}
          searchBusy={searchBusy}
          interactionDisabled={!isOnline}
          onSearchChange={searchInput.setDraftValue}
          onSearchSubmit={() => searchInput.commitNow()}
          onSearchClear={searchInput.clearSearch}
          scanAction={
            <OrderQrScannerButton
              disabled={!isOnline}
              ariaLabel={t("orders.scanOrderQr")}
              className="size-9 rounded-lg bg-card"
              iconClassName="size-3.5"
            />
          }
          filterAction={
            <Button
              type="button"
              variant="outline"
              size="iconDense"
              className="relative size-9 rounded-lg bg-card"
              aria-label={t("orders.mobileFilterAria", { count: mobileHiddenFilterCount })}
              onClick={() => setMobileFiltersOpen(true)}
            >
              <Filter className="size-4" aria-hidden="true" />
              {mobileHiddenFilterCount ? (
                <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                  {mobileHiddenFilterCount}
                </span>
              ) : null}
            </Button>
          }
          rangeLabel={t(`orders.range.${orderListView}`)}
        />
      ) : null}

      {
        <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <DialogContent
            closeLabel={t("orders.closeFilters")}
            className="max-h-[min(82svh,680px)] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-2xl p-3 sm:p-4"
          >
            <DialogHeader>
              <DialogTitle>{t("orders.mobileFilterTitle")}</DialogTitle>
              <DialogDescription>{t("orders.mobileFilterDescription")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 sm:space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">{t("orders.displayRange")}</legend>
                <OrderListViewMode
                  value={orderListView}
                  canBrowseArchive={canBrowseOrderArchive}
                  disabled={!isOnline || listInteractionBlocked}
                  onChange={changeOrderListView}
                />
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">{t("orders.typeFilter")}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["quick_repair", t("orders.quickRepair")],
                      ["dropoff_repair", t("orders.dropoffRepair")],
                    ] as const
                  ).map(([value, label]) => {
                    const active = filters.types?.includes(value) ?? false;
                    return (
                      <Button
                        key={value}
                        type="button"
                        variant={active ? "default" : "outline"}
                        className="h-[38px] text-base"
                        aria-pressed={active}
                        onClick={() => updateMobileFilters({ types: active ? undefined : [value] })}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">{t("orders.paymentFilter")}</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      [undefined, t("orders.unlimited")],
                      ["unpaid", t("orders.paymentDue")],
                      ["paid", t("orders.paid")],
                    ] as const
                  ).map(([value, label]) => {
                    const active = (filters.paid ?? undefined) === value;
                    return (
                      <Button
                        key={value ?? "all"}
                        type="button"
                        variant={active ? "default" : "outline"}
                        className="h-[38px] px-2 text-base"
                        aria-pressed={active}
                        onClick={() => updateMobileFilters({ paid: value })}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">{t("orders.priorityNeeded")}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      [undefined, t("orders.unlimited")],
                      ["approval", t("orders.approvalOverdue")],
                      ["pickup", t("orders.pickupOverdue")],
                    ] as const
                  ).map(([value, label]) => {
                    const active = (filters.overdue ?? undefined) === value;
                    return (
                      <Button
                        key={value ?? "all"}
                        type="button"
                        variant={active ? "default" : "outline"}
                        className="h-[38px] px-2 text-base"
                        aria-pressed={active}
                        onClick={() => updateMobileFilters({ overdue: value })}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </fieldset>
              {options.technicians.length ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold">{t("dashboard.assignee")}</legend>
                  <div className="flex flex-wrap gap-2">
                    {options.technicians.map((technician) => {
                      const active = filters.technicians?.includes(technician) ?? false;
                      return (
                        <Button
                          key={technician}
                          type="button"
                          variant={active ? "default" : "outline"}
                          className="min-h-9"
                          aria-pressed={active}
                          onClick={() =>
                            updateMobileFilters({ technicians: active ? undefined : [technician] })
                          }
                        >
                          {technician}
                        </Button>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}
              <div className="grid grid-cols-2 gap-2 border-t border-[var(--border-panel)] pt-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={clearMobileHiddenFilters}
                >
                  {t("orders.clearAdvancedFilters")}
                </Button>
                <Button type="button" className="h-10" onClick={() => setMobileFiltersOpen(false)}>
                  {t("orders.viewResults")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      }

      <OrderListTransitionFeedback
        pendingLabel={activePendingListIntent?.label}
        offlineMessage={!isOnline ? t("orders.offlineCached") : undefined}
        errorMessage={
          failedListIntent
            ? t("orders.transitionFailedRollback", { label: failedListIntent.label })
            : undefined
        }
        backgroundRefreshing={backgroundRefreshing}
        onRetry={retryFailedListIntent}
      />

      {viewportMode === "compact" && isOnline && !listTransitionPending && !failedListIntent ? (
        <div>
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
            archiveSearchAvailable={archiveSearchAvailable}
            archiveSearchActive={archiveSearchActive}
            onArchiveSearchChange={changeArchiveSearchScope}
            onRetry={() => void refetchOrders()}
          />
        </div>
      ) : null}

      {viewportMode === "compact" && mobileHiddenFilterCount > 0 ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border/60 bg-surface/70 px-3 py-2 text-xs text-muted-foreground">
          <Filter className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            {t("orders.appliedAdvancedFilters", { count: mobileHiddenFilterCount })}
          </span>
          <Button
            type="button"
            disabled={!isOnline}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-primary"
            onClick={clearMobileHiddenFilters}
          >
            {t("orders.clearAllFilters")}
          </Button>
        </div>
      ) : null}

      {viewportMode === "compact" && (workflowIsError || optionsIsError) ? (
        <div className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-status-warn-foreground/25 bg-status-warn/10 px-3 py-2 text-xs text-status-warn-foreground">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {workflowIsError ? workflowErrorMessage : optionsErrorMessage}
          </span>
        </div>
      ) : null}

      {/* Desktop stage and search toolbar */}
      {viewportMode === "desktop" ? (
        <div
          data-order-desktop-unified-toolbar="true"
          className={cn(repairOs.mobileInfoCard, "mb-3 mt-3 min-w-0 space-y-2 p-2.5")}
        >
          {statusGroupItems.length > 0 ? (
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
          ) : null}

          <div className={cn(layoutGuards.wrapRow, "min-w-0 items-stretch justify-end")}>
            <span className="self-center text-sm font-medium" data-order-current-range="true">
              {t(`orders.range.${orderListView}`)}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMobileFiltersOpen(true)}
              aria-label={t("orders.mobileFilterTitle")}
            >
              <Filter className="size-4" />
              {t("orders.mobileFilterTitle")}
            </Button>
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
                placeholder={t("orders.searchLabel")}
                aria-label={t("orders.searchLabel")}
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
                    aria-label={t("orders.clearSearch")}
                    title={t("orders.clearSearch")}
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
            <OrderQrScannerButton
              disabled={!isOnline}
              size="sm"
              showLabel
              ariaLabel={t("orders.scanOrderQr")}
              label={t("orders.scanOrderQrShort")}
              className="h-9 gap-1.5 border-border/60 bg-surface/60 backdrop-blur"
              iconClassName="size-3.5"
            />
            <Button
              type="button"
              data-order-list-new-button="true"
              size="sm"
              className={cn("hidden h-9 gap-1.5 lg:inline-flex", controls.brandButton)}
              style={brandGradientStyle}
              onClick={openNewOrder}
            >
              <Plus className="size-3.5" /> {t("orders.new")}
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
              archiveSearchAvailable={archiveSearchAvailable}
              archiveSearchActive={archiveSearchActive}
              onArchiveSearchChange={changeArchiveSearchScope}
              onRetry={() => void refetchOrders()}
            />
          ) : null}
          {(workflowIsError || optionsIsError) && (
            <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-status-warn-foreground/25 bg-status-warn/10 px-2.5 py-2 text-xs text-status-warn-foreground">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1">
                {workflowIsError
                  ? t("orders.workflowFallback", { message: workflowErrorMessage })
                  : t("orders.optionsFallback", { message: optionsErrorMessage })}
              </span>
            </div>
          )}
          {activeFilterChips.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{t("orders.currentFilters")}</span>
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  disabled={!isOnline}
                  onClick={() => removeFilterChip(chip.key)}
                  className="inline-flex h-7 max-w-full items-center gap-1 rounded-md border border-border/60 bg-surface/70 px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title={t("orders.removeFilter")}
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
                {t("orders.clearAllFilters")}
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {isOnline && listIsError && listResult && !searchInput.committedValue && !failedListIntent ? (
        <div
          role="status"
          className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-status-warn-foreground/25 bg-status-warn/10 px-3 py-2 text-xs text-status-warn-foreground"
        >
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{t("orders.refreshFailedCached")}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={() => refreshOrderData()}
          >
            {t("orders.retry")}
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
            {viewportMode === "desktop" ? (
              <div
                data-order-desktop-list="true"
                className="min-w-0 max-w-full overflow-x-hidden overflow-y-hidden pb-1"
              >
                {canUseBulkActions ? (
                  <div className="mb-2 flex min-w-0 justify-end gap-2 px-1">
                    <span className="text-xs text-muted-foreground">
                      {t("orders.selectedCount", { count: selected.length })}
                    </span>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <div
                    className={cn(
                      orderQueueDesktopGrid,
                      "rounded-lg border border-border/40 bg-surface/45 px-1 text-[11px] font-medium text-muted-foreground lg:text-xs lg:leading-4",
                    )}
                  >
                    <label className="flex min-w-0 items-center justify-center py-1.5">
                      {canUseBulkActions ? (
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(v) => setSelected(v ? data.map((o) => o.id) : [])}
                          aria-label={t("orders.selectPage")}
                        />
                      ) : null}
                    </label>
                    <div className="min-w-0 px-2 py-1.5">{t("orders.headerStage")}</div>
                    <div className="min-w-0 px-2 py-1.5">{t("orders.headerCustomer")}</div>
                    <div className="min-w-0 px-2 py-1.5">{t("orders.headerDevice")}</div>
                    <div className="px-2 py-1.5 text-right">{t("orders.headerAmountRisk")}</div>
                    <div className="px-2 py-1.5">{t("orders.headerAssigneeTime")}</div>
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
                          aria-label={t("orders.groupAria", {
                            label: localizeOrderResultGroup(section.group, t).label,
                          })}
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
                                  onPrint={() => requestPrintRows([order])}
                                  canPrint={canPrintSingleOrders}
                                  printDisabledReason={singlePrintDisabledReason}
                                  onOpenPrintRecovery={() => openDetail(order.id)}
                                  onStopInteraction={stopRowClick}
                                  suppliers={visibleSuppliers}
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
            ) : null}

            {/* Mobile and tablet cards */}
            {viewportMode === "compact" ? (
              <div data-order-mobile-list="true" className="space-y-4">
                {groupedData.map((section) => (
                  <section
                    key={section.group}
                    className="space-y-2"
                    aria-labelledby={`mobile-order-group-${section.group}`}
                  >
                    <OrderResultGroupHeader
                      headingId={`mobile-order-group-${section.group}`}
                      group={section.group}
                      pageCount={section.items.length}
                      totalCount={resultGroupCounts[section.group]}
                      oldestCreatedAt={section.items[0].created_at}
                    />
                    <div className="grid gap-2 md:grid-cols-2" role="list">
                      {section.items.map((order) => (
                        <div key={order.id} role="listitem" data-order-id={order.id}>
                          <OrderMobileCard
                            order={order}
                            detailHref={`/orders/${order.id}?from=orders`}
                            onPrefetch={() => scheduleOrderDetailPrefetch(order.id, "intent")}
                            onCancelPrefetch={() => cancelOrderDetailPrefetch(order.id)}
                            suppliers={visibleSuppliers}
                            onOpenIntent={() => rememberListContext(order.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
            <PaginationBar
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              pageSizeOptions={[20, 50]}
              total={totalOrders}
              visible={data.length}
              onPageChange={changeOrderListPage}
              onPageSizeChange={changeOrderListPageSize}
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
                {t("orders.bulkSelected", { count: selected.length })}
              </span>
              <Separator orientation="vertical" className="h-5" />
              {canBatchTransitionOrders ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" disabled={!bulkTargets.length}>
                      {t("orders.bulkTransition")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>
                      {bulkTargets.length
                        ? t("orders.bulkAvailable")
                        : hasReasonRequiredBulkTargets
                          ? t("orders.bulkReasonRequired")
                          : t("orders.bulkInconsistent")}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {bulkTargets.map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => bulk.mutate({ ids: selected, to: s })}
                      >
                        {localizeWorkflowStatusLabel(workflow, s, t)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {canBatchPrintOrders ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={Boolean(singlePrintDisabledReason)}
                    title={singlePrintDisabledReason}
                    onClick={() =>
                      requestPrintRows(data.filter((order) => selected.includes(order.id)))
                    }
                  >
                    <Printer className="size-3.5" /> {t("orders.print")}
                  </Button>
                  {singlePrintDisabledReason && selected[0] ? (
                    <Button size="sm" variant="ghost" onClick={() => openDetail(selected[0])}>
                      {t("orders.printSettings")}
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <OrderListPrintSheet
        orders={printOrders}
        storeSettings={storeSettings}
        activeStore={shell.activeStore}
        customerStatusUrls={customerStatusUrls}
        paperMode={printPaperMode}
      />
      <OrderPrintPaperDialog
        open={printPaperDialogOpen}
        onOpenChange={setPrintPaperDialogOpen}
        onSelect={(mode) => void printRows(pendingPrintOrders, mode)}
      />
      <FixedPdfReadyDialog
        prepared={preparedPdf}
        pending={deliveryPending}
        errorMessage={deliveryError}
        onClose={dismissPreparedPdf}
        onShare={() => void sharePreparedPdf()}
        onOpenPdf={openPreparedPdf}
        onDownload={downloadPreparedPdf}
      />
      <NewOrderDialog
        open={newOrderOpen}
        sessionKey={newOrderSessionKey}
        prefill={newOrderPrefill}
        onOpenChange={handleNewOrderOpenChange}
        onCreated={handleNewOrderCreated}
      />
      <Dialog open={Boolean(detailOrderId)} onOpenChange={handleDetailOpenChange}>
        <DialogContent
          data-order-detail-dialog-shell="true"
          onCloseAutoFocus={(event) => {
            const opener = detailReturnFocusRef.current;
            if (!opener?.isConnected || opener.getClientRects().length === 0) return;
            event.preventDefault();
            opener.focus({ preventScroll: true });
          }}
          showCloseButton={false}
          className={
            detailFaultEditorActive
              ? cn(componentOverlay.modalLg, "max-h-[calc(100svh-24px)] overflow-hidden p-0 sm:p-0")
              : componentOverlay.orderDetailWorkspace
          }
          onEscapeKeyDown={(event) => {
            if (!detailCloseRequestRef.current) return;
            event.preventDefault();
            detailCloseRequestRef.current("escape");
          }}
          onInteractOutside={(event) => {
            if (!detailCloseRequestRef.current) return;
            event.preventDefault();
            detailCloseRequestRef.current("outside");
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              {t(detailFaultEditorActive ? "orders.faultEditor.title" : "orders.detailDialogTitle")}
            </DialogTitle>
            <DialogDescription>{t("orders.detailDialogDescription")}</DialogDescription>
          </DialogHeader>
          {detailOrderId && (
            <Suspense
              fallback={
                <OrderDetailSkeleton
                  surface="dialog"
                  onClose={() => handleDetailOpenChange(false)}
                />
              }
            >
              <LazyOrderDetailScreen
                id={detailOrderId}
                surface="dialog"
                faultCloseRequestRef={detailCloseRequestRef}
                onFaultEditorActiveChange={setDetailFaultEditorActive}
                onClose={() => handleDetailOpenChange(false)}
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderListViewportPending() {
  const { t } = useLocale();
  return (
    <div
      data-ui="order-list-viewport-pending"
      className="mx-auto w-full min-w-0 max-w-7xl space-y-2 overflow-hidden px-2 py-3 sm:px-4 sm:py-5 md:px-6 lg:px-8"
      aria-busy="true"
    >
      <span className="sr-only" role="status" aria-live="polite">
        {t("orders.viewportPreparing")}
      </span>
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}
