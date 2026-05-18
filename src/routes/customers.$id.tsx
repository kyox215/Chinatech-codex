"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Edit3,
  Plus,
  Send,
  Smartphone,
  Tags,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { MoneyText, PhoneText, StatusBadge } from "@/components/orders/badges";
import {
  completeCustomerFollowup,
  createCustomerFollowup,
  deleteCustomerDevice,
  getCustomerDetail,
  sendCustomerMessage,
  setCustomerTags,
  updateCustomer,
  upsertCustomerDevice,
  type CustomerDetail,
  type CustomerDeviceInput,
  type CustomerFollowupInput,
  type CustomerMessageInput,
  type CustomerTag,
  type CustomerUpdateInput,
  type Device,
  type OrderListItem,
} from "@/lib/repairdesk/api";
import { brandGradientStyle } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "overview", label: "概览" },
  { key: "devices", label: "设备" },
  { key: "orders", label: "工单" },
  { key: "messages", label: "消息" },
  { key: "marketing", label: "营销" },
  { key: "followups", label: "回访" },
  { key: "timeline", label: "时间线" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function CustomerDetailPage({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | undefined>();
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupOrderId, setFollowupOrderId] = useState<string | undefined>();
  const [messageOpen, setMessageOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [orderUrl, setOrderUrl] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["customer-detail", id],
    queryFn: () => getCustomerDetail(id),
  });

  useEffect(() => {
    setOrderUrl(window.location.origin);
  }, []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["customer-detail", id] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const update = useMutation({
    mutationFn: (input: CustomerUpdateInput) => updateCustomer(id, input),
    onSuccess: () => {
      toast.success("客户已更新");
      setEditOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const upsertDevice = useMutation({
    mutationFn: (input: CustomerDeviceInput) => upsertCustomerDevice(id, input),
    onSuccess: () => {
      toast.success("设备已保存");
      setDeviceOpen(false);
      setEditingDevice(undefined);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteDevice = useMutation({
    mutationFn: (deviceId: string) => deleteCustomerDevice(id, deviceId),
    onSuccess: () => {
      toast.success("设备已删除");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const followup = useMutation({
    mutationFn: (input: CustomerFollowupInput) => createCustomerFollowup(id, input),
    onSuccess: () => {
      toast.success("回访任务已创建");
      setFollowupOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const completeFollowup = useMutation({
    mutationFn: (followupId: string) => completeCustomerFollowup(id, followupId),
    onSuccess: () => {
      toast.success("回访已完成");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const message = useMutation({
    mutationFn: (input: CustomerMessageInput) => sendCustomerMessage(id, input),
    onSuccess: () => {
      toast.success("客户消息已记录");
      setMessageOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const tags = useMutation({
    mutationFn: (tagIds: string[]) => setCustomerTags(id, tagIds),
    onSuccess: () => {
      toast.success("客户标签已更新");
      setTagsOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 pb-12 pt-4 md:px-6">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { customer, devices, orders, followups, interactions, stats } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-4 md:px-6">
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
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {customer.name}
              </h1>
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
            <div className="mt-3">
              <TagList tags={data.tags} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="gap-1.5 border-0 text-white" style={brandGradientStyle}>
              <Link href={`/orders/new?customerId=${customer.id}`}>
                <Wrench className="size-4" /> 新建工单
              </Link>
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => setMessageOpen(true)}>
              <Send className="size-4" /> 发送消息
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setFollowupOrderId(undefined);
                setFollowupOpen(true);
              }}
            >
              <Bell className="size-4" /> 添加回访
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => setEditOpen(true)}>
              <Edit3 className="size-4" /> 编辑客户
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-4 -mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border/60 bg-surface/60 p-1">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === item.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold">客户概览</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="设备" value={stats.device_count} />
              <Metric label="历史工单" value={stats.order_count} />
              <Metric label="已结清营收" value={<MoneyText amount={stats.total_spent} />} />
              <Metric label="未结清" value={<MoneyText amount={stats.unpaid_amount} />} />
            </div>
            <Separator className="my-4" />
            <InfoBlock label="客户备注" value={customer.notes || "暂无备注"} />
            <InfoBlock label="营销备注" value={customer.marketing_notes || "暂无营销备注"} />
          </Card>
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold">最近动态</h2>
            <TimelineList data={data} limit={6} />
          </Card>
        </div>
      )}

      {tab === "devices" && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">设备档案</h2>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setEditingDevice(undefined);
                setDeviceOpen(true);
              }}
            >
              <Plus className="size-3.5" /> 添加设备
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                customerId={customer.id}
                deleting={deleteDevice.isPending}
                onEdit={() => {
                  setEditingDevice(device);
                  setDeviceOpen(true);
                }}
                onDelete={() => deleteDevice.mutate(device.id)}
              />
            ))}
          </div>
        </Card>
      )}

      {tab === "orders" && (
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">历史工单</h2>
          <div className="space-y-2">
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                onFollowup={() => {
                  setFollowupOrderId(order.id);
                  setFollowupOpen(true);
                }}
              />
            ))}
          </div>
        </Card>
      )}

      {tab === "messages" && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">联系记录</h2>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setMessageOpen(true)}
            >
              <Send className="size-3.5" /> 发送消息
            </Button>
          </div>
          <div className="space-y-2">
            {interactions.length ? (
              interactions.map((interaction) => (
                <div
                  key={interaction.id}
                  className="rounded-md border bg-surface-muted/30 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>
                      {interaction.channel === "whatsapp" ? "WhatsApp" : "SMS"} ·{" "}
                      {interaction.operator_name}
                    </span>
                    <span>{formatDateTime(interaction.created_at)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                    {interaction.message_body}
                  </p>
                </div>
              ))
            ) : (
              <EmptyLine text="暂无联系记录" />
            )}
          </div>
        </Card>
      )}

      {tab === "marketing" && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">营销画像</h2>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setTagsOpen(true)}
            >
              <Tags className="size-3.5" /> 管理标签
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoBlock
              label="营销许可"
              value={customer.consent_marketing && !customer.blacklisted_at ? "可营销" : "不可营销"}
            />
            <InfoBlock
              label="首选通道"
              value={customer.preferred_channel === "sms" ? "SMS" : "WhatsApp"}
            />
            <InfoBlock
              label="语言"
              value={
                customer.language === "zh"
                  ? "中文"
                  : customer.language === "en"
                    ? "English"
                    : "Italiano"
              }
            />
            <InfoBlock
              label="最近联系"
              value={customer.last_contacted_at ? formatDateTime(customer.last_contacted_at) : "—"}
            />
          </div>
          <Separator className="my-4" />
          <InfoBlock label="营销备注" value={customer.marketing_notes || "暂无营销备注"} />
        </Card>
      )}

      {tab === "followups" && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">回访任务</h2>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setFollowupOrderId(undefined);
                setFollowupOpen(true);
              }}
            >
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
                      {formatDateTime(item.due_at)} · {item.owner_name || "未分配"}
                    </p>
                    {item.note && <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>}
                  </div>
                  {item.status === "open" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => completeFollowup.mutate(item.id)}
                    >
                      <CheckCircle2 className="size-3.5" /> 完成
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <EmptyLine text="暂无回访任务" />
            )}
          </div>
        </Card>
      )}

      {tab === "timeline" && (
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">客户时间线</h2>
          <TimelineList data={data} />
        </Card>
      )}

      <CustomerEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        data={data}
        busy={update.isPending}
        onSave={(input) => update.mutateAsync(input)}
      />
      <DeviceDialog
        open={deviceOpen}
        onOpenChange={(open) => {
          setDeviceOpen(open);
          if (!open) setEditingDevice(undefined);
        }}
        device={editingDevice}
        busy={upsertDevice.isPending}
        onSave={(input) => upsertDevice.mutateAsync(input)}
      />
      <FollowupDialog
        open={followupOpen}
        onOpenChange={(open) => {
          setFollowupOpen(open);
          if (!open) setFollowupOrderId(undefined);
        }}
        busy={followup.isPending}
        orders={orders}
        selectedOrderId={followupOrderId}
        onSave={(input) => followup.mutateAsync(input)}
      />
      <CustomerMessageDialog
        open={messageOpen}
        onOpenChange={setMessageOpen}
        data={data}
        appOrigin={orderUrl}
        busy={message.isPending}
        onConfirm={(input) => message.mutateAsync(input)}
      />
      <TagsDialog
        open={tagsOpen}
        onOpenChange={setTagsOpen}
        data={data}
        busy={tags.isPending}
        onSave={(ids) => tags.mutateAsync(ids)}
      />
    </div>
  );
}

