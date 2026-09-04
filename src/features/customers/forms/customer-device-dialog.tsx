"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

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
import { CustomerFormField } from "@/features/customers/forms/customer-form-field";
import { componentOverlay } from "@/lib/component-patterns";
import type { CustomerDeviceInput, Device } from "@/lib/repairdesk/api";
import { useLocale } from "@/shared/i18n/locale-provider";

const compactInputClass = "h-11 text-base lg:h-9 lg:text-sm";

export function CustomerDeviceDialog({
  open,
  onOpenChange,
  device,
  busy,
  returnFocusRef,
  onSave,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  device?: Device;
  busy: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onSave: (input: CustomerDeviceInput) => Promise<unknown>;
}) {
  const { t } = useLocale();
  const outsideDismissedRef = useRef(false);
  const [form, setForm] = useState<CustomerDeviceInput>(() => ({
    id: device?.id,
    brand: device?.brand ?? "",
    model: device?.model ?? "",
    serial_or_imei: device?.serial_or_imei ?? "",
    device_notes: device?.device_notes ?? "",
  }));
  useEffect(() => {
    if (open) {
      outsideDismissedRef.current = false;
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
      <DialogContent
        closeLabel={t("customers.detail.close")}
        className={`${componentOverlay.formContent} !animate-none`}
        onPointerDownOutside={() => {
          outsideDismissedRef.current = true;
        }}
        onCloseAutoFocus={(event) => {
          if (outsideDismissedRef.current) {
            outsideDismissedRef.current = false;
            return;
          }
          const intendedOpener = returnFocusRef?.current;
          if (!intendedOpener?.isConnected || intendedOpener.getClientRects().length === 0) return;
          event.preventDefault();
          intendedOpener.focus({ preventScroll: true });
        }}
      >
        <DialogHeader className={componentOverlay.header}>
          <DialogTitle className={componentOverlay.title}>
            {t(device ? "customers.form.editDeviceTitle" : "customers.form.addDeviceTitle")}
          </DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            {t("customers.form.deviceDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
          <CustomerFormField
            label={t("customers.form.brand")}
            required
            htmlFor="customer-device-brand"
          >
            <Input
              id="customer-device-brand"
              className={compactInputClass}
              value={form.brand}
              onChange={(event) => setForm({ ...form, brand: event.target.value })}
            />
          </CustomerFormField>
          <CustomerFormField
            label={t("customers.form.model")}
            required
            htmlFor="customer-device-model"
          >
            <Input
              id="customer-device-model"
              className={compactInputClass}
              value={form.model}
              onChange={(event) => setForm({ ...form, model: event.target.value })}
            />
          </CustomerFormField>
          <CustomerFormField label={t("customers.form.serial")} htmlFor="customer-device-serial">
            <Input
              id="customer-device-serial"
              value={form.serial_or_imei ?? ""}
              onChange={(event) => setForm({ ...form, serial_or_imei: event.target.value })}
              className={`${compactInputClass} font-mono`}
            />
          </CustomerFormField>
          <CustomerFormField
            label={t("customers.form.deviceNotes")}
            htmlFor="customer-device-notes"
          >
            <Input
              id="customer-device-notes"
              className={compactInputClass}
              value={form.device_notes ?? ""}
              onChange={(event) => setForm({ ...form, device_notes: event.target.value })}
            />
          </CustomerFormField>
        </div>
        <DialogFooter className={componentOverlay.footer}>
          <Button
            className="min-h-11 whitespace-normal lg:min-h-9"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t("customers.form.cancel")}
          </Button>
          <Button
            disabled={busy || !form.brand.trim() || !form.model.trim()}
            className="min-h-11 whitespace-normal lg:min-h-9"
            onClick={() => void onSave(form).catch(() => undefined)}
          >
            {busy ? t("customers.form.saving") : t("customers.form.saveDevice")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
