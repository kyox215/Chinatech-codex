"use client";

import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Check, ChevronDown, ScanLine, Smartphone, Store, UserRound } from "lucide-react";

import { ImeiScannerField } from "@/components/imei-scanner-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeviceUnlockEditor } from "@/features/orders/components/device-unlock-fields";
import { OrderWorkspaceSectionHeader } from "@/features/orders/components/order-workspace-primitives";
import { CustomerIdentityLookup } from "@/features/orders/forms/customer-intake-lookup";
import {
  brandSuggestions,
  deviceModelSuggestionsForBrand,
  isAppleDeviceModelSuggestion,
  type NewOrderFormState,
} from "@/features/orders/model/new-order-form";
import {
  DEVICE_CUSTODY_WITH_CUSTOMER,
  DEVICE_CUSTODY_WITH_SHOP,
  deviceCustodyLabels,
} from "@/features/orders/model/device-custody";
import type { DeviceCustodyStatus } from "@/lib/repairdesk/types";
import type {
  CustomerHistoryDeviceCandidate,
  CustomerIntakeCandidate,
  CustomerIntakeNewCustomerPolicy,
} from "@/lib/repairdesk/api";
import { detailWorkspace, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useTouchSafeDropdownTrigger } from "@/shared/lib/touch-safe-dropdown-trigger";

type NewOrderCustomerDeviceBaseProps = {
  form: NewOrderFormState;
  setForm: Dispatch<SetStateAction<NewOrderFormState>>;
  surface?: "page" | "dialog";
};

type NewOrderCustomerSectionProps = NewOrderCustomerDeviceBaseProps & {
  onClearCustomerContext: () => void;
  onPickCustomer: (candidate: CustomerIntakeCandidate) => void | Promise<void>;
  onNewCustomerIntentChange?: (intent: CustomerIntakeNewCustomerPolicy | null) => void;
};

type NewOrderDeviceSectionProps = NewOrderCustomerDeviceBaseProps & {
  historyDevices: CustomerHistoryDeviceCandidate[];
  onSelectHistoryDevice: (device: CustomerHistoryDeviceCandidate) => void;
};

type NewOrderCustomerDeviceSectionProps = NewOrderCustomerSectionProps & NewOrderDeviceSectionProps;

const visualInputClass =
  "h-11 w-full border-0 bg-transparent px-0 py-0 font-sans text-base leading-11 text-foreground shadow-none placeholder:text-base placeholder:text-muted-foreground/55 focus-visible:ring-0 sm:h-11 sm:text-base lg:h-8 lg:text-[13px] lg:leading-8 lg:placeholder:text-[13px]";

export function NewOrderCustomerDeviceSection({
  form,
  setForm,
  historyDevices,
  onClearCustomerContext,
  onPickCustomer,
  onNewCustomerIntentChange,
  onSelectHistoryDevice,
  surface = "page",
}: NewOrderCustomerDeviceSectionProps) {
  return (
    <div data-new-order-section="customer-device" className="grid min-w-0 gap-1.5 sm:gap-3">
      <NewOrderCustomerSection
        form={form}
        setForm={setForm}
        onClearCustomerContext={onClearCustomerContext}
        onPickCustomer={onPickCustomer}
        onNewCustomerIntentChange={onNewCustomerIntentChange}
        surface={surface}
      />
      <NewOrderDeviceInfoSection
        form={form}
        setForm={setForm}
        historyDevices={historyDevices}
        onSelectHistoryDevice={onSelectHistoryDevice}
        surface={surface}
      />
      <NewOrderDeviceUnlockSection form={form} setForm={setForm} surface={surface} />
    </div>
  );
}

