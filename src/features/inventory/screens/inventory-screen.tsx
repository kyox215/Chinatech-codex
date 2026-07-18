"use client";

import type * as React from "react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BatteryCharging,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  CircleDashed,
  DatabaseZap,
  Edit3,
  Eraser,
  FileText,
  FileUp,
  HardDrive,
  Hash,
  Inbox,
  Layers3,
  LockKeyhole,
  MoreHorizontal,
  Palette,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tag,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { MoneyText, PhoneText } from "@/components/orders/badges";
import { StoreOutputIdentityRecovery } from "@/components/store/store-output-identity-recovery";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import { inventorySummaryQueryOptions } from "@/features/inventory/api/query-options";
import { InventoryIntakeDialog } from "@/features/inventory/components/inventory-intake-dialog";
import { useAiAssistantWorkspace } from "@/features/ai-assistant";
import { storeSettingsQueryOptions } from "@/features/messages/api/query-options";
import { useRealtimeSync } from "@/features/realtime";
import {
  ScanSearchButton,
  consumeScanSearchIntent,
  subscribeScanSearchIntent,
} from "@/features/capture";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import {
  resolveStoreOutputIdentity,
  type StoreOutputIdentity,
} from "@/entities/store/model/store-output-identity";
import {
  RepairOsBusinessCard,
  RepairOsChipRow,
  RepairOsHeaderActionButton,
  RepairOsInfoTile,
  RepairOsListScaffold,
  RepairOsSectionHeader,
} from "@/shared/ui";
import {
  buildInventoryListViews,
  filterInventoryItemsByView,
  getInventoryPrimaryAction,
  getInventoryNextStatuses,
  getInventoryListViewLabel,
  type InventoryPrimaryActionKind,
  type InventoryListViewKey,
  inventoryStatusMeta,
} from "@/features/inventory/model/inventory-workflow";
import {
  buildInventoryBuybackSummary,
  type InventoryBuybackSummary,
} from "@/features/inventory/model/inventory-buyback-summary";
import { resolveInventoryIntakeRoute } from "@/features/inventory/model/inventory-intake-route";
import {
  buildInventorySaleReceiptData,
  getInventoryWarrantyState,
  INVENTORY_SALE_RECEIPT_TERMS,
  type InventorySaleReceiptData,
} from "@/features/inventory/model/inventory-sale-receipt";
import { formatEuro, formatItalianDateTime } from "@/features/orders/model/order-italian";
import { PrintPortal } from "@/features/orders/components/print-portal";
import {
  accessInventoryAttachment,
  applyElectronicsCsvImport,
  completeInventorySaleV2,
  getInventoryItem,
  importElectronicsCsvPreview,
  recordInventoryCheck,
  sellInventoryItem,
  searchCustomers,
  transitionInventoryItem,
  updateInventoryItem,
  type InventoryDetail,
  type InventoryItemStatus,
  type InventoryListItem,
  type InventoryQualityCheckInput,
  type SellInventoryItemInput,
  type UpdateInventoryItemInput,
} from "@/lib/repairdesk/api";
import type { CompleteInventorySaleV2Input, Customer } from "@/lib/repairdesk/types";
import { componentOverlay } from "@/lib/component-patterns";
import { fadeUp } from "@/lib/motion";
import { CACHE_TIMES } from "@/lib/query-performance";
import {
  brandGradientStyle,
  controls,
  dataDisplay,
  density,
  formLayout,
  repairOs,
  surfaces,
} from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const checkOptions = ["unchecked", "pass", "fail", "unknown"] as const;
const cosmeticOptions = ["unknown", "new", "mint", "good", "fair", "poor", "for_parts"] as const;
const functionalOptions = ["untested", "passed", "needs_repair", "failed", "for_parts"] as const;
const compactInventoryInputClass = "h-8 text-sm sm:h-9";
const compactInventoryTextareaClass = "min-h-20 text-sm";
const compactInventorySelectClass =
  "h-8 rounded-md border border-[var(--border-panel)] bg-background px-2 text-sm text-foreground sm:h-9";
const compactInventoryGrid = "grid gap-2.5 sm:grid-cols-2";
const inventoryDialogContentClass = "gap-0 !flex flex-col !overflow-hidden !p-0";
const inventoryDialogHeaderClass = "shrink-0 px-3 pt-3 sm:px-4 sm:pt-4";
const inventoryDialogBodyClass = "min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4";
const inventoryDialogFooterClass = cn(
  componentOverlay.footer,
  "shrink-0 border-t border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] px-3 py-3 sm:px-4",
);
type InventoryItemActionMode = Exclude<InventoryPrimaryActionKind, "view"> | "receipt";
type InventoryActionMode = InventoryItemActionMode | "import";
type ElectronicsImportPreviewResult = Awaited<ReturnType<typeof importElectronicsCsvPreview>>;
const inventoryDetailActions = [
  { mode: "update", label: "编辑价格/成本" },
  { mode: "transition", label: "推进状态" },
  { mode: "check", label: "登记检测" },
  { mode: "sell", label: "售出" },
  { mode: "receipt", label: "打印保修票据" },
] as const satisfies ReadonlyArray<{
  mode: InventoryItemActionMode;
  label: string;
}>;
const EMPTY_INVENTORY_ITEMS: InventoryListItem[] = [];

