"use client";

import Link from "next/link";
import { ArrowUpRight, Mail, Phone, Smartphone } from "lucide-react";

import { MoneyText, PhoneText } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import {
  getCustomerDetailHref,
  getCustomerLifetimeQuotedAmount,
  getCustomerOutstandingAmount,
  getCustomerWorkSummary,
} from "@/features/customers/model/customer-list";
import type { CustomerListItem, CustomerTag } from "@/lib/repairdesk/api";
import { repairOs } from "@/lib/ui-patterns";
import { RepairOsBadge, RepairOsBusinessCard } from "@/shared/ui";
import { cn } from "@/lib/utils";

const customerTagPriority = new Map([
  ["tag_followup", 0],
  ["tag_price_sensitive", 1],
  ["tag_vip", 2],
  ["tag_business", 3],
  ["tag_repeat", 4],
]);

function customerInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "客";
}

function CustomerIdentityMark({ name, compact = false }: { name: string; compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary/10 font-semibold text-primary",
        compact ? "size-7 text-[11px]" : "size-8 text-xs",
      )}
    >
      {customerInitial(name)}
    </span>
  );
}

function CustomerContactLine({
  phone,
  email,
  compact = false,
}: {
  phone: string;
  email?: string | null;
  compact?: boolean;
}) {
  return (
    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={cn(
          "inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-primary/10 bg-primary/5 px-1.5 py-0.5 text-primary",
          compact ? "text-[10px] leading-3" : "text-[11px] leading-4",
        )}
      >
        <Phone className={cn("shrink-0", compact ? "size-2.5" : "size-3")} />
        <PhoneText
          value={phone}
          className={cn("min-w-0 truncate text-inherit", compact ? "text-[10px]" : "text-[11px]")}
        />
      </span>
      {email ? (
        <span
          className="inline-flex min-w-0 max-w-full items-center gap-1 text-[10px] text-muted-foreground"
          title={email}
        >
          <Mail className="size-2.5 shrink-0" />
          <span className="min-w-0 truncate">{email}</span>
        </span>
      ) : null}
    </div>
  );
}

function CustomerCompactTags({ tags, max = 1 }: { tags: CustomerTag[]; max?: number }) {
  if (!tags.length) return null;
  const ordered = [...tags].sort(
    (a, b) =>
      (customerTagPriority.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (customerTagPriority.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
  const visible = ordered.slice(0, max);
  const hiddenCount = Math.max(0, tags.length - visible.length);

  return (
    <span className="flex min-w-0 items-center justify-end gap-1">
      {visible.map((tag) => (
        <RepairOsBadge
          key={tag.id}
          title={tag.name}
          className="min-w-0 max-w-16 border bg-card text-[10px] leading-none"
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
    </span>
  );
}

export function CustomerRow({
  customer,
  onOpenDetail,
}: {
  customer: CustomerListItem;
  onOpenDetail?: (customerId: string, trigger?: HTMLButtonElement) => void;
}) {
  const href = getCustomerDetailHref(customer.id);
  const workSummary = getCustomerWorkSummary(customer);
  const outstanding = getCustomerOutstandingAmount(customer);

  return (
    <tr className="h-14 border-b border-border/30 transition-colors hover:bg-accent/30 focus-within:bg-accent/30">
      <td className="min-w-0 px-3 py-2.5">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
          <CustomerIdentityMark name={customer.name} />
          <div className="min-w-0">
            <span
              data-ui="customer-row-name"
              title={customer.name}
              className="block truncate text-sm font-semibold leading-5 text-foreground"
            >
              {customer.name}
            </span>
            <CustomerContactLine phone={customer.phone_e164} email={customer.email} />
          </div>
          <CustomerCompactTags tags={customer.tags} />
        </div>
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
        {customer.finance_redacted ? (
          <span className="text-muted-foreground">金额受限</span>
        ) : (
          <div className="space-y-0.5">
            <MoneyText amount={getCustomerLifetimeQuotedAmount(customer)} />
            <div
              className={cn(
                "text-[10px]",
                outstanding > 0 ? "text-status-warn-foreground" : "text-muted-foreground",
              )}
            >
              {outstanding > 0 ? `待收 €${outstanding.toFixed(2)}` : "已结清"}
            </div>
          </div>
        )}
      </td>
      <td className="min-w-0 px-2 py-2 text-[11px]">
        <div className="truncate font-semibold text-foreground">{workSummary.actionLabel}</div>
        <div className="truncate text-muted-foreground">{workSummary.detail}</div>
      </td>
      <td className="px-2 py-2 text-right">
        {onOpenDetail ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-xs"
            aria-label={`查看客户 ${customer.name}`}
            onClick={(event) => onOpenDetail(customer.id, event.currentTarget)}
          >
            查看 <ArrowUpRight className="size-3" />
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
            <Link href={href} aria-label={`查看客户 ${customer.name}`}>
              查看 <ArrowUpRight className="size-3" />
            </Link>
          </Button>
        )}
      </td>
    </tr>
  );
}

export function CustomerMobileCard({ customer }: { customer: CustomerListItem }) {
  const href = getCustomerDetailHref(customer.id);
  const workSummary = getCustomerWorkSummary(customer);
  const outstanding = getCustomerOutstandingAmount(customer);

  return (
    <Link
      href={href}
      title={`查看客户 ${customer.name}`}
      aria-label={`打开客户详情：${customer.name}`}
      className="block min-w-0 touch-manipulation rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <RepairOsBusinessCard
        density="dense"
        className={cn("cursor-pointer transition active:scale-[0.99] active:bg-accent/15")}
        trailing={
          <div className="flex min-w-[4.5rem] flex-col items-end text-right text-xs">
            <span className="text-[9px] leading-3 text-muted-foreground">
              {customer.finance_redacted ? "工单" : outstanding > 0 ? "待收" : "工单额"}
            </span>
            {customer.finance_redacted ? (
              <span className={repairOs.cardAmount}>{customer.order_count} 单</span>
            ) : outstanding > 0 ? (
              <span className={cn(repairOs.cardAmount, "text-status-warn-foreground")}>
                €{outstanding.toFixed(2)}
              </span>
            ) : (
              <MoneyText
                amount={getCustomerLifetimeQuotedAmount(customer)}
                className={repairOs.cardAmount}
              />
            )}
            <span className="mt-1 grid size-7 place-items-center rounded-lg text-muted-foreground">
              <ArrowUpRight className="size-3.5" />
            </span>
          </div>
        }
      >
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
          <CustomerIdentityMark name={customer.name} compact />
          <div className="min-w-0">
            <span
              data-ui="customer-mobile-name"
              className={cn(repairOs.cardTitle, "block min-w-0 truncate text-foreground")}
            >
              {customer.name}
            </span>
            <CustomerContactLine phone={customer.phone_e164} email={customer.email} compact />
          </div>
          <CustomerCompactTags tags={customer.tags} />
        </div>
        <div className="mt-1.5 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <p className={cn(repairOs.cardMeta, "min-w-0 truncate")}>
            {customer.latest_device_label ?? "暂无设备"}
          </p>
          <RepairOsBadge className="gap-1 bg-[var(--surface-panel-muted)] text-[9px] text-muted-foreground">
            <Smartphone className="size-2.5" /> {customer.device_count} / {customer.order_count}
          </RepairOsBadge>
        </div>
        <div className="mt-1.5 min-w-0 truncate text-[11px]">
          <span className="font-semibold text-foreground">{workSummary.actionLabel}</span>
          <span className="ml-1 text-muted-foreground">· {workSummary.detail}</span>
        </div>
      </RepairOsBusinessCard>
    </Link>
  );
}
