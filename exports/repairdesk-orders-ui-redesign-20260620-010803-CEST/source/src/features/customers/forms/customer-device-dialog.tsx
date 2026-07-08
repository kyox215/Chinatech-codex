"use client";

import { useEffect, useState } from "react";

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

const compactInputClass = "h-8 text-sm sm:h-9";

export function CustomerDeviceDialog({
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
      <DialogContent className={componentOverlay.formContent}>
        <DialogHeader className={componentOverlay.header}>
          <DialogTitle className={componentOverlay.title}>
            {device ? "编辑设备" : "添加设备"}
          </DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            设备档案用于新建工单预填；历史工单仍保留创建时快照。
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
          <CustomerFormField label="品牌" required>
            <Input
              className={compactInputClass}
              value={form.brand}
              onChange={(event) => setForm({ ...form, brand: event.target.value })}
            />
          </CustomerFormField>
          <CustomerFormField label="型号" required>
            <Input
              className={compactInputClass}
              value={form.model}
              onChange={(event) => setForm({ ...form, model: event.target.value })}
            />
          </CustomerFormField>
          <CustomerFormField label="IMEI / 序列号">
            <Input
              value={form.serial_or_imei ?? ""}
              onChange={(event) => setForm({ ...form, serial_or_imei: event.target.value })}
              className={`${compactInputClass} font-mono`}
            />
          </CustomerFormField>
          <CustomerFormField label="设备备注">
            <Input
              className={compactInputClass}
              value={form.device_notes ?? ""}
              onChange={(event) => setForm({ ...form, device_notes: event.target.value })}
            />
          </CustomerFormField>
        </div>
        <DialogFooter className={componentOverlay.footer}>
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
