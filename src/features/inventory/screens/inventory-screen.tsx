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
  FileUp,
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
  RepairOsChipRow,
  RepairOsHeaderActionButton,
  RepairOsListScaffold,
  RepairOsModuleHeader,
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
import { fadeUp, stagger } from "@/lib/motion";
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
const inventoryDialogContentClass = "gap-0 !overflow-hidden p-0 [display:flex] flex-col";
const inventoryDialogHeaderClass = "shrink-0 px-3 pt-3 sm:px-4 sm:pt-4";
const inventoryDialogBodyClass = "min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4";
const inventoryDialogFooterClass = cn(
  componentOverlay.footer,
  "shrink-0 border-t border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] px-3 py-3 sm:px-4",
);
type InventoryActionMode = Exclude<InventoryPrimaryActionKind, "view"> | "import";
const inventoryDetailActions = [
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
      desktopHeader={
        <motion.div
          variants={stagger(0.05)}
          initial="hidden"
          animate="show"
          className="mb-3 space-y-3 sm:mb-5 sm:space-y-4"
        >
          <motion.div variants={fadeUp}>
            <RepairOsModuleHeader
              action={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-9 gap-2"
                    onClick={() => setAction("import")}
                  >
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
            />
          </motion.div>

          <motion.div variants={fadeUp} className={dataDisplay.kpiGrid}>
            <InventoryKpi
              icon={Layers3}
              label="库存总数"
              value={statsLoading ? "-" : (stats?.total ?? 0)}
            />
            <InventoryKpi
              icon={ClipboardCheck}
              label="检测/整备中"
              value={stats?.inPipeline ?? 0}
            />
            <InventoryKpi
              icon={ShoppingBag}
              label="待售/售卖中"
              value={stats?.readyOrListed ?? 0}
            />
            <InventoryKpi
              icon={TrendingUp}
              label="已实现利润"
              value={<MoneyText amount={stats?.realizedProfit ?? 0} />}
            />
          </motion.div>
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
    <article
      className={cn(
        repairOs.businessCardDense,
        "w-full text-left transition-transform active:scale-[0.99]",
      )}
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
    </article>
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
          componentOverlay.responsiveContent,
          "gap-3 p-3 sm:p-4 lg:w-[min(1180px,calc(100vw-32px))]",
        )}
      >
        <DialogHeader className={componentOverlay.header}>
          <DialogTitle className={componentOverlay.title}>
            {data?.item.public_no ?? "库存详情"}
          </DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            {data?.item.item_label ?? "读取商品检测、财务和时间线"}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
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
    <div className="space-y-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <InventoryStatusBadge status={item.status} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 gap-1.5 px-2 text-xs"
              aria-label="更多库存操作"
            >
              <MoreHorizontal className="size-3.5" />
              更多操作
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

      <div
        className={cn(
          "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
          inventoryActionPanelClass(primaryAction.tone),
        )}
      >
        <ArrowRight className="size-3.5 shrink-0 text-primary" />
        <div className="min-w-0">
          <span className="block truncate font-medium text-foreground">{primaryAction.label}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {primaryAction.detail}
          </span>
        </div>
        {!primaryDialogAction ? (
          <span
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
              inventoryActionBadgeClass(primaryAction.tone),
            )}
          >
            {primaryAction.actionLabel}
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 shrink-0 rounded-md px-1.5 text-[11px] font-medium",
              inventoryActionBadgeClass(primaryAction.tone),
            )}
            onClick={() => onAction(item, primaryDialogAction)}
          >
            {primaryAction.actionLabel}
          </Button>
        )}
      </div>

      {buybackSummary ? <InventoryBuybackSection summary={buybackSummary} /> : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <InfoBox label="回收价" value={<MoneyText amount={item.buyback_price} />} />
        <InfoBox label="维修成本" value={<MoneyText amount={repairCost} />} />
        <InfoBox label="其他费用" value={<MoneyText amount={fees} />} />
        <InfoBox label="成本价" value={<MoneyText amount={costBasis} />} />
        <InfoBox label="挂牌价" value={<MoneyText amount={item.list_price} />} />
        <InfoBox label="利润" value={<MoneyText amount={item.profit} />} />
      </div>

      <InventoryTransactionsSection transactions={data.transactions} />

      <div className="grid gap-2 md:grid-cols-2">
        <section className={componentOverlay.flatSection}>
          <h3 className="mb-2 text-sm font-semibold">商品</h3>
          <InfoGrid
            rows={[
              ["类别", item.category],
              ["品牌型号", item.item_label],
              ["颜色/容量", [item.color, item.storage_capacity].filter(Boolean).join(" / ") || "-"],
              ["IMEI/序列号", item.serial_or_imei || "-"],
              ["备注", item.notes || "-"],
            ]}
          />
        </section>
        <section className={componentOverlay.flatSection}>
          <h3 className="mb-2 text-sm font-semibold">检测</h3>
          <InfoGrid
            rows={[
              ["外观", gradeLabel(item.cosmetic_grade)],
              ["功能", gradeLabel(item.functional_grade)],
              ["电池", item.battery_health === undefined ? "-" : `${item.battery_health}%`],
              ["IMEI", checkLabel(item.imei_check_status)],
              ["激活锁", checkLabel(item.activation_lock_status)],
              ["资料清除", checkLabel(item.data_wipe_status)],
            ]}
          />
        </section>
      </div>

      <section className={componentOverlay.flatSection}>
        <h3 className="mb-2 text-sm font-semibold">附件凭证</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {data.attachments.map((attachment) => {
            const content = (
              <>
                <span className="truncate text-sm font-medium">
                  {inventoryAttachmentKindLabel(attachment.kind)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
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
            <p className="text-sm text-muted-foreground">暂无附件凭证。</p>
          ) : null}
        </div>
      </section>

      <section className={componentOverlay.flatSection}>
        <h3 className="mb-2 text-sm font-semibold">时间线</h3>
        <div className="space-y-2">
          {data.events.slice(0, 8).map((event) => (
            <div
              key={event.id}
              className="flex min-w-0 gap-3 border-b border-border/30 pb-2 last:border-0"
            >
              <div className="mt-1 size-2 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {eventLabel(event.event_type)}
                  {event.to_status ? ` · ${inventoryStatusMeta[event.to_status].label}` : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  {event.operator_name} · {formatDateTime(event.created_at)}
                </div>
              </div>
            </div>
          ))}
          {data.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无时间线记录。</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function InventoryBuybackSection({ summary }: { summary: InventoryBuybackSummary }) {
  const missingProof = summary.proofRows.filter((row) => !row.done);

  return (
    <section className={componentOverlay.flatSection}>
      <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">回收来源</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{summary.statusDetail}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
            buybackSummaryToneClass(summary.statusTone),
          )}
        >
          {summary.statusLabel}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <InfoBox label="成交报价" value={<MoneyText amount={summary.offer} />} />
        <InfoBox label="实际回收" value={<MoneyText amount={summary.purchaseCost} />} />
        <InfoBox label="维修预估" value={<MoneyText amount={summary.repairCost} />} />
        <InfoBox label="成本价" value={<MoneyText amount={summary.costBasis} />} />
        <InfoBox label="凭证进度" value={`${summary.proofDone}/${summary.proofTotal}`} />
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
        <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-2">
          <div className="mb-1 text-[11px] font-semibold text-muted-foreground">维修计划</div>
          <p className="text-xs font-medium">{summary.repairIssueSummary}</p>
          {summary.repairRows.length ? (
            <div className="mt-1.5 grid gap-1">
              {summary.repairRows.slice(0, 4).map((row) => (
                <div
                  key={row.key}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_42px] gap-2 rounded-md bg-card px-2 py-1"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{row.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{row.detail}</p>
                  </div>
                  <span
                    className={cn(
                      "self-start text-right text-[10px]",
                      repairPriorityClass(row.priority),
                    )}
                  >
                    {repairPriorityLabel(row.priority)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              维修后可在库存成本里补录实际维修费用。
            </p>
          )}
        </div>
        <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-2">
          <div className="mb-1 text-[11px] font-semibold text-muted-foreground">成本组成</div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">回收</span>
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

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <InfoBox
          label="报价有效期"
          value={summary.quoteExpiresAt ? formatDateTime(summary.quoteExpiresAt) : "-"}
        />
        <InfoBox label="其他费用" value={<MoneyText amount={summary.fees} />} />
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-2">
          <div className="mb-1 text-[11px] font-semibold text-muted-foreground">凭证状态</div>
          <div className="grid gap-1 sm:grid-cols-2">
            {summary.proofRows.map((row) => (
              <div key={row.key} className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-xs">{row.label}</span>
                <span
                  className={cn(
                    "shrink-0 text-[11px] font-medium",
                    row.done ? "text-status-success-foreground" : "text-status-warn-foreground",
                  )}
                >
                  {row.done ? "已齐" : "待补"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-2">
          <div className="mb-1 text-[11px] font-semibold text-muted-foreground">风险 / 扣减</div>
          {summary.deductions.length ? (
            <div className="space-y-1">
              {summary.deductions.slice(0, 3).map((row) => (
                <div
                  key={`${row.label}-${row.amount}`}
                  className="flex min-w-0 items-center justify-between gap-2 text-xs"
                >
                  <span className="truncate">{row.label}</span>
                  <span className="font-mono font-semibold text-status-danger-foreground">
                    -€{row.amount.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          ) : summary.riskNotes.length ? (
            <div className="space-y-1">
              {summary.riskNotes.slice(0, 3).map((note) => (
                <p key={note} className="truncate text-xs text-status-warn-foreground">
                  {note}
                </p>
              ))}
            </div>
          ) : missingProof.length ? (
            <p className="text-xs text-status-warn-foreground">
              还缺 {missingProof.map((row) => row.label).join("、")}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">暂无风险或扣减记录。</p>
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
    <section className={componentOverlay.flatSection}>
      <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">财务流水</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            回收付款、维修成本、费用和售出收入都会计入库存成本。
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-[var(--surface-panel-muted)] px-1.5 py-0.5 font-mono text-[11px] font-semibold">
          {transactions.length}
        </span>
      </div>

      {transactions.length ? (
        <div className="grid gap-1.5 lg:grid-cols-2">
          {transactions.slice(0, 8).map((transaction) => {
            const isCost = ["buyback_payment", "repair_cost", "fee", "refund"].includes(
              transaction.transaction_type,
            );

            return (
              <div
                key={transaction.id}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">
                    {inventoryTransactionTypeLabel(transaction.transaction_type)}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {transaction.method || "未记录方式"} · {formatDateTime(transaction.created_at)}
                  </p>
                  {transaction.note ? (
                    <p className="truncate text-[11px] text-muted-foreground">{transaction.note}</p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "shrink-0 font-mono text-xs font-semibold tabular-nums",
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
        <p className="rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-2 text-xs text-muted-foreground">
          暂无财务流水。回收成交、登记维修成本或售出后会自动显示在这里。
        </p>
      )}
    </section>
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
            title="补齐价格"
            description={currentItem.item_label}
            onSubmit={handleUpdate}
            footer={
              <Button type="submit" disabled={updateMutation.isPending}>
                保存价格
              </Button>
            }
          >
            <div className={compactInventoryGrid}>
              <Field
                name="list_price"
                label="挂牌价"
                type="number"
                step="0.01"
                defaultValue={currentItem.list_price ? String(currentItem.list_price) : ""}
                required
              />
              <Field
                name="buyback_price"
                label="回收价"
                type="number"
                step="0.01"
                defaultValue={currentItem.buyback_price ? String(currentItem.buyback_price) : ""}
              />
              <Field
                name="repair_cost_amount"
                label="整备成本"
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
            </div>
            <TextAreaField name="notes" label="价格备注" />
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
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof importElectronicsCsvPreview>>>();
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
          {preview ? (
            <div className={cn(componentOverlay.flatSection, "text-sm")}>
              <div>
                识别 {preview.report.itemCount} 台，客户 {preview.report.customerCount} 个，流水{" "}
                {preview.report.transactionCount} 条。
              </div>
              <div className="mt-1 text-muted-foreground">
                回收合计 <MoneyText amount={preview.report.totalBuyback} />
                ，售价合计{" "}
                <MoneyText
                  amount={preview.report.totalSalePrice || preview.report.totalListPrice}
                />
                。
              </div>
            </div>
          ) : null}
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
    <div className="glass-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
            {label}
          </div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</div>
        </div>
        <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
      </div>
    </div>
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
    <div
      className={cn(
        compact
          ? "flex min-w-0 flex-col items-center justify-center rounded-lg border border-status-danger-foreground/20 bg-status-danger/20 p-4 text-center"
          : surfaces.empty,
      )}
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
    </div>
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
    <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-status-danger-foreground/20 bg-status-danger/20 px-3 py-2 text-xs text-status-danger-foreground">
      <div className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">{message}</span>
      </div>
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
    </div>
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

function InfoBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function InfoGrid({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-1.5 text-xs sm:text-sm">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[76px_minmax(0,1fr)] gap-2 sm:grid-cols-[88px_minmax(0,1fr)]"
        >
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
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
