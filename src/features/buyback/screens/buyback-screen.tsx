"use client";

import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Euro, FileText, Plus, Recycle, ScanLine, Search } from "lucide-react";
import { toast } from "sonner";

import { MoneyText, PhoneText } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BuybackQuoteWorkspace } from "@/features/buyback/components/buyback-quote-workspace";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import { inventoryStatusMeta } from "@/features/inventory/model/inventory-workflow";
import { getBuybackQuoteOffer, getBuybackRiskLevel } from "@/features/buyback/model/buyback-quote";
import {
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

const buybackScopeFilters = {
  sourceTypes: ["buyback"],
  categories: ["phone"],
};

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
      ...buybackScopeFilters,
      search: search.trim() || undefined,
      statuses: status === "all" ? undefined : [status],
    }),
    [search, status],
  );

  const { data: allBuybackItems = [], isLoading: statsLoading } = useQuery({
    queryKey: inventoryKeys.list(buybackScopeFilters),
    queryFn: () => listInventoryItems(buybackScopeFilters),
  });
  const { data: items = [], isLoading } = useQuery({
    queryKey: inventoryKeys.list(filters),
    queryFn: () => listInventoryItems(filters),
  });

  const pendingCount = allBuybackItems.filter(
    (item) => item.status === "intake" || item.status === "evaluating",
  ).length;
  const quotedCount = allBuybackItems.filter((item) => item.status === "offer_made").length;
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
          <Button
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            aria-label="扫码"
            onClick={() =>
              toast.info("回收扫码会接入快速查找 IMEI；当前请在报价向导中录入设备信息")
            }
          >
            <ScanLine className="size-4" />
          </Button>
        </motion.div>

        <motion.div variants={fadeUp}>
          <RepairOsMetricStrip
            metrics={[
              {
                label: "回收记录",
                value: statsLoading ? "-" : allBuybackItems.length,
                hint: "iPhone 回收",
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
          <BuybackEmptyState onCreate={() => setQuoteOpen(true)} />
        ) : (
          <motion.section variants={stagger(0.035)} className={cn(repairOs.cardList, "mt-2")}>
            {items.map((item) => (
              <motion.div key={item.id} variants={fadeUp}>
                <BuybackQuoteCard item={item} />
              </motion.div>
            ))}
          </motion.section>
        )}

        <BuybackQuoteWorkspace open={quoteOpen} onOpenChange={handleQuoteOpenChange} />
      </RepairOsMobilePage>
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

function BuybackQuoteCard({ item }: { item: InventoryListItem }) {
  const offer = getBuybackQuoteOffer(item);
  const risk = getBuybackRiskLevel(item);
  const estimatedProfit = Math.max(
    0,
    item.list_price - offer - item.repair_cost_amount - item.fees_amount,
  );
  const statusMeta = inventoryStatusMeta[item.status];

  return (
    <RepairOsBusinessCard className={cn(repairOs.businessCardDense, "grid-cols-1 gap-2")}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-mono text-[12px] font-semibold leading-4 text-primary">
              {item.public_no}
            </span>
            <RepairOsBadge className={statusToneClass(statusMeta.tone)}>
              {statusMeta.shortLabel}
            </RepairOsBadge>
          </div>
          <h2 className="mt-0.5 truncate text-[12px] font-semibold leading-4 text-foreground">
            {item.item_label}
          </h2>
          <p className="truncate text-[10px] leading-4 text-muted-foreground">
            {item.customer_name || "Walk-in"} · IMEI {maskImei(item.serial_or_imei)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-base font-semibold leading-5 tabular-nums">
            <MoneyText amount={offer} />
          </p>
          <RepairOsBadge className={riskToneClass(risk)}>
            {risk === "high" ? "高风险" : risk === "medium" ? "中风险" : "低风险"}
          </RepairOsBadge>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-3 gap-1 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
        <BuybackCardMetric
          label="客户"
          value={
            item.customer_phone ? (
              <PhoneText value={item.customer_phone} className="truncate" />
            ) : (
              "未留电话"
            )
          }
        />
        <BuybackCardMetric
          label="电池"
          value={item.battery_health ? `${item.battery_health}%` : "未测"}
        />
        <BuybackCardMetric
          label="预计毛利"
          value={<MoneyText amount={estimatedProfit} />}
          emphasis={estimatedProfit > 0}
        />
      </div>
    </RepairOsBusinessCard>
  );
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
