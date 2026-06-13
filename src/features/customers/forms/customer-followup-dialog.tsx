"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CustomerFormField } from "@/features/customers/forms/customer-form-field";
import { componentOverlay } from "@/lib/component-patterns";
import type { CustomerFollowupInput, OrderListItem } from "@/lib/repairdesk/api";

const compactInputClass = "h-8 text-sm sm:h-9";
const compactTextareaClass = "min-h-20 text-sm";

export function CustomerFollowupDialog({
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
  const defaultDueAt = useMemo(
    () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 16),
    [],
  );
  const [form, setForm] = useState<CustomerFollowupInput>({
    title: "维修后满意度回访",
    due_at: defaultDueAt,
    owner_name: "",
    note: "",
  });
  useEffect(() => {
    if (open) {
      setForm({
        title: "维修后满意度回访",
        due_at: defaultDueAt,
        owner_name: "",
        note: "",
        order_id: selectedOrderId,
      });
    }
  }, [defaultDueAt, open, selectedOrderId]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={componentOverlay.formContent}>
        <DialogHeader className={componentOverlay.header}>
          <DialogTitle className={componentOverlay.title}>添加回访任务</DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            用于售后满意度、报价确认或取机提醒。
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-2.5">
          <CustomerFormField label="标题" required>
            <Input
              className={compactInputClass}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </CustomerFormField>
          <CustomerFormField label="关联工单">
            <select
              value={form.order_id ?? ""}
              onChange={(event) => setForm({ ...form, order_id: event.target.value || undefined })}
              className="h-8 w-full rounded-md border border-[var(--border-panel)] bg-background px-3 text-sm sm:h-9"
            >
              <option value="">不关联</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.public_no} · {order.device_label}
                </option>
              ))}
            </select>
          </CustomerFormField>
          <CustomerFormField label="到期时间" required>
            <Input
              className={compactInputClass}
              type="datetime-local"
              value={form.due_at}
              onChange={(event) => setForm({ ...form, due_at: event.target.value })}
            />
          </CustomerFormField>
          <CustomerFormField label="负责人">
            <Input
              className={compactInputClass}
              value={form.owner_name ?? ""}
              onChange={(event) => setForm({ ...form, owner_name: event.target.value })}
            />
          </CustomerFormField>
          <CustomerFormField label="备注">
            <Textarea
              className={compactTextareaClass}
              value={form.note ?? ""}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </CustomerFormField>
        </div>
        <DialogFooter className={componentOverlay.footer}>
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
