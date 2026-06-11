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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CustomerBackupPhonesField } from "@/features/customers/forms/customer-backup-phones-field";
import { CustomerFormField } from "@/features/customers/forms/customer-form-field";
import { componentOverlay } from "@/lib/component-patterns";
import type { CustomerDetail, CustomerUpdateInput } from "@/lib/repairdesk/api";

const customerChannelOptions = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
] as const;

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
      <DialogContent className={componentOverlay.responsiveContent}>
        <DialogHeader className={componentOverlay.header}>
          <DialogTitle className={componentOverlay.title}>编辑客户</DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            客户姓名和联系方式会实时联动到相关工单显示。
          </DialogDescription>
        </DialogHeader>
        <CustomerFields form={form} setForm={setForm} />
        <DialogFooter className={componentOverlay.footer}>
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
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
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
      <div className="sm:col-span-2">
        <CustomerFormField label="备用联系电话">
          <CustomerBackupPhonesField
            primaryPhone={form.phone_e164}
            phones={form.contact_phones ?? []}
            onPrimaryPhoneChange={(phone_e164) => setForm({ ...form, phone_e164 })}
            onPhonesChange={(contact_phones) => setForm({ ...form, contact_phones })}
          />
        </CustomerFormField>
      </div>
      <CustomerFormField label="邮箱">
        <Input
          value={form.email ?? ""}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
      </CustomerFormField>
      <CustomerFormField label="首选通道">
        <Select
          value={form.preferred_channel ?? "whatsapp"}
          onValueChange={(preferred_channel) =>
            setForm({ ...form, preferred_channel: preferred_channel as "whatsapp" | "sms" })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {customerChannelOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      <label className="flex min-w-0 items-center gap-2 text-sm">
        <Checkbox
          checked={form.consent_marketing ?? false}
          onCheckedChange={(checked) => setForm({ ...form, consent_marketing: Boolean(checked) })}
        />
        允许营销触达
      </label>
      <label className="flex min-w-0 items-center gap-2 text-sm">
        <Checkbox
          checked={form.consent_sms ?? false}
          onCheckedChange={(checked) => setForm({ ...form, consent_sms: Boolean(checked) })}
        />
        允许短信通知
      </label>
      <label className="flex min-w-0 items-center gap-2 text-sm">
        <Checkbox
          checked={form.blacklisted ?? false}
          onCheckedChange={(checked) => setForm({ ...form, blacklisted: Boolean(checked) })}
        />
        加入黑名单
      </label>
    </div>
  );
}
