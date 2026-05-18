"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowUpRight, Bell, Filter, Mail, Plus, Search, Tags, Users } from "lucide-react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { MoneyText, PhoneText } from "@/components/orders/badges";
import {
  createCustomer,
  listCustomers,
  type CustomerCreateInput,
  type CustomerListFilters,
  type CustomerListItem,
  type CustomerTag,
} from "@/lib/repairdesk/api";
import { fadeUp, stagger } from "@/lib/motion";
import { brandGradientStyle, pageHeader, pageShell } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const defaultCustomerForm: CustomerCreateInput = {
  name: "",
  phone_e164: "",
  email: "",
  contact_phones: [],
  consent_marketing: true,
  consent_sms: true,
  preferred_channel: "whatsapp",
  language: "it",
  notes: "",
  marketing_notes: "",
  blacklisted: false,
};

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<CustomerListFilters>({
    marketing: "all",
    followup: "all",
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", filters],
    queryFn: () => listCustomers(filters),
  });

  const create = useMutation({
    mutationFn: (input: CustomerCreateInput) => createCustomer(input),
    onSuccess: () => {
      toast.success("客户已创建");
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const customers = data?.customers ?? [];
  const tags = data?.tags ?? [];
  const stats = data?.stats;

  const activeFilterCount = useMemo(() => {
    return (
      (filters.tagIds?.length ?? 0) +
      (filters.marketing && filters.marketing !== "all" ? 1 : 0) +
      (filters.followup && filters.followup !== "all" ? 1 : 0)
    );
  }, [filters]);

  return (
    <div className={pageShell.list}>
      <motion.div
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
        className="mb-5 space-y-4"
      >
        <div className={pageHeader.root}>
          <motion.div variants={fadeUp}>
            <p className={pageHeader.eyebrow}>CRM / 客户管理</p>
            <h1 className={pageHeader.title}>
              <span className="gradient-text">客户</span>
              <span className="ml-2 align-middle text-base font-normal text-muted-foreground">
                共 {customers.length} 位
              </span>
            </h1>
            <p className={pageHeader.subtitle}>客户资料、设备、历史工单、营销标签与回访任务。</p>
          </motion.div>
          <motion.div variants={fadeUp} className={pageHeader.actions}>
            <Button
              className="gap-1.5 border-0 text-white"
              style={brandGradientStyle}
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" /> 新建客户
            </Button>
          </motion.div>
        </div>

        <motion.div variants={fadeUp} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Users} label="总客户" value={stats?.total ?? 0} />
          <KpiCard icon={ArrowUpRight} label="复购客户" value={stats?.repeat ?? 0} />
          <KpiCard icon={Bell} label="待回访" value={stats?.dueFollowups ?? 0} />
          <KpiCard icon={Mail} label="可营销" value={stats?.marketable ?? 0} />
        </motion.div>
      </motion.div>

      <div className="glass-card mb-4 flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search ?? ""}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="搜索姓名、电话、邮箱或设备"
              className="h-9 border-border/60 bg-surface/60 pl-8"
            />
          </div>
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Filter className="size-3.5" /> 筛选
                {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-sm p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>客户筛选</SheetTitle>
              </SheetHeader>
              <CustomerFilters
                filters={filters}
                tags={tags}
                onChange={setFilters}
                onClose={() => setFilterOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "allowed", "blocked"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilters({ ...filters, marketing: value })}
              className={cn(
                "rounded-md border px-2 py-1 text-xs transition-colors",
                (filters.marketing ?? "all") === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-surface hover:bg-accent",
              )}
            >
              {value === "all" ? "全部营销状态" : value === "allowed" ? "可营销" : "不可营销"}
            </button>
          ))}
          {(["all", "due", "overdue"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilters({ ...filters, followup: value })}
              className={cn(
                "rounded-md border px-2 py-1 text-xs transition-colors",
                (filters.followup ?? "all") === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-surface hover:bg-accent",
              )}
            >
              {value === "all" ? "全部回访" : value === "due" ? "今天到期" : "已逾期"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="glass-card mx-auto mt-16 max-w-sm p-8 text-center">
          <Search className="mx-auto size-8 text-muted-foreground" />
          <h3 className="mt-3 font-display text-lg font-semibold">暂无符合条件的客户</h3>
          <p className="mt-1 text-sm text-muted-foreground">试试调整筛选条件，或新建客户档案。</p>
        </div>
      ) : (
        <>
          <div className="glass-card hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border/40">
                  <th className="px-4 py-2.5 text-left font-medium">客户</th>
                  <th className="px-3 py-2.5 text-left font-medium">标签</th>
                  <th className="px-3 py-2.5 text-left font-medium">设备/工单</th>
                  <th className="px-3 py-2.5 text-right font-medium">已结清营收</th>
                  <th className="px-3 py-2.5 text-right font-medium">未结清</th>
                  <th className="px-3 py-2.5 text-left font-medium">下次回访</th>
                  <th className="w-20 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <CustomerRow key={customer.id} customer={customer} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {customers.map((customer) => (
              <CustomerMobileCard key={customer.id} customer={customer} />
            ))}
          </div>
        </>
      )}

      <CustomerFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建客户"
        busy={create.isPending}
        initial={defaultCustomerForm}
        onSave={(input) => create.mutateAsync(input)}
      />
    </div>
  );
}

