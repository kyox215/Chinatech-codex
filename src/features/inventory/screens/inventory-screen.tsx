"use client";

import type * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Boxes, ExternalLink, PackageCheck, PackageSearch, Search, Truck } from "lucide-react";

import { MoneyText, PhoneText, StatusBadge } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getRepairDeskOptions,
  listOrders,
  type OrderListItem,
  type RepairDeskOptions,
} from "@/lib/repairdesk/api";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import { fadeUp, stagger } from "@/lib/motion";
import {
  brandGradientStyle,
  controls,
  dataDisplay,
  pageHeader,
  pageShell,
} from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

type InventoryStatusFilter = "all" | "parts_ordered" | "parts_arrived" | "supplier";

const partStatuses: RepairOrderStatus[] = ["parts_ordered", "parts_arrived"];

export function InventoryScreen() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InventoryStatusFilter>("all");
  const [supplierId, setSupplierId] = useState("all");

  const { data: options = { suppliers: [], technicians: [] } satisfies RepairDeskOptions } =
    useQuery({
      queryKey: ["repairdesk-options"],
      queryFn: getRepairDeskOptions,
    });

  const { data = [], isLoading } = useQuery({
    queryKey: ["inventory-orders"],
    queryFn: () =>
      listOrders({
        statuses: partStatuses,
      }),
  });

  const inventoryOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.filter((order) => {
      if (status === "parts_ordered" && order.status !== "parts_ordered") return false;
      if (status === "parts_arrived" && order.status !== "parts_arrived") return false;
      if (status === "supplier" && !order.supplier_id) return false;
      if (supplierId !== "all" && order.supplier_id !== supplierId) return false;
      if (!term) return true;
      return [
        order.public_no,
        order.customer_name,
        order.customer_phone,
        order.device_label,
        order.device_imei,
        order.issue_description,
        order.accessory_notes,
        order.fault_prices.map((item) => item.name).join(" "),
        order.supplier_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [data, search, status, supplierId]);

  const stats = useMemo(() => {
    const ordered = data.filter((order) => order.status === "parts_ordered").length;
    const arrived = data.filter((order) => order.status === "parts_arrived").length;
    const supplierLinked = data.filter((order) => Boolean(order.supplier_id)).length;
    const unpaid = data.reduce((sum, order) => sum + (order.balance_amount || 0), 0);
    return { ordered, arrived, supplierLinked, unpaid };
  }, [data]);

  return (
    <div className={pageShell.list}>
      <motion.div
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
        className="mb-5 space-y-4"
      >
        <div className={pageHeader.root}>
          <motion.div variants={fadeUp}>
            <p className={pageHeader.eyebrow}>RepairDesk / 配件库存</p>
            <h1 className={pageHeader.title}>
              <span className="gradient-text">配件与库存</span>
              <span className="ml-2 align-middle text-base font-normal text-muted-foreground">
                共 {inventoryOrders.length} 单
              </span>
            </h1>
            <p className={pageHeader.subtitle}>
              跟踪已订配件、到货配件和外修供应商关联，优先处理等待配件的工单。
            </p>
          </motion.div>
          <motion.div variants={fadeUp} className={pageHeader.actions}>
            <Button
              asChild
              className={cn("gap-1.5", controls.brandButton)}
              style={brandGradientStyle}
            >
              <Link href="/orders?tab=in_progress">
                <ExternalLink className="size-4" /> 打开工单
              </Link>
            </Button>
          </motion.div>
        </div>

        <motion.div variants={fadeUp} className={dataDisplay.kpiGrid}>
          <InventoryKpi icon={PackageSearch} label="已订配件" value={stats.ordered} />
          <InventoryKpi icon={PackageCheck} label="配件已到" value={stats.arrived} />
          <InventoryKpi icon={Truck} label="外修关联" value={stats.supplierLinked} />
          <InventoryKpi icon={Boxes} label="关联尾款" value={<MoneyText amount={stats.unpaid} />} />
        </motion.div>
      </motion.div>

      <div className="glass-card mb-4 flex flex-col gap-3 p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索工单号、客户、设备、IMEI、维修项目或供应商"
              className={controls.searchInput}
            />
          </div>
          <select
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
            aria-label="供应商筛选"
            className="h-9 rounded-md border border-border/60 bg-surface/60 px-2 text-sm text-foreground"
          >
            <option value="all">全部供应商</option>
            {options.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.short_name || supplier.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            ["all", "全部配件单"],
            ["parts_ordered", "配件已订"],
            ["parts_arrived", "配件已到"],
            ["supplier", "外修关联"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value as InventoryStatusFilter)}
              className={cn(
                controls.segmentedButton,
                status === value ? controls.segmentedActive : controls.segmentedInactive,
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : inventoryOrders.length === 0 ? (
        <div className="glass-card mx-auto mt-16 max-w-sm p-8 text-center">
          <Boxes className="mx-auto size-9 text-muted-foreground" />
          <h3 className="mt-3 font-display text-lg font-semibold">暂无配件或外修工单</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            当前筛选下没有配件状态工单，可从工单详情流转到配件已订或配件已到。
          </p>
        </div>
      ) : (
        <>
          <div className="glass-card hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border/40">
                  <th className="px-4 py-2.5 text-left font-medium">工单</th>
                  <th className="px-3 py-2.5 text-left font-medium">客户</th>
                  <th className="px-3 py-2.5 text-left font-medium">设备 / IMEI</th>
                  <th className="px-3 py-2.5 text-left font-medium">维修项目 / 留存备注</th>
                  <th className="px-3 py-2.5 text-left font-medium">供应商</th>
                  <th className="px-3 py-2.5 text-right font-medium">尾款</th>
                  <th className="px-3 py-2.5 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {inventoryOrders.map((order) => (
                  <InventoryTableRow key={order.id} order={order} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {inventoryOrders.map((order) => (
              <InventoryMobileCard key={order.id} order={order} />
            ))}
          </div>
        </>
      )}
    </div>
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

function InventoryTableRow({ order }: { order: OrderListItem }) {
  return (
    <tr className="border-b border-border/30 transition-colors last:border-0 hover:bg-accent/30">
      <td className="px-4 py-3">
        <Link href={`/orders/${order.id}`} className="font-mono text-xs font-medium text-primary">
          {order.public_no}
        </Link>
        <div className="mt-1">
          <StatusBadge status={order.status} />
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="font-medium">{order.customer_name}</div>
        <PhoneText value={order.customer_phone} />
      </td>
      <td className="px-3 py-3">
        <div className="font-medium">{order.device_label}</div>
        <div className="font-mono text-[11px] text-muted-foreground">
          {order.device_imei || "-"}
        </div>
      </td>
      <td className="max-w-[220px] px-3 py-3 text-xs text-muted-foreground">
        {order.accessory_notes ||
          order.fault_prices.map((item) => item.name).join("、") ||
          order.issue_description}
      </td>
      <td className="px-3 py-3">
        {order.supplier_name ? (
          <span className="inline-flex items-center gap-1.5 rounded border bg-surface-muted px-1.5 py-0.5 text-xs">
            {order.supplier_color && (
              <span className="size-2 rounded-full" style={{ background: order.supplier_color }} />
            )}
            {order.supplier_name}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">未关联</span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <MoneyText amount={order.balance_amount} />
      </td>
      <td className="px-3 py-3">
        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
          <Link href={`/orders/${order.id}`}>
            处理 <ExternalLink className="size-3" />
          </Link>
        </Button>
      </td>
    </tr>
  );
}

function InventoryMobileCard({ order }: { order: OrderListItem }) {
  return (
    <Link
      href={`/orders/${order.id}`}
      className="glass-card block border-l-2 border-l-primary p-3 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-xs font-semibold text-primary">{order.public_no}</div>
          <div className="mt-1 truncate font-medium">{order.device_label}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {order.customer_name} · {order.device_imei || "无 IMEI"}
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Info
          label="留存备注"
          value={
            order.accessory_notes ||
            order.fault_prices.map((item) => item.name).join("、") ||
            order.issue_description
          }
        />
        <Info label="供应商" value={order.supplier_name || "未关联"} />
        <Info label="电话" value={order.customer_phone} mono />
        <Info label="尾款" value={<MoneyText amount={order.balance_amount} />} />
      </div>
    </Link>
  );
}

function Info({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("truncate", mono && "font-mono")}>{value}</div>
    </div>
  );
}
