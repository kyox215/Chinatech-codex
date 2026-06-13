"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Euro, FileText, Plus, Recycle, ScanLine, Search, TrendingUp } from "lucide-react";

import { MoneyText, PhoneText } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BuybackQuoteWorkspace } from "@/features/buyback/components/buyback-quote-workspace";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import { inventoryStatusMeta } from "@/features/inventory/model/inventory-workflow";
import { getBuybackQuoteOffer, getBuybackRiskLevel } from "@/features/buyback/model/buyback-quote";
import {
  getInventoryStats,
  listInventoryItems,
  type InventoryItemStatus,
  type InventoryListItem,
} from "@/lib/repairdesk/api";
import { fadeUp, stagger } from "@/lib/motion";
import {
  RepairOsBadge,
  RepairOsBusinessCard,
  RepairOsChipRow,
  RepairOsMetricStrip,
  RepairOsMobilePage,
  RepairOsModuleHeader,
} from "@/shared/ui";
import { brandGradientStyle, controls, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | InventoryItemStatus;

const statusFilters: StatusFilter[] = [
  "all",
  "intake",
  "evaluating",
  "offer_made",
  "purchased",
  "data_wipe",
  "refurbishing",
  "ready_for_sale",
];

export function BuybackScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  useEffect(() => {
    if (searchParams.get("new") === "1") setQuoteOpen(true);
  }, [searchParams]);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      statuses: status === "all" ? undefined : [status],
    }),
    [search, status],
  );

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: inventoryKeys.stats(),
    queryFn: getInventoryStats,
  });
  const { data: items = [], isLoading } = useQuery({
    queryKey: inventoryKeys.list(filters),
    queryFn: () => listInventoryItems(filters),
  });

  const pendingCount = items.filter(
    (item) => item.status === "intake" || item.status === "evaluating",
  ).length;
  const quotedCount = items.filter((item) => item.status === "offer_made").length;
  const acquiredCount = items.filter((item) =>
    ["purchased", "data_wipe", "refurbishing", "ready_for_sale", "listed", "sold"].includes(
      item.status,
    ),
  ).length;

  const handleQuoteOpenChange = (open: boolean) => {
    setQuoteOpen(open);
    if (!open && searchParams.get("new") === "1") {
      router.replace("/buyback", { scroll: false });
    }
  };

  return (
    <motion.div variants={stagger()} initial="hidden" animate="show" className="contents">
      <RepairOsMobilePage>
        <motion.div variants={fadeUp}>
          <RepairOsModuleHeader
            action={
              <Button
                size="sm"
                className={cn("h-9 shrink-0 gap-1.5", controls.brandButton)}
                style={brandGradientStyle}
                onClick={() => setQuoteOpen(true)}
              >
                <Plus className="size-4" />
                回收报价
              </Button>
            }
          />
        </motion.div>

        <motion.div variants={fadeUp} className={cn(repairOs.searchBar, "mt-3")}>
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索客户 / 设备 / IMEI / 回收单号"
            className={repairOs.searchInput}
          />
          <Button variant="outline" size="icon" className="size-8 shrink-0" aria-label="扫码">
            <ScanLine className="size-4" />
          </Button>
        </motion.div>

        <motion.div variants={fadeUp}>
          <RepairOsMetricStrip
            metrics={[
              {
                label: "回收记录",
                value: statsLoading ? "-" : (stats?.total ?? items.length),
                hint: "全部设备",
                icon: Recycle,
                tone: "blue",
              },
              {
                label: "待检测",
                value: pendingCount,
                hint: "收机/估价",
                icon: ScanLine,
                tone: "amber",
              },
              {
                label: "已报价",
                value: quotedCount,
                hint: "待客户确认",
                icon: Euro,
                tone: "green",
              },
            ]}
            className="mt-3"
          />
        </motion.div>

        <motion.div variants={fadeUp}>
          <BuybackTrendCard items={items} acquiredCount={acquiredCount} />
        </motion.div>

        <motion.div variants={fadeUp}>
          <RepairOsChipRow
            className="mt-3"
            chips={statusFilters.map((value) => ({
              label: value === "all" ? "全部" : inventoryStatusMeta[value].shortLabel,
              active: status === value,
              onClick: () => setStatus(value),
            }))}
          />
        </motion.div>

        {isLoading ? (
          <div className="mt-2 space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <motion.section
            variants={fadeUp}
            className={cn(repairOs.adminSection, "mt-3 text-center")}
          >
            <FileText className="mx-auto size-9 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold">还没有回收报价</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              从设备信息和检测结果开始，1-3 分钟生成报价。
            </p>
            <Button
              className={cn("mt-3 h-9 gap-1.5", controls.brandButton)}
              style={brandGradientStyle}
              onClick={() => setQuoteOpen(true)}
            >
              <Plus className="size-4" />
              新建回收报价
            </Button>
          </motion.section>
        ) : (
          <motion.section variants={stagger(0.035)} className={cn(repairOs.cardList, "mt-2")}>
            {items.map((item) => (
              <motion.div key={item.id} variants={fadeUp}>
                <BuybackQuoteCard item={item} />
              </motion.div>
            ))}
          </motion.section>
        )}

        <motion.div variants={fadeUp} className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-9 gap-1.5">
            <Recycle className="size-4" />
            转翻新
          </Button>
          <Button variant="outline" className="h-9 gap-1.5">
            <Euro className="size-4" />
            付款记录
          </Button>
        </motion.div>

        <BuybackQuoteWorkspace open={quoteOpen} onOpenChange={handleQuoteOpenChange} />
      </RepairOsMobilePage>
    </motion.div>
  );
}

