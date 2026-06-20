"use client";

import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  DatabaseZap,
  Edit3,
  FileUp,
  Inbox,
  Layers3,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { MoneyText, PhoneText } from "@/components/orders/badges";
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
import {
  RepairOsBusinessCard,
  RepairOsChipRow,
  RepairOsHeaderActionButton,
  RepairOsInfoGrid,
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
import {
  applyElectronicsCsvImport,
  createInventoryIntake,
  getInventoryItem,
  getInventoryStats,
  importElectronicsCsvPreview,
  listInventoryItems,
  recordInventoryCheck,
  sellInventoryItem,
  transitionInventoryItem,
  updateInventoryItem,
  type CreateInventoryIntakeInput,
  type InventoryDetail,
  type InventoryItemStatus,
  type InventoryListItem,
  type InventoryQualityCheckInput,
  type SellInventoryItemInput,
  type UpdateInventoryItemInput,
} from "@/lib/repairdesk/api";
import { componentOverlay } from "@/lib/component-patterns";
import { fadeUp } from "@/lib/motion";
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
type InventoryActionMode = Exclude<InventoryPrimaryActionKind, "view"> | "import";
type ElectronicsImportPreviewResult = Awaited<ReturnType<typeof importElectronicsCsvPreview>>;
const inventoryDetailActions = [
  { mode: "update", label: "编辑价格/成本" },
  { mode: "transition", label: "推进状态" },
  { mode: "check", label: "登记检测" },
  { mode: "sell", label: "售出" },
] as const satisfies ReadonlyArray<{
  mode: Exclude<InventoryActionMode, "import">;
  label: string;
}>;

export function InventoryScreen() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<InventoryListViewKey>("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [actionItem, setActionItem] = useState<InventoryListItem>();
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [action, setAction] = useState<InventoryActionMode | null>(null);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
    }),
    [search],
  );

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: inventoryKeys.stats(),
    queryFn: getInventoryStats,
  });
  const {
    data: items = [],
    error: itemsError,
    isError: isItemsError,
    isFetching: isItemsFetching,
    isLoading,
    refetch: refetchItems,
  } = useQuery({
    queryKey: inventoryKeys.list(filters),
    queryFn: () => listInventoryItems(filters),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const visibleItems = useMemo(() => filterInventoryItemsByView(items, view), [items, view]);
  const listViews = useMemo(() => buildInventoryListViews(items), [items]);
  const selectedItem = items.find((item) => item.id === selectedId);
  const activeViewLabel = getInventoryListViewLabel(view);
  const hasSearch = Boolean(search.trim());
  const itemsErrorMessage = getErrorMessage(itemsError, "库存列表加载失败");

  useEffect(() => {
    if (searchParams.get("new") === "1") setIntakeOpen(true);
  }, [searchParams]);

  useEffect(() => {
    const query = searchParams.get("q");
    if (query) setSearch(query);
  }, [searchParams]);

  useEffect(() => {
    const focusedItemId = searchParams.get("item");
    if (!focusedItemId) return;
    if (items.some((item) => item.id === focusedItemId)) setSelectedId(focusedItemId);
  }, [items, searchParams]);

  function invalidate(id?: string) {
    queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    if (id) queryClient.invalidateQueries({ queryKey: inventoryKeys.detail(id) });
  }

  function openActionForItem(
    item: InventoryListItem,
    mode: Exclude<InventoryActionMode, "import">,
  ) {
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

  return (
    <RepairOsListScaffold
      title="库存商品"
      subtitle={`${activeViewLabel} · 共 ${
        view === "all" && !hasSearch ? (stats?.total ?? visibleItems.length) : visibleItems.length
      } 件`}
      eyebrow="工作台 / 库存"
      action={
        <RepairOsHeaderActionButton ariaLabel="新增入库" onClick={() => setIntakeOpen(true)}>
          <Plus className="size-4" />
        </RepairOsHeaderActionButton>
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="搜索编号、客户、型号、IMEI"
      filterAction={
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 rounded-xl bg-card"
          aria-label="导入库存"
          onClick={() => setAction("import")}
        >
          <FileUp className="size-3.5" />
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
            onClick={() => setIntakeOpen(true)}
          >
            <Plus className="size-4" /> 新增入库
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
          <InventoryKpi
            icon={TrendingUp}
            label="已实现利润"
            value={<MoneyText amount={stats?.realizedProfit ?? 0} />}
          />
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
        </div>
        <RepairOsChipRow
          chips={listViews.map((item) => ({
            label: item.label,
            active: view === item.key,
            onClick: () => setView(item.key),
          }))}
        />
      </section>

      {isItemsError && items.length > 0 ? (
        <InventoryInlineError
          message={`库存列表刷新失败：${itemsErrorMessage}`}
          isRetrying={isItemsFetching}
          onRetry={() => {
            void refetchItems();
          }}
        />
      ) : null}

      {isItemsError && items.length === 0 ? (
        <InventoryLoadError
          message={itemsErrorMessage}
          isRetrying={isItemsFetching}
          onRetry={() => {
            void refetchItems();
          }}
        />
      ) : isLoading ? (
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

      <IntakeDialog
        open={intakeOpen}
        onOpenChange={setIntakeOpen}
        onDone={(id) => {
          invalidate(id);
          setSelectedId(id);
        }}
      />
      <InventoryDetailDialog
        id={selectedId}
        onOpenChange={(open) => !open && setSelectedId(undefined)}
        onAction={openActionForItem}
      />
      <InventoryActionDialog
        action={action}
        item={actionItem ?? selectedItem}
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
  const costBasis =
    buybackSummary?.costBasis ?? item.buyback_price + item.repair_cost_amount + item.fees_amount;
  const repairCost = buybackSummary?.repairCost ?? item.repair_cost_amount;

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
        <div className="font-mono font-medium">
          <MoneyText amount={item.buyback_price} />
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          维修 <MoneyText amount={repairCost} /> · 成本 <MoneyText amount={costBasis} />
        </div>
      </TableCell>
      <TableCell className="text-right">
        <MoneyText amount={item.sale_price || item.list_price} />
      </TableCell>
      <TableCell className="text-right">
        <MoneyText
          amount={item.profit}
          className={
            item.profit >= 0 ? "text-status-success-foreground" : "text-status-danger-foreground"
          }
        />
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
  const costBasis =
    buybackSummary?.costBasis ?? item.buyback_price + item.repair_cost_amount + item.fees_amount;

  return (
    <RepairOsBusinessCard
      className={cn(
        repairOs.businessCardDense,
        "w-full text-left transition-transform active:scale-[0.99]",
      )}
      trailing={
        <div className="flex min-w-[4.75rem] flex-col items-end text-right text-xs">
          <MoneyText
            amount={item.sale_price || item.list_price || item.buyback_price}
            className={repairOs.cardAmount}
          />
          <div className="mt-1 text-[11px] text-muted-foreground">
            电池 {item.battery_health ?? "-"}%
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            成本 <MoneyText amount={costBasis} />
          </div>
          <div
            className={cn(
              "mt-1 text-[11px]",
              item.profit >= 0 ? "text-status-success-foreground" : "text-status-danger-foreground",
            )}
          >
            利润 <MoneyText amount={item.profit} />
          </div>
          <button
            type="button"
            className={cn(
              "mt-1 max-w-20 truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium",
              inventoryActionBadgeClass(primaryAction.tone),
            )}
            onClick={onPrimaryAction}
          >
            {primaryAction.actionLabel}
          </button>
        </div>
      }
    >
      <button type="button" className="block w-full min-w-0 text-left" onClick={onSelect}>
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
  onOpenChange,
  onAction,
}: {
  id?: string;
  onOpenChange: (open: boolean) => void;
  onAction: (item: InventoryListItem, action: Exclude<InventoryActionMode, "import">) => void;
}) {
  const { data, error, isError, isFetching, isLoading, refetch } = useQuery({
    queryKey: id ? inventoryKeys.detail(id) : inventoryKeys.detail(""),
    queryFn: () => getInventoryItem(id || ""),
    enabled: Boolean(id),
    retry: 1,
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
  onAction: (item: InventoryListItem, action: Exclude<InventoryActionMode, "import">) => void;
}) {
  const item = data.item;
  const primaryAction = getInventoryPrimaryAction(item);
  const primaryDialogAction = isInventoryDialogActionKind(primaryAction.actionKind)
    ? primaryAction.actionKind
    : undefined;
  const secondaryActions = inventoryDetailActions.filter(
    (action) => action.mode !== primaryDialogAction,
  );
  const buybackSummary = buildInventoryBuybackSummary(item);
  const costBasis =
    buybackSummary?.costBasis ?? item.buyback_price + item.repair_cost_amount + item.fees_amount;
  const repairCost = buybackSummary?.repairCost ?? item.repair_cost_amount;
  const fees = buybackSummary?.fees ?? item.fees_amount;

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
                headingLevel={3}
                className="mb-1.5"
                titleClassName="text-xs"
              />
              <RepairOsInfoGrid
                rows={[
                  { label: "类别", value: item.category },
                  { label: "品牌型号", value: item.item_label },
                  {
                    label: "颜色/容量",
                    value: [item.color, item.storage_capacity].filter(Boolean).join(" / ") || "-",
                  },
                  { label: "IMEI/序列号", value: item.serial_or_imei || "-" },
                  {
                    label: "备注",
                    value: item.notes || "-",
                    valueClassName: "line-clamp-4 text-[10px] font-normal leading-4",
                  },
                ]}
              />
            </section>
            <section className={cn(componentOverlay.flatSection, "p-2")}>
              <RepairOsSectionHeader
                title="检测"
                headingLevel={3}
                className="mb-1.5"
                titleClassName="text-xs"
              />
              <RepairOsInfoGrid
                rows={[
                  { label: "外观", value: gradeLabel(item.cosmetic_grade) },
                  { label: "功能", value: gradeLabel(item.functional_grade) },
                  {
                    label: "电池",
                    value: item.battery_health === undefined ? "-" : `${item.battery_health}%`,
                  },
                  { label: "IMEI", value: checkLabel(item.imei_check_status) },
                  { label: "激活锁", value: checkLabel(item.activation_lock_status) },
                  { label: "资料清除", value: checkLabel(item.data_wipe_status) },
                ]}
              />
            </section>
          </div>

          <section className={cn(componentOverlay.flatSection, "p-2")}>
            <RepairOsSectionHeader
              title="附件凭证"
              headingLevel={3}
              className="mb-1.5"
              titleClassName="text-xs"
            />
            <div className="grid gap-1.5 sm:grid-cols-2">
              {data.attachments.map((attachment) => {
                const content = (
                  <>
                    <span className="truncate text-xs font-medium">
                      {inventoryAttachmentKindLabel(attachment.kind)}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground">
                      {attachment.file_name} · {formatDateTime(attachment.created_at)}
                    </span>
                  </>
                );
                return attachment.signed_url ? (
                  <a
                    key={attachment.id}
                    href={attachment.signed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 flex-col rounded-lg border border-[var(--border-panel)] bg-card px-2 py-1.5"
                  >
                    {content}
                  </a>
                ) : (
                  <div
                    key={attachment.id}
                    className="flex min-w-0 flex-col rounded-lg border border-[var(--border-panel)] bg-card px-2 py-1.5"
                  >
                    {content}
                  </div>
                );
              })}
              {data.attachments.length === 0 ? (
                <InventoryDetailEmptyLine className="sm:col-span-2">
                  暂无附件凭证。
                </InventoryDetailEmptyLine>
              ) : null}
            </div>
          </section>
        </main>

        <aside className="min-w-0 space-y-2">
          <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-2">
            <InventoryInfoBox label="回收价" value={<MoneyText amount={item.buyback_price} />} />
            <InventoryInfoBox label="维修成本" value={<MoneyText amount={repairCost} />} />
            <InventoryInfoBox label="其他费用" value={<MoneyText amount={fees} />} />
            <InventoryInfoBox label="成本价" value={<MoneyText amount={costBasis} />} />
            <InventoryInfoBox label="挂牌价" value={<MoneyText amount={item.list_price} />} />
            <InventoryInfoBox label="利润" value={<MoneyText amount={item.profit} />} />
          </div>

          <InventoryTransactionsSection transactions={data.transactions} />

          <section className={cn(componentOverlay.flatSection, "p-2")}>
            <RepairOsSectionHeader
              title="时间线"
              headingLevel={3}
              className="mb-1.5"
              titleClassName="text-xs"
            />
            <div className="space-y-1.5">
              {data.events.slice(0, 8).map((event) => (
                <div
                  key={event.id}
                  className="grid min-w-0 grid-cols-[8px_minmax(0,1fr)] gap-2 border-b border-border/30 pb-1.5 last:border-0"
                >
                  <div className="mt-1.5 size-1.5 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">
                      {eventLabel(event.event_type)}
                      {event.to_status ? ` · ${inventoryStatusMeta[event.to_status].label}` : ""}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {event.operator_name} · {formatDateTime(event.created_at)}
                    </div>
                  </div>
                </div>
              ))}
              {data.events.length === 0 ? (
                <InventoryDetailEmptyLine>暂无时间线记录。</InventoryDetailEmptyLine>
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
            <span className="text-[10px] font-semibold text-muted-foreground">凭证</span>
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
          <div className="grid grid-cols-2 gap-x-1 gap-y-0.5">
            {summary.proofRows.map((row) => (
              <div key={row.key} className="flex min-w-0 items-center justify-between gap-1">
                <span className="truncate text-[10px] leading-3">{row.label}</span>
                <span
                  className={cn(
                    "shrink-0 rounded px-1 text-[9px] font-medium leading-3",
                    row.done
                      ? "bg-status-success text-status-success-foreground"
                      : "bg-status-warn text-status-warn-foreground",
                  )}
                >
                  {row.done ? "已齐" : "待补"}
                </span>
              </div>
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

function InventoryTransactionsSection({
  transactions,
}: {
  transactions: InventoryDetail["transactions"];
}) {
  return (
    <section className={cn(componentOverlay.flatSection, "p-2")}>
      <RepairOsSectionHeader
        title="财务流水"
        description="回收付款、维修成本、费用和售出收入都会计入库存成本。"
        headingLevel={3}
        className="mb-1.5 items-start"
        titleClassName="text-xs"
        descriptionClassName="mt-0.5 text-[10px]"
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

            return (
              <div
                key={transaction.id}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium">
                    {inventoryTransactionTypeLabel(transaction.transaction_type)}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {transaction.method || "未记录方式"} · {formatDateTime(transaction.created_at)}
                  </p>
                  {transaction.note ? (
                    <p className="truncate text-[10px] text-muted-foreground">{transaction.note}</p>
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

function IntakeDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (id: string) => void;
}) {
  const mutation = useMutation({
    mutationFn: createInventoryIntake,
    onSuccess: ({ id }) => {
      toast.success("已创建库存记录");
      onDone(id);
      onOpenChange(false);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(intakeInput(new FormData(event.currentTarget)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(componentOverlay.formContent, inventoryDialogContentClass)}>
        <form className="flex max-h-[calc(100svh-24px)] min-h-0 flex-col" onSubmit={handleSubmit}>
          <DialogHeader className={cn(componentOverlay.header, inventoryDialogHeaderClass)}>
            <DialogTitle className={componentOverlay.title}>新增入库</DialogTitle>
            <DialogDescription className={componentOverlay.description}>
              登记客户交来的设备，后续检测、清除、上架和售出都会进入时间线。
            </DialogDescription>
          </DialogHeader>
          <div className={cn(inventoryDialogBodyClass, "space-y-3")}>
            <div className={compactInventoryGrid}>
              <Field name="customer_name" label="客户姓名" required />
              <Field name="customer_phone" label="客户电话" required />
              <Field name="brand" label="品牌" required />
              <Field name="model" label="型号" required />
              <Field name="category" label="类别" defaultValue="phone" />
              <Field name="color" label="颜色" />
              <Field name="storage_capacity" label="容量" />
              <Field name="serial_or_imei" label="IMEI/序列号" />
              <Field name="buyback_price" label="回收价" type="number" step="0.01" />
              <Field name="list_price" label="预估挂牌价" type="number" step="0.01" />
              <Field name="payment_method" label="付款方式" />
            </div>
            <div className={formLayout.field}>
              <Label htmlFor="notes">备注</Label>
              <Textarea id="notes" name="notes" className={compactInventoryTextareaClass} />
            </div>
          </div>
          <DialogFooter className={inventoryDialogFooterClass}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending}
              className={cn("h-8", controls.brandButton)}
              style={brandGradientStyle}
            >
              创建
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InventoryActionDialog({
  action,
  item,
  onOpenChange,
  onDone,
}: {
  action: InventoryActionMode | null;
  item?: InventoryListItem;
  onOpenChange: (open: boolean) => void;
  onDone: (id?: string) => void;
}) {
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

  if (action === "import") {
    return <ImportDialog open onOpenChange={onOpenChange} onDone={() => onDone()} />;
  }

  if (!item || !action) return null;

  const currentItem = item;
  const currentCostBasis =
    currentItem.buyback_price + currentItem.repair_cost_amount + currentItem.fees_amount;
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
    checkMutation.mutate({ id: currentItem.id, input: checkInput(formData) });
  }

  function handleSell(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    sellMutation.mutate({ id: currentItem.id, input: sellInput(formData) });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={cn(componentOverlay.formContent, inventoryDialogContentClass)}>
        {action === "update" ? (
          <ActionForm
            title="编辑价格 / 成本"
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
                保存价格/成本
              </Button>
            }
          >
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
            <div className={compactInventoryGrid}>
              <Field
                name="buyback_price"
                label="回收实付"
                type="number"
                step="0.01"
                defaultValue={currentItem.buyback_price ? String(currentItem.buyback_price) : ""}
              />
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
              <Button type="submit" disabled={sellMutation.isPending}>
                确认售出
              </Button>
            }
          >
            <div className={compactInventoryGrid}>
              <Field name="buyer_name" label="买家姓名" />
              <Field name="buyer_phone" label="买家电话" />
              <Field
                name="sale_price"
                label="成交价"
                type="number"
                step="0.01"
                defaultValue={String(currentItem.list_price || currentItem.sale_price || 0)}
                required
              />
              <Field name="payment_method" label="付款方式" />
              <Field name="sale_channel" label="售卖渠道" defaultValue="store" />
              <Field name="warranty_months" label="保修月数" type="number" defaultValue="12" />
            </div>
            <TextAreaField name="notes" label="售卖备注" />
          </ActionForm>
        ) : null}
      </DialogContent>
    </Dialog>
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

function InventoryInfoBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <RepairOsInfoTile
      label={label}
      value={value}
      frame="bordered"
      valueClassName="truncate font-mono text-[13px] font-semibold leading-4 tabular-nums"
    />
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

function Field(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string },
) {
  const { label, name, required, ...inputProps } = props;
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

function intakeInput(formData: FormData): CreateInventoryIntakeInput {
  return {
    customer_name: optionalValue(formData, "customer_name"),
    customer_phone: optionalValue(formData, "customer_phone"),
    category: optionalValue(formData, "category"),
    brand: textValue(formData, "brand"),
    model: textValue(formData, "model"),
    color: optionalValue(formData, "color"),
    storage_capacity: optionalValue(formData, "storage_capacity"),
    serial_or_imei: optionalValue(formData, "serial_or_imei"),
    buyback_price: numberValue(formData, "buyback_price"),
    list_price: numberValue(formData, "list_price"),
    payment_method: optionalValue(formData, "payment_method"),
    notes: optionalValue(formData, "notes"),
  };
}

function checkInput(formData: FormData): InventoryQualityCheckInput {
  return {
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

function isInventoryDialogActionKind(
  actionKind: InventoryPrimaryActionKind,
): actionKind is Exclude<InventoryActionMode, "import"> {
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
