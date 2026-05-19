"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { CustomerFormField } from "@/features/customers/forms/customer-form-field";
import { CustomerSegmented } from "@/features/customers/forms/customer-filters";
import type { CustomerDetail, CustomerUpdateInput } from "@/lib/repairdesk/api";

export function CustomerEditDialog({
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
      <CustomerFormField label="姓名" required>
        <Input
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </CustomerFormField>
      <CustomerFormField label="手机号" required>
        <Input
          value={form.phone_e164}
          onChange={(event) => setForm({ ...form, phone_e164: event.target.value })}
          className="font-mono"
        />
      </CustomerFormField>
      <CustomerFormField label="邮箱">
        <Input
          value={form.email ?? ""}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
      </CustomerFormField>
      <CustomerFormField label="首选通道">
        <CustomerSegmented
          value={form.preferred_channel ?? "whatsapp"}
          options={[
            ["whatsapp", "WhatsApp"],
            ["sms", "SMS"],
          ]}
          onChange={(preferred_channel) =>
            setForm({ ...form, preferred_channel: preferred_channel as "whatsapp" | "sms" })
          }
        />
      </CustomerFormField>
      <div className="sm:col-span-2">
        <CustomerFormField label="客户备注">
          <Textarea
            rows={3}
            value={form.notes ?? ""}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
        </CustomerFormField>
      </div>
      <div className="sm:col-span-2">
        <CustomerFormField label="营销备注">
          <Textarea
            rows={3}
            value={form.marketing_notes ?? ""}
            onChange={(event) => setForm({ ...form, marketing_notes: event.target.value })}
          />
        </CustomerFormField>
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
