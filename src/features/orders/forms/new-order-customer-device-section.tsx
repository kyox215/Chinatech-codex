"use client";

import { type Dispatch, type ReactNode, type SetStateAction, useState } from "react";
import { Check, ChevronDown, Pencil, ScanLine, Smartphone, Store, UserRound } from "lucide-react";

import { ImeiScannerField } from "@/components/imei-scanner-field";
import { DenseOptionMenu } from "@/features/orders/components/dense-option-menu";
import { Button } from "@/components/ui/button";
import { AccessoryNotesPicker } from "@/features/orders/components/accessory-notes-picker";
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
} from "@/features/orders/model/device-custody";
import { localizeDeviceCustody } from "@/features/orders/model/order-i18n";
import type { DeviceCustodyStatus } from "@/lib/repairdesk/types";
import type {
  CustomerHistoryDeviceCandidate,
  CustomerIntakeCandidate,
  CustomerIntakeNewCustomerPolicy,
} from "@/lib/repairdesk/api";
import { detailWorkspace, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

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
  children?: ReactNode;
  historyDevices: CustomerHistoryDeviceCandidate[];
  onSelectHistoryDevice: (device: CustomerHistoryDeviceCandidate) => void;
  editorOnly?: boolean;
  onScan?: () => void;
};

type NewOrderCustomerDeviceSectionProps = NewOrderCustomerSectionProps & NewOrderDeviceSectionProps;

