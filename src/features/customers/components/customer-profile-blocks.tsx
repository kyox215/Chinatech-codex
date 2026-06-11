"use client";

import Link from "next/link";
import { Bell, Edit3, Smartphone, Trash2, Wrench } from "lucide-react";

import { MoneyText, StatusBadge } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import type { CustomerDetail, CustomerTag, Device, OrderListItem } from "@/lib/repairdesk/api";

export function CustomerDetailTagList({ tags }: { tags: CustomerTag[] }) {
  if (!tags.length) return <span className="text-xs text-muted-foreground">无标签</span>;
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
    <div className="min-w-0 rounded-md bg-surface-muted/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 min-w-0 truncate font-display text-xl font-semibold">{value}</div>
    </div>
  );
}

export function CustomerInfoBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm">{value}</div>
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
    <div className="min-w-0 rounded-md border p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium" title={`${device.brand} ${device.model}`}>
            {device.brand} {device.model}
          </div>
          <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
            {device.serial_or_imei || "无 IMEI"}
          </div>
        </div>
        <Smartphone className="size-5 shrink-0 text-muted-foreground" />
      </div>
      {device.device_notes && (
        <p className="mt-2 break-words text-sm text-muted-foreground">{device.device_notes}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
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
    <div className="flex min-w-0 flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <Link
          href={`/orders/${order.id}`}
          className="block truncate font-mono text-xs font-medium text-primary hover:underline"
        >
          {order.public_no}
        </Link>
        <div className="mt-1 truncate font-medium" title={order.device_label}>
          {order.device_label}
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
            <Bell className="size-3.5" /> 回访
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
      followup.status === "done" ? `完成回访：${followup.title}` : `回访任务：${followup.title}`,
    body: followup.note || formatCustomerDateTime(followup.due_at),
  }));
  const items = [...orderItems, ...interactionItems, ...followupItems]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);

  if (!items.length) return <CustomerEmptyLine text="暂无动态" />;
  return (
    <ol className="min-w-0 space-y-4 border-l border-border/60 pl-4">
      {items.map((item) => (
        <li key={item.id} className="relative min-w-0">
          <span className="absolute -left-[21px] top-1 size-3 rounded-full bg-primary ring-4 ring-background" />
          <div className="text-xs text-muted-foreground">{formatCustomerDateTime(item.at)}</div>
          <div className="truncate text-sm font-medium" title={item.title}>
            {item.title}
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function CustomerEmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
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
