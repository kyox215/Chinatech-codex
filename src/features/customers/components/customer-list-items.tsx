"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CircleDollarSign, Smartphone, Wrench } from "lucide-react";

import { MoneyText, PhoneText } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { RepairOsBusinessCard, RepairOsBadge, RepairOsInfoTile } from "@/shared/ui";
import {
  getCustomerDetailHref,
  getCustomerWorkSummary,
  type CustomerWorkSummaryTone,
} from "@/features/customers/model/customer-list";
import { brandGradientStyle, repairOs } from "@/lib/ui-patterns";
import type { CustomerListItem, CustomerTag } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";

const customerTagPriority = new Map([
  ["tag_followup", 0],
  ["tag_price_sensitive", 1],
  ["tag_vip", 2],
  ["tag_business", 3],
  ["tag_repeat", 4],
]);

function CustomerCompactTags({
  tags,
  max = 1,
  reserveSlot = false,
}: {
  tags: CustomerTag[];
  max?: number;
  reserveSlot?: boolean;
}) {
  if (!tags.length) {
    return reserveSlot ? <span aria-hidden="true" className="block h-5 w-full" /> : null;
  }
  const orderedTags = [...tags].sort(
    (a, b) =>
      (customerTagPriority.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (customerTagPriority.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
  const visibleTags = orderedTags.slice(0, max);
  const hiddenCount = Math.max(0, tags.length - visibleTags.length);

  return (
    <span className="flex min-w-0 items-center justify-end gap-1">
      {visibleTags.map((tag) => (
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
    <RepairOsInfoTile
      frame="plain"
      label={label}
      value={value}
      className={repairOs.metricCardDense}
      labelClassName={repairOs.metricLabel}
      valueClassName="mt-1 font-mono text-lg font-semibold leading-none tabular-nums"
      trailing={
        <div
          className="grid size-8 place-items-center rounded-md text-primary-foreground"
          style={brandGradientStyle}
        >
          <Icon className="size-3.5" />
        </div>
      }
    />
  );
}

export function CustomerRow({
  customer,
  onPrefetch,
  onOpenDetail,
}: {
  customer: CustomerListItem;
  onPrefetch?: () => void;
  onOpenDetail?: (customerId: string) => void;
}) {
  const router = useRouter();
  const href = getCustomerDetailHref(customer.id);
  const summary = getCustomerWorkSummary(customer);

  function openDetail() {
    if (onOpenDetail) {
      onOpenDetail(customer.id);
      return;
    }
    router.push(href);
  }

  return (
    <tr
      className="h-12 cursor-pointer border-b border-border/30 transition-colors hover:bg-accent/30 focus-within:bg-accent/30"
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a,button")) return;
        openDetail();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if ((event.target as HTMLElement).closest("a,button")) return;
        event.preventDefault();
        openDetail();
      }}
      tabIndex={0}
      role="link"
      aria-label={`查看客户 ${customer.name}`}
    >
      <td className="min-w-0 px-3 py-2">
        <div className="min-w-0">
          {onOpenDetail ? (
            <button
              type="button"
              title={customer.name}
              data-ui="customer-row-name"
              className="block max-w-full truncate text-left text-xs font-medium hover:text-primary hover:underline"
              onClick={openDetail}
            >
              {customer.name}
            </button>
          ) : (
            <Link
              href={href}
              title={customer.name}
              data-ui="customer-row-name"
              className="block truncate text-xs font-medium hover:text-primary hover:underline"
            >
              {customer.name}
            </Link>
          )}
          <div className="mt-0.5 grid min-w-0 grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-2 text-[11px] text-muted-foreground">
            <div className="flex min-w-0 items-center gap-2">
              <PhoneText
                value={customer.phone_e164}
                className="block min-w-0 shrink-0 truncate text-[11px]"
              />
              {customer.email && (
                <span className="min-w-0 truncate" title={customer.email}>
                  {customer.email}
                </span>
              )}
            </div>
            <span
              data-ui="customer-row-tag-slot"
              className="hidden w-[5.5rem] justify-self-end sm:block"
            >
              <CustomerCompactTags tags={customer.tags} reserveSlot />
            </span>
          </div>
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
        <MoneyText amount={customer.total_spent} />
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-right text-xs">
        <MoneyText amount={customer.unpaid_amount} />
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-[11px]">
        <CustomerWorkState summary={summary} />
      </td>
      <td className="px-2 py-2 text-right">
        <Button
          asChild={!onOpenDetail}
          type={onOpenDetail ? "button" : undefined}
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={onOpenDetail ? openDetail : undefined}
        >
          {onOpenDetail ? (
            <>
              详情 <ArrowUpRight className="size-3" />
            </>
          ) : (
            <Link href={href}>
              详情 <ArrowUpRight className="size-3" />
            </Link>
          )}
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
  const href = getCustomerDetailHref(customer.id);
  const summary = getCustomerWorkSummary(customer);

  return (
    <Link
      href={href}
      title={`查看客户 ${customer.name}`}
      aria-label={`打开客户详情：${customer.name}`}
      className="block min-w-0 touch-manipulation rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
    >
      <RepairOsBusinessCard
        className={cn(
          repairOs.businessCardDense,
          "cursor-pointer transition-transform active:scale-[0.99]",
        )}
        trailing={
          <div className="flex min-w-[4.5rem] flex-col items-end text-right text-xs">
            <MoneyText amount={customer.total_spent} className={repairOs.cardAmount} />
            <span
              className={cn(
                "mt-0.5 max-w-24 truncate text-[11px] leading-4",
                customer.unpaid_amount > 0
                  ? "text-status-warn-foreground"
                  : "text-muted-foreground",
              )}
            >
              {customer.unpaid_amount > 0 ? "有未结清" : `${customer.order_count} 个工单`}
            </span>
            <span className="mt-0.5 grid size-7 place-items-center rounded-lg text-muted-foreground">
              <ArrowUpRight className="size-3.5" />
            </span>
          </div>
        }
      >
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 max-[360px]:grid-cols-1">
          <span
            data-ui="customer-mobile-name"
            className={cn(repairOs.cardTitle, "min-w-0 truncate")}
          >
            {customer.name}
          </span>
          <span className="flex max-w-[6.25rem] shrink-0 justify-end justify-self-end max-[360px]:max-w-full max-[360px]:justify-self-start">
            <span data-ui="customer-mobile-tag-slot">
              <CustomerCompactTags tags={customer.tags} />
            </span>
          </span>
        </div>
        <PhoneText value={customer.phone_e164} className="block truncate text-[11px] leading-4" />
        <div className="mt-1 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
          <p className={cn(repairOs.cardMeta, "min-w-0 truncate")}>
            {customer.latest_device_label ?? "暂无设备"}
          </p>
          <RepairOsBadge className="gap-1 bg-[var(--surface-panel-muted)] text-[9px] text-muted-foreground">
            <Smartphone className="size-2.5" />
            {customer.device_count} / {customer.order_count}
          </RepairOsBadge>
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
          <RepairOsBadge
            className={cn("gap-1 text-[9px] font-semibold", customerWorkToneClass(summary.tone))}
          >
            <Wrench className="size-2.5" />
            {summary.label}
          </RepairOsBadge>
          <RepairOsBadge
            className={cn(
              "gap-1 text-[9px] font-semibold",
              customer.unpaid_amount > 0
                ? "bg-status-warn text-status-warn-foreground"
                : "bg-status-success text-status-success-foreground",
            )}
          >
            <CircleDollarSign className="size-2.5" />
            {customer.unpaid_amount > 0 ? "未结清" : "已结清"}
          </RepairOsBadge>
          <RepairOsBadge className="gap-1 bg-[var(--surface-panel-muted)] text-[9px] text-muted-foreground">
            <Smartphone className="size-2.5" />
            {customer.device_count} 台设备
          </RepairOsBadge>
        </div>
        <RepairOsInfoTile
          className="mt-1.5"
          label="下一步"
          value={summary.actionLabel}
          labelClassName="text-[9px] leading-3"
          valueClassName="truncate text-[11px] font-medium leading-4"
        />
      </RepairOsBusinessCard>
    </Link>
  );
}

function CustomerWorkState({ summary }: { summary: ReturnType<typeof getCustomerWorkSummary> }) {
  return (
    <RepairOsBadge
      className={cn("gap-1 text-[11px] font-semibold", customerWorkToneClass(summary.tone))}
      title={`${summary.detail} · ${summary.actionLabel}`}
    >
      <Wrench className="size-3" />
      {summary.label}
    </RepairOsBadge>
  );
}

function customerWorkToneClass(tone: CustomerWorkSummaryTone) {
  if (tone === "info") return "bg-status-info text-status-info-foreground";
  if (tone === "warning") return "bg-status-warn text-status-warn-foreground";
  if (tone === "success") return "bg-status-success text-status-success-foreground";
  return "bg-status-neutral text-status-neutral-foreground";
}