const visualInputClass =
  "h-[38px] w-full border-0 bg-transparent px-0 py-0 font-sans text-base leading-[38px] text-foreground shadow-none placeholder:text-base placeholder:text-muted-foreground/55 focus-visible:ring-0 lg:h-8 lg:text-[13px] lg:leading-8 lg:placeholder:text-[13px]";

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
  const { t } = useLocale();
  const shellClass = getShellClass(surface);
  const [editingSelected, setEditingSelected] = useState(false);

  return (
    <section
      data-new-order-section="customer"
      data-new-order-field="customer-phone"
      className={cn(shellClass, "space-y-1.5")}
    >
      <OrderWorkspaceSectionHeader
        icon={UserRound}
        title={t("orders2b1.new.customerInfo")}
        className="mb-1.5"
      />
      {form.customerId && !editingSelected ? (
        <div className="flex min-w-0 items-center gap-2 rounded-lg bg-primary/5 px-2 py-1">
          <UserRound className="size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="break-words text-base font-semibold">{form.customerPhone}</p>
            <p className="truncate text-xs text-muted-foreground">
              {form.customerName || t("orders2b1.new.lookup.unnamed")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label={t("orders.newFlow.customerEdit")}
            onClick={() => setEditingSelected(true)}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      ) : (
        <CustomerIdentityLookup
          phone={form.customerPhone}
          name={form.customerName}
          selectedCustomerId={form.customerId}
          inputClassName={visualInputClass}
          inputContainerClassName="relative h-[38px] w-full min-w-0 overflow-hidden lg:h-9"
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
          onPickCustomer={(candidate) => {
            setEditingSelected(false);
            return onPickCustomer(candidate);
          }}
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
      )}
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
  children,
  editorOnly = false,
  onScan,
}: NewOrderDeviceSectionProps) {
  const { t } = useLocale();
  const shellClass = getShellClass(surface);
  const hasDeviceDraft = Boolean(form.brand.trim() || form.model.trim() || form.imei.trim());
  const modelSuggestions = deviceModelSuggestionsForBrand(form.brand);

  return (
    <section
      data-new-order-section="device-info"
      className={cn(editorOnly ? "min-w-0" : shellClass, "space-y-1.5")}
    >
      {!editorOnly ? (
        <OrderWorkspaceSectionHeader
          icon={Smartphone}
          title={t("orders2b1.new.deviceInfo")}
          className="mb-1.5"
        />
      ) : null}
      {!editorOnly ? <NewOrderDeviceCustodySelector form={form} setForm={setForm} /> : null}
      {!editorOnly && form.customerId && !hasDeviceDraft && historyDevices.length > 0 && (
        <div className="mb-1.5 rounded-xl border border-[var(--border-panel)] bg-card p-1.5 shadow-[var(--shadow-card)]">
          <div className="mb-1 flex items-center justify-between gap-2 px-1">
            <span className="truncate text-[10px] font-bold leading-3 text-muted-foreground lg:text-xs lg:leading-4">
              {t("orders2b1.new.historyModels")}
            </span>
            <span className="shrink-0 text-[9px] font-medium leading-3 text-primary lg:text-[11px] lg:leading-4">
              {t("orders2b1.new.manualSelect")}
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
                <span className="block truncate text-[10px] font-bold leading-3 lg:text-[13px] lg:leading-5">
                  {device.brand} {device.model}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[9px] font-medium leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
                  {device.serial_or_imei ||
                    device.order_public_no ||
                    t("orders2b1.new.historyRecord")}
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
          label={t("orders2b1.new.brand")}
          required
          trailingInteractive
          trailing={
            <DenseOptionMenu
              label={t("orders2b1.new.brand")}
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
            className={visualInputClass}
            placeholder={t("orders2b1.new.brandPlaceholder")}
          />
        </DensePillField>
        <DensePillField
          fieldTarget="device-model"
          inputId="new-order-device-model"
          label={t("orders2b1.new.model")}
          required
          trailingInteractive
          trailing={
            <DenseOptionMenu
              label={t("orders2b1.new.model")}
              value={form.model}
              options={modelSuggestions}
              emptyText={t("orders2b1.new.modelEmpty")}
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
            className={visualInputClass}
            placeholder={t("orders2b1.new.modelPlaceholder")}
          />
        </DensePillField>
        <DenseScannerBlock label="IMEI">
          <div className="flex min-w-0 flex-1 items-center [&>div]:min-w-0 [&>div]:flex-1">
            <ImeiScannerField
              value={form.imei}
              onChange={(imei) => setForm({ ...form, imei, deviceId: undefined })}
              placeholder={t("orders2b1.new.imeiPlaceholder")}
              inputAriaLabel={t("orders2b1.new.imeiAria")}
              density="compact"
              appearance="quiet"
              showPaste={false}
              showScanner={!onScan}
            />
            {onScan ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                onClick={onScan}
                aria-label={t("inventory2b4.scanner.title")}
              >
                <ScanLine className="size-4" />
              </Button>
            ) : null}
          </div>
        </DenseScannerBlock>
      </div>
      {!editorOnly ? (
        <div className="grid min-w-0 gap-1.5 border-t border-border pt-1.5">
          <span className="text-[11px] text-muted-foreground">
            {t("orders2b1.new.accessories")}
          </span>
          <AccessoryNotesPicker
            value={form.accessoryNotes}
            onChange={(accessoryNotes) => setForm({ ...form, accessoryNotes })}
            compact
          />
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function NewOrderDeviceUnlockSection({ form, setForm }: NewOrderCustomerDeviceBaseProps) {
  const { t } = useLocale();
  return (
    <details
      data-new-order-section="device-unlock"
      className="group min-w-0 border-t border-border pt-1"
    >
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-md text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="text-muted-foreground">{t("orders2b1.new.unlockTitle")}</span>
        <span className="min-w-0 flex-1 text-right">
          {form.deviceUnlock.method === "none"
            ? t("orders.newFlow.optional")
            : t("orders.newFlow.filled")}
        </span>
        <ChevronDown className="size-3.5 group-open:rotate-180" />
      </summary>
      <DeviceUnlockEditor
        value={form.deviceUnlock}
        onChange={(deviceUnlock) => setForm({ ...form, deviceUnlock })}
        compact
      />
      <p className="mt-1 rounded-lg bg-status-warn/45 px-2 py-1 text-[11px] leading-4 text-status-warn-foreground">
        {t("orders2b1.new.unlockNotDrafted")}
      </p>
    </details>
  );
}

export function NewOrderDeviceCustodySelector({
  form,
  setForm,
}: Pick<NewOrderCustomerDeviceBaseProps, "form" | "setForm">) {
  const { t } = useLocale();
  const options: Array<{
    value: DeviceCustodyStatus;
    description: string;
    icon: typeof Store;
  }> = [
    {
      value: DEVICE_CUSTODY_WITH_SHOP,
      description: t("orders2b1.new.custodyShopHelp"),
      icon: Store,
    },
    {
      value: DEVICE_CUSTODY_WITH_CUSTOMER,
      description: t("orders2b1.new.custodyCustomerHelp"),
      icon: UserRound,
    },
  ];

  return (
    <fieldset
      data-new-order-field="device-custody"
      className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-1.5"
      aria-required="true"
    >
      <legend className="sr-only text-[10.5px] font-semibold leading-4 text-muted-foreground lg:text-xs lg:leading-4">
        {t("orders2b1.new.custodyRequired")} <span className="text-destructive">*</span>
      </legend>
      <span aria-hidden="true" className="text-[11px] text-muted-foreground">
        {t("orders2b1.new.custody")} <span className="text-destructive">*</span>
      </span>
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
                "min-h-9 min-w-0 rounded-lg border px-1.5 py-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
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
                <span className="truncate text-[11px] font-semibold leading-4 lg:text-xs lg:leading-4">
                  {localizeDeviceCustody(option.value, undefined, t)}
                </span>
                {selected ? <Check className="ml-auto size-3.5 shrink-0" /> : null}
              </span>
              <span className="sr-only">{option.description}</span>
            </button>
          );
        })}
      </div>
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
      className="rd-new-order-field grid min-h-[38px] min-w-0 grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-1.5 rounded-lg border border-transparent border-b-border bg-card px-0 py-0 shadow-none focus-within:border-ring focus-within:ring-1 focus-within:ring-ring"
    >
      <Label
        htmlFor={inputId}
        className="whitespace-normal text-[10.5px] font-semibold leading-4 text-muted-foreground lg:text-xs lg:leading-4"
      >
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <div
        className={cn(
          "grid h-[38px] min-w-0 items-center gap-1.5 overflow-hidden lg:h-9",
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

function DenseScannerBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rd-new-order-field grid min-h-[38px] min-w-0 grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-1.5 rounded-lg border border-transparent border-b-border bg-card px-0 py-0 shadow-none focus-within:border-ring focus-within:ring-1 focus-within:ring-ring lg:min-h-10">
      <Label className="whitespace-normal text-[10.5px] font-semibold leading-4 text-muted-foreground lg:text-xs lg:leading-4">
        {label}
      </Label>
      <div className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-center gap-1.5">
        <span className="size-4" />
        <div className="flex min-w-0 items-center">{children}</div>
      </div>
    </div>
  );
}