export function InventoryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext();
  const aiAssistant = useAiAssistantWorkspace();
  const activeStoreId = shell.activeStore?.id;
  const intakeAuthorityReady = Boolean(activeStoreId) && !shell.isLoading && !shell.isRefreshing;
  const storeSettingsQuery = useQuery({
    ...storeSettingsQueryOptions(activeStoreId),
    enabled: Boolean(activeStoreId),
  });
  const storeOutputIdentity = resolveStoreOutputIdentity({
    activeStore: shell.activeStore,
    settings: storeSettingsQuery.data,
    settingsState: storeSettingsQuery.isLoading
      ? "loading"
      : storeSettingsQuery.isError
        ? "error"
        : "ready",
  });
  const { coordinator } = useRealtimeSync();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [view, setView] = useState<InventoryListViewKey>("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [actionItem, setActionItem] = useState<InventoryListItem>();
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [action, setAction] = useState<InventoryActionMode | null>(null);
  const itemFocusFallbackRef = useRef<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const inventoryV2Available =
    shell.permissions?.inventoryV2UiEnabled === true &&
    shell.permissions?.inventoryV2CommandsEnabled === true;
  const requestedIntakeRoute = resolveInventoryIntakeRoute({
    requested: searchParams.get("new") === "1",
    authorityReady: intakeAuthorityReady,
    inventoryV2Available,
  });

  useEffect(() => {
    setHydrated(true);
  }, []);

  const filters = useMemo(
    () => ({
      search: deferredSearch.trim() || undefined,
    }),
    [deferredSearch],
  );

  const {
    data: inventorySummary,
    error: itemsError,
    isError: isItemsError,
    isFetching: isItemsFetching,
    isLoading,
    refetch: refetchItems,
  } = useQuery({
    ...inventorySummaryQueryOptions(filters, activeStoreId),
    enabled: Boolean(activeStoreId),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const displayInventorySummary = hydrated ? inventorySummary : undefined;
  const items = displayInventorySummary?.list.items ?? EMPTY_INVENTORY_ITEMS;
  const stats = displayInventorySummary?.stats;
  const statsLoading = !hydrated || (isLoading && !inventorySummary);
  const displayItemsError = hydrated && isItemsError;
  const displayItemsLoading = hydrated && isLoading;
  const displayItemsFetching = hydrated && isItemsFetching;
  const visibleItems = useMemo(() => filterInventoryItemsByView(items, view), [items, view]);
  const listViews = useMemo(() => buildInventoryListViews(items), [items]);
  const selectedItem = items.find((item) => item.id === selectedId);
  const activeViewLabel = getInventoryListViewLabel(view);
  const hasSearch = Boolean(search.trim());
  const itemsErrorMessage = getErrorMessage(itemsError, "库存列表加载失败");
  const refreshInventoryData = () => {
    if (coordinator) {
      void coordinator.refreshGroups(["inventory.all"]);
      return;
    }
    void refetchItems();
  };

  useEffect(() => {
    if (requestedIntakeRoute === "v2") router.replace("/inventory/new");
    else if (requestedIntakeRoute === "legacy") setIntakeOpen(true);
  }, [requestedIntakeRoute, router]);

  useEffect(() => {
    const query = searchParams.get("q");
    if (query) setSearch(query);
  }, [searchParams]);

  useEffect(() => {
    const applyIntent = (value: string) => {
      if (value) setSearch((current) => (current === value ? current : value));
    };

    applyIntent(consumeScanSearchIntent("inventory"));
    return subscribeScanSearchIntent("inventory", applyIntent);
  }, []);

  useEffect(() => {
    const focusedItemId = searchParams.get("item");
    if (!focusedItemId) {
      itemFocusFallbackRef.current = null;
      return;
    }

    if (items.some((item) => item.id === focusedItemId)) {
      setSelectedId(focusedItemId);
      itemFocusFallbackRef.current = null;
      return;
    }

    if (
      isLoading ||
      isItemsFetching ||
      isItemsError ||
      itemFocusFallbackRef.current === focusedItemId
    )
      return;
    itemFocusFallbackRef.current = focusedItemId;
    setSearch((current) => (current.trim() === focusedItemId ? current : focusedItemId));
    toast.info("未找到该库存记录，已按编号搜索");
  }, [isItemsError, isItemsFetching, isLoading, items, searchParams]);

  function invalidate(id?: string) {
    queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    if (id) queryClient.invalidateQueries({ queryKey: inventoryKeys.detail(id) });
  }

  function openActionForItem(item: InventoryListItem, mode: InventoryItemActionMode) {
    setActionItem(item);
    setAction(mode);
  }

  function openPrimaryActionForItem(item: InventoryListItem) {
    const primaryAction = getInventoryPrimaryAction(item);
    if (!isInventoryDialogActionKind(primaryAction.actionKind)) {
      setSelectedId(item.id);
      return;
    }
    openActionForItem(item, primaryAction.actionKind);
  }

  function openInventoryIntake() {
    if (!intakeAuthorityReady) return;
    if (inventoryV2Available) {
      router.push("/inventory/new");
      return;
    }
    setIntakeOpen(true);
  }

  return (
    <RepairOsListScaffold
      title="库存商品"
      subtitle={`${activeViewLabel} · 共 ${
        view === "all" && !hasSearch ? (stats?.total ?? visibleItems.length) : visibleItems.length
      } 件`}
      eyebrow="工作台 / 库存"
      action={
        <RepairOsHeaderActionButton
          ariaLabel="新增商品"
          disabled={!intakeAuthorityReady}
          onClick={openInventoryIntake}
        >
          <Plus className="size-4" />
        </RepairOsHeaderActionButton>
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="搜索编号、客户、型号、IMEI"
      searchAction={
        <ScanSearchButton
          scope="inventory"
          onSearch={setSearch}
          className="size-10 rounded-xl bg-card"
          iconClassName="size-4"
        />
      }
      filterAction={
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 rounded-xl bg-card"
          aria-label="导入库存"
          onClick={() => setAction("import")}
        >
          <FileUp className="size-4" />
        </Button>
      }
      chips={listViews.map((item) => ({
        key: item.key,
        label: item.label,
        shortLabel: item.shortLabel,
        count: item.count,
        active: view === item.key,
        onClick: () => setView(item.key),
      }))}
      desktopAction={
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-9 gap-2" onClick={() => setAction("import")}>
            <FileUp className="size-4" /> 导入电子产品
          </Button>
          <Button
            className={cn("h-9 gap-2", controls.brandButton)}
            style={brandGradientStyle}
            disabled={!intakeAuthorityReady}
            onClick={openInventoryIntake}
          >
            <Plus className="size-4" /> 新增商品
          </Button>
        </div>
      }
      desktopHeaderAddon={
        <motion.div
          data-ui="inventory-kpi-strip"
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className={dataDisplay.kpiGrid}
        >
          <InventoryKpi
            icon={Layers3}
            label="库存总数"
            value={statsLoading ? "-" : (stats?.total ?? 0)}
          />
          <InventoryKpi icon={ClipboardCheck} label="检测/整备中" value={stats?.inPipeline ?? 0} />
          <InventoryKpi icon={ShoppingBag} label="待售/售卖中" value={stats?.readyOrListed ?? 0} />
          {stats?.finance_redacted ? (
            <InventoryKpi icon={TrendingUp} label="已售数量" value={stats.sold} />
          ) : (
            <InventoryKpi
              icon={TrendingUp}
              label="已实现利润"
              value={<MoneyText amount={stats?.realizedProfit ?? 0} />}
            />
          )}
        </motion.div>
      }
    >
      <section
        className={cn(
          repairOs.toolbar,
          "mb-3 hidden flex-col items-stretch gap-2 sm:mb-4 sm:gap-3 sm:p-3 md:flex",
        )}
      >
        <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索编号、客户、型号、IMEI、备注"
              className="h-8 border-0 bg-transparent pl-8 text-sm shadow-none focus-visible:ring-0 sm:h-9 sm:border-border/60 sm:bg-surface/60 sm:shadow-sm"
            />
          </div>
          <ScanSearchButton
            scope="inventory"
            onSearch={setSearch}
            size="sm"
            showLabel
            className="h-8 shrink-0 gap-1.5 sm:h-9"
            iconClassName="size-3.5"
          />
        </div>
        <RepairOsChipRow
          chips={listViews.map((item) => ({
            label: item.label,
            active: view === item.key,
            onClick: () => setView(item.key),
          }))}
        />
      </section>

      {displayItemsError && items.length > 0 ? (
        <InventoryInlineError
          message={`库存列表刷新失败：${itemsErrorMessage}`}
          isRetrying={displayItemsFetching}
          onRetry={refreshInventoryData}
        />
      ) : null}

      {displayItemsError && items.length === 0 ? (
        <InventoryLoadError
          message={itemsErrorMessage}
          isRetrying={displayItemsFetching}
          onRetry={refreshInventoryData}
        />
      ) : displayItemsLoading ? (
        <div className={dataDisplay.mobileCardList}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className={surfaces.empty}>
          <DatabaseZap className="mb-3 size-9 text-muted-foreground" />
          <h3 className="font-display text-lg font-semibold">
            {items.length === 0 ? "暂无库存商品" : "当前视图暂无商品"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length === 0
              ? "新增一台设备或商品，开始检测、整备和售卖跟踪。"
              : "可以切换到其他库存视图，或调整搜索关键词。"}
          </p>
        </div>
      ) : (
        <>
          <div className="glass-card hidden min-w-0 max-w-full overflow-x-auto lg:block">
            <Table className={cn(density.tableDense, "min-w-[920px] table-fixed xl:min-w-0")}>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">编号 / 状态</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead className="hidden w-[140px] xl:table-cell">客户</TableHead>
                  <TableHead className="w-[138px] text-right">成本</TableHead>
                  <TableHead className="w-[112px] text-right">挂牌/成交</TableHead>
                  <TableHead className="w-[104px] text-right">利润</TableHead>
                  <TableHead className="w-[170px]">检测</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.map((item) => (
                  <InventoryTableRow
                    key={item.id}
                    item={item}
                    onSelect={() => setSelectedId(item.id)}
                    onPrimaryAction={() => openPrimaryActionForItem(item)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 lg:hidden">
            {visibleItems.map((item) => (
              <InventoryMobileCard
                key={item.id}
                item={item}
                onSelect={() => setSelectedId(item.id)}
                onPrimaryAction={() => openPrimaryActionForItem(item)}
              />
            ))}
          </div>
        </>
      )}

      <InventoryIntakeDialog
        open={intakeOpen}
        defaultWarrantyMonths={storeSettingsQuery.data?.default_inventory_warranty_months}
        canUseVisionIntake={aiAssistant.capabilities?.canUseVisionIntake === true}
        canApplyInventoryDraft={aiAssistant.capabilities?.canApplyInventoryDraft === true}
        authorityKey={shell.authorityFingerprint}
        onOpenChange={setIntakeOpen}
        onDone={(id) => {
          invalidate(id);
          setSelectedId(id);
        }}
      />
      <InventoryDetailDialog
        id={selectedId}
        activeStoreId={activeStoreId}
        onOpenChange={(open) => !open && setSelectedId(undefined)}
        onAction={openActionForItem}
      />
      <InventoryActionDialog
        action={action}
        item={actionItem ?? selectedItem}
        activeStoreId={activeStoreId}
        storeOutputIdentity={storeOutputIdentity}
        canReadStoreSettings={shell.permissions?.canReadStoreSettings === true}
        canUpdateStoreSettings={shell.permissions?.canUpdateStoreSettings === true}
        useAtomicSale={inventoryV2Available && shell.permissions?.canSellInventory === true}
        onRetryStoreSettings={storeSettingsQuery.refetch}
        onReloadStoreContext={shell.retry}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
            setActionItem(undefined);
          }
        }}
        onDone={(id) => invalidate(id)}
      />
    </RepairOsListScaffold>
  );
}

function InventoryTableRow({
  item,
  onSelect,
  onPrimaryAction,
}: {
  item: InventoryListItem;
  onSelect: () => void;
  onPrimaryAction: () => void;
}) {
  const primaryAction = getInventoryPrimaryAction(item);
  const buybackSummary = buildInventoryBuybackSummary(item);
  const costBasis = item.finance_redacted
    ? 0
    : (buybackSummary?.costBasis ??
      item.buyback_price + item.repair_cost_amount + item.fees_amount);
  const repairCost = item.finance_redacted
    ? 0
    : (buybackSummary?.repairCost ?? item.repair_cost_amount);

  return (
    <TableRow
      role="button"
      tabIndex={0}
      className="h-12 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect();
      }}
    >
      <TableCell>
        <div className="truncate font-mono font-semibold text-primary">{item.public_no}</div>
        <InventoryStatusBadge status={item.status} className="mt-1" />
      </TableCell>
      <TableCell className="min-w-0">
        <div className="truncate font-medium">{item.item_label}</div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">
          {[item.color, item.storage_capacity, item.serial_or_imei].filter(Boolean).join(" · ") ||
            "-"}
        </div>
        <div className="truncate text-[11px] text-muted-foreground xl:hidden">
          客户：{item.customer_name || "-"}
          {item.customer_phone ? ` · ${item.customer_phone}` : ""}
        </div>
        {buybackSummary?.repairIssueSummary ? (
          <div className="truncate text-[11px] text-status-warn-foreground">
            需修：{buybackSummary.repairIssueSummary}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="hidden min-w-0 xl:table-cell">
        <div className="truncate font-medium">{item.customer_name || "-"}</div>
        {item.customer_phone ? <PhoneText value={item.customer_phone} /> : null}
      </TableCell>
      <TableCell className="text-right">
        {item.finance_redacted ? (
          <span className="text-xs text-muted-foreground">成本受限</span>
        ) : (
          <>
            <div className="font-mono font-medium">
              <MoneyText amount={item.buyback_price} />
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              维修 <MoneyText amount={repairCost} /> · 成本 <MoneyText amount={costBasis} />
            </div>
          </>
        )}
      </TableCell>
      <TableCell className="text-right">
        <MoneyText amount={item.sale_price || item.list_price} />
      </TableCell>
      <TableCell className="text-right">
        {item.finance_redacted ? (
          <span className="text-xs text-muted-foreground">受限</span>
        ) : (
          <MoneyText
            amount={item.profit}
            className={
              item.profit >= 0 ? "text-status-success-foreground" : "text-status-danger-foreground"
            }
          />
        )}
      </TableCell>
      <TableCell className="min-w-0">
        <div className="truncate">
          外观 {gradeLabel(item.cosmetic_grade)} · 功能 {gradeLabel(item.functional_grade)}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          电池 {item.battery_health ?? "-"}% · 清除 {checkLabel(item.data_wipe_status)}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center justify-between gap-1.5">
          <span
            className={cn(
              "min-w-0 truncate text-[11px] font-medium",
              inventoryActionTextClass(primaryAction.tone),
            )}
          >
            {primaryAction.label}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 shrink-0 rounded-md px-1.5 text-[10px]",
              inventoryActionBadgeClass(primaryAction.tone),
            )}
            onClick={(event) => {
              event.stopPropagation();
              onPrimaryAction();
            }}
          >
            {primaryAction.actionLabel}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function InventoryMobileCard({
  item,
  onSelect,
  onPrimaryAction,
}: {
  item: InventoryListItem;
  onSelect: () => void;
  onPrimaryAction: () => void;
}) {
  const primaryAction = getInventoryPrimaryAction(item);
  const buybackSummary = buildInventoryBuybackSummary(item);
  const costBasis = item.finance_redacted
    ? 0
    : (buybackSummary?.costBasis ??
      item.buyback_price + item.repair_cost_amount + item.fees_amount);

  return (
    <RepairOsBusinessCard
      className={cn(
        repairOs.businessCardDense,
        "w-full select-none text-left transition active:scale-[0.99] active:bg-accent/15",
      )}
      trailing={
        <div className="flex min-w-[4.75rem] flex-col items-end text-right text-xs">
          <MoneyText
            amount={
              item.sale_price || item.list_price || (item.finance_redacted ? 0 : item.buyback_price)
            }
            className={repairOs.cardAmount}
          />
          <div className="mt-1 text-[11px] text-muted-foreground">
            电池 {item.battery_health ?? "-"}%
          </div>
          {item.finance_redacted ? (
            <div className="mt-1 text-[11px] text-muted-foreground">成本与利润受限</div>
          ) : (
            <>
              <div className="mt-1 text-[11px] text-muted-foreground">
                成本 <MoneyText amount={costBasis} />
              </div>
              <div
                className={cn(
                  "mt-1 text-[11px]",
                  item.profit >= 0
                    ? "text-status-success-foreground"
                    : "text-status-danger-foreground",
                )}
              >
                利润 <MoneyText amount={item.profit} />
              </div>
            </>
          )}
          <button
            type="button"
            className={cn(
              "mt-1 max-w-20 touch-manipulation truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium active:scale-[0.98]",
              inventoryActionBadgeClass(primaryAction.tone),
            )}
            onClick={onPrimaryAction}
          >
            {primaryAction.actionLabel}
          </button>
        </div>
      }
    >
      <button
        type="button"
        className="block w-full min-w-0 touch-manipulation text-left"
        onClick={onSelect}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-primary">{item.public_no}</span>
          <InventoryStatusBadge status={item.status} className="text-[10px]" />
        </div>
        <div className={cn(repairOs.cardTitle, "mt-1")}>{item.item_label}</div>
        <div className={repairOs.cardMeta}>
          {item.customer_name || "-"} · {item.serial_or_imei || "无 IMEI"}
        </div>
        <div className={repairOs.cardMeta}>
          外观 {gradeLabel(item.cosmetic_grade)} · 功能 {gradeLabel(item.functional_grade)}
        </div>
        {buybackSummary?.repairIssueSummary ? (
          <div className="mt-0.5 line-clamp-1 text-[10px] leading-4 text-status-warn-foreground">
            需修：{buybackSummary.repairIssueSummary}
          </div>
        ) : null}
        <div
          className={cn(
            "mt-1 flex min-w-0 items-center gap-1 text-[11px] font-medium",
            inventoryActionTextClass(primaryAction.tone),
          )}
        >
          <ArrowRight className="size-3 shrink-0" />
          <span className="truncate">{primaryAction.label}</span>
        </div>
      </button>
    </RepairOsBusinessCard>
  );
}

function InventoryDetailDialog({
  id,
  activeStoreId,
  onOpenChange,
  onAction,
}: {
  id?: string;
  activeStoreId?: string;
  onOpenChange: (open: boolean) => void;
  onAction: (item: InventoryListItem, action: InventoryItemActionMode) => void;
}) {
  const { data, error, isError, isFetching, isLoading, refetch } = useQuery({
    queryKey: id
      ? inventoryKeys.detail(id, activeStoreId)
      : inventoryKeys.detail("", activeStoreId),
    queryFn: ({ signal }) => getInventoryItem(id || "", { signal }),
    enabled: Boolean(id),
    retry: 1,
    staleTime: CACHE_TIMES.detail,
    refetchOnWindowFocus: false,
  });
  const detailErrorMessage = getErrorMessage(error, "库存详情加载失败");

  return (
    <Dialog open={Boolean(id)} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          componentOverlay.modalWide,
          inventoryDialogContentClass,
          "h-[min(860px,calc(100svh-32px))] max-h-[calc(100svh-32px)] lg:w-[min(1180px,calc(100vw-32px))]",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-[var(--border-panel)] px-3 py-2 text-left sm:px-4">
          <DialogTitle className="truncate text-base font-semibold leading-5">
            {data?.item.public_no ?? "库存详情"}
          </DialogTitle>
          <DialogDescription className="truncate text-xs text-muted-foreground">
            {data?.item.item_label ?? "读取商品检测、财务和时间线"}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : isError && !data ? (
            <InventoryLoadError
              compact
              title="库存详情加载失败"
              message={detailErrorMessage}
              isRetrying={isFetching}
              onRetry={() => {
                void refetch();
              }}
            />
          ) : !data ? (
            <InventoryLoadError
              compact
              title="库存详情为空"
              message="没有读取到该库存记录，请返回列表后重新打开。"
              isRetrying={isFetching}
              onRetry={() => {
                void refetch();
              }}
            />
          ) : (
            <>
              {isError ? (
                <InventoryInlineError
                  message={`库存详情刷新失败：${detailErrorMessage}`}
                  isRetrying={isFetching}
                  onRetry={() => {
                    void refetch();
                  }}
                />
              ) : null}
              <InventoryDetailBody data={data} onAction={onAction} />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InventoryDetailBody({
  data,
  onAction,
}: {
  data: InventoryDetail;
  onAction: (item: InventoryListItem, action: InventoryItemActionMode) => void;
}) {
  const item = data.item;
  const primaryAction = getInventoryPrimaryAction(item);
  const primaryDialogAction = isInventoryDialogActionKind(primaryAction.actionKind)
    ? primaryAction.actionKind
    : undefined;
  const secondaryActions = inventoryDetailActions.filter(
    (action) =>
      action.mode !== primaryDialogAction && (action.mode !== "receipt" || item.status === "sold"),
  );
  const buybackSummary = buildInventoryBuybackSummary(item);
  const costBasis = item.finance_redacted
    ? 0
    : (buybackSummary?.costBasis ??
      item.buyback_price + item.repair_cost_amount + item.fees_amount);
  const repairCost = item.finance_redacted
    ? 0
    : (buybackSummary?.repairCost ?? item.repair_cost_amount);
  const fees = item.finance_redacted ? 0 : (buybackSummary?.fees ?? item.fees_amount);
  const attachmentAccess = useMutation({
    mutationFn: (attachmentId: string) => accessInventoryAttachment(item.id, attachmentId),
    onSuccess: (result) => {
      window.open(result.signed_url, "_blank", "noopener,noreferrer");
    },
    onError: (attachmentError) =>
      toast.error(getErrorMessage(attachmentError, "当前账号无法查看该附件")),
  });

  return (
    <div className="space-y-2">
      <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <InventoryStatusBadge status={item.status} />
          <span className="truncate text-xs text-muted-foreground">
            {primaryAction.label} · {primaryAction.detail}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {primaryDialogAction ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                "h-7 rounded-md px-2 text-[11px] font-medium",
                inventoryActionBadgeClass(primaryAction.tone),
              )}
              onClick={() => onAction(item, primaryDialogAction)}
            >
              {primaryAction.actionLabel}
            </Button>
          ) : (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                inventoryActionBadgeClass(primaryAction.tone),
              )}
            >
              {primaryAction.actionLabel}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0 gap-1 px-2 text-[11px]"
                aria-label="更多库存操作"
              >
                <MoreHorizontal className="size-3.5" />
                更多
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {secondaryActions.map((action) => (
                <DropdownMenuItem key={action.mode} onClick={() => onAction(item, action.mode)}>
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        className={cn(
          "grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border px-2 py-1.5 text-xs lg:hidden",
          inventoryActionPanelClass(primaryAction.tone),
        )}
      >
        <ArrowRight className="size-3.5 shrink-0 text-primary" />
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">
          {primaryAction.detail}
        </span>
      </div>

      <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)] xl:grid-cols-[minmax(0,1.55fr)_380px]">
        <main className="min-w-0 space-y-2">
          {buybackSummary ? (
            <InventoryBuybackSection
              summary={buybackSummary}
              onEditCosts={() => onAction(item, "update")}
            />
          ) : null}

          <div className="grid gap-2 md:grid-cols-2">
            <section className={cn(componentOverlay.flatSection, "p-2")}>
              <RepairOsSectionHeader
                title="商品"
                icon={Smartphone}
                headingLevel={3}
                className="mb-1.5"
                titleClassName="text-xs"
                iconWrapperClassName="size-6"
                iconClassName="size-3.5"
              />
              <InventoryProductPanel item={item} />
            </section>
            <section className={cn(componentOverlay.flatSection, "p-2")}>
              <RepairOsSectionHeader
                title="检测"
                icon={BadgeCheck}
                headingLevel={3}
                className="mb-1.5"
                titleClassName="text-xs"
                iconWrapperClassName="size-6"
                iconClassName="size-3.5"
              />
              <InventoryQualityPanel item={item} />
            </section>
          </div>

          <section className={cn(componentOverlay.flatSection, "p-2")}>
            <RepairOsSectionHeader
              title="附件凭证"
              headingLevel={3}
              className="mb-1.5 items-center"
              titleClassName="text-xs"
              action={
                <span className="rounded-md bg-[var(--surface-panel-muted)] px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                  {data.attachments.length}
                </span>
              }
            />
            <div className="grid gap-1.5 sm:grid-cols-2">
              {data.attachments.map((attachment) => {
                const content = (
                  <>
                    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5">
                      <FileText className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate text-[11px] font-semibold">
                        {inventoryAttachmentKindLabel(attachment.kind)}
                      </span>
                      <time className="shrink-0 text-[9px] leading-3 text-muted-foreground">
                        {formatDateTime(attachment.created_at)}
                      </time>
                    </div>
                    <span className="mt-0.5 block truncate pl-5 text-[10px] leading-3 text-muted-foreground">
                      {attachment.file_name}
                    </span>
                  </>
                );
                return attachment.signed_url ? (
                  <a
                    key={attachment.id}
                    href={attachment.signed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block min-w-0 rounded-lg border border-[var(--border-panel)] bg-card px-2 py-1.5"
                  >
                    {content}
                  </a>
                ) : (
                  <button
                    type="button"
                    key={attachment.id}
                    className="block min-h-11 w-full min-w-0 rounded-lg border border-[var(--border-panel)] bg-card px-2 py-1.5 text-left disabled:cursor-wait disabled:opacity-60"
                    disabled={
                      attachmentAccess.isPending && attachmentAccess.variables === attachment.id
                    }
                    onClick={() => attachmentAccess.mutate(attachment.id)}
                  >
                    {content}
                  </button>
                );
              })}
              {data.attachments.length === 0 ? (
                <InventoryDetailEmptyLine className="border-0 bg-[var(--surface-panel-muted)] px-2 py-1.5 sm:col-span-2">
                  暂无附件凭证
                </InventoryDetailEmptyLine>
              ) : null}
            </div>
          </section>
        </main>

        <aside className="min-w-0 space-y-2">
          {item.finance_redacted ? (
            <section
              className={cn(componentOverlay.flatSection, "p-2 text-xs text-muted-foreground")}
            >
              成本、利润与交易流水仅对已授权角色可见。
            </section>
          ) : (
            <>
              <InventoryFinancialSummarySection
                item={item}
                repairCost={repairCost}
                fees={fees}
                costBasis={costBasis}
                onEditCosts={() => onAction(item, "update")}
              />
              <InventoryTransactionsSection transactions={data.transactions} />
            </>
          )}

          <section className={cn(componentOverlay.flatSection, "p-2")}>
            <RepairOsSectionHeader
              title="时间线"
              headingLevel={3}
              className="mb-1.5"
              titleClassName="text-xs"
            />
            <div className="space-y-1.5 border-l border-border/50 pl-3">
              {data.events.slice(0, 8).map((event) => (
                <div
                  key={event.id}
                  className="relative min-w-0 border-b border-border/30 pb-1.5 last:border-0"
                >
                  <span className="absolute -left-[15px] top-1.5 size-2 rounded-full bg-primary ring-[3px] ring-background" />
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <div className="truncate text-[11px] font-semibold leading-4">
                      {eventLabel(event.event_type)}
                      {event.to_status ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {inventoryStatusMeta[event.to_status].label}
                        </span>
                      ) : null}
                    </div>
                    <time className="shrink-0 text-[9px] leading-3 text-muted-foreground">
                      {formatDateTime(event.created_at)}
                    </time>
                  </div>
                  <p className="truncate text-[10px] leading-[14px] text-muted-foreground">
                    {event.operator_name}
                  </p>
                </div>
              ))}
              {data.events.length === 0 ? (
                <InventoryDetailEmptyLine className="border-0 bg-[var(--surface-panel-muted)] px-2 py-1.5">
                  暂无时间线记录
                </InventoryDetailEmptyLine>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function InventoryBuybackSection({
  summary,
  onEditCosts,
}: {
  summary: InventoryBuybackSummary;
  onEditCosts?: () => void;
}) {
  const missingProof = summary.proofRows.filter((row) => !row.done);
  const proofComplete = summary.proofTotal > 0 && summary.proofDone >= summary.proofTotal;
  const proofTone = proofComplete ? "success" : "warning";
  const repairAndFees = summary.repairCost + summary.fees;
  const proofMeta = proofComplete
    ? "凭证齐"
    : missingProof.length
      ? `${missingProof.length} 项待补`
      : "待核对";
  const quoteMeta = summary.quoteExpiresAt
    ? `有效 ${formatDateTime(summary.quoteExpiresAt)}`
    : "未设有效期";
  const riskTone = summary.deductions.length
    ? "danger"
    : missingProof.length
      ? "warning"
      : "success";

  return (
    <section
      className={cn(
        componentOverlay.flatSection,
        "border-[var(--border-panel)] bg-card p-1.5 sm:p-2",
      )}
    >
      <RepairOsSectionHeader
        title="回收来源"
        headingLevel={3}
        className="mb-1.5 items-center"
        titleClassName="text-xs"
        action={
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none",
                buybackSummaryToneClass(summary.statusTone),
              )}
            >
              {summary.statusLabel}
            </span>
            {onEditCosts ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 gap-1 rounded-md bg-card px-1.5 text-[10px]"
                aria-label="编辑回收价格和成本"
                onClick={onEditCosts}
              >
                <Edit3 className="size-3" />
                编辑
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-1 lg:grid-cols-5">
        <InventoryDenseInfoBox
          label="报价"
          value={<MoneyText amount={summary.offer} />}
          meta={quoteMeta}
          tone="info"
        />
        <InventoryDenseInfoBox
          label="实付"
          value={<MoneyText amount={summary.purchaseCost} />}
          meta={summary.purchaseCost > 0 ? "回收成本" : "待录入"}
          tone={summary.purchaseCost > 0 ? "success" : "neutral"}
        />
        <InventoryDenseInfoBox
          label="整备"
          value={<MoneyText amount={repairAndFees} />}
          meta={summary.fees > 0 ? "维修+费用" : "维修预估"}
          tone={repairAndFees > 0 ? "warning" : "neutral"}
        />
        <InventoryDenseInfoBox
          label="总成本"
          value={<MoneyText amount={summary.costBasis} />}
          meta="实付+整备"
          tone="warning"
        />
        <InventoryDenseInfoBox
          label="凭证"
          value={`${summary.proofDone}/${summary.proofTotal}`}
          meta={proofMeta}
          tone={proofTone}
        />
      </div>

      <div className="mt-1 grid grid-cols-[minmax(0,1fr)_108px] gap-1 sm:grid-cols-[minmax(0,1fr)_150px]">
        <div
          className={cn(
            "min-w-0 rounded-lg border px-2 py-1",
            summary.repairRows.length
              ? "border-status-warn-foreground/20 bg-status-warn/15"
              : "border-[var(--border-panel)] bg-[var(--surface-panel)]",
          )}
        >
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="text-[10px] font-semibold text-muted-foreground">故障 / 整备</div>
            {summary.repairRows.length ? (
              <span className="shrink-0 rounded bg-status-warn px-1 text-[9px] font-medium leading-4 text-status-warn-foreground">
                {summary.repairRows.length} 项
              </span>
            ) : null}
          </div>
          <p className="truncate text-[11px] font-medium leading-4">{summary.repairIssueSummary}</p>
          {summary.repairRows.length ? (
            <div className="mt-0.5 grid gap-0.5">
              {summary.repairRows.slice(0, 2).map((row) => (
                <div
                  key={row.key}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_32px] gap-1 rounded-md border border-status-warn-foreground/10 bg-card/80 px-1.5 py-0.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-medium leading-3">{row.label}</p>
                    <p className="truncate text-[9px] leading-3 text-muted-foreground">
                      {row.detail}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "self-start text-right text-[9px] leading-3",
                      repairPriorityClass(row.priority),
                    )}
                  >
                    {repairPriorityLabel(row.priority)}
                  </span>
                </div>
              ))}
              {summary.repairRows.length > 2 ? (
                <div className="truncate px-1 text-[9px] leading-3 text-muted-foreground">
                  另 {summary.repairRows.length - 2} 项维修检查在详情中保留
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground">
              未记录整备项目
            </p>
          )}
        </div>
        <div className="min-w-0 rounded-lg border border-status-info-foreground/15 bg-status-info/10 px-1.5 py-1">
          <div className="mb-0.5 flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground">成本组成</span>
            <span className="font-mono text-[10px] font-semibold text-status-info-foreground">
              <MoneyText amount={summary.costBasis} />
            </span>
          </div>
          <div className="space-y-0.5 text-[10px] leading-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">实付</span>
              <span className="font-mono font-semibold">
                <MoneyText amount={summary.purchaseCost} />
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">维修</span>
              <span className="font-mono font-semibold">
                <MoneyText amount={summary.repairCost} />
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">其他</span>
              <span className="font-mono font-semibold">
                <MoneyText amount={summary.fees} />
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-1">
        <div
          className={cn(
            "min-w-0 rounded-lg border px-1.5 py-1",
            proofComplete
              ? "border-status-success-foreground/20 bg-status-success/10"
              : "border-status-warn-foreground/20 bg-status-warn/15",
          )}
        >
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold text-muted-foreground">凭证状态</span>
            <span
              className={cn(
                "rounded px-1 font-mono text-[10px] font-semibold leading-4",
                proofComplete
                  ? "bg-status-success text-status-success-foreground"
                  : "bg-status-warn text-status-warn-foreground",
              )}
            >
              {summary.proofDone}/{summary.proofTotal}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {summary.proofRows.map((row) => (
              <InventoryProofChip key={row.key} row={row} />
            ))}
          </div>
        </div>

        <div
          className={cn(
            "min-w-0 rounded-lg border px-1.5 py-1",
            riskTone === "danger"
              ? "border-status-danger-foreground/20 bg-status-danger/10"
              : riskTone === "warning"
                ? "border-status-warn-foreground/20 bg-status-warn/15"
                : "border-status-success-foreground/20 bg-status-success/10",
          )}
        >
          <div className="mb-0.5 flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground">风险</span>
            <span
              className={cn(
                "rounded px-1 text-[9px] font-medium leading-4",
                riskTone === "danger"
                  ? "bg-status-danger text-status-danger-foreground"
                  : riskTone === "warning"
                    ? "bg-status-warn text-status-warn-foreground"
                    : "bg-status-success text-status-success-foreground",
              )}
            >
              {riskTone === "danger" ? "扣减" : riskTone === "warning" ? "待补" : "正常"}
            </span>
          </div>
          {summary.deductions.length ? (
            <div className="space-y-0.5">
              {summary.deductions.slice(0, 3).map((row) => (
                <div
                  key={`${row.label}-${row.amount}`}
                  className="flex min-w-0 items-center justify-between gap-1 text-[10px] leading-3"
                >
                  <span className="truncate">{row.label}</span>
                  <span className="font-mono font-semibold text-status-danger-foreground">
                    -€{row.amount.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          ) : summary.riskNotes.length ? (
            <div className="space-y-0.5">
              {summary.riskNotes.slice(0, 3).map((note) => (
                <p
                  key={note}
                  className="truncate text-[10px] leading-3 text-status-warn-foreground"
                >
                  {note}
                </p>
              ))}
            </div>
          ) : missingProof.length ? (
            <p className="line-clamp-2 text-[10px] leading-3 text-status-warn-foreground">
              待补：{missingProof.map((row) => row.label).join("、")}
            </p>
          ) : (
            <p className="truncate text-[10px] leading-3 text-status-success-foreground">无扣减</p>
          )}
        </div>
      </div>
    </section>
  );
}

function InventoryFinancialSummarySection({
  item,
  repairCost,
  fees,
  costBasis,
  onEditCosts,
}: {
  item: InventoryDetail["item"];
  repairCost: number;
  fees: number;
  costBasis: number;
  onEditCosts: () => void;
}) {
  const profitTone = item.profit > 0 ? "success" : item.profit < 0 ? "danger" : "neutral";

  return (
    <section className={cn(componentOverlay.flatSection, "p-2")}>
      <RepairOsSectionHeader
        title="财务总览"
        headingLevel={3}
        className="mb-1.5 items-center"
        titleClassName="text-xs"
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 gap-1 rounded-md bg-card px-1.5 text-[10px]"
            aria-label="编辑回收价格和成本"
            onClick={onEditCosts}
          >
            <Edit3 className="size-3" />
            编辑
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-1">
        <InventoryFinanceTile
          icon={Wallet}
          label="回收"
          value={<MoneyText amount={item.buyback_price} />}
          tone={item.buyback_price > 0 ? "success" : "neutral"}
        />
        <InventoryFinanceTile
          icon={Calculator}
          label="成本"
          value={<MoneyText amount={costBasis} />}
          tone={costBasis > 0 ? "warning" : "neutral"}
        />
        <InventoryFinanceTile
          icon={Tag}
          label="挂牌"
          value={<MoneyText amount={item.list_price} />}
          tone={item.list_price > 0 ? "info" : "warning"}
        />
        <InventoryFinanceTile
          icon={Wrench}
          label="维修"
          value={<MoneyText amount={repairCost} />}
          tone={repairCost > 0 ? "warning" : "neutral"}
        />
        <InventoryFinanceTile
          icon={FileText}
          label="其他"
          value={<MoneyText amount={fees} />}
          tone={fees > 0 ? "warning" : "neutral"}
        />
        <InventoryFinanceTile
          icon={TrendingUp}
          label="利润"
          value={<MoneyText amount={item.profit} />}
          tone={profitTone}
        />
      </div>
    </section>
  );
}

function InventoryFinanceTile({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  tone?: InventoryDenseInfoTone;
}) {
  const toneClass = inventoryAppToneClass(tone);

  return (
    <div className={cn("min-w-0 rounded-lg border px-1.5 py-1", toneClass.frame)}>
      <div className="flex min-w-0 items-center gap-1">
        <span
          className={cn("grid size-5 shrink-0 place-items-center rounded-md", toneClass.iconFrame)}
        >
          <Icon className={cn("size-3", toneClass.icon)} />
        </span>
        <span className={cn("min-w-0 truncate text-[9px] font-medium leading-3", toneClass.label)}>
          {label}
        </span>
      </div>
      <div className="mt-0.5 truncate font-mono text-[11px] font-semibold leading-4 tabular-nums">
        {value}
      </div>
    </div>
  );
}

function InventoryTransactionsSection({
  transactions,
}: {
  transactions: InventoryDetail["transactions"];
}) {
  return (
    <section className={cn(componentOverlay.flatSection, "p-2")}>
      <RepairOsSectionHeader
        title="财务流水"
        headingLevel={3}
        className="mb-1.5 items-center"
        titleClassName="text-xs"
        action={
          <span className="rounded-md bg-[var(--surface-panel-muted)] px-1.5 py-0.5 font-mono text-[11px] font-semibold">
            {transactions.length}
          </span>
        }
      />

      {transactions.length ? (
        <div className="grid gap-1.5">
          {transactions.slice(0, 8).map((transaction) => {
            const isCost = ["buyback_payment", "repair_cost", "fee", "refund"].includes(
              transaction.transaction_type,
            );
            const transactionLabel = inventoryTransactionTypeLabel(transaction.transaction_type);
            const note =
              transaction.note && transaction.note !== transactionLabel ? transaction.note : "";

            return (
              <div
                key={transaction.id}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1"
              >
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium">{transactionLabel}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {transaction.method || "未记录方式"} · {formatDateTime(transaction.created_at)}
                  </p>
                  {note ? (
                    <p className="truncate text-[10px] text-muted-foreground">{note}</p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[11px] font-semibold tabular-nums",
                    isCost ? "text-status-danger-foreground" : "text-status-success-foreground",
                  )}
                >
                  {isCost ? "-" : "+"}
                  <MoneyText amount={Math.abs(transaction.amount)} />
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <InventoryDetailEmptyLine className="border-0 bg-[var(--surface-panel-muted)] px-2 py-1.5">
          暂无财务流水。回收成交、登记维修成本或售出后会自动显示在这里。
        </InventoryDetailEmptyLine>
      )}
    </section>
  );
}

function InventoryDetailEmptyLine({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <RepairOsBusinessCard
      as="div"
      data-ui="inventory-detail-empty-line"
      className={cn(
        "grid-cols-[auto_minmax(0,1fr)] items-center rounded-lg border-dashed px-2.5 py-2 text-muted-foreground shadow-none",
        className,
      )}
      leading={
        <span className="grid size-7 place-items-center rounded-md bg-[var(--surface-panel-muted)] text-muted-foreground">
          <Inbox className="size-3.5" />
        </span>
      }
      leadingClassName="self-center"
    >
      <span className="block text-[11px] leading-4 text-muted-foreground">{children}</span>
    </RepairOsBusinessCard>
  );
}

function InventoryActionDialog({
  action,
  item,
  activeStoreId,
  storeOutputIdentity,
  canReadStoreSettings,
  canUpdateStoreSettings,
  useAtomicSale,
  onRetryStoreSettings,
  onReloadStoreContext,
  onOpenChange,
  onDone,
}: {
  action: InventoryActionMode | null;
  item?: InventoryListItem;
  activeStoreId?: string;
  storeOutputIdentity: StoreOutputIdentity;
  canReadStoreSettings: boolean;
  canUpdateStoreSettings: boolean;
  useAtomicSale: boolean;
  onRetryStoreSettings?: () => void | Promise<unknown>;
  onReloadStoreContext?: () => void | Promise<unknown>;
  onOpenChange: (open: boolean) => void;
  onDone: (id?: string) => void;
}) {
  const [buyerSearch, setBuyerSearch] = useState("");
  const [selectedBuyer, setSelectedBuyer] = useState<Customer | null>(null);
  const deferredBuyerSearch = useDeferredValue(buyerSearch.trim());
  const saleCommandRef = useRef<{ itemId: string; key: string; soldAt: string } | null>(null);
  const buyersQuery = useQuery({
    queryKey: ["inventory-v2", "sale-customers", activeStoreId, deferredBuyerSearch],
    queryFn: () => searchCustomers(deferredBuyerSearch, 6),
    enabled:
      Boolean(activeStoreId) &&
      useAtomicSale &&
      action === "sell" &&
      deferredBuyerSearch.length >= 2,
  });

  useEffect(() => {
    setBuyerSearch("");
    setSelectedBuyer(null);
    saleCommandRef.current = null;
  }, [action, activeStoreId, item?.id]);
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInventoryItemInput }) =>
      updateInventoryItem(id, input),
    onSuccess: (_, { id }) => {
      toast.success("已更新库存商品");
      onDone(id);
      onOpenChange(false);
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const transitionMutation = useMutation({
    mutationFn: ({ id, to, reason }: { id: string; to: InventoryItemStatus; reason?: string }) =>
      transitionInventoryItem(id, to, { reason }),
    onSuccess: ({ to }, { id }) => {
      toast.success(`已推进至 ${inventoryStatusMeta[to].label}`);
      onDone(id);
      onOpenChange(false);
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const checkMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: InventoryQualityCheckInput }) =>
      recordInventoryCheck(id, input),
    onSuccess: (_, { id }) => {
      toast.success("已记录检测");
      onDone(id);
      onOpenChange(false);
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const sellMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: SellInventoryItemInput }) =>
      sellInventoryItem(id, input),
    onSuccess: (_, { id }) => {
      toast.success("已登记售出");
      onDone(id);
      onOpenChange(false);
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const atomicSellMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CompleteInventorySaleV2Input }) =>
      completeInventorySaleV2(id, input),
    onSuccess: (_, { id }) => {
      toast.success("成交、收款、库存与审计已一次完成");
      onDone(id);
      onOpenChange(false);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  if (action === "import") {
    return <ImportDialog open onOpenChange={onOpenChange} onDone={() => onDone()} />;
  }

  if (!item || !action) return null;

  if (action === "receipt") {
    return (
      <InventorySaleReceiptDialog
        item={item}
        storeOutputIdentity={storeOutputIdentity}
        canReadStoreSettings={canReadStoreSettings}
        canUpdateStoreSettings={canUpdateStoreSettings}
        onRetryStoreSettings={onRetryStoreSettings}
        onReloadStoreContext={onReloadStoreContext}
        onOpenChange={onOpenChange}
      />
    );
  }

  const currentItem = item;
  const currentCostBasis = currentItem.finance_redacted
    ? 0
    : currentItem.buyback_price + currentItem.repair_cost_amount + currentItem.fees_amount;
  const nextStatuses = getInventoryNextStatuses(currentItem.status);
  const primaryAction = getInventoryPrimaryAction(currentItem);
  const preferredNextStatus =
    primaryAction.nextStatus && nextStatuses.includes(primaryAction.nextStatus)
      ? primaryAction.nextStatus
      : nextStatuses[0];

  function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateMutation.mutate({
      id: currentItem.id,
      input: updateItemInput(formData),
    });
  }

  function handleTransition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    transitionMutation.mutate({
      id: currentItem.id,
      to: textValue(formData, "to") as InventoryItemStatus,
      reason: optionalValue(formData, "reason"),
    });
  }

  function handleCheck(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    checkMutation.mutate({
      id: currentItem.id,
      input: checkInput(formData, currentItem.updated_at),
    });
  }

  function handleSell(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (useAtomicSale) {
      if (!saleCommandRef.current || saleCommandRef.current.itemId !== currentItem.id) {
        saleCommandRef.current = {
          itemId: currentItem.id,
          key: crypto.randomUUID(),
          soldAt: new Date().toISOString(),
        };
      }
      const salePrice = numberValue(formData, "sale_price") ?? 0;
      atomicSellMutation.mutate({
        id: currentItem.id,
        input: {
          expected_updated_at: currentItem.updated_at,
          idempotency_key: saleCommandRef.current.key,
          buyer_customer_id: selectedBuyer?.id,
          sale_price: salePrice,
          payment_amount: salePrice,
          payment_method: textValue(formData, "payment_method"),
          sale_channel: textValue(formData, "sale_channel"),
          warranty_months: numberValue(formData, "warranty_months") ?? 0,
          warranty_snapshot: {
            version: "inventory-sale-v2-2026-07",
            language: "it",
            terms: INVENTORY_SALE_RECEIPT_TERMS,
          },
          fiscal_status: textValue(
            formData,
            "fiscal_status",
          ) as CompleteInventorySaleV2Input["fiscal_status"],
          fiscal_reference: optionalValue(formData, "fiscal_reference"),
          sold_at: saleCommandRef.current.soldAt,
        },
      });
      return;
    }
    sellMutation.mutate({ id: currentItem.id, input: sellInput(formData) });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={cn(componentOverlay.formContent, inventoryDialogContentClass)}>
        {action === "update" ? (
          <ActionForm
            title={currentItem.finance_redacted ? "编辑挂牌价" : "编辑价格 / 成本"}
            description={currentItem.item_label}
            onSubmit={handleUpdate}
            footer={
              <Button
                type="submit"
                size="sm"
                className={cn("h-8", controls.brandButton)}
                style={brandGradientStyle}
                disabled={updateMutation.isPending}
              >
                {currentItem.finance_redacted ? "保存挂牌价" : "保存价格/成本"}
              </Button>
            }
          >
            {!currentItem.finance_redacted ? (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <InventoryDenseInfoBox
                  label="当前成本"
                  value={<MoneyText amount={currentCostBasis} />}
                  meta="实付+整备"
                  tone="warning"
                />
                <InventoryDenseInfoBox
                  label="回收实付"
                  value={<MoneyText amount={currentItem.buyback_price} />}
                  meta="客户成交"
                  tone={currentItem.buyback_price > 0 ? "success" : "neutral"}
                />
                <InventoryDenseInfoBox
                  label="挂牌价"
                  value={<MoneyText amount={currentItem.list_price} />}
                  meta={currentItem.list_price > 0 ? "可售价格" : "待录入"}
                  tone={currentItem.list_price > 0 ? "info" : "warning"}
                />
                <InventoryDenseInfoBox
                  label="利润"
                  value={<MoneyText amount={currentItem.profit} />}
                  meta="按当前数据"
                  tone={currentItem.profit >= 0 ? "success" : "danger"}
                />
              </div>
            ) : null}
            <div className={compactInventoryGrid}>
              {!currentItem.finance_redacted ? (
                <>
                  {currentItem.source_type !== "buyback" ? (
                    <Field
                      name="buyback_price"
                      label="采购成本"
                      type="number"
                      step="0.01"
                      defaultValue={
                        currentItem.buyback_price ? String(currentItem.buyback_price) : ""
                      }
                    />
                  ) : (
                    <div className="flex min-h-11 items-center rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 text-xs text-muted-foreground">
                      回收实付已由成交协议锁定；如需撤销，请使用专用冲正流程。
                    </div>
                  )}
                  <Field
                    name="repair_cost_amount"
                    label="维修/整备"
                    type="number"
                    step="0.01"
                    defaultValue={
                      currentItem.repair_cost_amount ? String(currentItem.repair_cost_amount) : ""
                    }
                  />
                  <Field
                    name="fees_amount"
                    label="其他费用"
                    type="number"
                    step="0.01"
                    defaultValue={currentItem.fees_amount ? String(currentItem.fees_amount) : ""}
                  />
                </>
              ) : null}
              <Field
                name="list_price"
                label="挂牌价"
                type="number"
                step="0.01"
                defaultValue={currentItem.list_price ? String(currentItem.list_price) : ""}
                required={currentItem.status === "refurbishing" && currentItem.list_price <= 0}
              />
            </div>
            <TextAreaField name="notes" label="备注（可选）" />
          </ActionForm>
        ) : null}
        {action === "transition" ? (
          <ActionForm
            title="推进状态"
            description={currentItem.item_label}
            onSubmit={handleTransition}
            footer={
              <Button
                type="submit"
                disabled={transitionMutation.isPending || nextStatuses.length === 0}
              >
                确认推进
              </Button>
            }
          >
            <SelectField
              name="to"
              label="下一状态"
              options={nextStatuses}
              optionLabel={(value) => inventoryStatusMeta[value].label}
              defaultValue={preferredNextStatus}
            />
            <TextAreaField name="reason" label="备注" />
          </ActionForm>
        ) : null}
        {action === "check" ? (
          <ActionForm
            title="登记检测"
            description={currentItem.item_label}
            onSubmit={handleCheck}
            footer={
              <Button type="submit" disabled={checkMutation.isPending}>
                保存检测
              </Button>
            }
          >
            <div className={compactInventoryGrid}>
              <SelectField
                name="cosmetic_grade"
                label="外观等级"
                options={cosmeticOptions}
                optionLabel={gradeLabel}
              />
              <SelectField
                name="functional_grade"
                label="功能等级"
                options={functionalOptions}
                optionLabel={gradeLabel}
              />
              <Field name="battery_health" label="电池健康" type="number" min="0" max="100" />
              <SelectField
                name="imei_check_status"
                label="IMEI 检查"
                options={checkOptions}
                optionLabel={checkLabel}
              />
              <SelectField
                name="activation_lock_status"
                label="激活锁"
                options={checkOptions}
                optionLabel={checkLabel}
              />
              <SelectField
                name="data_wipe_status"
                label="资料清除"
                options={checkOptions}
                optionLabel={checkLabel}
              />
            </div>
            <TextAreaField name="notes" label="检测备注" />
          </ActionForm>
        ) : null}
        {action === "sell" ? (
          <ActionForm
            title="登记售出"
            description={currentItem.item_label}
            onSubmit={handleSell}
            footer={
              <Button
                type="submit"
                disabled={sellMutation.isPending || atomicSellMutation.isPending}
              >
                {useAtomicSale ? "确认成交并全额收款" : "确认售出"}
              </Button>
            }
          >
            <div className="grid grid-cols-3 gap-1.5">
              <InventoryDenseInfoBox
                label="标价"
                value={<MoneyText amount={currentItem.list_price || currentItem.sale_price} />}
                meta="当前商品"
                tone={currentItem.list_price > 0 ? "info" : "warning"}
              />
              <InventoryDenseInfoBox
                label="成本"
                value={<MoneyText amount={currentCostBasis} />}
                meta="入库+整备"
                tone={currentCostBasis > 0 ? "warning" : "neutral"}
              />
              <InventoryDenseInfoBox
                label="默认保修"
                value={inventoryWarrantyLabel(currentItem.warranty_months)}
                meta="可修改"
                tone="success"
              />
            </div>
            <div className={compactInventoryGrid}>
              {useAtomicSale ? (
                <div className="col-span-2 space-y-1.5">
                  <Label>关联客户（可选）</Label>
                  <Input
                    value={buyerSearch}
                    onChange={(event) => {
                      setBuyerSearch(event.target.value);
                      setSelectedBuyer(null);
                    }}
                    placeholder="输入姓名或电话搜索"
                    className={compactInventoryInputClass}
                  />
                  {selectedBuyer ? (
                    <p className="text-xs text-status-success-foreground">
                      已选择：{selectedBuyer.name} · {selectedBuyer.phone_raw}
                    </p>
                  ) : null}
                  {(buyersQuery.data ?? []).map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className="block w-full rounded-lg border border-[var(--border-panel)] px-2 py-1.5 text-left text-xs"
                      onClick={() => {
                        setSelectedBuyer(customer);
                        setBuyerSearch(`${customer.name} · ${customer.phone_raw}`);
                      }}
                    >
                      {customer.name} · {customer.phone_raw}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <Field name="buyer_name" label="买家姓名" />
                  <Field name="buyer_phone" label="买家电话" />
                </>
              )}
              <Field
                name="sale_price"
                label="成交价"
                type="number"
                step="0.01"
                defaultValue={String(currentItem.list_price || currentItem.sale_price || 0)}
                required
              />
              <Field
                name="payment_method"
                label="付款方式"
                defaultValue={useAtomicSale ? "cash" : undefined}
                required={useAtomicSale}
              />
              <Field
                name="sale_channel"
                label="售卖渠道"
                defaultValue="store"
                required={useAtomicSale}
              />
              <Field
                name="warranty_months"
                label="保修月数"
                type="number"
                defaultValue={String(currentItem.warranty_months)}
                required={useAtomicSale}
              />
            </div>
            {useAtomicSale ? (
              <div className={compactInventoryGrid}>
                <SelectField
                  name="fiscal_status"
                  label="财政凭证"
                  options={["pending", "not_required", "recorded"] as const}
                  optionLabel={(value) =>
                    ({ pending: "待登记", not_required: "无需登记", recorded: "已登记" })[value]
                  }
                />
                <Field name="fiscal_reference" label="财政凭证引用（已登记时必填）" />
                <p className="col-span-2 text-xs leading-5 text-muted-foreground">
                  首版正式成交只支持一次全额收款；库存、收款、售卖事件与审计会在同一事务完成。
                </p>
              </div>
            ) : null}
            <TextAreaField name="notes" label="售卖备注" />
          </ActionForm>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function InventorySaleReceiptDialog({
  item,
  storeOutputIdentity,
  canReadStoreSettings,
  canUpdateStoreSettings,
  onRetryStoreSettings,
  onReloadStoreContext,
  onOpenChange,
}: {
  item: InventoryListItem;
  storeOutputIdentity: StoreOutputIdentity;
  canReadStoreSettings: boolean;
  canUpdateStoreSettings: boolean;
  onRetryStoreSettings?: () => void | Promise<unknown>;
  onReloadStoreContext?: () => void | Promise<unknown>;
  onOpenChange: (open: boolean) => void;
}) {
  const receipt = buildInventorySaleReceiptData(item, {
    storeIdentity: storeOutputIdentity,
  });
  const warrantyState = getInventoryWarrantyState(item);

  function handlePrint() {
    if (!storeOutputIdentity.canOutput) return;
    window.requestAnimationFrame(() => window.print());
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={cn(componentOverlay.formContent, inventoryDialogContentClass)}>
        <DialogHeader className={cn(componentOverlay.header, inventoryDialogHeaderClass)}>
          <DialogTitle className={componentOverlay.title}>保修票据</DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            {receipt.receipt_no} · {receipt.item_label}
          </DialogDescription>
        </DialogHeader>
        <div className={cn(inventoryDialogBodyClass, "space-y-3")}>
          <StoreOutputIdentityRecovery
            identity={storeOutputIdentity}
            canReadSettings={canReadStoreSettings}
            canUpdateSettings={canUpdateStoreSettings}
            onRetrySettings={onRetryStoreSettings}
            onReloadStoreContext={onReloadStoreContext}
            openSettingsInNewTab
          />
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <InventoryDenseInfoBox
              label="售出时间"
              value={formatDateTime(receipt.sold_at)}
              meta="购买日期"
              tone="info"
            />
            <InventoryDenseInfoBox
              label="成交价"
              value={<MoneyText amount={receipt.sale_price} />}
              meta={receipt.payment_method || "未记录付款"}
              tone="success"
            />
            <InventoryDenseInfoBox
              label="保修期"
              value={`${receipt.warranty_months} 月`}
              meta={receipt.warranty_until ? formatDateTime(receipt.warranty_until) : "无截止"}
              tone={warrantyState.key === "expired" ? "warning" : "success"}
            />
            <InventoryDenseInfoBox
              label="买家"
              value={receipt.buyer_name || "-"}
              meta={receipt.buyer_phone || "未记录电话"}
              tone={receipt.buyer_name ? "neutral" : "warning"}
            />
          </div>

          <section className={cn(componentOverlay.flatSection, "p-3")}>
            <RepairOsSectionHeader
              title="票据预览"
              icon={Printer}
              headingLevel={3}
              className="mb-2"
              titleClassName="text-xs"
              iconWrapperClassName="size-6"
              iconClassName="size-3.5"
            />
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <InventoryReceiptPreviewLine label="店铺" value={receipt.store_name} />
              <InventoryReceiptPreviewLine label="店铺地址" value={receipt.store_address} />
              <InventoryReceiptPreviewLine label="商品" value={receipt.item_label} />
              <InventoryReceiptPreviewLine label="IMEI / 序列号" value={receipt.serial_or_imei} />
              <InventoryReceiptPreviewLine
                label="颜色 / 容量"
                value={[receipt.color, receipt.storage_capacity].filter(Boolean).join(" / ")}
              />
              <InventoryReceiptPreviewLine label="保修状态" value={warrantyState.label} />
            </div>
            <div className="mt-3 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2">
              <p className="text-[11px] font-semibold text-foreground">保修条款</p>
              <ul className="mt-1 space-y-1 text-[11px] leading-4 text-muted-foreground">
                {receipt.terms.map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
        <DialogFooter className={inventoryDialogFooterClass}>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          <Button
            type="button"
            size="sm"
            className={cn("gap-2", controls.brandButton)}
            style={brandGradientStyle}
            disabled={!storeOutputIdentity.canOutput}
            onClick={handlePrint}
          >
            <Printer className="size-3.5" />
            打印票据
          </Button>
        </DialogFooter>
        {storeOutputIdentity.canOutput ? (
          <InventorySaleReceiptPrintSheet receipt={receipt} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function InventoryReceiptPreviewLine({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-card px-2 py-1.5">
      <p className="truncate text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="truncate text-[12px] font-semibold text-foreground">{value || "-"}</p>
    </div>
  );
}

function InventorySaleReceiptPrintSheet({ receipt }: { receipt: InventorySaleReceiptData }) {
  const balance = Math.max(0, receipt.sale_price - receipt.deposit_amount);

  return (
    <PrintPortal>
      <section className="repair-print-sheet" aria-hidden="true">
        <div className="repair-print-page">
          <div className="repair-print-left">
            <header className="repair-print-store">
              <h2>{receipt.store_name}</h2>
              {receipt.store_address ? <p>{receipt.store_address}</p> : null}
              <h1>RICEVUTA VENDITA USATO</h1>
              <p>Documento garanzia cliente</p>
            </header>

            <div className="repair-print-meta">
              <PrintMeta label="Numero ricevuta" value={receipt.receipt_no} />
              <PrintMeta label="Data vendita" value={formatItalianDateTime(receipt.sold_at)} />
              <PrintMeta label="Cliente" value={receipt.buyer_name || "-"} />
              <PrintMeta label="Telefono" value={receipt.buyer_phone || "-"} />
            </div>

            <PrintSection title="Prodotto venduto">
              <PrintLine label="Articolo" value={receipt.item_label} />
              <PrintLine label="Categoria" value={receipt.category || "-"} />
              <PrintLine
                label="Colore / Memoria"
                value={[receipt.color, receipt.storage_capacity].filter(Boolean).join(" / ") || "-"}
              />
              <PrintLine label="IMEI / Seriale" value={receipt.serial_or_imei || "-"} />
              <PrintLine label="Numero interno" value={receipt.item_no} />
            </PrintSection>

            <PrintSection title="Pagamento">
              <PrintLine label="Prezzo vendita" value={formatEuro(receipt.sale_price)} />
              <PrintLine label="Acconto" value={formatEuro(receipt.deposit_amount)} />
              <PrintLine label="Saldo" value={formatEuro(balance)} />
              <PrintLine label="Metodo" value={receipt.payment_method || "-"} />
              <PrintLine label="Canale" value={receipt.sale_channel || "store"} />
            </PrintSection>

            <PrintSection title="Garanzia">
              <PrintLine label="Durata" value={`${receipt.warranty_months} mesi`} />
              <PrintLine
                label="Scadenza"
                value={receipt.warranty_until ? formatItalianDateTime(receipt.warranty_until) : "-"}
              />
              <PrintParagraph label="Note" value={receipt.notes} />
            </PrintSection>
          </div>

          <aside className="repair-print-right">
            <header>
              <h2>CONDIZIONI DI GARANZIA</h2>
              <p>{receipt.store_name}</p>
              <p>{receipt.store_address}</p>
            </header>

            <section className="repair-print-warranty">
              <h3>Termini principali</h3>
              <ul>
                {receipt.terms.map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ul>
            </section>

            <footer className="repair-print-footer">
              <div className="repair-print-signature">
                <span>Firma cliente</span>
              </div>
              <p>
                Conservare questo documento per eventuali garanzie. La garanzia decorre dalla data
                vendita indicata sulla ricevuta.
              </p>
            </footer>
          </aside>
        </div>
      </section>
    </PrintPortal>
  );
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="repair-print-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function PrintMeta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span>{label}:</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function PrintLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="repair-print-line">
      <strong>{label}:</strong> <span>{value || "-"}</span>
    </p>
  );
}

function PrintParagraph({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <p className="repair-print-paragraph">
      <strong>{label}:</strong> {value}
    </p>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ElectronicsImportPreviewResult>();
  const previewMutation = useMutation({
    mutationFn: importElectronicsCsvPreview,
    onSuccess: setPreview,
    onError: (error) => toast.error((error as Error).message),
  });
  const applyMutation = useMutation({
    mutationFn: applyElectronicsCsvImport,
    onSuccess: (report) => {
      toast.success(`已导入 ${report.itemCount} 台电子产品`);
      onDone();
      onOpenChange(false);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(componentOverlay.responsiveContent, inventoryDialogContentClass)}
      >
        <DialogHeader className={cn(componentOverlay.header, inventoryDialogHeaderClass)}>
          <DialogTitle className={componentOverlay.title}>导入 SeaTable 电子产品</DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            粘贴 `电子产品` 表导出的 CSV，先预览字段映射再应用。
          </DialogDescription>
        </DialogHeader>
        <div className={cn(inventoryDialogBodyClass, "space-y-3")}>
          <Textarea
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            className="min-h-48 text-sm"
          />
          {preview ? <ImportPreviewSummary preview={preview} /> : null}
        </div>
        <DialogFooter className={inventoryDialogFooterClass}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => previewMutation.mutate(csv)}
            disabled={!csv.trim() || previewMutation.isPending}
          >
            预览
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={() => applyMutation.mutate(csv)}
            disabled={!preview || applyMutation.isPending}
          >
            应用导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportPreviewSummary({ preview }: { preview: ElectronicsImportPreviewResult }) {
  const warnings = preview.report.warnings;

  return (
    <div className="space-y-2" data-ui="inventory-import-preview-summary">
      <RepairOsBusinessCard
        className={cn(repairOs.businessCardDense, "rounded-xl px-2.5 py-2")}
        leading={
          <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <DatabaseZap className="size-4" />
          </span>
        }
        trailing={
          <span className="rounded-md bg-status-neutral px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-status-neutral-foreground">
            {preview.report.importedRows}/{preview.report.totalRows} 行
          </span>
        }
      >
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold leading-4">导入预览结果</div>
          <div className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground">
            SeaTable 电子产品字段已映射，确认后再写入库存。
          </div>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
            <RepairOsInfoTile
              frame="bordered"
              label="设备"
              value={preview.report.itemCount}
              valueClassName="font-mono text-sm font-semibold tabular-nums"
            />
            <RepairOsInfoTile
              frame="bordered"
              label="客户"
              value={preview.report.customerCount}
              valueClassName="font-mono text-sm font-semibold tabular-nums"
            />
            <RepairOsInfoTile
              frame="bordered"
              label="流水"
              value={preview.report.transactionCount}
              valueClassName="font-mono text-sm font-semibold tabular-nums"
            />
            <RepairOsInfoTile
              frame="bordered"
              label="事件"
              value={preview.report.eventCount}
              valueClassName="font-mono text-sm font-semibold tabular-nums"
            />
            <RepairOsInfoTile
              frame="bordered"
              label="回收合计"
              value={<MoneyText amount={preview.report.totalBuyback} />}
              valueClassName="font-mono text-sm font-semibold tabular-nums"
            />
            <RepairOsInfoTile
              frame="bordered"
              label="售价合计"
              value={
                <MoneyText
                  amount={preview.report.totalSalePrice || preview.report.totalListPrice}
                />
              }
              valueClassName="font-mono text-sm font-semibold tabular-nums"
            />
          </div>
        </div>
      </RepairOsBusinessCard>
      {warnings.length > 0 ? (
        <RepairOsBusinessCard
          className={cn(
            repairOs.businessCardDense,
            "rounded-xl border-status-warn-foreground/20 bg-status-warn px-2.5 py-2 text-status-warn-foreground",
          )}
          leading={
            <span className="grid size-8 place-items-center rounded-lg bg-status-warn-foreground/10">
              <AlertTriangle className="size-4" />
            </span>
          }
        >
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold leading-4">
              需要核对 {warnings.length} 项
            </div>
            <div className="mt-1 space-y-1">
              {warnings.slice(0, 3).map((warning, index) => (
                <div
                  key={`${warning.row}-${warning.field}-${index}`}
                  className="text-[10px] leading-4"
                >
                  第 {warning.row} 行 · {warning.field}: {warning.message}
                </div>
              ))}
              {warnings.length > 3 ? (
                <div className="text-[10px] leading-4">还有 {warnings.length - 3} 项核对提示。</div>
              ) : null}
            </div>
          </div>
        </RepairOsBusinessCard>
      ) : null}
    </div>
  );
}

function ActionForm({
  title,
  description,
  onSubmit,
  footer,
  children,
}: {
  title: string;
  description: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <form className="flex max-h-[calc(100svh-24px)] min-h-0 flex-col" onSubmit={onSubmit}>
      <DialogHeader className={cn(componentOverlay.header, inventoryDialogHeaderClass)}>
        <DialogTitle className={componentOverlay.title}>{title}</DialogTitle>
        <DialogDescription className={componentOverlay.description}>
          {description}
        </DialogDescription>
      </DialogHeader>
      <div className={cn(inventoryDialogBodyClass, "space-y-3")}>{children}</div>
      <DialogFooter className={inventoryDialogFooterClass}>{footer}</DialogFooter>
    </form>
  );
}

function InventoryKpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <RepairOsInfoTile
      data-ui="inventory-kpi-card"
      label={label}
      value={value}
      frame="plain"
      trailing={
        <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
      }
      className={cn(repairOs.metricCard, "p-3")}
      bodyClassName="min-w-0"
      labelClassName="text-[10px] uppercase tracking-widest text-muted-foreground/70"
      valueClassName="mt-1 font-display text-2xl font-semibold leading-none tabular-nums"
    />
  );
}

function InventoryLoadError({
  title = "库存加载失败",
  message,
  isRetrying,
  onRetry,
  compact = false,
}: {
  title?: string;
  message: string;
  isRetrying: boolean;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <RepairOsBusinessCard
      as="div"
      data-ui={compact ? "inventory-load-error-compact" : "inventory-load-error"}
      className={cn(
        compact
          ? "flex min-w-0 flex-col items-center justify-center rounded-lg border-status-danger-foreground/20 bg-status-danger/20 p-4 text-center shadow-none hover:bg-status-danger/20"
          : cn(surfaces.empty, "border-status-danger-foreground/20 bg-status-danger/10"),
      )}
      bodyClassName="flex min-w-0 flex-col items-center text-center"
      aria-live="polite"
    >
      <AlertTriangle className="mb-2 size-8 text-status-danger-foreground" />
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      <Button
        type="button"
        size="sm"
        className="mt-3 h-8 gap-1.5"
        onClick={onRetry}
        disabled={isRetrying}
      >
        <RefreshCw className={cn("size-3.5", isRetrying ? "animate-spin" : "")} />
        重新加载
      </Button>
    </RepairOsBusinessCard>
  );
}

function InventoryInlineError({
  message,
  isRetrying,
  onRetry,
}: {
  message: string;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  return (
    <RepairOsBusinessCard
      as="div"
      data-ui="inventory-inline-error"
      className="mb-3 items-center gap-2 rounded-lg border-status-danger-foreground/20 bg-status-danger/20 px-3 py-2 text-xs text-status-danger-foreground shadow-none hover:bg-status-danger/20"
      leading={<AlertTriangle className="size-3.5" />}
      bodyClassName="min-w-0"
      trailingClassName="shrink-0"
      trailing={
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 bg-card"
          onClick={onRetry}
          disabled={isRetrying}
        >
          <RefreshCw className={cn("size-3", isRetrying ? "animate-spin" : "")} />
          重试
        </Button>
      }
      aria-live="polite"
    >
      <span className="block min-w-0 truncate">{message}</span>
    </RepairOsBusinessCard>
  );
}

function InventoryStatusBadge({
  status,
  className,
}: {
  status: InventoryItemStatus;
  className?: string;
}) {
  const meta = inventoryStatusMeta[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        statusToneClass(meta.tone),
        className,
      )}
    >
      {meta.shortLabel}
    </span>
  );
}

type InventoryDenseInfoTone = "neutral" | "info" | "success" | "warning" | "danger";

function InventoryDenseInfoBox({
  label,
  value,
  meta,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
  tone?: InventoryDenseInfoTone;
}) {
  const toneClass = inventoryDenseInfoToneClass(tone);

  return (
    <RepairOsInfoTile
      label={label}
      value={value}
      meta={meta}
      frame="bordered"
      className={cn("min-h-[42px] rounded-lg px-2 py-1", toneClass.frame)}
      labelClassName={cn("text-[9px] leading-3", toneClass.label)}
      valueClassName={cn(
        "mt-0 truncate font-mono text-[12px] font-semibold leading-4 tabular-nums",
        toneClass.value,
      )}
      metaClassName="mt-0 truncate text-[9px] leading-3 text-muted-foreground"
    />
  );
}

function InventoryProductPanel({ item }: { item: InventoryDetail["item"] }) {
  const warrantyState = getInventoryWarrantyState(item);

  return (
    <div className="grid gap-1.5">
      <InventoryAppInfoRow
        icon={Smartphone}
        label="品牌型号"
        value={item.item_label}
        meta={item.category || "未分类"}
        tone="info"
      />
      <InventoryAppInfoRow
        icon={Layers3}
        label="来源 / 保修"
        value={inventorySourceLabel(item.source_type)}
        meta={warrantyState.label}
        tone={item.source_type === "buyback" ? "warning" : "neutral"}
      />
      <div className="grid grid-cols-2 gap-1.5">
        <InventoryAppStatusTile
          icon={Palette}
          label="颜色"
          value={item.color || "-"}
          tone={item.color ? "neutral" : "warning"}
        />
        <InventoryAppStatusTile
          icon={HardDrive}
          label="容量"
          value={item.storage_capacity || "-"}
          tone={item.storage_capacity ? "neutral" : "warning"}
        />
      </div>
      <InventoryAppInfoRow
        icon={Hash}
        label="IMEI / 序列号"
        value={item.serial_or_imei || "-"}
        tone={item.serial_or_imei ? "neutral" : "warning"}
        valueClassName="font-mono text-[11px] tracking-normal"
      />
      {item.notes ? (
        <InventoryAppInfoRow
          icon={FileText}
          label="备注"
          value={item.notes}
          tone="neutral"
          valueClassName="line-clamp-2 whitespace-normal text-[11px] font-medium leading-4"
        />
      ) : null}
    </div>
  );
}

function InventoryQualityPanel({ item }: { item: InventoryDetail["item"] }) {
  const batteryLabel = item.battery_health == null ? "-" : `${item.battery_health}%`;

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <InventoryAppStatusTile
        icon={Sparkles}
        label="外观"
        value={gradeLabel(item.cosmetic_grade)}
        tone={inventoryGradeTone(item.cosmetic_grade)}
      />
      <InventoryAppStatusTile
        icon={BadgeCheck}
        label="功能"
        value={gradeLabel(item.functional_grade)}
        tone={inventoryGradeTone(item.functional_grade)}
      />
      <InventoryAppStatusTile
        icon={BatteryCharging}
        label="电池"
        value={batteryLabel}
        tone={inventoryBatteryTone(item.battery_health)}
      />
      <InventoryAppStatusTile
        icon={ShieldCheck}
        label="IMEI"
        value={checkLabel(item.imei_check_status)}
        tone={inventoryCheckTone(item.imei_check_status)}
      />
      <InventoryAppStatusTile
        icon={LockKeyhole}
        label="激活锁"
        value={checkLabel(item.activation_lock_status)}
        tone={inventoryCheckTone(item.activation_lock_status)}
      />
      <InventoryAppStatusTile
        icon={Eraser}
        label="资料清除"
        value={checkLabel(item.data_wipe_status)}
        tone={inventoryCheckTone(item.data_wipe_status)}
      />
    </div>
  );
}

function InventoryAppInfoRow({
  icon: Icon,
  label,
  value,
  meta,
  tone = "neutral",
  valueClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
  tone?: InventoryDenseInfoTone;
  valueClassName?: string;
}) {
  const toneClass = inventoryAppToneClass(tone);

  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-2 py-1.5",
        toneClass.frame,
      )}
    >
      <span className={cn("grid size-7 place-items-center rounded-lg", toneClass.iconFrame)}>
        <Icon className={cn("size-3.5", toneClass.icon)} />
      </span>
      <div className="min-w-0">
        <div className={cn("truncate text-[9px] font-medium leading-3", toneClass.label)}>
          {label}
        </div>
        <div className={cn("truncate text-[12px] font-semibold leading-4", valueClassName)}>
          {value}
        </div>
      </div>
      {meta ? (
        <span
          className={cn("max-w-20 truncate rounded-md px-1 text-[9px] leading-4", toneClass.pill)}
        >
          {meta}
        </span>
      ) : null}
    </div>
  );
}

function InventoryAppStatusTile({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  tone?: InventoryDenseInfoTone;
}) {
  const toneClass = inventoryAppToneClass(tone);

  return (
    <div className={cn("min-w-0 rounded-xl border px-2 py-1.5", toneClass.frame)}>
      <div className="flex min-w-0 items-center justify-between gap-1.5">
        <span className={cn("grid size-6 place-items-center rounded-lg", toneClass.iconFrame)}>
          <Icon className={cn("size-3.5", toneClass.icon)} />
        </span>
        <span
          className={cn(
            "min-w-0 truncate rounded-md px-1 text-right text-[9px] font-semibold leading-4",
            toneClass.pill,
          )}
        >
          {value}
        </span>
      </div>
      <div className={cn("mt-1 truncate text-[10px] font-medium leading-3", toneClass.label)}>
        {label}
      </div>
    </div>
  );
}

function InventoryProofChip({ row }: { row: InventoryBuybackSummary["proofRows"][number] }) {
  const tone = row.done ? "success" : "warning";
  const toneClass = inventoryAppToneClass(tone);
  const Icon = row.done ? CheckCircle2 : CircleDashed;
  const label = inventoryProofShortLabel(row);

  return (
    <div
      aria-label={`${row.label}${row.done ? "已齐" : "待补"}`}
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-lg border px-1.5 py-0.5",
        toneClass.frame,
      )}
    >
      <Icon className={cn("size-3 shrink-0", toneClass.icon)} />
      <span className="min-w-0 flex-1 whitespace-nowrap text-[9px] font-medium leading-4">
        {label}
      </span>
      <span
        className={cn("shrink-0 rounded px-1 text-[8px] font-semibold leading-3", toneClass.pill)}
      >
        {row.done ? "齐" : "补"}
      </span>
    </div>
  );
}

function inventoryProofShortLabel(row: InventoryBuybackSummary["proofRows"][number]) {
  const labels: Record<string, string> = {
    signature: "客签",
    id_front: "证正",
    id_back: "证反",
    device_photo: "设备",
  };
  if (row.key === "invoice") return row.label.includes("发票") ? "票据" : "无票";
  if (row.key === "box") return row.label.includes("原装") ? "原盒" : "无盒";
  return labels[row.key] ?? row.label;
}

function Field(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    name: string;
    hint?: React.ReactNode;
  },
) {
  const { label, name, required, hint, ...inputProps } = props;
  return (
    <div className={formLayout.field}>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        id={name}
        name={name}
        required={required}
        className={compactInventoryInputClass}
        {...inputProps}
      />
      {hint ? <p className="text-[10px] leading-4 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function TextAreaField({ name, label }: { name: string; label: string }) {
  return (
    <div className={formLayout.field}>
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} className={compactInventoryTextareaClass} />
    </div>
  );
}

function SelectField<T extends string>({
  name,
  label,
  options,
  optionLabel,
  defaultValue,
}: {
  name: string;
  label: string;
  options: readonly T[];
  optionLabel: (value: T) => string;
  defaultValue?: T;
}) {
  return (
    <div className={formLayout.field}>
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className={compactInventorySelectClass}
      >
        {options.map((value) => (
          <option key={value} value={value}>
            {optionLabel(value)}
          </option>
        ))}
      </select>
    </div>
  );
}

function inventoryWarrantyLabel(months: number) {
  return months <= 0 ? "无保修" : `${months} 月`;
}

function checkInput(formData: FormData, expectedUpdatedAt: string): InventoryQualityCheckInput {
  return {
    expected_updated_at: expectedUpdatedAt,
    cosmetic_grade: textValue(
      formData,
      "cosmetic_grade",
    ) as InventoryQualityCheckInput["cosmetic_grade"],
    functional_grade: textValue(
      formData,
      "functional_grade",
    ) as InventoryQualityCheckInput["functional_grade"],
    battery_health: numberValue(formData, "battery_health"),
    imei_check_status: textValue(
      formData,
      "imei_check_status",
    ) as InventoryQualityCheckInput["imei_check_status"],
    activation_lock_status: textValue(
      formData,
      "activation_lock_status",
    ) as InventoryQualityCheckInput["activation_lock_status"],
    data_wipe_status: textValue(
      formData,
      "data_wipe_status",
    ) as InventoryQualityCheckInput["data_wipe_status"],
    notes: optionalValue(formData, "notes"),
  };
}

function sellInput(formData: FormData): SellInventoryItemInput {
  return {
    buyer_name: optionalValue(formData, "buyer_name"),
    buyer_phone: optionalValue(formData, "buyer_phone"),
    sale_price: numberValue(formData, "sale_price") ?? 0,
    payment_method: optionalValue(formData, "payment_method"),
    sale_channel: optionalValue(formData, "sale_channel"),
    warranty_months: numberValue(formData, "warranty_months"),
    warranty_terms_snapshot: INVENTORY_SALE_RECEIPT_TERMS,
    notes: optionalValue(formData, "notes"),
  };
}

function updateItemInput(formData: FormData): UpdateInventoryItemInput {
  const input: UpdateInventoryItemInput = {};
  const listPrice = numberValue(formData, "list_price");
  const buybackPrice = numberValue(formData, "buyback_price");
  const repairCost = numberValue(formData, "repair_cost_amount");
  const fees = numberValue(formData, "fees_amount");
  const notes = optionalValue(formData, "notes");

  if (listPrice !== undefined) input.list_price = listPrice;
  if (buybackPrice !== undefined) input.buyback_price = buybackPrice;
  if (repairCost !== undefined) input.repair_cost_amount = repairCost;
  if (fees !== undefined) input.fees_amount = fees;
  if (notes !== undefined) input.notes = notes;

  return input;
}

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value || undefined;
}

function numberValue(formData: FormData, key: string) {
  const value = optionalValue(formData, key);
  if (value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function statusToneClass(tone: (typeof inventoryStatusMeta)[InventoryItemStatus]["tone"]) {
  if (tone === "success")
    return "bg-status-success text-status-success-foreground ring-status-success-foreground/30";
  if (tone === "danger")
    return "bg-status-danger text-status-danger-foreground ring-status-danger-foreground/30";
  if (tone === "warning")
    return "bg-status-warn text-status-warn-foreground ring-status-warn-foreground/30";
  if (tone === "info")
    return "bg-status-info text-status-info-foreground ring-status-info-foreground/30";
  return "bg-status-neutral text-status-neutral-foreground ring-status-neutral-foreground/20";
}

function inventoryActionTextClass(tone: ReturnType<typeof getInventoryPrimaryAction>["tone"]) {
  if (tone === "success") return "text-status-success-foreground";
  if (tone === "danger") return "text-status-danger-foreground";
  if (tone === "warning") return "text-status-warn-foreground";
  if (tone === "info") return "text-primary";
  return "text-muted-foreground";
}

function inventoryActionBadgeClass(tone: ReturnType<typeof getInventoryPrimaryAction>["tone"]) {
  if (tone === "success") return "bg-status-success text-status-success-foreground";
  if (tone === "danger") return "bg-status-danger text-status-danger-foreground";
  if (tone === "warning") return "bg-status-warn text-status-warn-foreground";
  if (tone === "info") return "bg-status-info text-status-info-foreground";
  return "bg-status-neutral text-status-neutral-foreground";
}

function inventoryActionPanelClass(tone: ReturnType<typeof getInventoryPrimaryAction>["tone"]) {
  if (tone === "success") return "border-status-success/25 bg-status-success/10";
  if (tone === "danger") return "border-status-danger/25 bg-status-danger/10";
  if (tone === "warning") return "border-status-warn/25 bg-status-warn/10";
  if (tone === "info") return "border-status-info/25 bg-status-info/10";
  return "border-[var(--border-panel)] bg-[var(--surface-panel-muted)]";
}

function inventoryDenseInfoToneClass(tone: InventoryDenseInfoTone) {
  if (tone === "success") {
    return {
      frame: "border-status-success-foreground/20 bg-status-success/10",
      label: "text-status-success-foreground/80",
      value: "text-status-success-foreground",
    };
  }
  if (tone === "danger") {
    return {
      frame: "border-status-danger-foreground/20 bg-status-danger/10",
      label: "text-status-danger-foreground/80",
      value: "text-status-danger-foreground",
    };
  }
  if (tone === "warning") {
    return {
      frame: "border-status-warn-foreground/20 bg-status-warn/15",
      label: "text-status-warn-foreground/80",
      value: "text-status-warn-foreground",
    };
  }
  if (tone === "info") {
    return {
      frame: "border-status-info-foreground/20 bg-status-info/10",
      label: "text-status-info-foreground/80",
      value: "text-status-info-foreground",
    };
  }
  return {
    frame: "border-[var(--border-panel)] bg-[var(--surface-panel)]",
    label: "text-muted-foreground",
    value: "text-foreground",
  };
}

function inventoryAppToneClass(tone: InventoryDenseInfoTone) {
  if (tone === "success") {
    return {
      frame: "border-status-success-foreground/20 bg-status-success/10",
      iconFrame: "bg-status-success text-status-success-foreground",
      icon: "text-status-success-foreground",
      label: "text-status-success-foreground/80",
      pill: "bg-status-success text-status-success-foreground",
    };
  }
  if (tone === "danger") {
    return {
      frame: "border-status-danger-foreground/20 bg-status-danger/10",
      iconFrame: "bg-status-danger text-status-danger-foreground",
      icon: "text-status-danger-foreground",
      label: "text-status-danger-foreground/80",
      pill: "bg-status-danger text-status-danger-foreground",
    };
  }
  if (tone === "warning") {
    return {
      frame: "border-status-warn-foreground/20 bg-status-warn/15",
      iconFrame: "bg-status-warn text-status-warn-foreground",
      icon: "text-status-warn-foreground",
      label: "text-status-warn-foreground/80",
      pill: "bg-status-warn text-status-warn-foreground",
    };
  }
  if (tone === "info") {
    return {
      frame: "border-status-info-foreground/20 bg-status-info/10",
      iconFrame: "bg-status-info text-status-info-foreground",
      icon: "text-status-info-foreground",
      label: "text-status-info-foreground/80",
      pill: "bg-status-info text-status-info-foreground",
    };
  }
  return {
    frame: "border-[var(--border-panel)] bg-card",
    iconFrame: "bg-[var(--surface-panel-muted)] text-muted-foreground",
    icon: "text-muted-foreground",
    label: "text-muted-foreground",
    pill: "bg-[var(--surface-panel-muted)] text-muted-foreground",
  };
}

function inventoryGradeTone(value?: string): InventoryDenseInfoTone {
  if (["new", "mint", "good", "passed"].includes(value || "")) return "success";
  if (["fair", "untested", "unknown"].includes(value || "")) return "warning";
  if (["poor", "needs_repair"].includes(value || "")) return "warning";
  if (["failed", "for_parts"].includes(value || "")) return "danger";
  return "neutral";
}

function inventoryCheckTone(value?: string): InventoryDenseInfoTone {
  if (value === "pass") return "success";
  if (value === "fail") return "danger";
  if (value === "unknown" || value === "unchecked") return "warning";
  return "neutral";
}

function inventoryBatteryTone(value?: number | null): InventoryDenseInfoTone {
  if (value == null) return "warning";
  if (value >= 85) return "success";
  if (value >= 70) return "info";
  return "warning";
}

function isInventoryDialogActionKind(
  actionKind: InventoryPrimaryActionKind,
): actionKind is Exclude<InventoryPrimaryActionKind, "view"> {
  return actionKind !== "view";
}

function buybackSummaryToneClass(tone: InventoryBuybackSummary["statusTone"]) {
  if (tone === "success") return "bg-status-success text-status-success-foreground";
  if (tone === "danger") return "bg-status-danger text-status-danger-foreground";
  if (tone === "warning") return "bg-status-warn text-status-warn-foreground";
  if (tone === "info") return "bg-status-info text-status-info-foreground";
  return "bg-status-neutral text-status-neutral-foreground";
}

function repairPriorityLabel(priority: InventoryBuybackSummary["repairRows"][number]["priority"]) {
  if (priority === "high") return "高";
  if (priority === "low") return "低";
  return "中";
}

function repairPriorityClass(priority: InventoryBuybackSummary["repairRows"][number]["priority"]) {
  if (priority === "high") return "text-status-danger-foreground";
  if (priority === "low") return "text-muted-foreground";
  return "text-status-warn-foreground";
}

function gradeLabel(value?: string) {
  const labels: Record<string, string> = {
    unknown: "未定",
    new: "全新",
    mint: "近新",
    good: "良好",
    fair: "一般",
    poor: "差",
    for_parts: "配件机",
    untested: "未测",
    passed: "通过",
    needs_repair: "需维修",
    failed: "不通过",
  };
  return labels[value || "unknown"] ?? value ?? "-";
}

function inventorySourceLabel(value?: string) {
  const labels: Record<string, string> = {
    manual_stock: "直接库存",
    supplier_purchase: "供应商采购",
    repair_resale: "维修翻新转售",
    buyback: "客户回收",
    seatable_electronics: "SeaTable 导入",
  };
  return labels[value || ""] ?? value ?? "未知来源";
}

function checkLabel(value?: string) {
  const labels: Record<string, string> = {
    unchecked: "未检查",
    pass: "通过",
    fail: "不通过",
    unknown: "未知",
  };
  return labels[value || "unchecked"] ?? value ?? "-";
}

function inventoryAttachmentKindLabel(value: string) {
  const labels: Record<string, string> = {
    device_photo: "设备照片",
    id_front: "证件正面",
    id_back: "证件反面",
    signature: "客户签名",
    invoice_photo: "发票/无票确认",
    box_photo: "原装盒/无盒确认",
    other: "其他附件",
  };
  return labels[value] ?? value;
}

function eventLabel(value: string) {
  const labels: Record<string, string> = {
    created: "创建",
    updated: "更新",
    status_changed: "状态推进",
    quality_checked: "检测记录",
    attachment_uploaded: "附件上传",
    transaction: "财务流水",
    sold: "售出",
    imported: "导入",
  };
  return labels[value] ?? value;
}

function inventoryTransactionTypeLabel(value: string) {
  const labels: Record<string, string> = {
    buyback_payment: "回收付款",
    sale_payment: "售出收款",
    refund: "退款",
    repair_cost: "维修成本",
    fee: "其他费用",
    adjustment: "成本调整",
  };
  return labels[value] ?? value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
