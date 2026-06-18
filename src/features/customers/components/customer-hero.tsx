"use client";

import Link from "next/link";
import { ArrowLeft, Bell, Edit3, Send, Wrench } from "lucide-react";

import { PhoneText } from "@/components/orders/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerDetailTagList } from "@/features/customers/components/customer-profile-blocks";
import { getCustomerDetailWorkSummary } from "@/features/customers/model/customer-list";
import { brandGradientStyle, controls, repairOs } from "@/lib/ui-patterns";
import type { CustomerDetail } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";

export function CustomerHero({
  data,
  onMessage,
  onFollowup,
  onEdit,
  showBackLink = true,
}: {
  data: CustomerDetail;
  onMessage: () => void;
  onFollowup: () => void;
  onEdit: () => void;
  showBackLink?: boolean;
}) {
  const { customer } = data;
  const summary = getCustomerDetailWorkSummary(data);
  return (
    <div className={cn(repairOs.adminSection, "mb-3 min-w-0 max-w-full p-2.5 sm:p-3")}>
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        {showBackLink ? (
          <>
            <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-xs">
              <Link href="/customers">
                <ArrowLeft className="size-3.5" /> 返回客户
              </Link>
            </Button>
            <span className="opacity-50">/</span>
          </>
        ) : null}
        <span>客户详情</span>
      </div>
      <div className="mt-2 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 max-w-full truncate font-display text-2xl font-semibold tracking-tight md:text-3xl">
              {customer.name}
            </h1>
            {customer.blacklisted_at && <Badge variant="destructive">黑名单</Badge>}
            <Badge variant="secondary">
              {customer.preferred_channel === "sms" ? "SMS" : "WhatsApp"}
            </Badge>
          </div>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
            <PhoneText value={customer.phone_e164} className="max-w-full truncate" />
            {customer.email && (
              <span className="min-w-0 max-w-full truncate" title={customer.email}>
                {customer.email}
              </span>
            )}
            <span>{customer.preferred_channel === "sms" ? "SMS" : "WhatsApp"}</span>
          </div>
          {customer.contact_phones.length > 0 && (
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>备用号码</span>
              {customer.contact_phones.map((phone) => (
                <span
                  key={phone}
                  className="max-w-36 truncate rounded-md bg-surface-muted px-1.5 py-0.5 font-mono"
                  title={phone}
                >
                  {phone}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2">
            <CustomerDetailTagList tags={data.tags} />
          </div>
          <div className="mt-2 grid max-w-xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-[10px] leading-3 text-muted-foreground">客户处理建议</p>
              <p className="truncate text-xs font-medium leading-5">{summary.actionLabel}</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold",
                customerSummaryToneClass(summary.tone),
              )}
            >
              {summary.label}
            </span>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button
            asChild
            size="sm"
            className={cn("h-8 gap-1.5 sm:h-9", controls.brandButton)}
            style={brandGradientStyle}
          >
            <Link href={`/orders/new?customerId=${customer.id}`}>
              <Wrench className="size-4" /> 新建工单
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 sm:h-9" onClick={onMessage}>
            <Send className="size-4" /> 发送消息
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 sm:h-9" onClick={onFollowup}>
            <Bell className="size-4" /> 添加待办
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 sm:h-9" onClick={onEdit}>
            <Edit3 className="size-4" /> 编辑客户
          </Button>
        </div>
      </div>
    </div>
  );
}

function customerSummaryToneClass(tone: ReturnType<typeof getCustomerDetailWorkSummary>["tone"]) {
  if (tone === "info") return "bg-status-info text-status-info-foreground";
  if (tone === "warning") return "bg-status-warn text-status-warn-foreground";
  if (tone === "success") return "bg-status-success text-status-success-foreground";
  return "bg-status-neutral text-status-neutral-foreground";
}
