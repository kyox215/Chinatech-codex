"use client";

import Link from "next/link";
import { ArrowLeft, Bell, Edit3, Send, Wrench } from "lucide-react";

import { PhoneText } from "@/components/orders/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerDetailTagList } from "@/features/customers/components/customer-profile-blocks";
import { brandGradientStyle } from "@/lib/ui-patterns";
import type { CustomerDetail } from "@/lib/repairdesk/api";

export function CustomerHero({
  data,
  onMessage,
  onFollowup,
  onEdit,
}: {
  data: CustomerDetail;
  onMessage: () => void;
  onFollowup: () => void;
  onEdit: () => void;
}) {
  const { customer } = data;
  return (
    <div className="glass-card mb-6 p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-xs">
          <Link href="/customers">
            <ArrowLeft className="size-3.5" /> 返回客户
          </Link>
        </Button>
        <span className="opacity-50">/</span>
        <span>客户详情</span>
      </div>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight">{customer.name}</h1>
            {customer.blacklisted_at && <Badge variant="destructive">黑名单</Badge>}
            {customer.consent_marketing && !customer.blacklisted_at ? (
              <Badge className="bg-status-success text-status-success-foreground">可营销</Badge>
            ) : (
              <Badge variant="secondary">不可营销</Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <PhoneText value={customer.phone_e164} />
            {customer.email && <span>{customer.email}</span>}
            <span>{customer.preferred_channel === "sms" ? "SMS" : "WhatsApp"}</span>
          </div>
          {customer.contact_phones.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>备用号码</span>
              {customer.contact_phones.map((phone) => (
                <span key={phone} className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono">
                  {phone}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3">
            <CustomerDetailTagList tags={data.tags} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="gap-1.5 border-0 text-white" style={brandGradientStyle}>
            <Link href={`/orders/new?customerId=${customer.id}`}>
              <Wrench className="size-4" /> 新建工单
            </Link>
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={onMessage}>
            <Send className="size-4" /> 发送消息
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={onFollowup}>
            <Bell className="size-4" /> 添加回访
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={onEdit}>
            <Edit3 className="size-4" /> 编辑客户
          </Button>
        </div>
      </div>
    </div>
  );
}
