"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  ArrowLeft,
  ChevronRight,
  LockKeyhole,
  Package,
  SlidersHorizontal,
  Smartphone,
  UserRound,
} from "lucide-react";
import { ImeiScannerField } from "@/components/imei-scanner-field";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  AccessoryNotesPicker,
  AccessoryNotesPills,
} from "@/features/orders/components/accessory-notes-picker";
import { DeviceUnlockEditor } from "@/features/orders/components/device-unlock-fields";
import { CustomerIdentityLookup } from "@/features/orders/forms/customer-intake-lookup";
import {
  NewOrderDeviceCustodySelector,
  NewOrderDeviceInfoSection,
} from "@/features/orders/forms/new-order-customer-device-section";
import type { NewOrderFormState } from "@/features/orders/model/new-order-form";
import type {
  CustomerHistoryDeviceCandidate,
  CustomerIntakeCandidate,
  CustomerIntakeNewCustomerPolicy,
} from "@/lib/repairdesk/api";
import { componentOverlay } from "@/lib/component-patterns";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

type Panel = "customer" | "device" | "history" | "accessories" | "unlock" | "notes" | "settings";
type FormSetter = Dispatch<SetStateAction<NewOrderFormState>>;

/** One phone editor owns the draft and focus; subflows replace its content. */
export function NewOrderMobileWorkspace({
  form,
  setForm,
  historyDevices,
  onPickCustomer,
  onClearCustomerContext,
  onNewCustomerIntentChange,
  quote,
  photos,
  settings,
  settingsSummary,
  disabled,
  validationRequest,
}: {
  form: NewOrderFormState;
  setForm: FormSetter;
  historyDevices: CustomerHistoryDeviceCandidate[];
  onPickCustomer: (candidate: CustomerIntakeCandidate) => void | Promise<void>;
  onClearCustomerContext: () => void;
  onNewCustomerIntentChange: (intent: CustomerIntakeNewCustomerPolicy | null) => void;
  quote: ReactNode;
  photos: ReactNode;
  settings: (draft: NewOrderFormState, setDraft: FormSetter) => ReactNode;
  settingsSummary: string;
  disabled: boolean;
  validationRequest: { target: string; generation: number } | null;
}) {
  const { t } = useLocale();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [draft, setDraft] = useState(form);
  const [discard, setDiscard] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannerToken, setScannerToken] = useState(0);
  const baseline = useRef(form);
  const opener = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const intent = useRef<CustomerIntakeNewCustomerPolicy | null>(null);
  const handleIntentChange = useCallback((value: CustomerIntakeNewCustomerPolicy | null) => {
    intent.current = value;
  }, []);
  const blocked = useRef(disabled);
  blocked.current = disabled;
  const formRef = useRef(form);
  formRef.current = form;
  const openPanel = (next: Panel, trigger?: HTMLElement | null) => {
    if (blocked.current) return;
    opener.current =
      trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    baseline.current = formRef.current;
    setDraft(formRef.current);
    intent.current = null;
    setDiscard(false);
    setPanel(next);
  };
  useEffect(() => {
    if (disabled) {
      setPanel(null);
      setScanning(false);
    }
  }, [disabled]);
  useEffect(() => {
    if (!validationRequest || blocked.current) return;
    const target = validationRequest.target;
    const next = target.startsWith("customer")
      ? "customer"
      : target === "device-brand" || target === "device-model"
        ? "device"
        : target === "warranty-reason" || target === "create-status"
          ? "settings"
          : null;
    if (next) {
      const trigger = document.querySelector<HTMLElement>(`[data-mobile-edit="${next}"]`);
      opener.current = trigger;
      baseline.current = formRef.current;
      setDraft(formRef.current);
      setDiscard(false);
      setPanel(next);
    }
  }, [validationRequest]);
  const rootPanel = panel === "history" ? "device" : panel;
  const fields: Record<Exclude<Panel, "history">, (keyof NewOrderFormState)[]> = {
    customer: ["customerId", "customerName", "customerPhone", "deviceId"],
    device: ["brand", "model", "imei", "deviceId", "deviceNotes"],
    accessories: ["accessoryNotes"],
    unlock: ["deviceUnlock"],
    notes: ["issueDescription"],
    settings: ["type", "status", "warrantyMonths", "warrantyText", "warrantyChangeReason"],
  };
  const dirty =
    rootPanel &&
    fields[rootPanel].some(
      (key) => JSON.stringify(draft[key]) !== JSON.stringify(baseline.current[key]),
    );
  const close = () => {
    setPanel(null);
    setDiscard(false);
  };
  const requestClose = () => {
    if (dirty) setDiscard(true);
    else close();
  };
  const save = () => {
    if (!rootPanel || blocked.current) return;
    const changedCustomer =
      rootPanel === "customer" &&
      fields.customer.some((key) => draft[key] !== baseline.current[key]);
    if (changedCustomer) onClearCustomerContext();
    setForm((current) => {
      const next = { ...current };
      for (const key of fields[rootPanel]) Object.assign(next, { [key]: draft[key] });
      if (changedCustomer)
        Object.assign(next, {
          deviceId: undefined,
          brand: "",
          model: "",
          imei: "",
          deviceNotes: "",
        });
      return next;
    });
    if (rootPanel === "customer") onNewCustomerIntentChange(intent.current);
    close();
  };
  const titles = {
    customer: t("orders2b1.new.customerInfo"),
    device: t("orders2b1.new.deviceInfo"),
    history: t("orders2b1.new.historyModels"),
    accessories: t("orders2b1.new.accessories"),
    unlock: t("orders2b1.new.unlockTitle"),
    notes: t("orders.newFlow.notes"),
    settings: t("orders2b1.new.settings"),
  };
  const summaryClass =
    "flex min-h-14 w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60";
  return (
    <div
      data-new-order-single-page="true"
      data-new-order-mobile-app="true"
      className="grid min-w-0 gap-3"
    >
      <section className={cn(repairOs.mobileInfoCard, "!p-0 shadow-none")}>
        <button
          type="button"
          data-mobile-edit="customer"
          data-new-order-field="customer-phone"
          disabled={disabled}
          className={summaryClass}
          onClick={(event) => openPanel("customer", event.currentTarget)}
        >
          <UserRound className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block break-words text-base font-semibold leading-5",
                !form.customerPhone && "text-muted-foreground",
              )}
            >
              {form.customerPhone || t("orders2b1.new.lookup.phoneAria")}
            </span>
            <span className="block truncate text-xs leading-4 text-muted-foreground">
              {form.customerName || t("orders2b1.new.lookup.unnamed")}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0" />
        </button>
        <button
          type="button"
          data-mobile-edit="device"
          disabled={disabled}
          className={cn(summaryClass, "border-t border-border")}
          onClick={(event) => openPanel("device", event.currentTarget)}
        >
          <Smartphone className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block break-words text-sm font-semibold leading-5",
                (!form.brand || !form.model) && "text-muted-foreground",
              )}
            >
              {[form.brand, form.model].filter(Boolean).join(" ") || t("orders2b1.new.deviceInfo")}
              {!form.brand || !form.model ? " *" : ""}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {form.imei ? `IMEI / SN · ${form.imei}` : t("orders2b1.new.imeiPlaceholder")}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0" />
        </button>
        <div className="border-t border-border px-3 py-1.5">
          <NewOrderDeviceCustodySelector form={form} setForm={setForm} />
        </div>
        <div className="grid min-w-0 grid-cols-2 px-2 pb-1">
          <button
            type="button"
            disabled={disabled}
            data-mobile-edit="accessories"
            className="flex min-h-8 min-w-0 items-center gap-1.5 rounded px-1 text-left text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => openPanel("accessories", event.currentTarget)}
          >
            <Package className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate">
              {form.accessoryNotes ? (
                <AccessoryNotesPills
                  value={form.accessoryNotes}
                  className="flex-nowrap [&>span]:border-0 [&>span]:bg-transparent [&>span]:p-0"
                />
              ) : (
                t("orders2b1.new.accessories")
              )}
            </span>
          </button>
          <button
            type="button"
            disabled={disabled}
            data-mobile-edit="unlock"
            className="flex min-h-8 min-w-0 items-center gap-1.5 rounded px-1 text-left text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => openPanel("unlock", event.currentTarget)}
          >
            <LockKeyhole className="size-3.5 shrink-0" />
            <span className="truncate">
              {t("orders2b1.new.unlockTitle")} ·{" "}
              {t(
                form.deviceUnlock.method === "none"
                  ? "orders.newFlow.optional"
                  : "orders.newFlow.filled",
              )}
            </span>
          </button>
        </div>
      </section>
      {quote}
      {photos}
      <button
        type="button"
        disabled={disabled}
        data-mobile-edit="notes"
        className="flex min-h-9 min-w-0 items-center gap-2 border-b border-border px-1 text-left text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(event) => openPanel("notes", event.currentTarget)}
      >
        <span className="min-w-0 flex-1 truncate">
          {form.issueDescription ||
            `${t("orders.newFlow.notes")} · ${t("orders.newFlow.optional")}`}
        </span>
        <ChevronRight className="size-4 shrink-0" />
      </button>
      <button
        type="button"
        disabled={disabled}
        data-mobile-edit="settings"
        className="-mt-2 flex min-h-9 min-w-0 items-center gap-2 border-b border-border px-1 text-left text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(event) => openPanel("settings", event.currentTarget)}
      >
        <SlidersHorizontal className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 break-words">{settingsSummary}</span>
        <ChevronRight className="size-4 shrink-0" />
      </button>
      <Sheet
        open={Boolean(panel) && !scanning && !disabled}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
      >
        <SheetContent
          ref={content}
          side="bottom"
          mobileEditor
          editorLayout
          closeLabel={t("common.close")}
          className={cn(componentOverlay.editorSurface, componentOverlay.denseEditorSurface)}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            content.current
              ?.querySelector<HTMLButtonElement>("button[aria-label]")
              ?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!scanning && opener.current?.isConnected)
              opener.current.focus({ preventScroll: true });
          }}
        >
          <SheetHeader className={componentOverlay.denseEditorHeader}>
            {panel === "history" && !discard ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                aria-label={t("orders2b1.new.lookup.backResults")}
                onClick={() => setPanel("device")}
              >
                <ArrowLeft className="size-4" />
              </Button>
            ) : null}
            <SheetTitle className="text-base">
              {discard ? t("orders.newFlow.discardEdit") : panel ? titles[panel] : ""}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {discard ? t("orders.newFlow.discardEditHelp") : t("orders.newFlow.editHelp")}
            </SheetDescription>
          </SheetHeader>
          <div
            className={cn(componentOverlay.editorScroll, componentOverlay.denseEditorBody)}
            data-new-order-mobile-panel={panel}
          >
            {discard ? (
              <p className="py-3 text-sm">{t("orders.newFlow.discardEditHelp")}</p>
            ) : (
              <>
                {panel === "customer" ? (
                  <div
                    onPointerDown={(event) => {
                      // Keep the dock geometry stable until an explicit candidate click finishes.
                      if (
                        event.target instanceof Element &&
                        event.target.closest('[role="option"]')
                      )
                        event.stopPropagation();
                    }}
                  >
                    <CustomerIdentityLookup
                      phone={draft.customerPhone}
                      name={draft.customerName}
                      selectedCustomerId={draft.customerId}
                      inputClassName="h-10 border-0 bg-transparent text-base shadow-none"
                      onPhoneChange={(customerPhone) =>
                        setDraft((current) => ({
                          ...current,
                          customerPhone,
                          customerId: undefined,
                          deviceId: undefined,
                        }))
                      }
                      onNameChange={(customerName) =>
                        setDraft((current) => ({
                          ...current,
                          customerName,
                          customerId: undefined,
                          deviceId: undefined,
                        }))
                      }
                      onClearCustomerSelection={() =>
                        setDraft((current) => ({
                          ...current,
                          customerId: undefined,
                          deviceId: undefined,
                        }))
                      }
                      onNewCustomerIntentChange={handleIntentChange}
                      onPickCustomer={(candidate) => {
                        if (!blocked.current) {
                          void onPickCustomer(candidate);
                          close();
                        }
                      }}
                    />
                  </div>
                ) : null}
                {panel === "device" ? (
                  <>
                    {form.customerId ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11 w-full justify-between px-0 text-xs text-primary"
                        onClick={() => setPanel("history")}
                      >
                        {t("orders2b1.new.historyModels")}
                        <ChevronRight className="size-4" />
                      </Button>
                    ) : null}
                    <NewOrderDeviceInfoSection
                      form={draft}
                      setForm={setDraft}
                      historyDevices={[]}
                      onSelectHistoryDevice={() => undefined}
                      editorOnly
                      onScan={() => {
                        setScanning(true);
                        setScannerToken((value) => value + 1);
                      }}
                    />
                  </>
                ) : null}
                {panel === "history" ? (
                  <div className="grid gap-1">
                    <p className="pb-2 text-xs text-muted-foreground">
                      {t("orders2b1.new.manualSelect")}
                    </p>
                    {historyDevices.length ? (
                      historyDevices.map((device) => (
                        <button
                          type="button"
                          key={device.id}
                          className="flex min-h-14 items-center gap-2 border-b border-border py-2 text-left focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => {
                            setDraft((current) => ({
                              ...current,
                              deviceId:
                                device.source === "customer_device" ? device.device_id : undefined,
                              brand: device.brand,
                              model: device.model,
                              imei: device.serial_or_imei,
                              deviceNotes: device.device_notes ?? "",
                            }));
                            setPanel("device");
                          }}
                        >
                          <Smartphone className="size-4 shrink-0" />
                          <span className="min-w-0">
                            <span className="block break-words text-sm font-semibold">
                              {device.brand} {device.model}
                            </span>
                            <span className="block break-words text-xs text-muted-foreground">
                              {device.serial_or_imei || t("orders2b1.new.historyRecord")}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="py-4 text-sm text-muted-foreground">
                        {t("orders.newFlow.noHistory")}
                      </p>
                    )}
                  </div>
                ) : null}
                {panel === "accessories" ? (
                  <div className="pt-6">
                    <AccessoryNotesPicker
                      value={draft.accessoryNotes}
                      onChange={(accessoryNotes) =>
                        setDraft((current) => ({ ...current, accessoryNotes }))
                      }
                      quickChoices
                    />
                  </div>
                ) : null}
                {panel === "unlock" ? (
                  <>
                    <DeviceUnlockEditor
                      value={draft.deviceUnlock}
                      onChange={(deviceUnlock) =>
                        setDraft((current) => ({ ...current, deviceUnlock }))
                      }
                      compact
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("orders2b1.new.unlockNotDrafted")}
                    </p>
                  </>
                ) : null}
                {panel === "notes" ? (
                  <Textarea
                    value={draft.issueDescription}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, issueDescription: event.target.value }))
                    }
                    aria-label={t("orders.newFlow.notes")}
                    className="min-h-[104px] resize-none text-base"
                  />
                ) : null}
                {panel === "settings" ? settings(draft, setDraft) : null}
              </>
            )}
          </div>
          {panel !== "history" || discard ? (
            <SheetFooter className={componentOverlay.denseEditorFooter}>
              <Button
                type="button"
                variant="outline"
                onClick={discard ? () => setDiscard(false) : requestClose}
              >
                {t(discard ? "orders.newFlow.keepEditing" : "common.cancel")}
              </Button>
              <Button type="button" onClick={discard ? close : save}>
                {t(discard ? "orders.newFlow.discardChanges" : "orders2b1.keypad.done")}
              </Button>
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>
      <div className="hidden" aria-hidden="true">
        <ImeiScannerField
          value={draft.imei}
          onChange={(imei) => {
            if (!blocked.current)
              setDraft((current) => ({ ...current, imei, deviceId: undefined }));
          }}
          disabled={disabled}
          startScannerToken={scannerToken}
          onScannerOpenChange={(open) => {
            if (!open) setScanning(false);
          }}
        />
      </div>
    </div>
  );
}
