"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ClipboardList, CircleAlert, X } from "lucide-react";

import { toFaultPriceItems } from "@/components/orders/fault-diagnosis-picker";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import {
  createOrder,
  getCustomerDetail,
  listOrderWorkflow,
  getOnboardingStatus,
  getStoreSettings,
} from "@/lib/repairdesk/api";
import type {
  CustomerDetail,
  CustomerHistoryDeviceCandidate,
  CustomerIntakeCandidate,
  FaultPriceItem,
} from "@/lib/repairdesk/api";
import { NewOrderCustomerDeviceSection } from "@/features/orders/forms/new-order-customer-device-section";
import { NewOrderFaultDiagnosisSection } from "@/features/orders/forms/new-order-fault-diagnosis-section";
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
  const [historyDevices, setHistoryDevices] = useState<CustomerHistoryDeviceCandidate[]>([]);
  const [queryPrefilled, setQueryPrefilled] = useState(false);
  const [floatingHeaderOffset, setFloatingHeaderOffset] = useState(
    "calc(env(safe-area-inset-top) + 5.5rem)",
  );

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

  const validFaultDrafts = useMemo(
    () => form.faults.filter((item) => item.name.trim()),
    [form.faults],
  );
  const total = useMemo(
    () => validFaultDrafts.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    [validFaultDrafts],
  );
  const faultSummary = validFaultDrafts.map((item) => item.name).join("，");
  const issueDescription =
    form.issue.trim() || faultSummary || "客户未补充故障描述，按所选故障项目检测。";
  const createStatusLabel =
    selectedCreateStatus?.label ?? defaultCreateStatus?.label ?? form.status;

  const selectHistoryDevice = useCallback((device: CustomerHistoryDeviceCandidate) => {
    setForm((current) => ({
      ...current,
      deviceId: device.source === "customer_device" ? device.device_id : undefined,
      brand: device.brand,
      model: device.model,
      imei: device.serial_or_imei,
      deviceNotes: device.device_notes ?? "",
    }));
  }, []);

  const handlePickCustomer = useCallback((candidate: CustomerIntakeCandidate) => {
    setHistoryDevices(candidate.historyDevices);
    setForm((current) => ({
      ...current,
      customerId: candidate.customer.id,
      customerName: candidate.customer.name,
      customerPhone: candidate.customer.phone_e164,
      deviceId: undefined,
      brand: "",
      model: "",
      imei: "",
      deviceNotes: "",
    }));
    toast.success(
      candidate.historyDevices.length
        ? `已选择客户 ${candidate.customer.name}，请选择历史维修型号`
        : `已选择客户 ${candidate.customer.name}`,
    );
  }, []);

  const handlePickHistoryDevice = useCallback(
    (candidate: CustomerIntakeCandidate, device: CustomerHistoryDeviceCandidate) => {
      setHistoryDevices(candidate.historyDevices);
      setForm((current) => ({
        ...current,
        customerId: candidate.customer.id,
        customerName: candidate.customer.name,
        customerPhone: candidate.customer.phone_e164,
        deviceId: device.source === "customer_device" ? device.device_id : undefined,
        brand: device.brand,
        model: device.model,
        imei: device.serial_or_imei,
        deviceNotes: device.device_notes ?? "",
      }));
      toast.success(`已带入 ${device.brand} ${device.model}`);
    },
    [],
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
        const candidates = buildHistoryDevicesFromDetail(detail);
        const selectedDevice = preferredDeviceId
          ? candidates.find((device) => device.device_id === preferredDeviceId)
          : undefined;
        setHistoryDevices(candidates);
        setForm((current) => ({
          ...current,
          customerId: detail.customer.id,
          customerName: detail.customer.name,
          customerPhone: detail.customer.phone_e164,
          ...(selectedDevice
            ? {
                deviceId:
                  selectedDevice.source === "customer_device"
                    ? selectedDevice.device_id
                    : undefined,
                brand: selectedDevice.brand,
                model: selectedDevice.model,
                imei: selectedDevice.serial_or_imei,
                deviceNotes: selectedDevice.device_notes ?? "",
              }
            : {
                deviceId: undefined,
                brand: "",
                model: "",
                imei: "",
                deviceNotes: "",
              }),
        }));
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
  }, [queryPrefilled]);

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
        issue_description: issueDescription,
        accessory_notes: form.accessoryNotes || undefined,
        warranty_text: form.warrantyText || undefined,
        warranty_months: form.warrantyMonths,
        warranty_change_reason: form.warrantyChangeReason || undefined,
        fault_prices: toFaultPriceItems(validFaultDrafts),
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
    (validFaultDrafts.length > 0 || form.issue.trim()) &&
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

  const handleFloatingHeaderHeight = useCallback((height: number) => {
    setFloatingHeaderOffset(`${Math.ceil(height)}px`);
  }, []);

  return (
    <div
      data-new-order-root="true"
      data-new-order-surface={surface}
      className={cn(
        layoutGuards.noPageOverflow,
        surface === "dialog"
          ? cn(detailWorkspace.root, "max-h-[calc(100svh-16px)] sm:max-h-[calc(100svh-32px)]")
          : "mx-auto w-full min-w-0 max-w-[430px] overflow-x-hidden px-2 sm:max-w-2xl md:max-w-7xl md:px-5 md:pt-3 lg:px-6",
      )}
      style={
        surface === "page"
          ? ({
              "--repair-os-mobile-floating-offset": floatingHeaderOffset,
            } as CSSProperties)
          : undefined
      }
    >
      {surface === "page" ? (
        <NewOrderMobileHeader
          form={form}
          operatorName={operatorName}
          statusLabel={createStatusLabel}
          valid={Boolean(valid)}
          total={total}
          defaultWarrantyMonths={defaultWarrantyMonths}
          onHeightChange={handleFloatingHeaderHeight}
        />
      ) : null}

      <form
        data-new-order-form="true"
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
          "min-w-0 pb-32 sm:pb-20",
          surface === "page" &&
            cn(
              repairOs.mobileFloatingPage,
              "pb-[calc(env(safe-area-inset-bottom)+9.5rem)] md:pb-20 md:pt-0",
            ),
          surface === "dialog" &&
            "max-h-[calc(100svh-16px)] overflow-y-auto p-2 pr-10 pt-3 sm:max-h-[calc(100svh-32px)] sm:p-3 sm:pr-12 sm:pt-3 md:p-4 md:pr-12 md:pt-3",
        )}
      >
        {surface === "page" ? (
          <div className="mb-2 hidden min-w-0 justify-end gap-2 md:flex md:mb-3">
            <Button variant="outline" size="icon" className="size-9 shrink-0 rounded-full" asChild>
              <Link href="/orders" aria-label="关闭">
                <X className="size-4" />
              </Link>
            </Button>
          </div>
        ) : null}

        <NewOrderDesktopHeader
          form={form}
          operatorName={operatorName}
          statusLabel={createStatusLabel}
          valid={Boolean(valid)}
          total={total}
          defaultWarrantyMonths={defaultWarrantyMonths}
          surface={surface}
        />

        <div
          data-new-order-workspace-grid="true"
          className={cn(
            "grid min-w-0 gap-1.5 sm:gap-3 md:gap-3 lg:grid-cols-2",
            "2xl:grid-cols-[minmax(320px,0.92fr)_minmax(480px,1.28fr)_minmax(250px,0.68fr)]",
          )}
        >
          <div className="min-w-0">
            <NewOrderCustomerDeviceSection
              form={form}
              setForm={setForm}
              historyDevices={historyDevices}
              onClearCustomerContext={() => setHistoryDevices([])}
              onPickCustomer={handlePickCustomer}
              onPickHistoryDevice={handlePickHistoryDevice}
              onSelectHistoryDevice={selectHistoryDevice}
              surface={surface}
            />
          </div>

          <div className="min-w-0">
            <NewOrderFaultDiagnosisSection
              form={form}
              setForm={setForm}
              total={total}
              onPatchFault={patchFault}
              onAddCustomFault={addCustomFault}
              createStatuses={createStatuses}
              defaultWarrantyMonths={defaultWarrantyMonths}
              surface={surface}
            />
          </div>

          <aside className="hidden min-w-0 2xl:block">
            <NewOrderDesktopSummaryPanel
              form={form}
              operatorName={operatorName}
              statusLabel={createStatusLabel}
              valid={Boolean(valid)}
              total={total}
              defaultWarrantyMonths={defaultWarrantyMonths}
            />
          </aside>
        </div>

        <NewOrderSubmitBar
          total={total}
          deposit={form.deposit}
          valid={Boolean(valid)}
          pending={create.isPending}
          onCancel={onCancel}
          surface={surface}
        />
      </form>
    </div>
  );
}

