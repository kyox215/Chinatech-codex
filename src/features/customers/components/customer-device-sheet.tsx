"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  Edit3,
  ExternalLink,
  History,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wrench,
} from "lucide-react";

import { MoneyText, StatusBadge } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CustomerDeviceWorkbenchItem } from "@/features/customers/model/customer-workbench";
import { formatCustomerDateTime } from "@/features/customers/components/customer-profile-blocks";
import { componentOverlay } from "@/lib/component-patterns";
import type { Device } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { RepairOsBadge, RepairOsInfoTile } from "@/shared/ui";

export interface CustomerDeviceSheetProps {
  item?: CustomerDeviceWorkbenchItem;
  customerId: string;
  open: boolean;
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (device: Device) => void;
  onDelete: (deviceId: string) => void;
}

export function CustomerDeviceSheet({
  item,
  customerId,
  open,
  deleting,
  onOpenChange,
  onEdit,
  onDelete,
}: CustomerDeviceSheetProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
  }, [item?.device.id, open]);

  const activeOrder = useMemo(
    () => item?.orderItems.find((orderItem) => orderItem.state === "active"),
    [item],
  );
  const unpaidOrder = useMemo(
    () =>
      item?.orderItems.find(
        (orderItem) => orderItem.state !== "closed" && orderItem.order.balance_amount > 0,
      ),
    [item],
  );
  const primaryOrder = activeOrder ?? unpaidOrder;
  const primaryActionLabel = activeOrder ? "查看在修" : unpaidOrder ? "查看欠款" : "新建工单";

  if (!item) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className={sheetContentClass}>
          <SheetHeader className="sr-only">
            <SheetTitle>设备详情</SheetTitle>
            <SheetDescription>客户设备维修历史与统计</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const { device } = item;
  const deviceName = `${device.brand} ${device.model}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={sheetContentClass}>
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border/70" />
        <SheetHeader className="shrink-0 space-y-2 px-3 pb-2 pt-2 text-left">
          <div className="flex min-w-0 items-start gap-2 pr-10">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Smartphone className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-sm font-semibold leading-5" title={deviceName}>
                {deviceName}
              </SheetTitle>
              <SheetDescription
                className="mt-0.5 truncate font-mono text-[10px] leading-4"
                title={device.serial_or_imei || "无 IMEI"}
              >
                {device.serial_or_imei || "无 IMEI"}
              </SheetDescription>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap gap-1">
            {item.activeOrderCount > 0 ? (
              <RepairOsBadge className="bg-status-info text-[10px] text-status-info-foreground">
                在修 {item.activeOrderCount}
              </RepairOsBadge>
            ) : null}
            {item.unpaidAmount > 0 ? (
              <RepairOsBadge className="bg-status-danger/10 text-[10px] text-status-danger-foreground">
                待收 <MoneyText amount={item.unpaidAmount} />
              </RepairOsBadge>
            ) : null}
            <RepairOsBadge className="bg-[var(--surface-panel-muted)] text-[10px] text-muted-foreground">
              历史 {item.orderItems.length} 单
            </RepairOsBadge>
          </div>
          {device.device_notes ? (
            <p className="line-clamp-2 text-[10px] leading-4 text-muted-foreground">
              {device.device_notes}
            </p>
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <div className="grid min-w-0 grid-cols-2 gap-1.5">
            <DeviceMetric label="维修次数" value={`${item.repairCount} 次`} />
            <DeviceMetric label="总金额" value={<MoneyText amount={item.totalQuoted} />} />
            <DeviceMetric label="待收尾款" value={<MoneyText amount={item.unpaidAmount} />} />
            <DeviceMetric label="售后" value={item.warrantyLabel} />
          </div>

          <div className="mt-2 grid min-w-0 gap-1.5">
            {primaryOrder ? (
              <div className="flex min-w-0 items-start gap-2 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2.5 py-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-status-warn-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold leading-4">
                    {activeOrder ? "当前仍在维修流程中" : "还有尾款待收"}
                  </div>
                  <div className="truncate text-[10px] leading-4 text-muted-foreground">
                    {primaryOrder.order.public_no} · {primaryOrder.order.issue_description}
                  </div>
                </div>
              </div>
            ) : null}

            {!item.canDelete ? (
              <div className="flex min-w-0 items-start gap-2 rounded-xl bg-[var(--surface-panel-muted)] px-2.5 py-2 text-[10px] leading-4 text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0">{item.deleteBlockedReason}</span>
              </div>
            ) : null}
          </div>

          <section className="mt-2 min-w-0">
            <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
              <div className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold leading-4">
                <History className="size-3.5 text-primary" />
                <span>设备历史</span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {item.orderItems.length} 单
              </span>
            </div>
            {item.orderItems.length ? (
              <div className="grid min-w-0 gap-1.5 pb-1">
                {item.orderItems.map((orderItem) => (
                  <DeviceHistoryRow key={orderItem.order.id} item={orderItem} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-4 text-center text-xs text-muted-foreground">
                暂无关联工单，可直接用这台设备创建新工单。
              </div>
            )}
          </section>
        </div>

        <SheetFooter className="flex-col shrink-0 border-t border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 sm:flex-col sm:items-stretch sm:space-x-0">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-1.5 sm:flex sm:w-full sm:justify-end">
            {primaryOrder ? (
              <Button asChild size="sm" className="h-9 gap-1.5 text-xs">
                <Link href={`/orders/${primaryOrder.order.id}`}>
                  <ExternalLink className="size-3.5" /> {primaryActionLabel}
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" className="h-9 gap-1.5 text-xs">
                <Link href={`/orders/new?customerId=${customerId}&deviceId=${device.id}`}>
                  <Wrench className="size-3.5" /> {primaryActionLabel}
                </Link>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 px-3 text-xs"
              onClick={() => onEdit(device)}
            >
              <Edit3 className="size-3.5" /> 编辑
            </Button>
          </div>
          {item.canDelete ? (
            confirmDelete ? (
              <div className="mt-1.5 grid min-w-0 gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 p-2 sm:w-full">
                <div className="min-w-0 text-[10px] leading-4 text-muted-foreground">
                  确认删除 {deviceName}
                  {device.serial_or_imei ? ` · ${device.serial_or_imei}` : ""}？
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={deleting}
                    onClick={() => setConfirmDelete(false)}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-8 gap-1.5 text-xs"
                    disabled={deleting}
                    onClick={() => onDelete(device.id)}
                  >
                    <Trash2 className="size-3.5" />
                    {deleting ? "删除中" : "确认删除"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-1.5 h-8 w-full gap-1.5 text-xs text-destructive hover:text-destructive sm:w-auto"
                disabled={deleting}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-3.5" /> 删除设备
              </Button>
            )
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DeviceMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <RepairOsInfoTile
      label={label}
      value={value}
      frame="plain"
      className="min-w-0 rounded-xl bg-[var(--surface-panel-muted)] px-2.5 py-2"
      labelClassName="text-[9px]"
      valueClassName="truncate text-xs font-semibold leading-4 tabular-nums"
    />
  );
}

function DeviceHistoryRow({ item }: { item: CustomerDeviceWorkbenchItem["orderItems"][number] }) {
  const isClosed = item.state === "closed";
  const balance = Math.max(0, item.order.balance_amount);

  return (
    <Link
      href={`/orders/${item.order.id}`}
      aria-label={`查看工单 ${item.order.public_no} ${item.order.issue_description}`}
      className={cn(
        "grid min-w-0 gap-1 rounded-xl border border-[var(--border-panel)] bg-card px-2.5 py-2 transition-colors hover:bg-accent/40",
        isClosed && "opacity-70",
      )}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-mono text-[10px] font-semibold text-primary">
            {item.order.public_no}
          </span>
          <StatusBadge status={item.order.status} className="max-w-[5.5rem] text-[10px]" />
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-[9px] leading-3 text-muted-foreground">
          <CalendarClock className="size-3" />
          {formatCustomerDateTime(item.order.created_at)}
        </span>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
        <span
          className="line-clamp-1 text-[10px] leading-4 text-muted-foreground"
          title={item.order.issue_description}
        >
          {item.order.issue_description}
        </span>
        <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums">
          <MoneyText amount={item.order.quotation_amount} />
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 font-mono text-[9px] leading-3 text-muted-foreground tabular-nums">
        <span>
          定金 <MoneyText amount={item.order.deposit_amount} />
        </span>
        <span className={balance > 0 ? "text-status-danger-foreground" : ""}>
          待收 <MoneyText amount={balance} />
        </span>
      </div>
    </Link>
  );
}

const sheetContentClass = cn(
  componentOverlay.bottomSheet,
  "inset-x-auto bottom-0 left-1/2 right-auto flex h-[min(92svh,760px)] w-[min(430px,calc(100vw-8px))] max-w-[calc(100vw-8px)] -translate-x-1/2 flex-col gap-0 rounded-t-2xl p-0 sm:h-[min(90svh,760px)]",
);
