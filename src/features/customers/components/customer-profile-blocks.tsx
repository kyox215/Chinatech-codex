"use client";

import Link from "next/link";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { Bell, Edit3, History, Inbox, ShieldCheck, Smartphone, Trash2, Wrench } from "lucide-react";

import { MoneyText, StatusBadge } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import type { CustomerDetail, CustomerTag, OrderListItem } from "@/lib/repairdesk/api";
import type {
  CustomerDeviceWorkbenchItem,
  CustomerOrderWorkbenchItem,
} from "@/features/customers/model/customer-workbench";
import { isCustomerOrderCancelled } from "@/features/customers/model/customer-order-state";
import {
  buildNewOrderWorkspaceHref,
  buildOrderDetailWorkspaceHref,
} from "@/features/orders/model/order-workspace-intent";
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
  item,
  customerId,
  deleting,
  onOpen,
  onEdit,
  onDelete,
}: {
  item: CustomerDeviceWorkbenchItem;
  customerId: string;
  deleting: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { device, latestOrder } = item;
  const hasHistory = item.orderItems.length > 0;
  const deviceName = `${device.brand} ${device.model}`;
  const stopCardClick = (event: ReactMouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onOpen();
  };

  return (
    <RepairOsBusinessCard
      role="button"
      tabIndex={0}
      aria-label={`查看设备详情 ${device.brand} ${device.model}`}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className="grid-cols-[minmax(0,1fr)] gap-1.5 px-2.5 py-1.5 transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      <div className="grid min-w-0 grid-cols-2 gap-1.5">
        <RepairOsInfoTile
          label="维修次数"
          value={`${item.repairCount} 次`}
          frame="plain"
          className="min-w-0 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5"
          labelClassName="text-[9px]"
          valueClassName="truncate font-mono text-xs font-semibold leading-4 tabular-nums"
        />
        <RepairOsInfoTile
          label="有效工单额"
          value={item.financeRedacted ? "金额受限" : <MoneyText amount={item.totalQuoted} />}
          frame="plain"
          className="min-w-0 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5"
          labelClassName="text-[9px]"
          valueClassName="truncate font-mono text-xs font-semibold leading-4 tabular-nums"
        />
        <RepairOsInfoTile
          label="待收"
          value={item.financeRedacted ? "金额受限" : <MoneyText amount={item.unpaidAmount} />}
          frame="plain"
          className="min-w-0 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5"
          labelClassName="text-[9px]"
          valueClassName="truncate font-mono text-xs font-semibold leading-4 tabular-nums"
        />
        <RepairOsInfoTile
          label="售后"
          value={item.warrantyLabel}
          frame="plain"
          className="min-w-0 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5"
          labelClassName="text-[9px]"
          valueClassName="truncate text-xs font-semibold leading-4"
        />
      </div>
      {latestOrder ? (
        <div className="rounded-lg border border-[var(--border-panel)] bg-card/60 px-2 py-1.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <Link
              href={buildOrderDetailWorkspaceHref(latestOrder.order.id, { source: "customer" })}
              className="truncate font-mono text-[10px] font-semibold text-primary hover:underline"
              onClick={stopCardClick}
            >
              {latestOrder.order.public_no}
            </Link>
            <StatusBadge
              status={
                isCustomerOrderCancelled(latestOrder.order) ? "cancelled" : latestOrder.order.status
              }
              className="max-w-[5.5rem] text-[10px]"
            />
          </div>
          <p
            className="mt-0.5 line-clamp-1 text-[10px] leading-4 text-muted-foreground"
            title={latestOrder.order.issue_description}
          >
            最近：{latestOrder.order.issue_description}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 py-2 text-[10px] font-medium leading-4 text-muted-foreground">
          暂无关联工单
        </div>
      )}
      {item.activeOrderCount > 0 ? (
        <RepairOsBadge className="w-fit bg-status-info text-[10px] text-status-info-foreground">
          在修 {item.activeOrderCount}
        </RepairOsBadge>
      ) : null}
      {hasHistory ? (
        <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--border-panel)] bg-card/60 px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <History className="size-3.5 shrink-0" />
            <span className="truncate">设备历史 · {item.orderItems.length} 单</span>
          </span>
          <span className="shrink-0 text-primary">点开查看</span>
        </div>
      ) : null}
      {!item.canDelete ? (
        <div className="flex min-w-0 items-start gap-1.5 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] font-medium leading-4 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          <span>{item.deleteBlockedReason}</span>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        <Button asChild size="sm" variant="outline" className="h-11 gap-1.5 lg:h-8">
          <Link
            href={buildNewOrderWorkspaceHref({
              source: "customer",
              customerId,
              deviceId: device.id,
            })}
            onClick={stopCardClick}
          >
            <Wrench className="size-3.5" /> 新建工单
          </Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-11 gap-1.5 lg:h-8"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          <Edit3 className="size-3.5" /> 编辑
        </Button>
        {item.canDelete ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-11 gap-1.5 text-destructive hover:text-destructive lg:h-8"
            disabled={deleting}
            onClick={(event) => {
              event.stopPropagation();
              if (
                window.confirm(
                  `确认删除 ${deviceName}${device.serial_or_imei ? ` · ${device.serial_or_imei}` : ""}？`,
                )
              ) {
                onDelete();
              }
            }}
          >
            <Trash2 className="size-3.5" /> 删除
          </Button>
        ) : null}
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
  const cancelled = isCustomerOrderCancelled(order);
  const financeRedacted = Boolean(order.finance_redacted);

  return (
    <RepairOsBusinessCard
      className="grid-cols-1 gap-1.5 rounded-xl px-2 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:justify-between sm:px-3 sm:py-2"
      trailing={
        <>
          {financeRedacted ? (
            <span className="text-[10px] text-muted-foreground">金额受限</span>
          ) : (
            <MoneyText amount={order.quotation_amount} />
          )}
          {order.status === "completed" && !cancelled && (
            <Button
              size="sm"
              variant="outline"
              className="h-11 gap-1.5 lg:h-8"
              onClick={onFollowup}
            >
              <Bell className="size-3.5" /> 待办
            </Button>
          )}
        </>
      }
      trailingClassName="flex shrink-0 items-center gap-3"
    >
      <div className="min-w-0 flex-1">
        <Link
          href={buildOrderDetailWorkspaceHref(order.id, { source: "customer" })}
          className="block truncate font-mono text-[11px] font-medium leading-4 text-primary hover:underline sm:text-xs"
        >
          {order.public_no}
        </Link>
        <div className="mt-0.5 truncate text-xs font-medium sm:text-sm" title={order.device_label}>
          {order.device_label}
        </div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground sm:text-xs">
          <StatusBadge status={cancelled ? "cancelled" : order.status} />
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
  const cancelled = isCustomerOrderCancelled(order);
  const financeRedacted = item.financeRedacted || Boolean(order.finance_redacted);

  return (
    <RepairOsBusinessCard
      className="grid-cols-1 gap-1.5 rounded-xl px-2 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:justify-between sm:px-3 sm:py-2"
      trailing={
        <div className="grid min-w-0 justify-items-end gap-1">
          {financeRedacted ? (
            <span className="text-[10px] text-muted-foreground">金额受限</span>
          ) : (
            <>
              <MoneyText amount={order.quotation_amount} />
              <div className="grid justify-items-end gap-0.5 font-mono text-[10px] leading-3 text-muted-foreground tabular-nums">
                <span>
                  定金 <MoneyText amount={order.deposit_amount} />
                </span>
                {cancelled ? (
                  <span className="text-muted-foreground">
                    取消时余额 <MoneyText amount={unpaid} /> · 不计入待收
                  </span>
                ) : (
                  <span className={unpaid > 0 ? "text-status-danger-foreground" : ""}>
                    待收 <MoneyText amount={unpaid} />
                  </span>
                )}
              </div>
            </>
          )}
          {order.status === "completed" && onFollowup ? (
            <Button
              size="sm"
              variant="outline"
              className="h-11 gap-1.5 lg:h-8"
              onClick={onFollowup}
            >
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
            href={buildOrderDetailWorkspaceHref(order.id, { source: "customer" })}
            className="block truncate font-mono text-[11px] font-medium leading-4 text-primary hover:underline sm:text-xs"
          >
            {order.public_no}
          </Link>
          <StatusBadge status={cancelled ? "cancelled" : order.status} />
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
