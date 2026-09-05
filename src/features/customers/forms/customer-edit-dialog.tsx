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
import { useLocale } from "@/shared/i18n/locale-provider";
import { uniqueContactPhones } from "@/shared/lib/phone";

const customerChannelOptions = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
] as const;

const compactInputClass = `${componentOverlay.editorField} h-11 lg:h-9 lg:text-sm`;
const compactTextareaClass = `${componentOverlay.editorField} min-h-20 lg:text-sm`;

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
  const { t } = useLocale();
  const [form, setForm] = useState<CustomerUpdateInput>(() => buildCustomerForm(data));
  useEffect(() => {
    if (open) setForm(buildCustomerForm(data));
  }, [data, open]);
  const canSave = form.name.trim() && form.phone_e164.trim();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("customers.detail.close")}
        className={`${componentOverlay.formContent} ${componentOverlay.editorSurface}`}
      >
        <DialogHeader className={componentOverlay.editorHeader}>
          <DialogTitle className={componentOverlay.title}>
            {t("customers.form.editTitle")}
          </DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            {t("customers.form.editDescription")}
          </DialogDescription>
        </DialogHeader>
        <CustomerFields form={form} setForm={setForm} />
        <DialogFooter className={`${componentOverlay.footer} ${componentOverlay.editorFooter}`}>
          <Button
            className="min-h-11 whitespace-normal lg:min-h-9"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t("customers.form.cancel")}
          </Button>
          <Button
            className="min-h-11 whitespace-normal lg:min-h-9"
            disabled={busy || !canSave}
            onClick={() => void onSave(form).catch(() => undefined)}
          >
            {busy ? t("customers.form.saving") : t("customers.form.save")}
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
    contact_phones: uniqueContactPhones(customer.phone_e164, customer.contact_phones),
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
  const { t } = useLocale();
  return (
    <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
      <CustomerFormField label={t("customers.form.name")} required htmlFor="customer-edit-name">
        <Input
          id="customer-edit-name"
          className={compactInputClass}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </CustomerFormField>
      <CustomerFormField label={t("customers.form.phone")} required htmlFor="customer-edit-phone">
        <Input
          id="customer-edit-phone"
          value={form.phone_e164}
          onChange={(event) => setForm({ ...form, phone_e164: event.target.value })}
          className={`${compactInputClass} font-mono`}
        />
      </CustomerFormField>
      <div className="sm:col-span-2">
        <CustomerFormField label={t("customers.form.backupPhones")}>
          <CustomerBackupPhonesField
            primaryPhone={form.phone_e164}
            phones={form.contact_phones ?? []}
            onPrimaryPhoneChange={(phone_e164) => setForm({ ...form, phone_e164 })}
            onPhonesChange={(contact_phones) => setForm({ ...form, contact_phones })}
          />
        </CustomerFormField>
      </div>
      <CustomerFormField label={t("customers.form.email")} htmlFor="customer-edit-email">
        <Input
          id="customer-edit-email"
          className={compactInputClass}
          value={form.email ?? ""}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
      </CustomerFormField>
      <CustomerFormField
        label={t("customers.form.preferredChannel")}
        htmlFor="customer-edit-channel"
      >
        <Select
          value={form.preferred_channel ?? "whatsapp"}
          onValueChange={(preferred_channel) =>
            setForm({ ...form, preferred_channel: preferred_channel as "whatsapp" | "sms" })
          }
        >
          <SelectTrigger id="customer-edit-channel" className={compactInputClass}>
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
        <CustomerFormField label={t("customers.form.customerNotes")} htmlFor="customer-edit-notes">
          <Textarea
            id="customer-edit-notes"
            className={compactTextareaClass}
            value={form.notes ?? ""}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
        </CustomerFormField>
      </div>
      <div className="sm:col-span-2">
        <CustomerFormField
          label={t("customers.form.contactNotes")}
          htmlFor="customer-edit-contact-notes"
        >
          <Textarea
            id="customer-edit-contact-notes"
            className={compactTextareaClass}
            value={form.marketing_notes ?? ""}
            onChange={(event) => setForm({ ...form, marketing_notes: event.target.value })}
          />
        </CustomerFormField>
      </div>
      <label className="flex min-h-11 min-w-0 items-center gap-2 whitespace-normal text-sm">
        <Checkbox
          checked={form.consent_marketing ?? false}
          onCheckedChange={(checked) => setForm({ ...form, consent_marketing: Boolean(checked) })}
        />
        {t("customers.form.allowContact")}
      </label>
      <label className="flex min-h-11 min-w-0 items-center gap-2 whitespace-normal text-sm">
        <Checkbox
          checked={form.consent_sms ?? false}
          onCheckedChange={(checked) => setForm({ ...form, consent_sms: Boolean(checked) })}
        />
        {t("customers.form.allowSms")}
      </label>
      <label className="flex min-h-11 min-w-0 items-center gap-2 whitespace-normal text-sm">
        <Checkbox
          checked={form.blacklisted ?? false}
          onCheckedChange={(checked) => setForm({ ...form, blacklisted: Boolean(checked) })}
        />
        {t("customers.form.blacklist")}
      </label>
    </div>
  );
}
