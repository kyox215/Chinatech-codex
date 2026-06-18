"use client";

import { CheckCircle2, Plus, Send, Tags } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CustomerEmptyLine,
  CustomerInfoBlock,
  CustomerTimelineList,
  formatCustomerDateTime,
} from "@/features/customers/components/customer-profile-blocks";
import type { CustomerDetail } from "@/lib/repairdesk/api";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const customerDetailSectionClass = cn(repairOs.mobileInfoCard, "sm:p-2.5 md:rounded-2xl md:p-3");
const customerDetailSectionTitleClass = "text-[11px] font-semibold leading-4 sm:text-sm";

export function CustomerMessagesPanel({
  interactions,
  onMessage,
}: {
  interactions: CustomerDetail["interactions"];
  onMessage: () => void;
}) {
  return (
    <section className={customerDetailSectionClass}>
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <h2 className={customerDetailSectionTitleClass}>联系记录</h2>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onMessage}>
          <Send className="size-3.5" /> 发送消息
        </Button>
      </div>
      <div className="grid min-w-0 gap-1.5 sm:gap-2 lg:grid-cols-2">
        {interactions.length ? (
          interactions.map((interaction) => (
            <div
              key={interaction.id}
              className={cn(
                repairOs.businessCardDense,
                "grid-cols-[minmax(0,1fr)] bg-surface-muted/30 text-sm",
              )}
            >
              <div className="flex min-w-0 items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <span className="min-w-0 truncate">
                  {interaction.channel === "whatsapp" ? "WhatsApp" : "SMS"} ·{" "}
                  {interaction.operator_name}
                </span>
                <span className="shrink-0">{formatCustomerDateTime(interaction.created_at)}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
                {interaction.message_body}
              </p>
            </div>
          ))
        ) : (
          <CustomerEmptyLine text="暂无联系记录" />
        )}
      </div>
    </section>
  );
}

export function CustomerProfilePanel({
  customer,
  tags,
  onManageTags,
}: {
  customer: CustomerDetail["customer"];
  tags: CustomerDetail["tags"];
  onManageTags: () => void;
}) {
  return (
    <section className={customerDetailSectionClass}>
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <h2 className={customerDetailSectionTitleClass}>客户资料</h2>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onManageTags}>
          <Tags className="size-3.5" /> 管理标签
        </Button>
      </div>
      <div className="mb-2 min-w-0 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
        <p className="mb-1 text-[10px] font-medium leading-3 text-muted-foreground">服务标签</p>
        {tags.length ? (
          <div className="flex min-w-0 flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="max-w-full truncate rounded-full border bg-card px-2 py-0.5 text-[10px] font-semibold leading-4"
                style={{ borderColor: tag.color, color: tag.color }}
                title={tag.name}
              >
                {tag.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] leading-4 text-muted-foreground">暂无标签</p>
        )}
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <CustomerInfoBlock
          label="联系权限"
          value={customer.consent_marketing && !customer.blacklisted_at ? "允许联系" : "勿主动联系"}
        />
        <CustomerInfoBlock
          label="首选通道"
          value={customer.preferred_channel === "sms" ? "SMS" : "WhatsApp"}
        />
        <CustomerInfoBlock
          label="语言"
          value={
            customer.language === "zh"
              ? "中文"
              : customer.language === "en"
                ? "English"
                : "Italiano"
          }
        />
        <CustomerInfoBlock
          label="最近联系"
          value={
            customer.last_contacted_at ? formatCustomerDateTime(customer.last_contacted_at) : "—"
          }
        />
      </div>
      <Separator className="my-2" />
      <CustomerInfoBlock label="服务备注" value={customer.marketing_notes || "暂无服务备注"} />
    </section>
  );
}

export function CustomerFollowupsPanel({
  followups,
  onAdd,
  onComplete,
}: {
  followups: CustomerDetail["followups"];
  onAdd: () => void;
  onComplete: (followupId: string) => void;
}) {
  return (
    <section className={customerDetailSectionClass}>
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <h2 className={customerDetailSectionTitleClass}>客户待办</h2>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onAdd}>
          <Plus className="size-3.5" /> 添加待办
        </Button>
      </div>
      <div className="grid min-w-0 gap-1.5 sm:gap-2 lg:grid-cols-2">
        {followups.length ? (
          followups.map((item) => (
            <div
              key={item.id}
              className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-[var(--border-panel)] bg-card px-2 py-1.5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:px-3 sm:py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span
                    className="min-w-0 truncate text-xs font-medium sm:text-sm"
                    title={item.title}
                  >
                    {item.title}
                  </span>
                  <Badge variant={item.status === "done" ? "secondary" : "outline"}>
                    {item.status === "done"
                      ? "已完成"
                      : item.status === "cancelled"
                        ? "已取消"
                        : "待处理"}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatCustomerDateTime(item.due_at)} · {item.owner_name || "未分配"}
                </p>
                {item.note && (
                  <p className="mt-1 break-words text-xs text-muted-foreground">{item.note}</p>
                )}
              </div>
              {item.status === "open" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  onClick={() => onComplete(item.id)}
                >
                  <CheckCircle2 className="size-3.5" /> 标记完成
                </Button>
              )}
            </div>
          ))
        ) : (
          <CustomerEmptyLine text="暂无客户待办" />
        )}
      </div>
    </section>
  );
}

export function CustomerTimelinePanel({ data }: { data: CustomerDetail }) {
  return (
    <section className={customerDetailSectionClass}>
      <h2 className="mb-2 text-[11px] font-semibold leading-4 sm:text-sm">操作记录</h2>
      <CustomerTimelineList data={data} />
    </section>
  );
}
