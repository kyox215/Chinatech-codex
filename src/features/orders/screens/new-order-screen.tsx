"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ClipboardList,
  CircleAlert,
  Smartphone,
  X,
} from "lucide-react";

import { toFaultPriceItems } from "@/components/orders/fault-diagnosis-picker";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import {
  createOrder,
  getCustomerDetail,
  getCustomerDevices,
  listOrderWorkflow,
  getOnboardingStatus,
  getStoreSettings,
} from "@/lib/repairdesk/api";
import type { Customer, Device, FaultPriceItem } from "@/lib/repairdesk/api";
import { NewOrderCustomerDeviceSection } from "@/features/orders/forms/new-order-customer-device-section";
import { NewOrderFaultDiagnosisSection } from "@/features/orders/forms/new-order-fault-diagnosis-section";
import { NewOrderQuotationSection } from "@/features/orders/forms/new-order-quotation-section";
import { NewOrderSubmitBar } from "@/features/orders/forms/new-order-submit-bar";
import {
  initialNewOrderForm,
  type NewOrderFormState,
} from "@/features/orders/model/new-order-form";
import { formatWarrantyText, warrantyReasonRequired } from "@/features/orders/model/order-warranty";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { getWorkflowStatuses } from "@/features/orders/model/order-workflow";
import { platformKeys } from "@/features/platform/api/query-keys";
import { formatMoney } from "@/lib/money";
import { detailWorkspace, layoutGuards, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export function NewOrderScreen({
  surface = "page",
  onCreated,
  onCancel,
}: {
  surface?: "page" | "dialog";
  onCreated?: (id: string) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<NewOrderFormState>(initialNewOrderForm);
  const [knownDevices, setKnownDevices] = useState<Device[]>([]);
  const [queryPrefilled, setQueryPrefilled] = useState(false);

  useEffect(() => {
    if (surface !== "page") return;
    document.body.dataset.mobileWorkspaceActive = "true";
    return () => {
      delete document.body.dataset.mobileWorkspaceActive;
    };
  }, [surface]);

  const { data: onboardingStatus } = useQuery({
    queryKey: platformKeys.onboardingStatus,
    queryFn: getOnboardingStatus,
    retry: false,
    staleTime: 30_000,
  });
  const { data: storeSettings } = useQuery({
    queryKey: messageSettingsKeys.store,
    queryFn: getStoreSettings,
    staleTime: 30_000,
  });
  const { data: workflow } = useQuery({
    queryKey: ordersKeys.workflow(),
    queryFn: () => listOrderWorkflow(),
    staleTime: 60_000,
  });
  const operatorName = onboardingStatus?.displayName ?? "当前登录账号";
  const defaultWarrantyMonths = storeSettings?.default_order_warranty_months ?? 6;
  const createStatuses = useMemo(
    () =>
      getWorkflowStatuses(workflow).filter((status) => status.enabled && status.allowed_for_create),
    [workflow],
  );
  const defaultCreateStatus =
    createStatuses.find((status) => status.is_default_create_status) ?? createStatuses[0];
  const selectedCreateStatus = createStatuses.find((status) => status.code === form.status);

  useEffect(() => {
    if (!storeSettings) return;
    setForm((current) => {
      const untouchedDefault =
        current.warrantyMonths === 6 &&
        current.warrantyText === "6个月" &&
        !current.warrantyChangeReason;
      if (!untouchedDefault) return current;
      return {
        ...current,
        warrantyMonths: defaultWarrantyMonths,
        warrantyText: formatWarrantyText(defaultWarrantyMonths),
      };
    });
  }, [defaultWarrantyMonths, storeSettings]);

  useEffect(() => {
    if (!defaultCreateStatus) return;
    setForm((current) =>
      createStatuses.some((status) => status.code === current.status)
        ? current
        : { ...current, status: defaultCreateStatus.code },
    );
  }, [createStatuses, defaultCreateStatus]);

  const total = useMemo(
    () => form.faults.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    [form.faults],
  );
  const balance = Math.max(0, total - form.deposit);
  const faultSummary = form.faults.map((item) => item.name).join("，");
  const issueDescription =
    form.issue.trim() || faultSummary || "客户未补充故障描述，按所选故障项目检测。";

  const applyCustomerPick = useCallback(
    (customer: Customer, devices: Device[], preferredDeviceId?: string) => {
      setKnownDevices(devices);
      const selectedDevice =
        (preferredDeviceId && devices.find((device) => device.id === preferredDeviceId)) ||
        (devices.length === 1 ? devices[0] : undefined);

      setForm((current) => ({
        ...current,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone_e164,
        ...(selectedDevice
          ? {
              deviceId: selectedDevice.id,
              brand: selectedDevice.brand,
              model: selectedDevice.model,
              imei: selectedDevice.serial_or_imei,
              deviceNotes: selectedDevice.device_notes ?? "",
            }
          : devices.length > 1
            ? {
                deviceId: undefined,
                brand: "",
                model: "",
                imei: "",
                deviceNotes: "",
              }
            : {}),
      }));

      return selectedDevice;
    },
    [],
  );

  const selectKnownDevice = (deviceId: string) => {
    if (deviceId === "new") {
      setForm((current) => ({
        ...current,
        deviceId: undefined,
        brand: "",
        model: "",
        imei: "",
        deviceNotes: "",
      }));
      return;
    }

    const device = knownDevices.find((item) => item.id === deviceId);
    if (!device) return;
    setForm((current) => ({
      ...current,
      deviceId: device.id,
      brand: device.brand,
      model: device.model,
      imei: device.serial_or_imei,
      deviceNotes: device.device_notes ?? "",
    }));
  };

  const handlePickCustomer = useCallback(
    async (customer: Customer, preferredDeviceId?: string) => {
      const devices = await getCustomerDevices(customer.id);
      const selectedDevice = applyCustomerPick(customer, devices, preferredDeviceId);
      toast.success(
        selectedDevice
          ? `已带入 ${customer.name} 的设备：${selectedDevice.brand} ${selectedDevice.model}`
          : devices.length > 1
            ? `已选择客户 ${customer.name}，请选择本次维修设备`
            : `已选择客户 ${customer.name}`,
      );
    },
    [applyCustomerPick],
  );

  useEffect(() => {
    if (queryPrefilled) return;

    const params = new URLSearchParams(window.location.search);
    const customerId = params.get("customerId");
    const prefillIdentifier = params.get("imei") ?? params.get("serial") ?? "";

    const applyPrefillIdentifier = () => {
      if (!prefillIdentifier) return;
      setForm((current) =>
        current.imei ? current : { ...current, imei: prefillIdentifier, deviceId: undefined },
      );
    };

    if (!customerId) {
      applyPrefillIdentifier();
      setQueryPrefilled(true);
      return;
    }

    let active = true;
    const preferredDeviceId = params.get("deviceId") ?? undefined;
    getCustomerDetail(customerId)
      .then((detail) => {
        if (!active) return;
        const selectedDevice = applyCustomerPick(
          detail.customer,
          detail.devices,
          preferredDeviceId,
        );
        toast.success(
          selectedDevice
            ? `已从客户档案带入：${detail.customer.name} / ${selectedDevice.brand} ${selectedDevice.model}`
            : `已从客户档案带入：${detail.customer.name}`,
        );
        applyPrefillIdentifier();
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => {
        if (active) setQueryPrefilled(true);
      });

    return () => {
      active = false;
    };
  }, [applyCustomerPick, queryPrefilled]);

  const create = useMutation({
    mutationFn: () =>
      createOrder({
        order_type: form.type,
        status: form.status,
        customer_id: form.customerId,
        customer_name: form.customerName.trim() || `客户 ${form.customerPhone.trim()}`,
        customer_phone: form.customerPhone,
        device_id: form.deviceId,
        device_brand: form.brand,
        device_model: form.model,
        device_imei: form.imei,
        device_notes: form.deviceNotes || undefined,
        issue_description: issueDescription,
        accessory_notes: form.accessoryNotes || undefined,
        warranty_text: form.warrantyText || undefined,
        warranty_months: form.warrantyMonths,
        warranty_change_reason: form.warrantyChangeReason || undefined,
        fault_prices: toFaultPriceItems(form.faults.filter((item) => item.name.trim())),
        deposit_amount: form.deposit,
      }),
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-stats"] });
      queryClient.invalidateQueries({ queryKey: ["repairdesk-options"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-detail"] });
      toast.success("工单已创建");
      if (onCreated) {
        onCreated(id);
      } else {
        router.push(`/orders/${id}`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const valid =
    form.customerPhone.trim() &&
    form.brand.trim() &&
    form.model.trim() &&
    (form.faults.length > 0 || form.issue.trim()) &&
    form.deposit <= total &&
    (!warrantyReasonRequired(form.warrantyMonths, defaultWarrantyMonths) ||
      form.warrantyChangeReason.trim());

  const patchFault = (index: number, patch: Partial<FaultPriceItem>) => {
    const next = [...form.faults];
    next[index] = { ...next[index], ...patch };
    setForm({ ...form, faults: next });
  };

  const addCustomFault = () => {
    setForm({
      ...form,
      faults: [
        ...form.faults,
        {
          key: `custom:${Date.now()}`,
          categoryKey: "custom",
          categoryLabel: "自定义",
          name: "",
          price: 0,
          note: "Intervento personalizzato",
        },
      ],
    });
  };

  return (
    <div
      className={cn(
        layoutGuards.noPageOverflow,
        surface === "dialog"
          ? cn(detailWorkspace.root, "max-h-[calc(100svh-16px)] sm:max-h-[calc(100svh-32px)]")
          : cn(repairOs.mobilePage, "px-2 pt-0 sm:max-w-2xl md:max-w-7xl md:px-5 md:pt-3 lg:px-6"),
      )}
    >
      {surface === "page" ? (
        <NewOrderMobileHeader
          form={form}
          total={total}
          balance={balance}
          operatorName={operatorName}
          statusLabel={selectedCreateStatus?.label ?? defaultCreateStatus?.label ?? form.status}
          valid={Boolean(valid)}
        />
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) {
            toast.error(
              form.deposit > total
                ? "定金不能超过订单总金额"
                : warrantyReasonRequired(form.warrantyMonths, defaultWarrantyMonths) &&
                    !form.warrantyChangeReason.trim()
                  ? "非默认质保需要填写原因"
                  : "请补全必填字段",
            );
            return;
          }
          create.mutate();
        }}
        className={cn(
          "min-w-0 pb-20 sm:pb-20",
          surface === "page" && "pt-[calc(env(safe-area-inset-top)+5.8rem)] md:pt-0",
          surface === "dialog" &&
            "max-h-[calc(100svh-16px)] overflow-y-auto p-2 sm:max-h-[calc(100svh-32px)] sm:p-3 md:p-4",
        )}
      >
        <div className="mb-2 hidden min-w-0 justify-end gap-2 md:flex md:mb-3">
          {surface === "page" && (
            <Button variant="outline" size="icon" className="size-9 shrink-0 rounded-full" asChild>
              <Link href="/orders" aria-label="关闭">
                <X className="size-4" />
              </Link>
            </Button>
          )}
        </div>

        <div
          className={cn(
            "grid min-w-0 gap-1.5 sm:gap-3 lg:grid-cols-2",
            surface === "dialog"
              ? "xl:grid-cols-[minmax(280px,0.95fr)_minmax(420px,1.2fr)_minmax(310px,0.95fr)]"
              : "xl:grid-cols-[minmax(280px,0.95fr)_minmax(420px,1.2fr)_minmax(310px,0.95fr)]",
          )}
        >
          <div className="min-w-0">
            <NewOrderCustomerDeviceSection
              form={form}
              setForm={setForm}
              knownDevices={knownDevices}
              onClearKnownDevices={() => setKnownDevices([])}
              onPickCustomer={(customer) => handlePickCustomer(customer)}
              onSelectKnownDevice={selectKnownDevice}
              surface={surface}
            />
          </div>

          <div className="min-w-0">
            <NewOrderFaultDiagnosisSection form={form} setForm={setForm} surface={surface} />
          </div>

          <div className="min-w-0 lg:col-span-2 xl:col-span-1">
            <NewOrderQuotationSection
              form={form}
              setForm={setForm}
              total={total}
              balance={balance}
              operatorName={operatorName}
              onPatchFault={patchFault}
              onAddCustomFault={addCustomFault}
              createStatuses={createStatuses}
              defaultWarrantyMonths={defaultWarrantyMonths}
              surface={surface}
            />
          </div>
        </div>

        <NewOrderSubmitBar
          total={total}
          deposit={form.deposit}
          valid={Boolean(valid)}
          pending={create.isPending}
          onCancel={onCancel}
        />
      </form>
    </div>
  );
}

function NewOrderMobileHeader({
  form,
  total,
  balance,
  operatorName,
  statusLabel,
  valid,
}: {
  form: NewOrderFormState;
  total: number;
  balance: number;
  operatorName: string;
  statusLabel: string;
  valid: boolean;
}) {
  const customerText = form.customerName.trim() || form.customerPhone.trim() || "客户待填";
  const deviceText = [form.brand.trim(), form.model.trim()].filter(Boolean).join(" ") || "设备待填";
  const issueText =
    form.issue.trim() ||
    form.faults
      .map((item) => item.name)
      .filter(Boolean)
      .join("，") ||
    "故障待填";

  return (
    <div className="fixed inset-x-0 top-0 z-40 border-b border-[var(--border-panel)] bg-background/95 shadow-[0_8px_24px_color-mix(in_oklch,var(--foreground)_6%,transparent)] backdrop-blur-xl md:hidden">
      <div className="mx-auto max-w-[430px] px-2 pb-1.5 pt-[calc(env(safe-area-inset-top)+0.25rem)]">
        <header className="flex min-w-0 items-center justify-between gap-2">
          <Button asChild variant="ghost" size="icon" className="size-7 rounded-lg">
            <Link href="/orders" aria-label="返回工单列表">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0 text-center">
            <p className="truncate text-xs font-semibold leading-4">新建工单</p>
            <p className="truncate text-[9px] leading-3 text-muted-foreground">{operatorName}</p>
          </div>
          <span
            className={cn(
              "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-semibold",
              valid
                ? "bg-status-success text-status-success-foreground"
                : "bg-status-warn text-status-warn-foreground",
            )}
          >
            {valid ? <CheckCircle2 className="size-3" /> : <CircleAlert className="size-3" />}
            {valid ? "可创建" : "待补全"}
          </span>
        </header>

        <section className="mt-1 rounded-lg border border-[var(--border-panel)] bg-card/95 p-1.5 shadow-[var(--shadow-card)]">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-1">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold leading-4">{customerText}</p>
              <p className="truncate text-[9px] leading-3 text-muted-foreground">{issueText}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-[11px] font-semibold leading-4 text-primary">
                {formatMoney(total)}
              </p>
              <p className="text-[9px] leading-3 text-muted-foreground">
                应收 {formatMoney(balance)}
              </p>
            </div>
          </div>
          <div className="mt-1 grid min-w-0 grid-cols-3 gap-1 text-[9px] leading-3 text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1 rounded bg-[var(--surface-panel-muted)] px-1.5 py-0.5">
              <Smartphone className="size-3 shrink-0 text-primary" />
              <span className="truncate">{deviceText}</span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-1 rounded bg-[var(--surface-panel-muted)] px-1.5 py-0.5">
              <ClipboardList className="size-3 shrink-0 text-primary" />
              <span className="truncate">{statusLabel}</span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-1 rounded bg-[var(--surface-panel-muted)] px-1.5 py-0.5">
              <Banknote className="size-3 shrink-0 text-primary" />
              <span className="truncate">定金 {formatMoney(form.deposit)}</span>
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