export function NewOrderCustomerSection({
  form,
  setForm,
  onClearCustomerContext,
  onPickCustomer,
  onNewCustomerIntentChange,
  surface = "page",
}: NewOrderCustomerSectionProps) {
  const shellClass = getShellClass(surface);

  return (
    <section
      data-new-order-section="customer"
      data-new-order-field="customer-phone"
      className={cn(shellClass, "space-y-1.5")}
    >
      <OrderWorkspaceSectionHeader
        icon={UserRound}
        title="客户信息"
        description="电话优先匹配客户档案"
        className="mb-1.5"
      />
      <CustomerIdentityLookup
        phone={form.customerPhone}
        name={form.customerName}
        selectedCustomerId={form.customerId}
        inputClassName={visualInputClass}
        inputContainerClassName="relative h-11 w-full min-w-0 overflow-hidden lg:h-9"
        onPhoneChange={(customerPhone) => {
          onClearCustomerContext();
          setForm((current) => ({
            ...current,
            customerPhone,
            customerId: undefined,
            deviceId: undefined,
          }));
        }}
        onNameChange={(customerName) => {
          onClearCustomerContext();
          setForm((current) => ({
            ...current,
            customerName,
            customerId: undefined,
            deviceId: undefined,
          }));
        }}
        onPickCustomer={onPickCustomer}
        onNewCustomerIntentChange={onNewCustomerIntentChange}
        onClearCustomerSelection={() => {
          onClearCustomerContext();
          setForm((current) => ({
            ...current,
            customerId: undefined,
            deviceId: undefined,
          }));
        }}
      />
    </section>
  );
}

export function NewOrderDeviceSection({
  form,
  setForm,
  historyDevices,
  onSelectHistoryDevice,
  surface = "page",
}: NewOrderDeviceSectionProps) {
  return (
    <div data-new-order-section="device" className="grid min-w-0 gap-1.5 sm:gap-3">
      <NewOrderDeviceInfoSection
        form={form}
        setForm={setForm}
        historyDevices={historyDevices}
        onSelectHistoryDevice={onSelectHistoryDevice}
        surface={surface}
      />
      <NewOrderDeviceUnlockSection form={form} setForm={setForm} surface={surface} />
    </div>
  );
}

