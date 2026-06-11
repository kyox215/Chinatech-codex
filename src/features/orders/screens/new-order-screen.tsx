"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

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
import { detailWorkspace, layoutGuards, pageHeader } from "@/lib/ui-patterns";
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
    if (!customerId) {
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
          : "mx-auto max-w-7xl px-3 py-3 sm:px-5 lg:px-6",
      )}
    >
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
          "min-w-0 pb-16 sm:pb-20",
          surface === "dialog" &&
            "max-h-[calc(100svh-16px)] overflow-y-auto p-2 sm:max-h-[calc(100svh-32px)] sm:p-3 md:p-4",
        )}
      >
        <div className="mb-2 flex min-w-0 items-start justify-between gap-2 border-b border-border/60 pb-2 sm:mb-3 sm:gap-3 sm:pb-3">
          <div className="min-w-0">
            <h1
              className={cn(
                pageHeader.compactTitle,
                surface === "dialog" && "text-xl leading-6 sm:text-2xl sm:leading-8",
              )}
            >
              新建维修订单
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:mt-1 sm:text-sm">
              填写客户和设备信息以创建新工单
            </p>
          </div>
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
            "grid min-w-0 gap-2 sm:gap-3 lg:grid-cols-2",
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
