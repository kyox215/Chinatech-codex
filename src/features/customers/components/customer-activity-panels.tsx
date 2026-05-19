"use client";

import { CheckCircle2, Plus, Send, Tags } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CustomerEmptyLine,
  CustomerInfoBlock,
  CustomerTimelineList,
  formatCustomerDateTime,
} from "@/features/customers/components/customer-profile-blocks";
import type { CustomerDetail } from "@/lib/repairdesk/api";

export function CustomerMessagesPanel({
  interactions,
  onMessage,
}: {
  interactions: CustomerDetail["interactions"];
  onMessage: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">联系记录</h2>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onMessage}>
          <Send className="size-3.5" /> 发送消息
        </Button>
      </div>
      <div className="space-y-2">
        {interactions.length ? (
          interactions.map((interaction) => (
            <div key={interaction.id} className="rounded-md border bg-surface-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {interaction.channel === "whatsapp" ? "WhatsApp" : "SMS"} ·{" "}
                  {interaction.operator_name}
                </span>
                <span>{formatCustomerDateTime(interaction.created_at)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                {interaction.message_body}
              </p>
            </div>
          ))
        ) : (
          <CustomerEmptyLine text="暂无联系记录" />
        )}
      </div>
    </Card>
  );
}

export function CustomerMarketingPanel({
  customer,
  onManageTags,
}: {
  customer: CustomerDetail["customer"];
  onManageTags: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">营销画像</h2>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onManageTags}>
          <Tags className="size-3.5" /> 管理标签
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CustomerInfoBlock
          label="营销许可"
          value={customer.consent_marketing && !customer.blacklisted_at ? "可营销" : "不可营销"}
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
      <Separator className="my-4" />
      <CustomerInfoBlock label="营销备注" value={customer.marketing_notes || "暂无营销备注"} />
    </Card>
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
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">回访任务</h2>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onAdd}>
          <Plus className="size-3.5" /> 添加回访
        </Button>
      </div>
      <div className="space-y-2">
        {followups.length ? (
          followups.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.title}</span>
                  <Badge variant={item.status === "done" ? "secondary" : "outline"}>
                    {item.status === "done"
                      ? "已完成"
                      : item.status === "cancelled"
                        ? "已取消"
                        : "待处理"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatCustomerDateTime(item.due_at)} · {item.owner_name || "未分配"}
                </p>
                {item.note && <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>}
              </div>
              {item.status === "open" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => onComplete(item.id)}
                >
                  <CheckCircle2 className="size-3.5" /> 完成
                </Button>
              )}
            </div>
          ))
        ) : (
          <CustomerEmptyLine text="暂无回访任务" />
        )}
      </div>
    </Card>
  );
}

export function CustomerTimelinePanel({ data }: { data: CustomerDetail }) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold">客户时间线</h2>
      <CustomerTimelineList data={data} />
    </Card>
  );
}
