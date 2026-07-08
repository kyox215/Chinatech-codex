"use client";

import Link from "next/link";
import { Bell, Edit3, Smartphone, Trash2, Wrench } from "lucide-react";

import { MoneyText, StatusBadge } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import type { CustomerDetail, CustomerTag, Device, OrderListItem } from "@/lib/repairdesk/api";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export function CustomerDetailTagList({ tags }: { tags: CustomerTag[] }) {
  if (!tags.length) return <span className="text-[10px] text-muted-foreground">无标签</span>;
  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag.id}
          title={tag.name}
          className="max-w-24 truncate rounded border px-1.5 py-0.5 text-[11px]"
          style={{ borderColor: tag.color, color: tag.color }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}

export function CustomerMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--surface-panel-muted)] px-2 py-1.5">
      <div className="truncate text-[9px] leading-3 text-muted-foreground">{label}</div>
      <div className="mt-0.5 min-w-0 truncate font-mono text-sm font-semibold leading-5 tabular-nums sm:text-base">
        {value}
      </div>
    </div>
  );
}

export function CustomerInfoBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] leading-3 text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-words text-xs leading-4 sm:text-sm">{value}</div>
    </div>
  );
}

export function CustomerDeviceCard({
  device,
  customerId,
  deleting,
  onEdit,
  onDelete,
}: {
  device: Device;
  customerId: string;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn(repairOs.businessCardDense, "grid-cols-[minmax(0,1fr)] gap-1.5 py-1.5")}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="truncate text-xs font-medium sm:text-sm"
            title={`${device.brand} ${device.model}`}
          >
            {device.brand} {device.model}
          </div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground sm:text-xs">
            {device.serial_or_imei || "无 IMEI"}
          </div>
        </div>
        <Smartphone className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {device.device_notes && (
        <p className="break-words text-[11px] leading-4 text-muted-foreground">
          {device.device_notes}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
          <Link href={`/orders/new?customerId=${customerId}&deviceId=${device.id}`}>
            <Wrench className="size-3.5" /> 新建工单
          </Link>
        </Button>
        <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={onEdit}>
          <Edit3 className="size-3.5" /> 编辑
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-destructive hover:text-destructive"
          disabled={deleting}
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" /> 删除
        </Button>
      </div>
    </div>
  );
}

export function CustomerOrderRow({
  order,
  onFollowup,
}: {
  order: OrderListItem;
  onFollowup: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-[var(--border-panel)] bg-card px-2 py-1.5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:px-3 sm:py-2">
      <div className="min-w-0 flex-1">
        <Link
          href={`/orders/${order.id}`}
          className="block truncate font-mono text-[11px] font-medium leading-4 text-primary hover:underline sm:text-xs"
        >
          {order.public_no}
        </Link>
        <div className="mt-0.5 truncate text-xs font-medium sm:text-sm" title={order.device_label}>
          {order.device_label}
        </div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground sm:text-xs">
          <StatusBadge status={order.status} />
          <span className="min-w-0 max-w-full truncate" title={order.issue_description}>
            {order.issue_description}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <MoneyText amount={order.quotation_amount} />
        {order.status === "completed" && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onFollowup}>
            <Bell className="size-3.5" /> 待办
          </Button>
        )}
      </div>
    </div>
  );
}

export function CustomerTimelineList({ data, limit }: { data: CustomerDetail; limit?: number }) {
  const orderItems = data.orders.map((order) => ({
    id: `order-${order.id}`,
    at: order.created_at,
    title: `创建工单 ${order.public_no}`,
    body: `${order.device_label} · ${order.issue_description}`,
  }));
  const interactionItems = data.interactions.map((interaction) => ({
    id: `interaction-${interaction.id}`,
    at: interaction.created_at,
    title: `发送${interaction.channel === "whatsapp" ? " WhatsApp" : " SMS"}`,
    body: interaction.message_body,
  }));
  const followupItems = data.followups.map((followup) => ({
    id: `followup-${followup.id}`,
    at: followup.updated_at,
    title:
      followup.status === "done" ? `完成待办：${followup.title}` : `客户待办：${followup.title}`,
    body: followup.note || formatCustomerDateTime(followup.due_at),
  }));
  const items = [...orderItems, ...interactionItems, ...followupItems]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);

  if (!items.length) return <CustomerEmptyLine text="暂无动态" />;
  return (
    <ol className="min-w-0 space-y-2 border-l border-border/60 pl-3.5 sm:space-y-3 sm:pl-4">
      {items.map((item) => (
        <li key={item.id} className="relative min-w-0">
          <span className="absolute -left-[19px] top-1 size-2.5 rounded-full bg-primary ring-4 ring-background sm:-left-[21px] sm:size-3" />
          <div className="text-[10px] leading-3 text-muted-foreground sm:text-xs">
            {formatCustomerDateTime(item.at)}
          </div>
          <div className="truncate text-xs font-medium leading-4 sm:text-sm" title={item.title}>
            {item.title}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground sm:text-xs">
            {item.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function CustomerEmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-panel)] px-3 py-5 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

export function formatCustomerDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