export function NewOrderDeviceInfoSection({
  form,
  setForm,
  historyDevices,
  onSelectHistoryDevice,
  surface = "page",
}: NewOrderDeviceSectionProps) {
  const shellClass = getShellClass(surface);
  const hasDeviceDraft = Boolean(form.brand.trim() || form.model.trim() || form.imei.trim());
  const modelSuggestions = deviceModelSuggestionsForBrand(form.brand);

  return (
    <section data-new-order-section="device-info" className={cn(shellClass, "space-y-1.5")}>
      <OrderWorkspaceSectionHeader
        icon={Smartphone}
        title="设备信息"
        description="记录设备资料与当前保管方"
        className="mb-1.5"
      />
      <NewOrderDeviceCustodySelector form={form} setForm={setForm} />
      {form.customerId && !hasDeviceDraft && historyDevices.length > 0 && (
        <div className="mb-1.5 rounded-xl border border-[var(--border-panel)] bg-card p-1.5 shadow-[var(--shadow-card)]">
          <div className="mb-1 flex items-center justify-between gap-2 px-1">
            <span className="truncate text-[10px] font-bold leading-3 text-muted-foreground">
              历史维修型号
            </span>
            <span className="shrink-0 text-[9px] font-medium leading-3 text-primary">手动选择</span>
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
          fieldTarget="device-brand"
          inputId="new-order-device-brand"
          label="品牌"
          required
          trailingInteractive
          trailing={
            <DenseOptionMenu
              label="品牌"
              value={form.brand}
              options={brandSuggestions}
              onSelect={(brand) => setForm({ ...form, brand, deviceId: undefined })}
            />
          }
        >
          <Input
            id="new-order-device-brand"
            value={form.brand}
            onChange={(event) =>
              setForm({ ...form, brand: event.target.value, deviceId: undefined })
            }
            className={cn(visualInputClass, "pr-10")}
            placeholder="选择品牌"
          />
        </DensePillField>
        <DensePillField
          fieldTarget="device-model"
          inputId="new-order-device-model"
          label="型号"
          required
          trailingInteractive
          trailing={
            <DenseOptionMenu
              label="型号"
              value={form.model}
              options={modelSuggestions}
              emptyText="暂无预设型号，可直接输入"
              onSelect={(model) =>
                setForm({
                  ...form,
                  brand: isAppleDeviceModelSuggestion(model) ? "Apple" : form.brand,
                  model,
                  deviceId: undefined,
                })
              }
            />
          }
        >
          <Input
            id="new-order-device-model"
            value={form.model}
            onChange={(event) => {
              const model = event.target.value;
              setForm({
                ...form,
                brand:
                  isAppleDeviceModelSuggestion(model) && modelSuggestions.length > 0
                    ? "Apple"
                    : form.brand,
                model,
                deviceId: undefined,
              });
            }}
            className={cn(visualInputClass, "pr-10")}
            placeholder="例如 iPhone 13"
          />
        </DensePillField>
        <DenseScannerBlock label="IMEI">
          <div className="min-w-0 flex-1">
            <ImeiScannerField
              value={form.imei}
              onChange={(imei) => setForm({ ...form, imei, deviceId: undefined })}
              placeholder="IMEI / 序列号"
              inputAriaLabel="IMEI 或序列号"
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
  );
}

export function NewOrderDeviceUnlockSection({
  form,
  setForm,
  surface = "page",
}: NewOrderCustomerDeviceBaseProps) {
  const shellClass = getShellClass(surface);

  return (
    <section data-new-order-section="device-unlock" className={cn(shellClass, "space-y-1.5")}>
      <OrderWorkspaceSectionHeader
        icon={Smartphone}
        title="手机密码"
        description="可选；留店或未留店都可以登记，默认隐藏"
        className="mb-1.5"
      />
      <div className="rounded-xl border border-[var(--border-panel)] bg-card px-2 py-1.5 shadow-[var(--shadow-card)]">
        <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
          <Label className="truncate text-[10.5px] font-semibold leading-4 text-muted-foreground">
            手机密码
          </Label>
          <span className="shrink-0 text-[9px] font-medium leading-3 text-muted-foreground">
            默认隐藏
          </span>
        </div>
        <DeviceUnlockEditor
          value={form.deviceUnlock}
          onChange={(deviceUnlock) => setForm({ ...form, deviceUnlock })}
          compact
        />
        <p className="mt-1 rounded-lg bg-status-warn/45 px-2 py-1 text-[9px] leading-3 text-status-warn-foreground">
          本机草稿不保存手机密码、PIN 或图案；在线创建工单时会正常保存。
        </p>
      </div>
    </section>
  );
}

function NewOrderDeviceCustodySelector({
  form,
  setForm,
}: Pick<NewOrderCustomerDeviceBaseProps, "form" | "setForm">) {
  const options: Array<{
    value: DeviceCustodyStatus;
    description: string;
    icon: typeof Store;
  }> = [
    {
      value: DEVICE_CUSTODY_WITH_SHOP,
      description: "当前由门店保管，仅作记录",
      icon: Store,
    },
    {
      value: DEVICE_CUSTODY_WITH_CUSTOMER,
      description: "当前由客户保管，仅作记录",
      icon: UserRound,
    },
  ];

  return (
    <fieldset
      data-new-order-field="device-custody"
      className="grid min-w-0 gap-1.5"
      aria-required="true"
    >
      <legend className="text-[10.5px] font-semibold leading-4 text-muted-foreground">
        设备保管状态 <span className="text-destructive">*</span>
      </legend>
      <div className="grid min-w-0 grid-cols-2 gap-1.5">
        {options.map((option) => {
          const selected = form.deviceCustodyStatus === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              className={cn(
                "min-h-11 min-w-0 rounded-xl border px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-[var(--border-panel)] bg-card text-foreground hover:bg-accent/40",
              )}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  deviceCustodyStatus: option.value,
                }))
              }
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate text-[11px] font-semibold leading-4">
                  {deviceCustodyLabels[option.value]}
                </span>
                {selected ? <Check className="ml-auto size-3.5 shrink-0" /> : null}
              </span>
              <span className="mt-0.5 block truncate text-[9px] leading-3 text-muted-foreground">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
      {form.deviceCustodyStatus === null ? (
        <p className="rounded-lg bg-status-warn/45 px-2 py-1 text-[9px] leading-3 text-status-warn-foreground">
          请选择当前设备保管状态。
        </p>
      ) : null}
    </fieldset>
  );
}

function getShellClass(surface: "page" | "dialog") {
  return cn(
    "h-fit min-w-0 sm:p-3",
    surface === "dialog"
      ? cn(detailWorkspace.flatPanel, "p-1.5")
      : cn(
          repairOs.mobileInfoCard,
          "p-2",
          "md:rounded-[var(--radius-lg)] md:bg-[var(--surface-panel)] md:shadow-none",
        ),
  );
}

function DensePillField({
  fieldTarget,
  inputId,
  label,
  required,
  leading,
  trailing,
  trailingInteractive = false,
  children,
}: {
  fieldTarget?: string;
  inputId?: string;
  label: string;
  required?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  trailingInteractive?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-new-order-field={fieldTarget}
      className="rd-new-order-field grid min-h-11 min-w-0 grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-1.5 rounded-xl border border-[var(--border-panel)] bg-card px-2 py-0 shadow-[var(--shadow-card)]"
    >
      <Label
        htmlFor={inputId}
        className="truncate text-[10.5px] font-semibold leading-4 text-muted-foreground"
      >
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <div
        className={cn(
          "grid h-11 min-w-0 items-center gap-1.5 overflow-hidden lg:h-9",
          leading ? "grid-cols-[1rem_minmax(0,1fr)]" : "grid-cols-1",
        )}
      >
        {leading ? (
          <span className="grid size-4 shrink-0 place-items-center text-muted-foreground">
            {leading}
          </span>
        ) : null}
        <div className="relative h-9 min-w-0 flex-1 overflow-hidden">{children}</div>
      </div>
      {trailing ? (
        <div
          className={cn(
            "flex h-9 shrink-0 items-center gap-1 border-l border-[var(--border-panel)] pl-1.5",
            !trailingInteractive && "pointer-events-none pl-2",
          )}
        >
          {trailing}
        </div>
      ) : null}
    </div>
  );
}

function DenseOptionMenu({
  label,
  value,
  options,
  emptyText = "暂无选项",
  onSelect,
}: {
  label: string;
  value: string;
  options: readonly string[];
  emptyText?: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const normalizedValue = value.trim().toLowerCase();
  const touchSafeTrigger = useTouchSafeDropdownTrigger(setOpen);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors [touch-action:pan-y] hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring lg:size-8"
          aria-label={`选择${label}`}
          {...touchSafeTrigger}
        >
          <ChevronDown className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        collisionPadding={12}
        side="top"
        sideOffset={6}
        className="z-[90] max-h-[min(18rem,calc(100dvh_-_var(--rd-overlay-avoid-bottom,0px)_-_1rem))] w-[min(18rem,calc(100vw-24px))] overflow-y-auto rounded-xl p-1 shadow-[var(--shadow-overlay)]"
      >
        {options.length ? (
          options.map((option) => {
            const selected = option.trim().toLowerCase() === normalizedValue;
            return (
              <DropdownMenuItem
                key={option}
                onSelect={() => onSelect(option)}
                className={cn(
                  "min-h-11 gap-2 rounded-lg px-2.5 py-1.5 text-xs lg:min-h-9",
                  selected && "bg-primary/10 text-primary focus:bg-primary/10 focus:text-primary",
                )}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{option}</span>
                {selected ? <Check className="size-3.5 shrink-0" /> : null}
              </DropdownMenuItem>
            );
          })
        ) : (
          <DropdownMenuItem disabled className="min-h-9 rounded-lg px-2.5 py-1.5 text-xs">
            {emptyText}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DenseScannerBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rd-new-order-field grid min-h-11 min-w-0 grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-1.5 rounded-xl border border-[var(--border-panel)] bg-card px-2 py-0 shadow-[var(--shadow-card)] lg:min-h-10">
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