function NewOrderDesktopHeader({
  form,
  operatorName,
  statusLabel,
  valid,
  total,
  defaultWarrantyMonths,
  surface,
}: {
  form: NewOrderFormState;
  operatorName: string;
  statusLabel: string;
  valid: boolean;
  total: number;
  defaultWarrantyMonths: number;
  surface: "page" | "dialog";
}) {
  const customerReady = Boolean(form.customerPhone.trim());
  const deviceReady = Boolean(form.brand.trim() && form.model.trim());
  const diagnosisReady = Boolean(form.issue.trim() || form.faults.some((item) => item.name.trim()));
  const warrantyReady =
    !warrantyReasonRequired(form.warrantyMonths, defaultWarrantyMonths) ||
    Boolean(form.warrantyChangeReason.trim());
  const readiness = [
    { label: "客户", done: customerReady },
    { label: "设备", done: deviceReady },
    { label: "故障", done: diagnosisReady },
    { label: "质保", done: warrantyReady },
  ];

  return (
    <section
      data-new-order-desktop-header="true"
      className={cn(
        "mb-3 hidden min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel)] p-3 shadow-none md:grid md:grid-cols-[minmax(180px,0.8fr)_minmax(280px,1.2fr)] md:items-center md:gap-3 xl:grid-cols-[minmax(220px,0.85fr)_minmax(360px,1.2fr)_minmax(210px,0.7fr)]",
        surface === "page" && "shadow-[var(--shadow-workspace)]",
      )}
    >
      <div className="min-w-0">
        <div className="text-[11px] font-medium leading-4 text-muted-foreground">
          {surface === "dialog" ? "弹窗录入" : "工作台录入"}
        </div>
        <h1 className="truncate text-lg font-semibold leading-6">新建维修订单</h1>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="truncate">{operatorName}</span>
          <span className="size-1 rounded-full bg-muted-foreground/35" />
          <span className="truncate">创建后进入 {statusLabel}</span>
        </div>
      </div>

      <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2.5 py-2">
        <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
          <span className="truncate text-[11px] font-semibold leading-4">资料完整度</span>
          <span
            className={cn(
              "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-semibold",
              valid
                ? "bg-status-success text-status-success-foreground"
                : "bg-status-warn text-status-warn-foreground",
            )}
          >
            {valid ? <CheckCircle2 className="size-3" /> : <CircleAlert className="size-3" />}
            {valid ? "可创建" : "待补全"}
          </span>
        </div>
        <div className="grid min-w-0 grid-cols-4 gap-1.5">
          {readiness.map((item) => (
            <span
              key={item.label}
              className={cn(
                "inline-flex h-6 min-w-0 items-center justify-center rounded-md px-1.5 text-[10px] font-medium",
                item.done
                  ? "bg-status-success/45 text-status-success-foreground"
                  : "bg-background text-muted-foreground",
              )}
            >
              <span className="truncate">{item.label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 justify-items-start gap-1.5 md:col-span-2 md:grid-cols-[auto_auto_auto] md:items-center md:justify-start xl:col-span-1 xl:grid-cols-none xl:justify-items-end">
        <div className="text-[11px] font-medium leading-4 text-muted-foreground">预计总额</div>
        <div className="font-mono text-xl font-semibold leading-6 tabular-nums">
          {formatMoney(total)}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 rounded-full bg-primary/5 px-2 py-1 text-[10px] font-semibold text-primary">
          <ClipboardList className="size-3" />
          <span className="truncate">{statusLabel}</span>
        </div>
      </div>
    </section>
  );
}

function NewOrderDesktopSummaryPanel({
  form,
  operatorName,
  statusLabel,
  valid,
  total,
  defaultWarrantyMonths,
}: {
  form: NewOrderFormState;
  operatorName: string;
  statusLabel: string;
  valid: boolean;
  total: number;
  defaultWarrantyMonths: number;
}) {
  const namedFaults = form.faults.filter((item) => item.name.trim());
  const balance = Math.max(0, total - form.deposit);
  const warrantyReady =
    !warrantyReasonRequired(form.warrantyMonths, defaultWarrantyMonths) ||
    Boolean(form.warrantyChangeReason.trim());
  const checks = [
    {
      label: "客户",
      value: form.customerPhone.trim() || "缺少电话",
      done: Boolean(form.customerPhone.trim()),
    },
    {
      label: "设备",
      value: `${form.brand} ${form.model}`.trim() || "缺少品牌/型号",
      done: Boolean(form.brand.trim() && form.model.trim()),
    },
    {
      label: "故障",
      value: form.issue.trim() || namedFaults[0]?.name || "缺少故障",
      done: Boolean(form.issue.trim() || namedFaults.length),
    },
    {
      label: "金额",
      value:
        form.deposit > total ? "定金超过合计" : `${formatMoney(total)} / ${namedFaults.length} 项`,
      done: form.deposit <= total,
    },
    {
      label: "质保",
      value: form.warrantyText || formatWarrantyText(form.warrantyMonths),
      done: warrantyReady,
    },
  ];

  return (
    <section
      data-new-order-desktop-summary="true"
      className="sticky top-3 grid min-w-0 gap-2 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel)] p-2.5 shadow-[var(--shadow-workspace)]"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-medium leading-4 text-muted-foreground">创建摘要</div>
          <h2 className="truncate text-sm font-semibold leading-5">
            {form.customerName.trim() || form.customerPhone.trim() || "新客户工单"}
          </h2>
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
          {valid ? "可创建" : "检查中"}
        </span>
      </div>

      <div className="grid min-w-0 gap-1.5">
        {checks.map((item) => (
          <div
            key={item.label}
            className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 py-1.5"
          >
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full",
                item.done
                  ? "bg-status-success text-status-success-foreground"
                  : "bg-status-warn text-status-warn-foreground",
              )}
            >
              {item.done ? <CheckCircle2 className="size-3" /> : <CircleAlert className="size-3" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-medium leading-3 text-muted-foreground">
                {item.label}
              </span>
              <span className="block truncate text-xs font-semibold leading-4" title={item.value}>
                {item.value}
              </span>
            </span>
            <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
              {item.done ? "OK" : "待补"}
            </span>
          </div>
        ))}
      </div>

      <div className="grid min-w-0 gap-1 rounded-md border border-[var(--border-panel)] bg-card px-2 py-2">
        <SummaryLine label="合计" value={formatMoney(total)} strong />
        <SummaryLine label="定金" value={formatMoney(form.deposit)} />
        <SummaryLine
          label="尾款"
          value={formatMoney(balance)}
          strong={balance > 0}
          danger={form.deposit > total}
        />
      </div>

      <div className="grid min-w-0 gap-1 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 py-2 text-[11px] leading-4">
        <SummaryLine label="初始状态" value={statusLabel} />
        <SummaryLine label="录入账号" value={operatorName || "当前登录账号"} />
        <SummaryLine label="工单类型" value={form.type === "quick_repair" ? "快修" : "送修"} />
      </div>

      <p className="rounded-md bg-primary/5 px-2 py-1.5 text-[10px] leading-4 text-primary">
        创建后会写入工单时间线；技师归属由当前账号决定，不在前台手动改写。
      </p>
    </section>
  );
}

function SummaryLine({
  label,
  value,
  strong,
  danger,
}: {
  label: string;
  value: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="truncate text-muted-foreground">{label}</span>
      <span
        className={cn(
          "shrink-0 truncate text-right font-mono text-xs tabular-nums",
          strong && "font-semibold text-foreground",
          danger && "text-status-danger-foreground",
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function buildHistoryDevicesFromDetail(detail: CustomerDetail) {
  const byKey = new Map<string, CustomerHistoryDeviceCandidate>();

  for (const device of detail.devices) {
    upsertHistoryDeviceCandidate(byKey, {
      id: `device:${device.id}`,
      customer_id: detail.customer.id,
      source: "customer_device",
      device_id: device.id,
      brand: device.brand,
      model: device.model,
      serial_or_imei: device.serial_or_imei,
      device_notes: device.device_notes,
    });
  }

  for (const order of detail.orders) {
    const fallback = splitDeviceLabel(order.device_label);
    const snapshot = order.device_snapshot ?? fallback;
    if (!snapshot?.brand && !snapshot?.model) continue;
    upsertHistoryDeviceCandidate(byKey, {
      id: `order:${order.id}`,
      customer_id: detail.customer.id,
      source: "order_history",
      device_id: detail.devices.some((device) => device.id === order.device_id)
        ? order.device_id
        : undefined,
      brand: snapshot.brand,
      model: snapshot.model,
      serial_or_imei: snapshot.serial_or_imei || order.device_imei || "",
      device_notes: snapshot.device_notes,
      last_seen_at: order.created_at,
      order_id: order.id,
      order_public_no: order.public_no,
    });
  }

  return [...byKey.values()].sort(compareHistoryDeviceCandidates).slice(0, 8);
}

function splitDeviceLabel(deviceLabel: string) {
  const normalized = deviceLabel.trim();
  if (!normalized || normalized === "-") return undefined;
  const [brand = "", ...modelParts] = normalized.split(/\s+/);
  return {
    brand,
    model: modelParts.join(" "),
    serial_or_imei: "",
    device_notes: undefined,
  };
}

function historyDeviceKey(
  candidate: Pick<CustomerHistoryDeviceCandidate, "brand" | "model" | "serial_or_imei">,
) {
  return [candidate.brand, candidate.model, candidate.serial_or_imei]
    .map((value) => value.trim().toLowerCase())
    .join("|");
}

function upsertHistoryDeviceCandidate(
  byKey: Map<string, CustomerHistoryDeviceCandidate>,
  candidate: CustomerHistoryDeviceCandidate,
) {
  const brand = candidate.brand.trim();
  const model = candidate.model.trim();
  if (!brand && !model) return;
  const normalizedCandidate = {
    ...candidate,
    brand,
    model,
    serial_or_imei: candidate.serial_or_imei.trim(),
  };
  const key = historyDeviceKey(normalizedCandidate);
  const existing = byKey.get(key);
  byKey.set(key, mergeHistoryDeviceCandidate(existing, normalizedCandidate));
}

function mergeHistoryDeviceCandidate(
  existing: CustomerHistoryDeviceCandidate | undefined,
  candidate: CustomerHistoryDeviceCandidate,
) {
  if (!existing) return candidate;
  const candidateIsNewer = compareDate(candidate.last_seen_at, existing.last_seen_at) > 0;
  if (existing.source === "customer_device" && candidate.source === "order_history") {
    return {
      ...existing,
      last_seen_at: candidateIsNewer ? candidate.last_seen_at : existing.last_seen_at,
      order_id: candidate.order_id ?? existing.order_id,
      order_public_no: candidate.order_public_no ?? existing.order_public_no,
    };
  }
  if (existing.source === "order_history" && candidate.source === "customer_device") {
    return {
      ...candidate,
      last_seen_at: candidateIsNewer ? candidate.last_seen_at : existing.last_seen_at,
      order_id: existing.order_id,
      order_public_no: existing.order_public_no,
    };
  }
  return candidateIsNewer ? candidate : existing;
}

function compareHistoryDeviceCandidates(
  a: CustomerHistoryDeviceCandidate,
  b: CustomerHistoryDeviceCandidate,
) {
  const time = compareDate(b.last_seen_at, a.last_seen_at);
  if (time !== 0) return time;
  if (a.source !== b.source) return a.source === "customer_device" ? -1 : 1;
  return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "zh-CN");
}

function compareDate(a?: string, b?: string) {
  return new Date(a ?? 0).getTime() - new Date(b ?? 0).getTime();
}

function NewOrderMobileHeader({
  form,
  operatorName,
  statusLabel,
  valid,
  total,
  defaultWarrantyMonths,
  onHeightChange,
}: {
  form: NewOrderFormState;
  operatorName: string;
  statusLabel: string;
  valid: boolean;
  total: number;
  defaultWarrantyMonths: number;
  onHeightChange?: (height: number) => void;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const customerReady = Boolean(form.customerPhone.trim());
  const deviceReady = Boolean(form.brand.trim() && form.model.trim());
  const diagnosisReady = Boolean(form.issue.trim() || form.faults.some((item) => item.name.trim()));
  const warrantyReady =
    !warrantyReasonRequired(form.warrantyMonths, defaultWarrantyMonths) ||
    Boolean(form.warrantyChangeReason.trim());
  const missingItems = [
    !customerReady ? "客户电话" : null,
    !form.brand.trim() ? "设备品牌" : null,
    !form.model.trim() ? "设备型号" : null,
    !diagnosisReady ? "故障诊断" : null,
    form.deposit > total ? "定金金额" : null,
    !warrantyReady ? "质保原因" : null,
  ].filter(Boolean);
  const helperText = valid
    ? `资料已补全，创建后进入「${statusLabel}」。`
    : `还差：${missingItems.join("、") || "必填资料"}`;

  useEffect(() => {
    const node = shellRef.current;
    if (!node || !onHeightChange) return;

    const update = () => {
      onHeightChange(node.getBoundingClientRect().height);
    };

    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [onHeightChange]);

  return (
    <div ref={shellRef} className={repairOs.mobileFloatingHeaderShell}>
      <section className={cn(repairOs.mobileFloatingHeaderCard, "px-2.5 pb-2")}>
        <header className={repairOs.mobileFloatingHeaderNav}>
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

        <div className={cn(repairOs.mobileFloatingHeaderBody, "mt-1.5 pt-1.5")}>
          <div
            className={cn(
              "flex min-w-0 items-start gap-1.5 rounded-lg px-2 py-1.5 text-[10px] leading-4",
              valid
                ? "bg-status-success/45 text-status-success-foreground"
                : "bg-[var(--surface-panel-muted)] text-muted-foreground",
            )}
          >
            <ClipboardList
              className={cn(
                "mt-0.5 size-3.5 shrink-0",
                valid ? "text-status-success-foreground" : "text-primary",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2">{helperText}</span>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