function TagList({ tags }: { tags: CustomerTag[] }) {
  if (!tags.length) return <span className="text-xs text-muted-foreground">无标签</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="rounded border px-1.5 py-0.5 text-[11px]"
          style={{ borderColor: tag.color, color: tag.color }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-surface-muted/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-semibold">{value}</div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function DeviceCard({
  device,
  customerId,
  deleting,
  onEdit,
  onDelete,
}: {
  device: Device;
  customerId: string;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">
            {device.brand} {device.model}
          </div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            {device.serial_or_imei || "无 IMEI"}
          </div>
        </div>
        <Smartphone className="size-5 text-muted-foreground" />
      </div>
      {device.device_notes && (
        <p className="mt-2 text-sm text-muted-foreground">{device.device_notes}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
          <Link href={`/orders/new?customerId=${customerId}&deviceId=${device.id}`}>
            <Wrench className="size-3.5" /> 新建工单
          </Link>
        </Button>
        <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={onEdit}>
          <Edit3 className="size-3.5" /> 编辑
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-destructive hover:text-destructive"
          disabled={deleting}
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" /> 删除
        </Button>
      </div>
    </div>
  );
}

function OrderRow({ order, onFollowup }: { order: OrderListItem; onFollowup: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Link
          href={`/orders/${order.id}`}
          className="font-mono text-xs font-medium text-primary hover:underline"
        >
          {order.public_no}
        </Link>
        <div className="mt-1 font-medium">{order.device_label}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <StatusBadge status={order.status} />
          <span>{order.issue_description}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <MoneyText amount={order.quotation_amount} />
        {order.status === "completed" && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onFollowup}>
            <Bell className="size-3.5" /> 回访
          </Button>
        )}
      </div>
    </div>
  );
}

