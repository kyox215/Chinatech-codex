import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { MoneyText, PhoneText } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCustomerDate } from "@/features/customers/model/customer-list";
import { brandGradientStyle } from "@/lib/ui-patterns";
import type { CustomerListItem, CustomerTag } from "@/lib/repairdesk/api";

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
        className="grid size-9 place-items-center rounded-md text-white"
        style={brandGradientStyle}
      >
        <Icon className="size-4" />
      </div>
    </div>
  );
}

export function CustomerRow({ customer }: { customer: CustomerListItem }) {
  return (
    <tr className="border-b border-border/30 transition-colors hover:bg-accent/30">
      <td className="px-4 py-3">
        <Link
          href={`/customers/${customer.id}`}
          className="font-medium hover:text-primary hover:underline"
        >
          {customer.name}
        </Link>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <PhoneText value={customer.phone_e164} />
          {customer.email && <span>{customer.email}</span>}
        </div>
      </td>
      <td className="px-3 py-3">
        <CustomerTagList tags={customer.tags} />
      </td>
      <td className="px-3 py-3">
        <div className="font-medium">{customer.latest_device_label ?? "暂无设备"}</div>
        <div className="text-xs text-muted-foreground">
          {customer.device_count} 台设备 · {customer.order_count} 个工单
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        <MoneyText amount={customer.total_spent} />
      </td>
      <td className="px-3 py-3 text-right">
        <MoneyText amount={customer.unpaid_amount} />
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {customer.next_followup_at ? formatCustomerDate(customer.next_followup_at) : "—"}
      </td>
      <td className="px-3 py-3 text-right">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
          <Link href={`/customers/${customer.id}`}>
            详情 <ArrowUpRight className="size-3" />
          </Link>
        </Button>
      </td>
    </tr>
  );
}

export function CustomerMobileCard({ customer }: { customer: CustomerListItem }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/customers/${customer.id}`} className="font-semibold hover:text-primary">
            {customer.name}
          </Link>
          <div className="mt-1 text-xs text-muted-foreground">
            <PhoneText value={customer.phone_e164} />
          </div>
        </div>
        <Button asChild variant="ghost" size="icon">
          <Link href={`/customers/${customer.id}`} aria-label="查看客户">
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </div>
      <div className="mt-3">
        <CustomerTagList tags={customer.tags} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <InfoPill label="设备" value={`${customer.device_count}`} />
        <InfoPill label="工单" value={`${customer.order_count}`} />
        <InfoPill label="营收" value={<MoneyText amount={customer.total_spent} />} />
        <InfoPill
          label="回访"
          value={customer.next_followup_at ? formatCustomerDate(customer.next_followup_at) : "—"}
        />
      </div>
    </Card>
  );
}

function CustomerTagList({ tags }: { tags: CustomerTag[] }) {
  if (!tags.length) return <span className="text-xs text-muted-foreground">无标签</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 3).map((tag) => (
        <span
          key={tag.id}
          className="rounded border px-1.5 py-0.5 text-[11px]"
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

function InfoPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-surface-muted/50 px-2 py-1.5">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  );
}