function KpiCard({
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

function CustomerRow({ customer }: { customer: CustomerListItem }) {
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
        <TagList tags={customer.tags} />
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
        {customer.next_followup_at ? formatDate(customer.next_followup_at) : "—"}
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

function CustomerMobileCard({ customer }: { customer: CustomerListItem }) {
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
        <TagList tags={customer.tags} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <InfoPill label="设备" value={`${customer.device_count}`} />
        <InfoPill label="工单" value={`${customer.order_count}`} />
        <InfoPill label="营收" value={<MoneyText amount={customer.total_spent} />} />
        <InfoPill
          label="回访"
          value={customer.next_followup_at ? formatDate(customer.next_followup_at) : "—"}
        />
      </div>
    </Card>
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

function TagList({ tags }: { tags: CustomerTag[] }) {
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

function CustomerFilters({
  filters,
  tags,
  onChange,
  onClose,
}: {
  filters: CustomerListFilters;
  tags: CustomerTag[];
  onChange: (filters: CustomerListFilters) => void;
  onClose: () => void;
}) {
  const toggleTag = (tagId: string) => {
    const current = filters.tagIds ?? [];
    const next = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onChange({ ...filters, tagIds: next });
  };
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <Tags className="size-4" /> 客户筛选
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <section>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">标签</div>
          <div className="space-y-1.5">
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={filters.tagIds?.includes(tag.id) ?? false}
                  onCheckedChange={() => toggleTag(tag.id)}
                />
                <span className="size-2.5 rounded-full" style={{ background: tag.color }} />
                {tag.name}
              </label>
            ))}
          </div>
        </section>
        <section>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">营销状态</div>
          <Segmented
            value={filters.marketing ?? "all"}
            options={[
              ["all", "全部"],
              ["allowed", "可营销"],
              ["blocked", "不可营销"],
            ]}
            onChange={(marketing) =>
              onChange({ ...filters, marketing: marketing as CustomerListFilters["marketing"] })
            }
          />
        </section>
        <section>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">回访</div>
          <Segmented
            value={filters.followup ?? "all"}
            options={[
              ["all", "全部"],
              ["due", "今天到期"],
              ["overdue", "已逾期"],
            ]}
            onChange={(followup) =>
              onChange({ ...filters, followup: followup as CustomerListFilters["followup"] })
            }
          />
        </section>
      </div>
      <div className="border-t p-3">
        <Button className="w-full" onClick={onClose}>
          应用筛选
        </Button>
      </div>
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "rounded-md border px-2 py-1 text-xs",
            value === key
              ? "border-primary bg-primary/10 text-primary"
              : "bg-surface hover:bg-accent",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CustomerFormDialog({
  open,
  onOpenChange,
  title,
  initial,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  initial: CustomerCreateInput;
  busy: boolean;
  onSave: (input: CustomerCreateInput) => Promise<unknown>;
}) {
  const [form, setForm] = useState(initial);

  useEffect(() => {
    if (open) setForm(initial);
  }, [initial, open]);

  const canSave = form.name.trim() && form.phone_e164.trim();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            手机号会作为客户唯一身份，用于新建订单自动复用客户。
          </DialogDescription>
        </DialogHeader>
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
            <Segmented
              value={form.preferred_channel ?? "whatsapp"}
              options={[
                ["whatsapp", "WhatsApp"],
                ["sms", "SMS"],
              ]}
              onChange={(preferred_channel) =>
                setForm({ ...form, preferred_channel: preferred_channel as "whatsapp" | "sms" })
              }
            />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="客户备注">
              <Textarea
                value={form.notes ?? ""}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                rows={3}
              />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label="营销备注">
              <Textarea
                value={form.marketing_notes ?? ""}
                onChange={(event) => setForm({ ...form, marketing_notes: event.target.value })}
                rows={3}
              />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.consent_marketing ?? false}
              onCheckedChange={(checked) =>
                setForm({ ...form, consent_marketing: Boolean(checked) })
              }
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
        </div>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
