import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { MoneyText, PhoneText } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCustomerDate } from "@/features/customers/model/customer-list";
import { brandGradientStyle, density } from "@/lib/ui-patterns";
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
    <div className="glass-card flex items-center justify-between p-4">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
          {label}
        </div>
        <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</div>
      </div>
      <div
        className="grid size-9 place-items-center rounded-md text-primary-foreground"
        style={brandGradientStyle}
      >
        <Icon className="size-4" />
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
      <td className="whitespace-nowrap px-2 py-2 text-[11px] text-muted-foreground">
        {customer.next_followup_at ? formatCustomerDate(customer.next_followup_at) : "—"}
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
  const followup = customer.next_followup_at ? formatCustomerDate(customer.next_followup_at) : "—";
  return (
    <Card
      className={cn(density.cardDense, "grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3")}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
    >
      <div className="w-16 min-w-0">
        <CustomerTagList tags={customer.tags.slice(0, 1)} />
      </div>
      <div className="min-w-0">
        <div className="min-w-0">
          <Link
            href={`/customers/${customer.id}`}
            title={customer.name}
            className="block truncate text-sm font-semibold hover:text-primary"
          >
            {customer.name}
          </Link>
          <PhoneText value={customer.phone_e164} className="mt-0.5 block truncate" />
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {customer.latest_device_label ?? "暂无设备"} · {customer.device_count} 台设备 ·{" "}
          {customer.order_count} 个工单
        </div>
      </div>
      <div className="flex min-w-[5.5rem] flex-col items-end text-right text-xs">
        <MoneyText amount={customer.total_spent} />
        <span className="mt-1 max-w-24 truncate text-[11px] text-muted-foreground">{followup}</span>
        <Button asChild variant="ghost" size="icon" className="mt-1 size-7">
          <Link href={`/customers/${customer.id}`} aria-label="查看客户">
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  );
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