function BuybackTrendCard({
  items,
  acquiredCount,
}: {
  items: InventoryListItem[];
  acquiredCount: number;
}) {
  const quotedValue = items.reduce((sum, item) => sum + getBuybackQuoteOffer(item), 0);
  const bars = buildSevenDayBars(items);
  const max = Math.max(1, ...bars);

  return (
    <div className={cn(repairOs.adminSection, "mt-3")}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className={repairOs.adminSectionTitle}>回收趋势</h2>
          <p className="truncate text-[11px] text-muted-foreground">近 7 天报价数量和成交节奏</p>
        </div>
        <TrendingUp className="size-4 shrink-0 text-primary" />
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <div className="flex h-12 items-end gap-1.5">
          {bars.map((value, index) => (
            <div key={index} className="flex min-w-0 flex-1 items-end">
              <div
                className="w-full rounded-t bg-primary/25"
                style={{ height: `${Math.max(16, (value / max) * 48)}px` }}
              />
            </div>
          ))}
        </div>
        <div className="text-right text-xs">
          <p className="font-mono text-sm font-semibold">
            <MoneyText amount={quotedValue} />
          </p>
          <p className="text-muted-foreground">报价合计</p>
          <p className="mt-1 font-mono text-sm font-semibold">{acquiredCount}</p>
          <p className="text-muted-foreground">已成交</p>
        </div>
      </div>
    </div>
  );
}

function BuybackQuoteCard({ item }: { item: InventoryListItem }) {
  const offer = getBuybackQuoteOffer(item);
  const risk = getBuybackRiskLevel(item);
  const estimatedProfit = Math.max(
    0,
    item.list_price - offer - item.repair_cost_amount - item.fees_amount,
  );
  const statusMeta = inventoryStatusMeta[item.status];

  return (
    <RepairOsBusinessCard
      className={repairOs.businessCardDense}
      trailing={
        <div className="flex min-w-[4.75rem] flex-col items-end text-right">
          <MoneyText amount={offer} className={repairOs.cardAmount} />
          <span className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
            售价 <MoneyText amount={item.list_price} />
          </span>
          <span className="truncate text-[11px] leading-4 text-status-success-foreground">
            毛利 <MoneyText amount={estimatedProfit} />
          </span>
        </div>
      }
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="font-mono text-[11px] font-semibold text-primary">{item.public_no}</span>
        <RepairOsBadge className={statusToneClass(statusMeta.tone)}>
          {statusMeta.shortLabel}
        </RepairOsBadge>
        <RepairOsBadge className={riskToneClass(risk)}>
          {risk === "high" ? "高风险" : risk === "medium" ? "中风险" : "低风险"}
        </RepairOsBadge>
      </div>
      <h2 className={cn(repairOs.cardTitle, "mt-1")}>{item.item_label}</h2>
      <p className={repairOs.cardMeta}>
        {item.customer_name || "Walk-in"} · IMEI {maskImei(item.serial_or_imei)}
      </p>
      <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
        {item.customer_phone ? (
          <PhoneText value={item.customer_phone} className="truncate" />
        ) : null}
        <span className="truncate">
          {item.battery_health ? `电池 ${item.battery_health}%` : "待检测"}
        </span>
      </div>
    </RepairOsBusinessCard>
  );
}

function buildSevenDayBars(items: InventoryListItem[]) {
  const today = new Date();
  return Array.from({ length: 7 }).map((_, index) => {
    const target = new Date(today);
    target.setDate(today.getDate() - (6 - index));
    const key = target.toISOString().slice(0, 10);
    return items.filter((item) => item.created_at.slice(0, 10) === key).length;
  });
}

function maskImei(value?: string) {
  if (!value) return "未填写";
  return value.length > 4 ? `****${value.slice(-4)}` : value;
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
