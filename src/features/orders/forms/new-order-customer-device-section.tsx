"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { ChevronDown, ScanLine, Search, Smartphone, UserRound } from "lucide-react";

import { ImeiScannerField } from "@/components/imei-scanner-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerIntakeLookup } from "@/features/orders/forms/customer-intake-lookup";
import { SectionHeading } from "@/features/orders/forms/new-order-fields";
import { brandSuggestions, type NewOrderFormState } from "@/features/orders/model/new-order-form";
import type { CustomerHistoryDeviceCandidate, CustomerIntakeCandidate } from "@/lib/repairdesk/api";
import { detailWorkspace, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export function NewOrderCustomerDeviceSection({
  form,
  setForm,
  historyDevices,
  onClearCustomerContext,
  onPickCustomer,
  onPickHistoryDevice,
  onSelectHistoryDevice,
  surface = "page",
}: {
  form: NewOrderFormState;
  setForm: Dispatch<SetStateAction<NewOrderFormState>>;
  historyDevices: CustomerHistoryDeviceCandidate[];
  onClearCustomerContext: () => void;
  onPickCustomer: (candidate: CustomerIntakeCandidate) => void | Promise<void>;
  onPickHistoryDevice: (
    candidate: CustomerIntakeCandidate,
    device: CustomerHistoryDeviceCandidate,
  ) => void | Promise<void>;
  onSelectHistoryDevice: (device: CustomerHistoryDeviceCandidate) => void;
  surface?: "page" | "dialog";
}) {
  const shellClass = cn(
    "h-fit min-w-0 p-2 sm:p-3",
    surface === "dialog" ? detailWorkspace.flatPanel : repairOs.mobileInfoCard,
  );
  const visualInputClass =
    "absolute left-0 top-0 h-12 w-[133.333%] origin-top-left scale-75 border-0 bg-transparent px-0 py-0 font-sans text-base leading-[3rem] text-foreground shadow-none placeholder:text-base placeholder:text-muted-foreground/55 focus-visible:ring-0 md:static md:h-8 md:w-full md:scale-100 md:text-[13px] md:leading-8 md:placeholder:text-[13px]";
  const hasDeviceDraft = Boolean(form.brand.trim() || form.model.trim() || form.imei.trim());

  return (
    <div className="grid min-w-0 gap-1.5 sm:gap-3">
      <section className={cn(shellClass, "space-y-1.5")}>
        <SectionHeading icon={UserRound} title="客户信息" className="mb-1.5" />
        <div className="grid min-w-0 gap-1.5">
          <DensePillField
            label="电话"
            required
            leading={<Search className="size-3.5" />}
            trailing={<UserRound className="size-3.5 text-primary" />}
          >
            <CustomerIntakeLookup
              value={form.customerPhone}
              selectedCustomerId={form.customerId}
              selectedDeviceId={form.deviceId}
              className={visualInputClass}
              containerClassName="relative h-9 w-full min-w-0 overflow-hidden"
              placeholder="搜索电话 / 客户"
              onChange={(customerPhone) => {
                onClearCustomerContext();
                setForm({
                  ...form,
                  customerPhone,
                  customerId: undefined,
                  deviceId: undefined,
                });
              }}
              onPickCustomer={onPickCustomer}
              onPickHistoryDevice={onPickHistoryDevice}
            />
          </DensePillField>
          <DensePillField label="姓名">
            <Input
              value={form.customerName}
              onChange={(event) =>
                setForm({ ...form, customerName: event.target.value, customerId: undefined })
              }
              className={visualInputClass}
              placeholder="客户姓名（可选）"
            />
          </DensePillField>
        </div>
        <p className="mt-1 rounded-lg bg-primary/5 px-2 py-1 text-[9px] leading-3 text-primary">
          输入电话会即时匹配客户档案与历史维修型号
        </p>
      </section>

      <section className={cn(shellClass, "space-y-1.5")}>
        <SectionHeading icon={Smartphone} title="设备信息" className="mb-1.5" />
        <datalist id="repair-brand-suggestions">
          {brandSuggestions.map((brand) => (
            <option key={brand} value={brand} />
          ))}
        </datalist>
        {form.customerId && !hasDeviceDraft && historyDevices.length > 0 && (
          <div className="mb-1.5 rounded-xl border border-[var(--border-panel)] bg-card p-1.5 shadow-[var(--shadow-card)]">
            <div className="mb-1 flex items-center justify-between gap-2 px-1">
              <span className="truncate text-[10px] font-bold leading-3 text-muted-foreground">
                历史维修型号
              </span>
              <span className="shrink-0 text-[9px] font-medium leading-3 text-primary">
                手动选择
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {historyDevices.map((device) => (
                <button
                  key={device.id}
                  type="button"
                  className="min-w-0 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 py-1 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring"
                  onClick={() => onSelectHistoryDevice(device)}
                >
                  <span className="block truncate text-[10px] font-bold leading-3">
                    {device.brand} {device.model}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[9px] font-medium leading-3 text-muted-foreground">
                    {device.serial_or_imei || device.order_public_no || "历史记录"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid min-w-0 gap-1.5">
          <DensePillField
            label="品牌"
            required
            trailing={<ChevronDown className="size-3.5 text-muted-foreground" />}
          >
            <Input
              list="repair-brand-suggestions"
              value={form.brand}
              onChange={(event) =>
                setForm({ ...form, brand: event.target.value, deviceId: undefined })
              }
              className={cn(visualInputClass, "pr-10")}
              placeholder="选择品牌"
            />
          </DensePillField>
          <DensePillField
            label="型号"
            required
            trailing={<ChevronDown className="size-3.5 text-muted-foreground" />}
          >
            <Input
              value={form.model}
              onChange={(event) =>
                setForm({ ...form, model: event.target.value, deviceId: undefined })
              }
              className={cn(visualInputClass, "pr-10")}
              placeholder="例如 iPhone 13"
            />
          </DensePillField>
          <DenseScannerBlock label="IMEI">
            <div className="min-w-0 flex-1">
              <ImeiScannerField
                value={form.imei}
                onChange={(imei) => setForm({ ...form, imei, deviceId: undefined })}
                placeholder="请输入 IMEI / 序列号"
                density="compact"
                appearance="quiet"
                showPaste={false}
              />
            </div>
            <span className="ml-1 hidden h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-[9px] font-medium text-primary min-[430px]:inline-flex">
              <ScanLine className="size-3.5" />
              校验
            </span>
          </DenseScannerBlock>
        </div>
      </section>
    </div>
  );
}

function DensePillField({
  label,
  required,
  leading,
  trailing,
  children,
}: {
  label: string;
  required?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rd-new-order-field grid min-h-10 min-w-0 grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-1.5 rounded-xl border border-[var(--border-panel)] bg-card px-2 py-1 shadow-[var(--shadow-card)]">
      <Label className="truncate text-[10.5px] font-semibold leading-4 text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <div className="grid h-9 min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-center gap-1.5 overflow-hidden">
        <span className="grid size-4 shrink-0 place-items-center text-muted-foreground">
          {leading}
        </span>
        <div className="relative h-9 min-w-0 flex-1 overflow-hidden">{children}</div>
      </div>
      {trailing ? (
        <div className="pointer-events-none flex h-8 shrink-0 items-center gap-1 border-l border-[var(--border-panel)] pl-2">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}

function DenseScannerBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rd-new-order-field grid min-h-10 min-w-0 grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-1.5 rounded-xl border border-[var(--border-panel)] bg-card px-2 py-1 shadow-[var(--shadow-card)]">
      <Label className="truncate text-[10.5px] font-semibold leading-4 text-muted-foreground">
        {label}
      </Label>
      <div className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-center gap-1.5">
        <span className="size-4" />
        <div className="flex min-w-0 items-center">{children}</div>
      </div>
    </div>
  );
}
