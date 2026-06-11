"use client";

import type { Dispatch, SetStateAction } from "react";

import { ImeiScannerField } from "@/components/imei-scanner-field";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerPhoneLookup } from "@/features/orders/forms/customer-phone-lookup";
import { FormItem, SectionHeading } from "@/features/orders/forms/new-order-fields";
import { brandSuggestions, type NewOrderFormState } from "@/features/orders/model/new-order-form";
import type { Customer, Device } from "@/lib/repairdesk/api";
import { detailWorkspace } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export function NewOrderCustomerDeviceSection({
  form,
  setForm,
  knownDevices,
  onClearKnownDevices,
  onPickCustomer,
  onSelectKnownDevice,
  surface = "page",
}: {
  form: NewOrderFormState;
  setForm: Dispatch<SetStateAction<NewOrderFormState>>;
  knownDevices: Device[];
  onClearKnownDevices: () => void;
  onPickCustomer: (customer: Customer) => void | Promise<void>;
  onSelectKnownDevice: (deviceId: string) => void;
  surface?: "page" | "dialog";
}) {
  const shellClass = cn(
    "h-fit min-w-0",
    surface === "dialog"
      ? detailWorkspace.flatPanel
      : "glass-card border-border/70 p-2.5 shadow-sm sm:p-4",
  );
  const Shell = surface === "dialog" ? "section" : Card;

  return (
    <Shell className={shellClass}>
      <SectionHeading title="客户信息" />
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-1 2xl:grid-cols-2">
        <FormItem label="电话" required>
          <CustomerPhoneLookup
            value={form.customerPhone}
            selectedCustomerId={form.customerId}
            onChange={(customerPhone) => {
              onClearKnownDevices();
              setForm({
                ...form,
                customerPhone,
                customerId: undefined,
                deviceId: undefined,
              });
            }}
            onPick={onPickCustomer}
          />
        </FormItem>
        <FormItem label="姓名">
          <Input
            value={form.customerName}
            onChange={(event) =>
              setForm({ ...form, customerName: event.target.value, customerId: undefined })
            }
            className="h-8 sm:h-9"
            placeholder="客户姓名（可选）"
          />
        </FormItem>
      </div>

      <SectionHeading title="设备信息" className="mt-3 sm:mt-4" />
      <datalist id="repair-brand-suggestions">
        {brandSuggestions.map((brand) => (
          <option key={brand} value={brand} />
        ))}
      </datalist>
      {form.customerId && knownDevices.length > 1 && (
        <div className="mb-3">
          <FormItem label="选择客户设备">
            <Select value={form.deviceId ?? "new"} onValueChange={onSelectKnownDevice}>
              <SelectTrigger className="h-8 sm:h-9">
                <SelectValue placeholder="请选择本次维修设备" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">新设备 / 本次手动录入</SelectItem>
                {knownDevices.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.brand} {device.model}
                    {device.serial_or_imei ? ` · ${device.serial_or_imei}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        </div>
      )}
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-1 2xl:grid-cols-2">
        <FormItem label="品牌" required>
          <Input
            list="repair-brand-suggestions"
            value={form.brand}
            onChange={(event) =>
              setForm({ ...form, brand: event.target.value, deviceId: undefined })
            }
            className="h-8 sm:h-9"
            placeholder="选择品牌"
          />
        </FormItem>
        <FormItem label="型号" required>
          <Input
            value={form.model}
            onChange={(event) =>
              setForm({ ...form, model: event.target.value, deviceId: undefined })
            }
            className="h-8 sm:h-9"
            placeholder="例如：iPhone 13"
          />
        </FormItem>
      </div>
      <div className="mt-2 sm:mt-3">
        <FormItem label="IMEI / 序列号">
          <ImeiScannerField
            value={form.imei}
            onChange={(imei) => setForm({ ...form, imei, deviceId: undefined })}
            placeholder="可选"
            density="compact"
          />
        </FormItem>
      </div>
      <div className="mt-2 sm:mt-3">
        <FormItem label="设备备注">
          <Input
            value={form.deviceNotes}
            onChange={(event) =>
              setForm({ ...form, deviceNotes: event.target.value, deviceId: undefined })
            }
            className="h-8 sm:h-9"
            placeholder="外观、机身状态、缺失说明"
          />
        </FormItem>
      </div>
    </Shell>
  );
}
