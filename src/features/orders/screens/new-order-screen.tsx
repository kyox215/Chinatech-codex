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
  getRepairDeskOptions,
} from "@/lib/repairdesk/api";
import type { Customer, Device, FaultPriceItem } from "@/lib/repairdesk/api";
import { NewOrderCustomerDeviceSection } from "@/features/orders/forms/new-order-customer-device-section";
import { NewOrderFaultDiagnosisSection } from "@/features/orders/forms/new-order-fault-diagnosis-section";
import { NewOrderQuotationSection } from "@/features/orders/forms/new-order-quotation-section";
import { NewOrderSubmitBar } from "@/features/orders/forms/new-order-submit-bar";
import {
  fallbackTechnicians,
  initialNewOrderForm,
  type NewOrderFormState,
} from "@/features/orders/model/new-order-form";

export function NewOrderScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<NewOrderFormState>(initialNewOrderForm);
  const [knownDevices, setKnownDevices] = useState<Device[]>([]);
  const [queryPrefilled, setQueryPrefilled] = useState(false);
  const { data: options = { suppliers: [], technicians: [] } } = useQuery({
    queryKey: ["repairdesk-options"],
    queryFn: () => getRepairDeskOptions(),
  });
  const technicianOptions = options.technicians.length ? options.technicians : fallbackTechnicians;

  const total = useMemo(
    () => form.faults.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    [form.faults],
  );
  const balance = Math.max(0, total - form.deposit);
  const faultSummary = form.faults.map((item) => item.name).join("，");
  const issueDescription =
    form.issue.trim() || faultSummary || "客户未补充故障描述，按所选故障项目检测。";

  useEffect(() => {
    if (!form.technician && technicianOptions[0]) {
      setForm((current) =>
        current.technician ? current : { ...current, technician: technicianOptions[0] },
      );
    }
  }, [form.technician, technicianOptions]);

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
        technician_name: form.technician,
        internal_tag: form.internalTag || undefined,
        accessory_notes: form.accessoryNotes || undefined,
        warranty_text: form.warrantyText || undefined,
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
      router.push(`/orders/${id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const valid =
    form.customerPhone.trim() &&
    form.brand.trim() &&
    form.model.trim() &&
    form.technician.trim() &&
    (form.faults.length > 0 || form.issue.trim()) &&
    form.deposit <= total;

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
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) {
            toast.error(form.deposit > total ? "定金不能超过订单总金额" : "请补全必填字段");
            return;
          }
          create.mutate();
        }}
        className="pb-24"
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">新建维修订单</h1>
            <p className="mt-1 text-sm text-muted-foreground">填写客户和设备信息以创建新工单</p>
          </div>
          <Button variant="outline" size="icon" className="size-11 rounded-full" asChild>
            <Link href="/orders" aria-label="关闭">
              <X className="size-5" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.95fr)_minmax(430px,1.2fr)_minmax(320px,0.95fr)]">
          <NewOrderCustomerDeviceSection
            form={form}
            setForm={setForm}
            knownDevices={knownDevices}
            onClearKnownDevices={() => setKnownDevices([])}
            onPickCustomer={(customer) => handlePickCustomer(customer)}
            onSelectKnownDevice={selectKnownDevice}
          />

          <NewOrderFaultDiagnosisSection form={form} setForm={setForm} />

          <NewOrderQuotationSection
            form={form}
            setForm={setForm}
            total={total}
            balance={balance}
            technicianOptions={technicianOptions}
            onPatchFault={patchFault}
            onAddCustomFault={addCustomFault}
          />
        </div>

        <NewOrderSubmitBar
          total={total}
          deposit={form.deposit}
          valid={Boolean(valid)}
          pending={create.isPending}
        />
      </form>
    </div>
  );
}
