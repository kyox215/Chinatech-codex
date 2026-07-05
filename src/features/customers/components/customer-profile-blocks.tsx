"use client";

import Link from "next/link";
import { Bell, Edit3, Inbox, Smartphone, Trash2, Wrench } from "lucide-react";

import { MoneyText, StatusBadge } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import type { CustomerDetail, CustomerTag, Device, OrderListItem } from "@/lib/repairdesk/api";
import type { CustomerOrderWorkbenchItem } from "@/features/customers/model/customer-workbench";
import { RepairOsBadge, RepairOsBusinessCard, RepairOsInfoTile } from "@/shared/ui";

const customerTagPriority = new Map([
  ["tag_followup", 0],
  ["tag_price_sensitive", 1],
  ["tag_vip", 2],
  ["tag_business", 3],
  ["tag_repeat", 4],
]);

export function CustomerDetailTagList({ tags }: { tags: CustomerTag[] }) {
  if (!tags.length) return <span className="text-[10px] text-muted-foreground">无标签</span>;
  const orderedTags = [...tags].sort(
    (a, b) =>
      (customerTagPriority.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (customerTagPriority.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
  const visibleTags = orderedTags.slice(0, 2);
  const hiddenCount = Math.max(0, tags.length - visibleTags.length);

  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {visibleTags.map((tag) => (
        <RepairOsBadge
          key={tag.id}
          title={tag.name}
          className="max-w-20 border bg-card text-[10px]"
          style={{ borderColor: tag.color, color: tag.color }}
        >
          <span className="truncate">{tag.name}</span>
        </RepairOsBadge>
      ))}
      {hiddenCount > 0 ? (
        <RepairOsBadge className="bg-[var(--surface-panel-muted)] text-[10px] text-muted-foreground">
          +{hiddenCount}
        </RepairOsBadge>
      ) : null}
    </div>
  );
}

export function CustomerMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <RepairOsInfoTile
      label={label}
      value={value}
      labelClassName="text-[9px]"
      valueClassName="truncate font-mono text-sm font-semibold leading-5 tabular-nums sm:text-base"
    />
  );
}

export function CustomerInfoBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <RepairOsInfoTile
      label={label}
      value={value}
      frame="plain"
      labelClassName="text-[10px]"
      valueClassName="text-xs leading-4 sm:text-sm"
    />
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
    <RepairOsBusinessCard
      className="grid-cols-[minmax(0,1fr)] gap-1.5 px-2.5 py-1.5"
      bodyClassName="space-y-1.5"
    >
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
    </RepairOsBusinessCard>
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
    <RepairOsBusinessCard
      className="grid-cols-1 gap-1.5 rounded-xl px-2 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:justify-between sm:px-3 sm:py-2"
      trailing={
        <>
          <MoneyText amount={order.quotation_amount} />
          {order.status === "completed" && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onFollowup}>
              <Bell className="size-3.5" /> 待办
            </Button>
          )}
        </>
      }
      trailingClassName="flex shrink-0 items-center gap-3"
    >
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
    </RepairOsBusinessCard>
  );
}

