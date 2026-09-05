"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";

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
import { useLocale } from "@/shared/i18n/locale-provider";

const compactInputClass = `${componentOverlay.editorField} h-11 lg:h-9 lg:text-sm`;
const compactTextareaClass = `${componentOverlay.editorField} min-h-20 lg:text-sm`;

export function CustomerFollowupDialog({
  open,
  onOpenChange,
  busy,
  orders,
  selectedOrderId,
  returnFocusRef,
  onSave,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  busy: boolean;
  orders: OrderListItem[];
  selectedOrderId?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onSave: (input: CustomerFollowupInput) => Promise<unknown>;
}) {
  const { t } = useLocale();
  const defaultDueAt = useMemo(
    () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 16),
    [],
  );
  const [form, setForm] = useState<CustomerFollowupInput>({
    title: "维修后联系客户",
    due_at: defaultDueAt,
    owner_name: "",
    note: "",
  });
  useEffect(() => {
    if (open) {
      setForm({
        title: "维修后联系客户",
        due_at: defaultDueAt,
        owner_name: "",
        note: "",
        order_id: selectedOrderId,
      });
    }
  }, [defaultDueAt, open, selectedOrderId]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("customers.detail.close")}
        className={`${componentOverlay.formContent} ${componentOverlay.editorSurface}`}
        onCloseAutoFocus={(event) => {
          const intendedOpener = returnFocusRef?.current;
          if (!intendedOpener?.isConnected || intendedOpener.getClientRects().length === 0) return;
          event.preventDefault();
          intendedOpener.focus({ preventScroll: true });
        }}
      >
        <DialogHeader className={componentOverlay.editorHeader}>
          <DialogTitle className={componentOverlay.title}>
            {t("customers.form.followupTitle")}
          </DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            {t("customers.form.followupDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-2.5">
          <CustomerFormField
            label={t("customers.form.title")}
            required
            htmlFor="customer-followup-title"
          >
            <Input
              id="customer-followup-title"
              className={compactInputClass}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </CustomerFormField>
          <CustomerFormField
            label={t("customers.form.relatedOrder")}
            htmlFor="customer-followup-order"
          >
            <select
              id="customer-followup-order"
              value={form.order_id ?? ""}
              onChange={(event) => setForm({ ...form, order_id: event.target.value || undefined })}
              className="h-11 w-full rounded-md border border-[var(--border-panel)] bg-background px-3 text-base lg:h-9 lg:text-sm"
            >
              <option value="">{t("customers.form.noRelatedOrder")}</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.public_no} · {order.device_label}
                </option>
              ))}
            </select>
          </CustomerFormField>
          <CustomerFormField
            label={t("customers.form.dueAt")}
            required
            htmlFor="customer-followup-due-at"
          >
            <Input
              id="customer-followup-due-at"
              className={compactInputClass}
              type="datetime-local"
              value={form.due_at}
              onChange={(event) => setForm({ ...form, due_at: event.target.value })}
            />
          </CustomerFormField>
          <CustomerFormField label={t("customers.form.owner")} htmlFor="customer-followup-owner">
            <Input
              id="customer-followup-owner"
              className={compactInputClass}
              value={form.owner_name ?? ""}
              onChange={(event) => setForm({ ...form, owner_name: event.target.value })}
            />
          </CustomerFormField>
          <CustomerFormField label={t("customers.form.notes")} htmlFor="customer-followup-notes">
            <Textarea
              id="customer-followup-notes"
              className={compactTextareaClass}
              value={form.note ?? ""}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </CustomerFormField>
        </div>
        <DialogFooter className={`${componentOverlay.footer} ${componentOverlay.editorFooter}`}>
          <Button
            className="min-h-11 whitespace-normal lg:min-h-9"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t("customers.form.cancel")}
          </Button>
          <Button
            disabled={busy || !form.title.trim() || !form.due_at}
            className="min-h-11 whitespace-normal lg:min-h-9"
            onClick={() => void onSave(form).catch(() => undefined)}
          >
            {busy ? t("customers.form.creating") : t("customers.form.createFollowup")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
