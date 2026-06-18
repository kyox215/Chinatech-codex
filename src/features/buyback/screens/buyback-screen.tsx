"use client";

import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Battery,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Euro,
  FileText,
  Plus,
  Recycle,
  ScanLine,
  Search,
  Smartphone,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { MoneyText, PhoneText } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BuybackQuoteWorkspace } from "@/features/buyback/components/buyback-quote-workspace";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import { inventoryStatusMeta } from "@/features/inventory/model/inventory-workflow";
import { buildInventoryBuybackSummary } from "@/features/inventory/model/inventory-buyback-summary";
import {
  buildBuybackQuoteDraftFromInventoryItem,
  getBuybackBatteryBand,
  getBuybackQuoteOffer,
  getBuybackQuotePayload,
  getBuybackRiskLevel,
  type BuybackQuoteDraft,
} from "@/features/buyback/model/buyback-quote";
import {
  buildBuybackListViews,
  buildBuybackListSummary,
  filterBuybackItemsByView,
  getBuybackInventoryHandoff,
  getBuybackListViewLabel,
  getBuybackRecordProgress,
  getBuybackRecordPrimaryAction,
  getBuybackRecordReadiness,
  getBuybackRecordTaskGuidance,
  type BuybackListViewKey,
} from "@/features/buyback/model/buyback-record-workflow";
import { listInventoryItems, type InventoryListItem } from "@/lib/repairdesk/api";
import { componentOverlay } from "@/lib/component-patterns";
import { fadeUp, stagger } from "@/lib/motion";
import {
  RepairOsBadge,
  RepairOsBusinessCard,
  RepairOsChipRow,
  RepairOsHeaderActionButton,
  RepairOsListScaffold,
  RepairOsMetricStrip,
  RepairOsModuleHeader,
} from "@/shared/ui";
import { brandGradientStyle, controls, density, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const buybackScopeFilters = {
  sourceTypes: ["buyback"],
  categories: ["phone"],
};

export function BuybackScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteInitialDraft, setQuoteInitialDraft] = useState<BuybackQuoteDraft | null>(null);
  const [quoteTargetRecord, setQuoteTargetRecord] = useState<InventoryListItem | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<InventoryListItem | null>(null);
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<BuybackListViewKey>("all");

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setQuoteInitialDraft(null);
      setQuoteTargetRecord(null);
      setQuoteOpen(true);
    }
  }, [searchParams]);

  const filters = useMemo(
    () => ({
      ...buybackScopeFilters,
      search: search.trim() || undefined,
    }),
    [search],
  );

  const { data: allBuybackItems = [], isLoading: statsLoading } = useQuery({
    queryKey: inventoryKeys.list(buybackScopeFilters),
    queryFn: () => listInventoryItems(buybackScopeFilters),
  });
  const { data: items = [], isLoading } = useQuery({
    queryKey: inventoryKeys.list(filters),
    queryFn: () => listInventoryItems(filters),
  });

  const summary = useMemo(() => buildBuybackListSummary(allBuybackItems), [allBuybackItems]);
  const views = useMemo(() => buildBuybackListViews(allBuybackItems), [allBuybackItems]);
  const filteredItems = useMemo(
    () => filterBuybackItemsByView(items, activeView),
    [activeView, items],
  );
  const activeViewLabel = getBuybackListViewLabel(activeView);
  const handleQuoteOpenChange = (open: boolean) => {
    setQuoteOpen(open);
    if (!open && searchParams.get("new") === "1") {
      router.replace("/buyback", { scroll: false });
    }
    if (!open) {
      setQuoteInitialDraft(null);
      setQuoteTargetRecord(null);
    }
  };
  const handleCreateQuote = () => {
    setQuoteInitialDraft(null);
    setQuoteTargetRecord(null);
    setQuoteOpen(true);
  };
  const handleStartRecordFollowUp = (item: InventoryListItem) => {
    setQuoteInitialDraft(buildBuybackQuoteDraftFromInventoryItem(item));
    setQuoteTargetRecord(item);
    setSelectedRecord(null);
    setQuoteOpen(true);
  };
  const handleOpenInventoryRecord = (item: InventoryListItem) => {
    setSelectedRecord(null);
    const params = new URLSearchParams({ q: item.public_no, item: item.id });
    router.push(`/inventory?${params.toString()}`);
  };

  return (
    <motion.div variants={stagger()} initial="hidden" animate="show" className="contents">
      <RepairOsListScaffold
        title="回收管理"
        subtitle={`${activeViewLabel} · 共 ${filteredItems.length} 条`}
        action={
          <RepairOsHeaderActionButton ariaLabel="新建回收报价" onClick={handleCreateQuote}>
            <Plus className="size-4" />
          </RepairOsHeaderActionButton>
        }
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="搜索客户、设备、IMEI"
        filterAction={
          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded-xl bg-card"
            aria-label="扫码"
            onClick={() =>
              toast.info("回收扫码会接入快速查找 IMEI；当前请在报价向导中录入设备信息")
            }
          >
            <ScanLine className="size-3.5" />
          </Button>
        }
        chips={views.map((view) => ({
          key: view.key,
          label: view.label,
          shortLabel: view.shortLabel,
          count: view.count,
          active: activeView === view.key,
          onClick: () => setActiveView(view.key),
        }))}
        desktopHeader={
          <div className="mb-3 space-y-3 sm:mb-5 sm:space-y-4">
            <motion.div variants={fadeUp}>
              <RepairOsModuleHeader
                action={
                  <Button
                    size="sm"
                    className={cn("h-9 shrink-0 gap-1.5", controls.brandButton)}
                    style={brandGradientStyle}
                    onClick={handleCreateQuote}
                  >
                    <Plus className="size-4" />
                    回收报价
                  </Button>
                }
              />
            </motion.div>
            <motion.div variants={fadeUp}>
              <RepairOsMetricStrip
                metrics={[
                  {
                    label: "回收记录",
                    value: statsLoading ? "-" : summary.total,
                    hint: "iPhone 回收",
                    icon: Recycle,
                    tone: "blue",
                  },
                  {
                    label: "待检测",
                    value: summary.pendingCount,
                    hint: "收机/估价",
                    icon: ScanLine,
                    tone: "amber",
                  },
                  {
                    label: "已报价",
                    value: summary.quotedCount,
                    hint: "待客户确认",
                    icon: Euro,
                    tone: "green",
                  },
                ]}
              />
            </motion.div>
          </div>
        }
      >
        <motion.div
          variants={fadeUp}
          className={cn(repairOs.toolbar, "mb-3 hidden flex-col items-stretch gap-2 md:flex")}
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索客户 / 设备 / IMEI / 回收单号"
                className="h-8 border-0 bg-transparent pl-8 text-sm shadow-none focus-visible:ring-0 sm:h-9 sm:border-border/60 sm:bg-surface/60 sm:shadow-sm"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
              aria-label="扫码"
              onClick={() =>
                toast.info("回收扫码会接入快速查找 IMEI；当前请在报价向导中录入设备信息")
              }
            >
              <ScanLine className="size-4" />
            </Button>
          </div>
          <RepairOsChipRow
            chips={views.map((view) => ({
              label: `${view.label} ${view.count}`,
              active: activeView === view.key,
              onClick: () => setActiveView(view.key),
            }))}
          />
        </motion.div>

        {isLoading ? (
          <div className="mt-2 space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <BuybackEmptyState onCreate={handleCreateQuote} />
        ) : (
          <>
            <BuybackDesktopTable items={filteredItems} onOpenRecord={setSelectedRecord} />
            <motion.section
              variants={stagger(0.035)}
              className={cn(repairOs.cardList, "mt-2 lg:hidden")}
            >
              {filteredItems.map((item) => (
                <motion.div key={item.id} variants={fadeUp}>
                  <BuybackQuoteCard item={item} onOpenRecord={setSelectedRecord} />
                </motion.div>
              ))}
            </motion.section>
          </>
        )}

        <BuybackQuoteWorkspace
          open={quoteOpen}
          onOpenChange={handleQuoteOpenChange}
          initialDraft={quoteInitialDraft}
          targetItem={quoteTargetRecord}
        />
        <BuybackRecordSheet
          item={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onStartFollowUp={handleStartRecordFollowUp}
          onOpenInventoryRecord={handleOpenInventoryRecord}
        />
      </RepairOsListScaffold>
    </motion.div>
  );
}

function BuybackEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.section variants={fadeUp} className={cn(repairOs.mobileInfoCard, "mt-3")}>
      <div className="grid min-w-0 grid-cols-[36px_minmax(0,1fr)] gap-2">
        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <FileText className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[12px] font-semibold leading-4">还没有回收报价</h2>
          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
            先做简易估价，客户同意后再检测功能并登记资料。
          </p>
        </div>
      </div>
      <Button
        className={cn("mt-2 h-9 w-full gap-1.5 rounded-lg text-xs", controls.brandButton)}
        style={brandGradientStyle}
        onClick={onCreate}
      >
        <Plus className="size-3.5" />
        新建回收报价
      </Button>
    </motion.section>
  );
}

function BuybackDesktopTable({
  items,
  onOpenRecord,
}: {
  items: InventoryListItem[];
  onOpenRecord: (item: InventoryListItem) => void;
}) {
  return (
    <div className="glass-card mt-2 hidden min-w-0 max-w-full overflow-x-auto overflow-y-hidden lg:block">
      <Table className={cn(density.tableDense, "min-w-[980px] table-fixed xl:min-w-0")}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[122px]">回收单</TableHead>
            <TableHead className="w-[150px]">客户</TableHead>
            <TableHead>设备 / 检测</TableHead>
            <TableHead className="w-[126px] text-right">报价</TableHead>
            <TableHead className="w-[150px] text-right">成本</TableHead>
            <TableHead className="w-[178px]">维修 / 风险</TableHead>
            <TableHead className="w-[170px]">下一步</TableHead>
            <TableHead className="w-[44px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <BuybackDesktopTableRow key={item.id} item={item} onOpenRecord={onOpenRecord} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BuybackDesktopTableRow({
  item,
  onOpenRecord,
}: {
  item: InventoryListItem;
  onOpenRecord: (item: InventoryListItem) => void;
}) {
  const offer = getBuybackQuoteOffer(item);
  const risk = getBuybackRiskLevel(item);
  const quotePayload = getBuybackQuotePayload(item);
  const summary = buildInventoryBuybackSummary(item);
  const statusMeta = inventoryStatusMeta[item.status];
  const handoff = getBuybackInventoryHandoff(item.status, risk);
  const primaryAction = getBuybackRecordPrimaryAction(item, risk);
  const suggestedLow =
    typeof quotePayload.suggested_low === "number" ? quotePayload.suggested_low : undefined;
  const suggestedHigh =
    typeof quotePayload.suggested_high === "number" ? quotePayload.suggested_high : undefined;
  const repairCost = summary?.repairCost ?? item.repair_cost_amount;
  const costBasis =
    summary?.costBasis ?? item.buyback_price + item.repair_cost_amount + item.fees_amount;
  const estimatedProfit = Math.max(0, item.list_price - offer - repairCost - item.fees_amount);
  const batteryBand =
    typeof item.battery_health === "number"
      ? getBuybackBatteryBand(item.battery_health)
      : undefined;

  const openRecord = () => onOpenRecord(item);

  return (
    <TableRow
      role="button"
      tabIndex={0}
      className="h-14 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={openRecord}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openRecord();
      }}
    >
      <TableCell className="min-w-0">
        <div className="truncate font-mono font-semibold text-primary">{item.public_no}</div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
          <RepairOsBadge className={statusToneClass(statusMeta.tone)}>
            {statusMeta.shortLabel}
          </RepairOsBadge>
          <RepairOsBadge className={handoffToneClass(handoff.tone)}>{handoff.label}</RepairOsBadge>
        </div>
      </TableCell>
      <TableCell className="min-w-0">
        <div className="truncate font-medium">{item.customer_name || "Walk-in"}</div>
        {item.customer_phone ? (
          <PhoneText value={item.customer_phone} className="block truncate text-[11px]" />
        ) : (
          <div className="truncate text-[11px] text-muted-foreground">未留电话</div>
        )}
      </TableCell>
      <TableCell className="min-w-0">
        <div className="truncate font-medium">{item.item_label}</div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">
          {[item.color, item.storage_capacity, maskImei(item.serial_or_imei)]
            .filter(Boolean)
            .join(" · ")}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          电池 {item.battery_health ?? "-"}%{batteryBand ? ` · ${batteryBand.label}` : ""} · 功能{" "}
          {gradeLabel(item.functional_grade)}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <MoneyText amount={offer} className="font-semibold text-primary" />
        <div className="truncate text-[11px] text-muted-foreground">
          {suggestedLow !== undefined && suggestedHigh !== undefined
            ? `区间 €${suggestedLow}-${suggestedHigh}`
            : "未生成区间"}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="font-mono font-semibold">
          <MoneyText amount={costBasis} />
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          回收 <MoneyText amount={item.buyback_price} /> · 修 <MoneyText amount={repairCost} />
        </div>
        <div className="truncate text-[11px] text-status-success-foreground">
          毛利 <MoneyText amount={estimatedProfit} />
        </div>
      </TableCell>
      <TableCell className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <RepairOsBadge className={riskToneClass(risk)}>
            {risk === "high" ? "高风险" : risk === "medium" ? "需复核" : "低风险"}
          </RepairOsBadge>
          {summary ? (
            <RepairOsBadge className={statusToneClass(summary.statusTone)}>
              {summary.statusLabel}
            </RepairOsBadge>
          ) : null}
        </div>
        <div className="mt-1 truncate text-[11px] font-medium">
          {summary?.repairIssueSummary ?? "未记录明确故障"}
        </div>
        {summary?.repairRows.length ? (
          <div className="truncate text-[11px] text-muted-foreground">
            维修：
            {summary.repairRows
              .slice(0, 2)
              .map((row) => row.label)
              .join("、")}
          </div>
        ) : (
          <div className="truncate text-[11px] text-muted-foreground">维修后在库存补录实际成本</div>
        )}
      </TableCell>
      <TableCell className="min-w-0">
        <div className={cn("truncate font-medium", handoffToneTextClass(primaryAction.tone))}>
          {primaryAction.label}
        </div>
        <div className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
          {primaryAction.detail}
        </div>
      </TableCell>
      <TableCell onClick={(event) => event.stopPropagation()}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-md"
          aria-label={`查看回收记录 ${item.public_no}`}
          onClick={() => onOpenRecord(item)}
        >
          <ArrowUpRight className="size-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function BuybackQuoteCard({
  item,
  onOpenRecord,
}: {
  item: InventoryListItem;
  onOpenRecord: (item: InventoryListItem) => void;
}) {
  const offer = getBuybackQuoteOffer(item);
  const risk = getBuybackRiskLevel(item);
  const quotePayload = getBuybackQuotePayload(item);
  const intentLabel =
    typeof quotePayload.intent_outcome_label === "string"
      ? quotePayload.intent_outcome_label
      : "回收流程";
  const suggestedLow =
    typeof quotePayload.suggested_low === "number" ? quotePayload.suggested_low : undefined;
  const suggestedHigh =
    typeof quotePayload.suggested_high === "number" ? quotePayload.suggested_high : undefined;
  const batteryBand =
    typeof item.battery_health === "number"
      ? getBuybackBatteryBand(item.battery_health)
      : undefined;
  const estimatedProfit = Math.max(
    0,
    item.list_price - offer - item.repair_cost_amount - item.fees_amount,
  );
  const statusMeta = inventoryStatusMeta[item.status];
  const handoff = getBuybackInventoryHandoff(item.status, risk);
  const primaryAction = getBuybackRecordPrimaryAction(item, risk);
  const openRecord = () => onOpenRecord(item);

  return (
    <RepairOsBusinessCard
      className={cn(
        repairOs.businessCardDense,
        "grid-cols-1 gap-1.5 cursor-pointer select-none touch-manipulation transition-colors hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      role="button"
      tabIndex={0}
      aria-label={`查看回收记录 ${item.public_no}`}
      onClick={openRecord}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openRecord();
      }}
    >
      <div className="flex min-w-0 items-start justify-between gap-2 border-b border-[var(--border-panel)] pb-1.5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-mono text-[12px] font-semibold leading-4 text-primary">
              {item.public_no}
            </span>
            <RepairOsBadge className={statusToneClass(statusMeta.tone)}>
              {statusMeta.shortLabel}
            </RepairOsBadge>
            <RepairOsBadge className={riskToneClass(risk)}>
              {risk === "high" ? "高风险" : risk === "medium" ? "需复核" : "低风险"}
            </RepairOsBadge>
            <RepairOsBadge className={handoffToneClass(handoff.tone)}>
              {handoff.label}
            </RepairOsBadge>
          </div>
          <p className="truncate text-[10px] leading-4 text-muted-foreground">
            {intentLabel} · {statusMeta.label}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-[15px] font-semibold leading-5 tabular-nums text-primary">
            <MoneyText amount={offer} />
          </p>
          <p className="text-[9px] leading-3 text-muted-foreground">建议收购价</p>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_108px] gap-2">
        <div className="min-w-0 space-y-1">
          <BuybackInlineInfo
            icon={UserRound}
            label="客户"
            value={item.customer_name || "Walk-in"}
            meta={
              item.customer_phone ? (
                <PhoneText value={item.customer_phone} className="truncate" />
              ) : (
                "未留电话"
              )
            }
          />
          <BuybackInlineInfo
            icon={Smartphone}
            label="设备"
            value={item.item_label}
            meta={`IMEI ${maskImei(item.serial_or_imei)}`}
          />
          <BuybackInlineInfo
            icon={Battery}
            label="电池"
            value={item.battery_health ? `${item.battery_health}%` : "未检测"}
            meta={batteryBand ? `${batteryBand.label} · -€${batteryBand.deduction}` : "待检测"}
          />
        </div>
        <div className="min-w-0 border-l border-[var(--border-panel)] pl-2">
          <BuybackCardMetric label="参考售价" value={<MoneyText amount={item.list_price} />} />
          <BuybackCardMetric
            label="口头区间"
            value={
              suggestedLow !== undefined && suggestedHigh !== undefined
                ? `€${suggestedLow}-${suggestedHigh}`
                : "未生成"
            }
          />
          <BuybackCardMetric
            label="预计毛利"
            value={<MoneyText amount={estimatedProfit} />}
            emphasis={estimatedProfit > 0}
          />
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-between gap-2 border-t border-[var(--border-panel)] pt-1.5">
        <span className="flex min-w-0 items-center gap-1 text-[10px] leading-4 text-muted-foreground">
          {risk === "high" ? <AlertTriangle className="size-3 shrink-0" /> : null}
          <span className="truncate">
            {primaryAction.label} · {primaryAction.detail}
          </span>
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            handoffToneClass(primaryAction.tone),
          )}
          aria-hidden
        >
          详情
          <ArrowUpRight className="size-3" />
        </span>
      </div>
    </RepairOsBusinessCard>
  );
}