function TimelineList({ data, limit }: { data: CustomerDetail; limit?: number }) {
  const items = useMemo(() => {
    const orderItems = data.orders.map((order) => ({
      id: `order-${order.id}`,
      at: order.created_at,
      title: `创建工单 ${order.public_no}`,
      body: `${order.device_label} · ${order.issue_description}`,
    }));
    const interactionItems = data.interactions.map((interaction) => ({
      id: `interaction-${interaction.id}`,
      at: interaction.created_at,
      title: `发送${interaction.channel === "whatsapp" ? " WhatsApp" : " SMS"}`,
      body: interaction.message_body,
    }));
    const followupItems = data.followups.map((followup) => ({
      id: `followup-${followup.id}`,
      at: followup.updated_at,
      title:
        followup.status === "done" ? `完成回访：${followup.title}` : `回访任务：${followup.title}`,
      body: followup.note || formatDateTime(followup.due_at),
    }));
    return [...orderItems, ...interactionItems, ...followupItems]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, limit);
  }, [data, limit]);

  if (!items.length) return <EmptyLine text="暂无动态" />;
  return (
    <ol className="space-y-4 border-l border-border/60 pl-4">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[21px] top-1 size-3 rounded-full bg-primary ring-4 ring-background" />
          <div className="text-xs text-muted-foreground">{formatDateTime(item.at)}</div>
          <div className="text-sm font-medium">{item.title}</div>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
        </li>
      ))}
    </ol>
  );
}