export function CustomerWorkbenchOrderRow({
  item,
  onFollowup,
}: {
  item: CustomerOrderWorkbenchItem;
  onFollowup?: () => void;
}) {
  const { order } = item;
  const unpaid = Math.max(0, order.balance_amount);

  return (
    <RepairOsBusinessCard
      className="grid-cols-1 gap-1.5 rounded-xl px-2 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:justify-between sm:px-3 sm:py-2"
      trailing={
        <div className="grid min-w-0 justify-items-end gap-1">
          <MoneyText amount={order.quotation_amount} />
          <div className="grid justify-items-end gap-0.5 font-mono text-[10px] leading-3 text-muted-foreground tabular-nums">
            <span>
              定金 <MoneyText amount={order.deposit_amount} />
            </span>
            <span className={unpaid > 0 ? "text-status-danger-foreground" : ""}>
              待收 <MoneyText amount={unpaid} />
            </span>
          </div>
          {order.status === "completed" && onFollowup ? (
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onFollowup}>
              <Bell className="size-3.5" /> 待办
            </Button>
          ) : null}
        </div>
      }
      trailingClassName="shrink-0"
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Link
            href={`/orders/${order.id}`}
            className="block truncate font-mono text-[11px] font-medium leading-4 text-primary hover:underline sm:text-xs"
          >
            {order.public_no}
          </Link>
          <StatusBadge status={order.status} />
        </div>
        <div className="mt-0.5 truncate text-xs font-medium sm:text-sm" title={item.deviceLabel}>
          {item.deviceLabel}
        </div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground sm:text-xs">
          {item.deviceImei ? (
            <span className="max-w-full truncate font-mono" title={item.deviceImei}>
              IMEI {item.deviceImei}
            </span>
          ) : null}
          <span className="min-w-0 max-w-full truncate" title={order.issue_description}>
            {order.issue_description}
          </span>
        </div>
      </div>
    </RepairOsBusinessCard>
  );
}

export function CustomerTimelineList({ data, limit }: { data: CustomerDetail; limit?: number }) {
  const orderItems = data.orders.map((order) => ({
    id: `order-${order.id}`,
    at: order.created_at,
    title: `工单 ${order.public_no}`,
    meta: order.device_label,
    body: order.issue_description,
  }));
  const interactionItems = data.interactions.map((interaction) => ({
    id: `interaction-${interaction.id}`,
    at: interaction.created_at,
    title: interaction.channel === "whatsapp" ? "WhatsApp" : "SMS",
    meta: interaction.operator_name,
    body: interaction.message_body,
  }));
  const followupItems = data.followups.map((followup) => ({
    id: `followup-${followup.id}`,
    at: followup.updated_at,
    title: followup.status === "done" ? "完成待办" : "客户待办",
    meta: followup.title,
    body: followup.note || `到期 ${formatCustomerDateTime(followup.due_at)}`,
  }));
  const items = [...orderItems, ...interactionItems, ...followupItems]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);

  if (!items.length) return <CustomerEmptyLine text="暂无动态" />;
  return (
    <ol className="min-w-0 space-y-1.5 border-l border-border/50 pl-3 sm:space-y-2 sm:pl-3.5">
      {items.map((item) => (
        <li key={item.id} className="relative min-w-0">
          <span className="absolute -left-[17px] top-1.5 size-2 rounded-full bg-primary ring-[3px] ring-background sm:-left-[19px] sm:size-2.5" />
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="min-w-0 truncate text-[11px] font-semibold leading-4 sm:text-xs">
              <span title={item.title}>{item.title}</span>
              {item.meta ? (
                <span className="font-normal text-muted-foreground" title={item.meta}>
                  {" "}
                  · {item.meta}
                </span>
              ) : null}
            </div>
            <time className="shrink-0 text-[9px] leading-3 text-muted-foreground">
              {formatCustomerDateTime(item.at)}
            </time>
          </div>
          <p className="line-clamp-1 text-[10px] leading-[14px] text-muted-foreground sm:text-[11px] sm:leading-4">
            {item.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function CustomerEmptyLine({ text }: { text: string }) {
  return (
    <RepairOsBusinessCard
      as="div"
      data-ui="customer-empty-line"
      className="grid-cols-[auto_minmax(0,1fr)] items-center rounded-xl border-dashed px-3 py-3 text-muted-foreground shadow-none"
      leading={
        <span className="grid size-8 place-items-center rounded-lg bg-[var(--surface-panel-muted)] text-muted-foreground">
          <Inbox className="size-4" />
        </span>
      }
      leadingClassName="self-center"
    >
      <span className="block truncate text-xs font-medium leading-4 text-muted-foreground">
        {text}
      </span>
    </RepairOsBusinessCard>
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