function BuybackRecordSheet({
  item,
  onClose,
  onStartFollowUp,
  onOpenInventoryRecord,
}: {
  item: InventoryListItem | null;
  onClose: () => void;
  onStartFollowUp: (item: InventoryListItem) => void;
  onOpenInventoryRecord: (item: InventoryListItem) => void;
}) {
  if (!item) return null;

  const quotePayload = getBuybackQuotePayload(item);
  const legacyPayload = asRecord(item.legacy_payload);
  const devicePayload = asRecord(legacyPayload.buyback_device);
  const customerPayload = asRecord(legacyPayload.buyback_customer);
  const checksPayload = asRecord(legacyPayload.buyback_function_checks);
  const marketSource = asRecord(quotePayload.market_source);
  const deductions = deductionRowsFromPayload(quotePayload.deductions);
  const riskNotes = stringArrayFromPayload(quotePayload.risk_notes);
  const offer = getBuybackQuoteOffer(item);
  const risk = getBuybackRiskLevel(item);
  const statusMeta = inventoryStatusMeta[item.status];
  const checkStats = inspectionStatsFromPayload(checksPayload);
  const proofStats = proofStatsFromPayload(customerPayload);
  const progress = getBuybackRecordProgress(item.status, risk);
  const handoff = getBuybackInventoryHandoff(item.status, risk);
  const taskGuidance = getBuybackRecordTaskGuidance(item.status, risk);
  const readiness = getBuybackRecordReadiness(item, risk);
  const primaryAction = getBuybackRecordPrimaryAction(item, risk);
  const canOpenQuoteWorkspace = primaryAction.canResumeQuote;
  const primaryButtonLabel = canOpenQuoteWorkspace
    ? `${primaryAction.actionLabel} / 复估`
    : "打开库存详情";

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className={cn(
          componentOverlay.bottomSheet,
          "left-1/2 right-auto flex w-[min(430px,calc(100vw-0.5rem))] -translate-x-1/2 flex-col gap-0 rounded-t-xl border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] p-0 shadow-[var(--shadow-overlay)] md:bottom-4 md:h-[calc(100svh-2rem)] md:max-h-[calc(100svh-2rem)] md:w-[min(1120px,calc(100vw-2rem))] md:rounded-xl",
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3">
          <SheetHeader className="mb-2 space-y-1 text-left">
            <SheetTitle className="text-[14px] leading-5">回收记录</SheetTitle>
            <SheetDescription className="text-[10px] leading-4">
              {item.public_no} · {item.item_label}
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3 [&>section:first-child]:md:col-span-2 [&>section:first-child]:xl:col-span-3">
            <section className={cn(repairOs.mobileInfoCard, "p-2.5")}>
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-mono text-[13px] font-semibold leading-5 text-primary">
                      {item.public_no}
                    </span>
                    <RepairOsBadge className={statusToneClass(statusMeta.tone)}>
                      {statusMeta.shortLabel}
                    </RepairOsBadge>
                    <RepairOsBadge className={riskToneClass(risk)}>
                      {risk === "high" ? "高风险" : risk === "medium" ? "需复核" : "低风险"}
                    </RepairOsBadge>
                    <RepairOsBadge className={handoffToneClass(handoff.tone)}>
                      {handoff.label}
                    </RepairOsBadge>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
                    {stringValue(quotePayload.intent_outcome_label, "回收流程")} ·{" "}
                    {progress.nextAction}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[17px] font-semibold leading-5 text-primary">
                    <MoneyText amount={offer} />
                  </p>
                  <p className="text-[9px] leading-3 text-muted-foreground">建议收购价</p>
                </div>
              </div>
            </section>

            <section className={cn(repairOs.mobileInfoCard, "p-2.5")}>
              <div className="flex min-w-0 items-start justify-between gap-2">
                <RecordSectionTitle icon={ClipboardCheck} title="执行摘要" />
                <RepairOsBadge className={readinessToneClass(readiness.state)}>
                  {readiness.label}
                </RepairOsBadge>
              </div>
              <div className="mt-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <p className="truncate text-[10px] font-medium leading-4">{readiness.detail}</p>
                  <span className="shrink-0 font-mono text-[10px] font-semibold leading-4 text-primary">
                    {readiness.progress}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-card">
                  <div
                    className={cn("h-full rounded-full", readinessProgressClass(readiness.state))}
                    style={{ width: `${Math.max(6, readiness.progress)}%` }}
                  />
                </div>
              </div>
              {readiness.missing.length ? (
                <div className="mt-1.5 grid gap-1">
                  {readiness.missing.slice(0, 3).map((item) => (
                    <div
                      key={item}
                      className="flex min-w-0 items-center gap-1.5 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1"
                    >
                      <AlertTriangle className="size-3 shrink-0 text-status-warn-foreground" />
                      <span className="truncate text-[10px] leading-4 text-muted-foreground">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className={cn(repairOs.mobileInfoCard, "p-2.5")}>
              <RecordSectionTitle icon={ClipboardCheck} title="处理进度" />
              <div className="mt-2 grid grid-cols-4 gap-1">
                {progress.steps.map((step, index) => {
                  return (
                    <div key={step.key} className="min-w-0 text-center">
                      <span
                        className={cn(
                          "mx-auto grid size-6 place-items-center rounded-full border text-[10px] font-semibold",
                          step.completed && "border-primary bg-primary text-primary-foreground",
                          step.active && "border-primary bg-primary/10 text-primary",
                          !step.completed &&
                            !step.active &&
                            "border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-muted-foreground",
                        )}
                      >
                        {step.completed ? <CheckCircle2 className="size-3.5" /> : index + 1}
                      </span>
                      <p
                        className={cn(
                          "mt-0.5 truncate text-[9px] leading-3 text-muted-foreground",
                          step.active && "font-medium text-primary",
                        )}
                      >
                        {step.label}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
                {progress.nextAction}
              </p>
              <div className="mt-1.5 rounded-lg border border-[var(--border-panel)] bg-card px-2 py-1.5">
                <p className="truncate text-[9px] leading-3 text-muted-foreground">交接到</p>
                <p className="truncate text-[10px] font-medium leading-4">
                  {handoff.label} · {handoff.detail}
                </p>
              </div>
            </section>

            <section className={cn(repairOs.mobileInfoCard, "p-2.5")}>
              <div className="flex min-w-0 items-start justify-between gap-2">
                <RecordSectionTitle icon={CheckCircle2} title="当前任务" />
                <RepairOsBadge className={handoffToneClass(taskGuidance.tone)}>
                  {taskGuidance.primaryAction}
                </RepairOsBadge>
              </div>
              <div
                className={cn(
                  "mt-2 rounded-lg border px-2 py-1.5",
                  taskGuidanceToneClass(primaryAction.tone),
                )}
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <p className="truncate text-[11px] font-semibold leading-4">
                    {primaryAction.label}
                  </p>
                  {primaryAction.missingCount ? (
                    <span className="shrink-0 rounded-full bg-card px-1.5 py-0.5 text-[9px] font-semibold leading-none">
                      缺 {primaryAction.missingCount}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[10px] leading-4">{primaryAction.detail}</p>
              </div>
              <div className="mt-2 grid gap-1">
                {taskGuidance.checklist.map((task, index) => (
                  <div
                    key={task}
                    className="grid min-w-0 grid-cols-[18px_minmax(0,1fr)] items-center gap-1.5 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1"
                  >
                    <span className="grid size-4 place-items-center rounded-full bg-card font-mono text-[9px] font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span className="truncate text-[10px] leading-4 text-muted-foreground">
                      {task}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className={cn(repairOs.mobileInfoCard, "p-2.5")}>
              <RecordSectionTitle icon={Euro} title="报价依据" />
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <RecordMetric
                  label="系统价"
                  value={<MoneyText amount={numberValue(quotePayload.system_offer)} />}
                />
                <RecordMetric
                  label="口头区间"
                  value={rangeText(quotePayload.suggested_low, quotePayload.suggested_high)}
                />
                <RecordMetric
                  label="预计毛利"
                  value={<MoneyText amount={numberValue(quotePayload.expected_profit)} />}
                />
              </div>
              <div className="mt-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
                <p className="truncate text-[9px] leading-3 text-muted-foreground">行情来源</p>
                <p className="truncate text-[10px] font-medium leading-4">
                  {stringValue(marketSource.source_label, "手动估价")}{" "}
                  {stringValue(marketSource.observed_at, "")}
                </p>
              </div>
            </section>

            <section className={cn(repairOs.mobileInfoCard, "p-2.5")}>
              <RecordSectionTitle icon={AlertTriangle} title="扣减与风险" />
              <div className="mt-2 space-y-1">
                {deductions.length ? (
                  deductions.slice(0, 6).map((row) => (
                    <div
                      key={`${row.label}-${row.amount}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1"
                    >
                      <span className="min-w-0 truncate text-[10px] leading-4">{row.label}</span>
                      <span className="shrink-0 font-mono text-[10px] font-semibold leading-4 text-status-danger-foreground">
                        -€{row.amount.toFixed(0)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
                    暂无扣减项。
                  </p>
                )}
              </div>
              {riskNotes.length ? (
                <div className="mt-1.5 space-y-1">
                  {riskNotes.slice(0, 3).map((note) => (
                    <p
                      key={note}
                      className="rounded-lg bg-status-warn/15 px-2 py-1 text-[10px] leading-4 text-status-warn-foreground"
                    >
                      {note}
                    </p>
                  ))}
                </div>
              ) : null}
            </section>

            <section className={cn(repairOs.mobileInfoCard, "p-2.5")}>
              <RecordSectionTitle icon={Smartphone} title="设备与资料" />
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <RecordMetric
                  label="电池"
                  value={item.battery_health ? `${item.battery_health}%` : "未检测"}
                />
                <RecordMetric label="成色" value={stringValue(devicePayload.cosmetic_grade, "-")} />
                <RecordMetric
                  label="盒子"
                  value={devicePayload.box_included === false ? "无盒" : "有/待确认"}
                />
                <RecordMetric
                  label="发票"
                  value={devicePayload.purchase_proof === false ? "无票" : "有/待确认"}
                />
              </div>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_92px] gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-[9px] leading-3 text-muted-foreground">客户</p>
                  <p className="truncate text-[10px] font-medium leading-4">
                    {stringValue(customerPayload.name, item.customer_name || "未登记")}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="truncate text-[9px] leading-3 text-muted-foreground">检测</p>
                  <p className="truncate text-[10px] font-medium leading-4">
                    {checkStats.handled} 项已处理
                  </p>
                </div>
              </div>
            </section>

            <section className={cn(repairOs.mobileInfoCard, "p-2.5")}>
              <RecordSectionTitle icon={Camera} title="检测与凭证" />
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <RecordMetric label="检测正常" value={`${checkStats.pass} 项`} />
                <RecordMetric label="异常/风险" value={`${checkStats.fail} 项`} />
                <RecordMetric label="仍未检测" value={`${checkStats.unchecked} 项`} />
                <RecordMetric label="凭证采集" value={`${proofStats.done}/${proofStats.total}`} />
              </div>
              <div className="mt-2 grid gap-1">
                {proofStats.rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1"
                  >
                    <span className="truncate text-[10px] leading-4 text-muted-foreground">
                      {row.label}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-[10px] font-medium leading-4",
                        row.done ? "text-status-success-foreground" : "text-muted-foreground",
                      )}
                    >
                      {row.done ? "已采集" : "未采集"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-1.5 border-t border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] px-3 py-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg text-xs"
            onClick={onClose}
          >
            关闭
          </Button>
          <Button
            type="button"
            className={cn("h-9 rounded-lg text-xs", controls.brandButton)}
            style={brandGradientStyle}
            onClick={() => {
              if (canOpenQuoteWorkspace) {
                toast.info("已带入当前记录，保存后会更新原回收单；确认成交后转入库存商品。");
                onStartFollowUp(item);
                return;
              }
              toast.info("已跳转库存商品，可继续整备、调价或查看历史。");
              onOpenInventoryRecord(item);
            }}
          >
            {primaryButtonLabel}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RecordSectionTitle({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="size-3.5 text-primary" />
      <h3 className="text-[12px] font-semibold leading-4">{title}</h3>
    </div>
  );
}

function RecordMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
      <p className="truncate text-[9px] leading-3 text-muted-foreground">{label}</p>
      <p className="truncate text-[11px] font-semibold leading-4">{value}</p>
    </div>
  );
}

function BuybackInlineInfo({
  icon: Icon,
  label,
  value,
  meta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  meta: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[20px_minmax(0,1fr)] gap-1.5">
      <span className="grid size-5 place-items-center rounded-md bg-[var(--surface-panel-muted)] text-primary">
        <Icon className="size-3" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[9px] leading-3 text-muted-foreground">{label}</p>
        <p className="truncate text-[11px] font-semibold leading-4">{value}</p>
        <p className="truncate text-[9px] leading-3 text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

function inspectionStatsFromPayload(payload: Record<string, unknown>) {
  const values = Object.values(payload);
  const pass = values.filter((value) => value === "pass").length;
  const fail = values.filter((value) => value === "fail").length;
  const unchecked = values.filter((value) => value === "unchecked").length;
  const handled = values.filter((value) => value !== "unchecked").length;
  return { pass, fail, unchecked, handled };
}

function proofStatsFromPayload(payload: Record<string, unknown>) {
  const rows = [
    { label: "客户签名", done: payload.signature_captured === true },
    { label: "证件正面", done: payload.id_front_captured === true },
    { label: "证件反面", done: payload.id_back_captured === true },
    { label: "设备照片", done: payload.device_photo_captured === true },
    { label: "发票照片", done: payload.invoice_photo_captured === true },
    { label: "原装盒照片", done: payload.box_photo_captured === true },
  ];

  return {
    rows,
    done: rows.filter((row) => row.done).length,
    total: rows.length,
  };
}

function BuybackCardMetric({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[9px] leading-3 text-muted-foreground">{label}</p>
      <p
        className={cn(
          "truncate text-[10px] font-medium leading-4",
          emphasis ? "font-mono text-status-success-foreground" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function rangeText(low: unknown, high: unknown) {
  const lowValue = numberValue(low);
  const highValue = numberValue(high);
  if (lowValue <= 0 && highValue <= 0) return "未生成";
  return `€${lowValue}-${highValue}`;
}

function stringArrayFromPayload(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function deductionRowsFromPayload(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => asRecord(row))
    .map((row) => ({
      label: stringValue(row.label, stringValue(row.key, "扣减项")),
      amount: numberValue(row.amount),
    }))
    .filter((row) => row.amount > 0);
}

function maskImei(value?: string) {
  if (!value) return "未填写";
  return value.length > 4 ? `****${value.slice(-4)}` : value;
}

function gradeLabel(value?: string) {
  const labels: Record<string, string> = {
    untested: "未检测",
    passed: "正常",
    needs_repair: "需维修",
    failed: "异常",
    for_parts: "拆件",
    unknown: "未知",
    new: "全新",
    mint: "近新",
    good: "良好",
    fair: "一般",
    poor: "较差",
  };
  return value ? (labels[value] ?? value) : "-";
}

function statusToneClass(tone: "neutral" | "info" | "warning" | "success" | "danger") {
  if (tone === "success") return "bg-status-success text-status-success-foreground";
  if (tone === "warning") return "bg-status-warn text-status-warn-foreground";
  if (tone === "danger") return "bg-status-danger text-status-danger-foreground";
  if (tone === "info") return "bg-status-info text-status-info-foreground";
  return "bg-status-neutral text-status-neutral-foreground";
}

function riskToneClass(risk: "low" | "medium" | "high") {
  if (risk === "high") return "bg-status-danger text-status-danger-foreground";
  if (risk === "medium") return "bg-status-warn text-status-warn-foreground";
  return "bg-status-success text-status-success-foreground";
}

function handoffToneClass(tone: "neutral" | "info" | "warning" | "success") {
  if (tone === "success") return "bg-status-success text-status-success-foreground";
  if (tone === "warning") return "bg-status-warn text-status-warn-foreground";
  if (tone === "info") return "bg-status-info text-status-info-foreground";
  return "bg-status-neutral text-status-neutral-foreground";
}

function handoffToneTextClass(tone: "neutral" | "info" | "warning" | "success") {
  if (tone === "success") return "text-status-success-foreground";
  if (tone === "warning") return "text-status-warn-foreground";
  if (tone === "info") return "text-primary";
  return "text-foreground";
}

function taskGuidanceToneClass(tone: "neutral" | "info" | "warning" | "success") {
  if (tone === "success") {
    return "border-status-success/25 bg-status-success/10 text-status-success-foreground";
  }
  if (tone === "warning") {
    return "border-status-warn/25 bg-status-warn/10 text-status-warn-foreground";
  }
  if (tone === "info") {
    return "border-status-info/25 bg-status-info/10 text-status-info-foreground";
  }
  return "border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-muted-foreground";
}

function readinessToneClass(state: "blocked" | "todo" | "ready" | "done") {
  if (state === "blocked") return "bg-status-danger text-status-danger-foreground";
  if (state === "todo") return "bg-status-warn text-status-warn-foreground";
  if (state === "ready") return "bg-status-info text-status-info-foreground";
  return "bg-status-success text-status-success-foreground";
}

function readinessProgressClass(state: "blocked" | "todo" | "ready" | "done") {
  if (state === "blocked") return "bg-status-danger";
  if (state === "todo") return "bg-status-warn";
  if (state === "ready") return "bg-primary";
  return "bg-status-success";
}