function CustomerEditDialog({
  open,
  onOpenChange,
  data,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data: CustomerDetail;
  busy: boolean;
  onSave: (input: CustomerUpdateInput) => Promise<unknown>;
}) {
  const [form, setForm] = useState<CustomerUpdateInput>(() => buildCustomerForm(data));
  useEffect(() => {
    if (open) setForm(buildCustomerForm(data));
  }, [data, open]);
  const canSave = form.name.trim() && form.phone_e164.trim();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑客户</DialogTitle>
          <DialogDescription>客户姓名和联系方式会实时联动到相关工单显示。</DialogDescription>
        </DialogHeader>
        <CustomerFields form={form} setForm={setForm} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={busy || !canSave} onClick={() => onSave(form)}>
            {busy ? "保存中…" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildCustomerForm(data: CustomerDetail): CustomerUpdateInput {
  const customer = data.customer;
  return {
    name: customer.name,
    phone_e164: customer.phone_e164,
    email: customer.email ?? "",
    contact_phones: customer.contact_phones,
    consent_marketing: customer.consent_marketing,
    consent_sms: customer.consent_sms,
    preferred_channel: customer.preferred_channel ?? "whatsapp",
    language: customer.language ?? "it",
    notes: customer.notes ?? "",
    marketing_notes: customer.marketing_notes ?? "",
    blacklisted: Boolean(customer.blacklisted_at),
  };
}

function CustomerFields({
  form,
  setForm,
}: {
  form: CustomerUpdateInput;
  setForm: (input: CustomerUpdateInput) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField label="姓名" required>
        <Input
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </FormField>
      <FormField label="手机号" required>
        <Input
          value={form.phone_e164}
          onChange={(event) => setForm({ ...form, phone_e164: event.target.value })}
          className="font-mono"
        />
      </FormField>
      <FormField label="邮箱">
        <Input
          value={form.email ?? ""}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
      </FormField>
      <FormField label="首选通道">
        <div className="flex gap-1.5">
          {(["whatsapp", "sms"] as const).map((channel) => (
            <button
              key={channel}
              type="button"
              onClick={() => setForm({ ...form, preferred_channel: channel })}
              className={cn(
                "rounded-md border px-2 py-1 text-xs",
                form.preferred_channel === channel
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-surface hover:bg-accent",
              )}
            >
              {channel === "whatsapp" ? "WhatsApp" : "SMS"}
            </button>
          ))}
        </div>
      </FormField>
      <div className="sm:col-span-2">
        <FormField label="客户备注">
          <Textarea
            rows={3}
            value={form.notes ?? ""}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
        </FormField>
      </div>
      <div className="sm:col-span-2">
        <FormField label="营销备注">
          <Textarea
            rows={3}
            value={form.marketing_notes ?? ""}
            onChange={(event) => setForm({ ...form, marketing_notes: event.target.value })}
          />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={form.consent_marketing ?? false}
          onCheckedChange={(checked) => setForm({ ...form, consent_marketing: Boolean(checked) })}
        />
        允许营销触达
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={form.consent_sms ?? false}
          onCheckedChange={(checked) => setForm({ ...form, consent_sms: Boolean(checked) })}
        />
        允许短信通知
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={form.blacklisted ?? false}
          onCheckedChange={(checked) => setForm({ ...form, blacklisted: Boolean(checked) })}
        />
        加入黑名单
      </label>
    </div>
  );
}

function DeviceDialog({
  open,
  onOpenChange,
  device,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  device?: Device;
  busy: boolean;
  onSave: (input: CustomerDeviceInput) => Promise<unknown>;
}) {
  const [form, setForm] = useState<CustomerDeviceInput>(() => ({
    id: device?.id,
    brand: device?.brand ?? "",
    model: device?.model ?? "",
    serial_or_imei: device?.serial_or_imei ?? "",
    device_notes: device?.device_notes ?? "",
  }));
  useEffect(() => {
    if (open) {
      setForm({
        id: device?.id,
        brand: device?.brand ?? "",
        model: device?.model ?? "",
        serial_or_imei: device?.serial_or_imei ?? "",
        device_notes: device?.device_notes ?? "",
      });
    }
  }, [device, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{device ? "编辑设备" : "添加设备"}</DialogTitle>
          <DialogDescription>
            设备档案用于新建工单预填；历史工单仍保留创建时快照。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="品牌" required>
            <Input
              value={form.brand}
              onChange={(event) => setForm({ ...form, brand: event.target.value })}
            />
          </FormField>
          <FormField label="型号" required>
            <Input
              value={form.model}
              onChange={(event) => setForm({ ...form, model: event.target.value })}
            />
          </FormField>
          <FormField label="IMEI / 序列号">
            <Input
              value={form.serial_or_imei ?? ""}
              onChange={(event) => setForm({ ...form, serial_or_imei: event.target.value })}
              className="font-mono"
            />
          </FormField>
          <FormField label="设备备注">
            <Input
              value={form.device_notes ?? ""}
              onChange={(event) => setForm({ ...form, device_notes: event.target.value })}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={busy || !form.brand.trim() || !form.model.trim()}
            onClick={() => onSave(form)}
          >
            {busy ? "保存中…" : "保存设备"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FollowupDialog({
  open,
  onOpenChange,
  busy,
  orders,
  selectedOrderId,
  onSave,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  busy: boolean;
  orders: OrderListItem[];
  selectedOrderId?: string;
  onSave: (input: CustomerFollowupInput) => Promise<unknown>;
}) {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
  const [form, setForm] = useState<CustomerFollowupInput>({
    title: "维修后满意度回访",
    due_at: tomorrow,
    owner_name: "",
    note: "",
  });
  useEffect(() => {
    if (open) {
      setForm({
        title: "维修后满意度回访",
        due_at: tomorrow,
        owner_name: "",
        note: "",
        order_id: selectedOrderId,
      });
    }
  }, [open, selectedOrderId, tomorrow]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加回访任务</DialogTitle>
          <DialogDescription>用于售后满意度、报价确认或取机提醒。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <FormField label="标题" required>
            <Input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </FormField>
          <FormField label="关联工单">
            <select
              value={form.order_id ?? ""}
              onChange={(event) => setForm({ ...form, order_id: event.target.value || undefined })}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">不关联</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.public_no} · {order.device_label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="到期时间" required>
            <Input
              type="datetime-local"
              value={form.due_at}
              onChange={(event) => setForm({ ...form, due_at: event.target.value })}
            />
          </FormField>
          <FormField label="负责人">
            <Input
              value={form.owner_name ?? ""}
              onChange={(event) => setForm({ ...form, owner_name: event.target.value })}
            />
          </FormField>
          <FormField label="备注">
            <Textarea
              rows={3}
              value={form.note ?? ""}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={busy || !form.title.trim() || !form.due_at}
            onClick={() => onSave(form)}
          >
            {busy ? "创建中…" : "创建回访"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerMessageDialog({
  open,
  onOpenChange,
  data,
  appOrigin,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data: CustomerDetail;
  appOrigin: string;
  busy: boolean;
  onConfirm: (input: CustomerMessageInput) => Promise<unknown>;
}) {
  const [channel, setChannel] = useState<"whatsapp" | "sms">(
    data.customer.preferred_channel ?? "whatsapp",
  );
  const [body, setBody] = useState(() => buildCustomerMessage(data, appOrigin));
  useEffect(() => {
    if (open) {
      setChannel(data.customer.preferred_channel ?? "whatsapp");
      setBody(buildCustomerMessage(data, appOrigin));
    }
  }, [data, open, appOrigin]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>预览客户消息</DialogTitle>
          <DialogDescription>
            客户可见内容使用意大利语。确认后打开对应通道并记录联系历史。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-1.5">
            {(["whatsapp", "sms"] as const).map((item) => (
              <button
                key={item}
                onClick={() => setChannel(item)}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs",
                  channel === item
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-surface hover:bg-accent",
                )}
              >
                {item === "whatsapp" ? "WhatsApp" : "SMS"}
              </button>
            ))}
          </div>
          <Textarea
            rows={10}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="font-mono text-xs"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={busy || !body.trim()}
            onClick={async () => {
              if (channel === "whatsapp") {
                const url = whatsAppUrl(data.customer.phone_e164, body.trim());
                if (url) window.open(url, "_blank", "noopener,noreferrer");
              } else {
                const url = smsUrl(data.customer.phone_e164, body.trim());
                if (url) window.open(url, "_blank", "noopener,noreferrer");
              }
              await onConfirm({ channel, body: body.trim() });
            }}
          >
            <Send className="mr-1.5 size-3.5" /> 确认并记录
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TagsDialog({
  open,
  onOpenChange,
  data,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data: CustomerDetail;
  busy: boolean;
  onSave: (ids: string[]) => Promise<unknown>;
}) {
  const [selected, setSelected] = useState<string[]>(() => data.tags.map((tag) => tag.id));
  const allTags = useMemo(() => {
    const known = new Map<string, CustomerTag>();
    data.tags.forEach((tag) => known.set(tag.id, tag));
    const defaults: CustomerTag[] = [
      { id: "tag_vip", name: "VIP", color: "#8b5cf6" },
      { id: "tag_repeat", name: "复购", color: "#10b981" },
      { id: "tag_business", name: "企业", color: "#0ea5e9" },
      { id: "tag_price_sensitive", name: "价格敏感", color: "#f59e0b" },
      { id: "tag_followup", name: "需回访", color: "#ef4444" },
    ];
    defaults.forEach((tag) => {
      if (!known.has(tag.id)) known.set(tag.id, tag);
    });
    return Array.from(known.values());
  }, [data.tags]);
  useEffect(() => {
    if (open) setSelected(data.tags.map((tag) => tag.id));
  }, [data.tags, open]);
  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>管理客户标签</DialogTitle>
          <DialogDescription>标签会用于客户筛选和营销分群。</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {allTags.map((tag) => (
            <label
              key={tag.id}
              className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm"
            >
              <Checkbox
                checked={selected.includes(tag.id)}
                onCheckedChange={() => toggle(tag.id)}
              />
              <span className="size-2.5 rounded-full" style={{ background: tag.color }} />
              {tag.name}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={busy} onClick={() => onSave(selected)}>
            {busy ? "保存中…" : "保存标签"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildCustomerMessage(data: CustomerDetail, appOrigin: string) {
  const { customer, orders, stats } = data;
  const latest = orders[0];
  return [
    `Gentile ${customer.name},`,
    "",
    "la contattiamo da ChinaTech per il servizio di assistenza.",
    latest ? `Ultimo ordine: ${latest.public_no} - ${latest.device_label}` : null,
    `Dispositivi registrati: ${stats.device_count}`,
    appOrigin ? `Area assistenza: ${appOrigin}/customers/${customer.id}` : null,
    "",
    "Restiamo a disposizione per qualsiasi necessità.",
    "Grazie,",
    "ChinaTech",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function whatsAppUrl(phone: string, body: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

function smsUrl(phone: string, body: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return "";
  return `sms:${digits}?body=${encodeURIComponent(body)}`;
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
