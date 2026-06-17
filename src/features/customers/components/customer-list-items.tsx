import Link from "next/link";
import { ArrowUpRight, CircleDollarSign, Smartphone, Wrench } from "lucide-react";

import { MoneyText, PhoneText } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { RepairOsBusinessCard, RepairOsBadge } from "@/shared/ui";
import { brandGradientStyle, repairOs } from "@/lib/ui-patterns";
import type { CustomerListItem, CustomerTag } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";

export function CustomerKpiCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className={cn(repairOs.metricCardDense, "flex items-center justify-between gap-3")}>
      <div className="min-w-0">
        <div className={repairOs.metricLabel}>{label}</div>
        <div className="mt-1 font-mono text-lg font-semibold leading-none tabular-nums">
          {value}
        </div>
      </div>
      <div
        className="grid size-8 shrink-0 place-items-center rounded-md text-primary-foreground"
        style={brandGradientStyle}
      >
        <Icon className="size-3.5" />
      </div>
    </div>
  );
}

export function CustomerRow({
  customer,
  onPrefetch,
}: {
  customer: CustomerListItem;
  onPrefetch?: () => void;
}) {
  return (
    <tr
      className="h-12 border-b border-border/30 transition-colors hover:bg-accent/30"
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
    >
      <td className="min-w-0 px-3 py-2">
        <div className="min-w-0">
          <Link
            href={`/customers/${customer.id}`}
            title={customer.name}
            className="block truncate text-xs font-medium hover:text-primary hover:underline"
          >
            {customer.name}
          </Link>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
            <PhoneText value={customer.phone_e164} className="block truncate text-[11px]" />
            {customer.email && (
              <span className="min-w-0 truncate" title={customer.email}>
                {customer.email}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="min-w-0 px-2 py-2">
        <CustomerTagList tags={customer.tags} />
      </td>
      <td className="min-w-0 px-2 py-2">
        <div className="truncate text-xs font-medium" title={customer.latest_device_label ?? ""}>
          {customer.latest_device_label ?? "暂无设备"}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {customer.device_count} 台设备 · {customer.order_count} 个工单
        </div>
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-right text-xs">
        <MoneyText amount={customer.total_spent} />
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-right text-xs">
        <MoneyText amount={customer.unpaid_amount} />
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-[11px]">
        <CustomerWorkState customer={customer} />
      </td>
      <td className="px-2 py-2 text-right">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
          <Link href={`/customers/${customer.id}`}>
            详情 <ArrowUpRight className="size-3" />
          </Link>
        </Button>
      </td>
    </tr>
  );
}

export function CustomerMobileCard({
  customer,
  onPrefetch,
}: {
  customer: CustomerListItem;
  onPrefetch?: () => void;
}) {
  const activeLabel =
    customer.active_order_count > 0 ? `在修 ${customer.active_order_count}` : "暂无在修";
  return (
    <RepairOsBusinessCard
      className={cn(repairOs.businessCardDense, "transition-transform active:scale-[0.99]")}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      trailing={
        <div className="flex min-w-[4.5rem] flex-col items-end text-right text-xs">
          <MoneyText amount={customer.total_spent} className={repairOs.cardAmount} />
          <span
            className={cn(
              "mt-0.5 max-w-24 truncate text-[11px] leading-4",
              customer.unpaid_amount > 0 ? "text-status-warn-foreground" : "text-muted-foreground",
            )}
          >
            {customer.unpaid_amount > 0 ? "有未结清" : `${customer.order_count} 个工单`}
          </span>
          <Button asChild variant="ghost" size="icon" className="mt-0.5 size-7">
            <Link href={`/customers/${customer.id}`} aria-label="查看客户">
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      }
    >
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={`/customers/${customer.id}`}
          title={customer.name}
          className={cn(repairOs.cardTitle, "hover:text-primary")}
        >
          {customer.name}
        </Link>
        {customer.tags[0] ? (
          <RepairOsBadge
            className="max-w-20 border bg-card"
            style={{ borderColor: customer.tags[0].color, color: customer.tags[0].color }}
          >
            <span className="truncate">{customer.tags[0].name}</span>
          </RepairOsBadge>
        ) : (
          <RepairOsBadge className="bg-status-neutral text-status-neutral-foreground">
            普通
          </RepairOsBadge>
        )}
      </div>
      <PhoneText value={customer.phone_e164} className="block truncate text-[11px] leading-4" />
      <div className="mt-1 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
        <p className={cn(repairOs.cardMeta, "min-w-0 truncate")}>
          {customer.latest_device_label ?? "暂无设备"}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--surface-panel-muted)] px-1.5 py-0.5 text-[9px] font-medium leading-none text-muted-foreground">
          <Smartphone className="size-2.5" />
          {customer.device_count} / {customer.order_count}
        </span>
      </div>
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none",
            customer.active_order_count > 0
              ? "bg-status-info text-status-info-foreground"
              : "bg-status-neutral text-status-neutral-foreground",
          )}
        >
          <Wrench className="size-2.5" />
          {activeLabel}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none",
            customer.unpaid_amount > 0
              ? "bg-status-warn text-status-warn-foreground"
              : "bg-status-success text-status-success-foreground",
          )}
        >
          <CircleDollarSign className="size-2.5" />
          {customer.unpaid_amount > 0 ? "未结清" : "已结清"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-panel-muted)] px-1.5 py-0.5 text-[9px] font-medium leading-none text-muted-foreground">
          <Smartphone className="size-2.5" />
          {customer.device_count} 台设备
        </span>
      </div>
    </RepairOsBusinessCard>
  );
}

function CustomerWorkState({ customer }: { customer: CustomerListItem }) {
  if (customer.active_order_count > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-status-info px-1.5 py-0.5 font-semibold text-status-info-foreground">
        <Wrench className="size-3" />
        在修 {customer.active_order_count}
      </span>
    );
  }
  if (customer.unpaid_amount > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-status-warn px-1.5 py-0.5 font-semibold text-status-warn-foreground">
        <CircleDollarSign className="size-3" />
        未结清
      </span>
    );
  }
  if (customer.order_count > 1) {
    return <span className="text-muted-foreground">老客户</span>;
  }
  return <span className="text-muted-foreground">普通</span>;
}

function CustomerTagList({ tags }: { tags: CustomerTag[] }) {
  if (!tags.length) return <span className="text-xs text-muted-foreground">无标签</span>;
  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {tags.slice(0, 3).map((tag) => (
        <span
          key={tag.id}
          title={tag.name}
          className="max-w-20 truncate rounded border px-1.5 py-0.5 text-[11px]"
          style={{ borderColor: tag.color, color: tag.color }}
        >
          {tag.name}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="text-[11px] text-muted-foreground">+{tags.length - 3}</span>
      )}
    </div>
  );
}
