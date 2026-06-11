"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type React from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Camera,
  CheckCircle2,
  ChevronUp,
  CreditCard,
  Plus,
  Printer,
  Send,
  Signature,
  Trash2,
} from "lucide-react";

import { ImeiScannerField } from "@/components/imei-scanner-field";
import { ApprovalBadge, MoneyText } from "@/components/orders/badges";
import {
  AccessoryNotesPicker,
  AccessoryNotesPills,
} from "@/features/orders/components/accessory-notes-picker";
import { PhoneContactMenu } from "@/features/orders/components/order-contact-menu";
import { WarrantyPicker, WarrantyTag } from "@/features/orders/components/warranty-picker";
import {
  FaultDiagnosisPicker,
  normalizeFaultPrices,
  toFaultPriceItems,
} from "@/components/orders/fault-diagnosis-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { inferOrderPaidAmount } from "@/features/orders/model/edit-order-form";
import {
  emptyFinanceFaultDraft,
  financeDraftFromPrices,
  normalizeFinanceDraft,
  type FinanceDraftState,
  type FinanceFaultDraft,
} from "@/features/orders/model/order-finance-draft";
import { fadeUp } from "@/lib/motion";
import { detailWorkspace } from "@/lib/ui-patterns";
import type { Customer, OrderDetail, Supplier, UpdateOrderInput } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";

type DetailSurface = "page" | "dialog";

export type OrderEditableField =
  | "customer_name"
  | "device_brand"
  | "device_model"
  | "device_notes"
  | "issue_description"
  | "diagnosis_result";

type OrderEditContext = {
  draft: UpdateOrderInput;
  onDraftChange: (draft: UpdateOrderInput) => void;
  activeField: OrderEditableField | null;
  onActiveFieldChange: (field: OrderEditableField | null) => void;
};

type FinanceEditContext = {
  financeDraft: FinanceDraftState;
  onFinanceDraftChange: (draft: FinanceDraftState) => void;
};

type InfoTone = "plain" | "hero" | "soft" | "note" | "metric" | "metricStrong";

const overviewPanelClass =
  "min-w-0 overflow-hidden border-border/70 bg-card/95 p-2.5 shadow-sm sm:p-4";
const DetailDensityContext = createContext(false);

function useDenseDetail() {
  return useContext(DetailDensityContext);
}

export function OrderOverviewTab({
  order,
  customer,
  deviceBrand,
  deviceModel,
  deviceImei,
  deviceNotes,
  accessoryNotes,
  isEditing = false,
  editDraft,
  onEditDraftChange,
  activeEditField,
  onActiveEditFieldChange,
  defaultWarrantyMonths = 6,
  onQuickImeiSave,
  quickImeiPending = false,
  surface = "page",
}: {
  order: OrderDetail["order"];
  customer?: Customer;
  deviceBrand: string;
  deviceModel: string;
  deviceImei: string;
  deviceNotes?: string;
  accessoryNotes?: string;
  isEditing?: boolean;
  editDraft?: UpdateOrderInput | null;
  onEditDraftChange?: (draft: UpdateOrderInput) => void;
  activeEditField?: OrderEditableField | null;
  onActiveEditFieldChange?: (field: OrderEditableField | null) => void;
  defaultWarrantyMonths?: number;
  onQuickImeiSave?: (imei: string) => void | Promise<void>;
  quickImeiPending?: boolean;
  surface?: DetailSurface;
}) {
  const edit =
    isEditing && editDraft && onEditDraftChange && onActiveEditFieldChange
      ? {
          draft: editDraft,
          onDraftChange: onEditDraftChange,
          activeField: activeEditField ?? null,
          onActiveFieldChange: onActiveEditFieldChange,
        }
      : null;

  return (
    <motion.div variants={fadeUp} className="min-w-0">
      <div className="min-w-0 space-y-2 md:hidden">
        <MobileCoreInfoPanel
          order={order}
          customer={customer}
          deviceBrand={deviceBrand}
          deviceModel={deviceModel}
          deviceImei={deviceImei}
          deviceNotes={deviceNotes}
          accessoryNotes={accessoryNotes}
          defaultWarrantyMonths={defaultWarrantyMonths}
          onQuickImeiSave={onQuickImeiSave}
          quickImeiPending={quickImeiPending}
          edit={edit}
          surface={surface}
        />
      </div>

      <div
        className={cn(
          "hidden min-w-0 gap-2 sm:gap-3 md:grid md:grid-cols-2",
          surface === "dialog"
            ? detailWorkspace.compactDetailGrid
            : "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)]",
        )}
      >
        <CustomerPanel order={order} customer={customer} edit={edit} surface={surface} />
        <DeviceIssuePanel
          order={order}
          deviceBrand={deviceBrand}
          deviceModel={deviceModel}
          deviceImei={deviceImei}
          deviceNotes={deviceNotes}
          accessoryNotes={accessoryNotes}
          defaultWarrantyMonths={defaultWarrantyMonths}
          onQuickImeiSave={onQuickImeiSave}
          quickImeiPending={quickImeiPending}
          edit={edit}
          surface={surface}
        />
      </div>
    </motion.div>
  );
}

export function OrderFinanceDock({
  order,
  isEditing,
  financeDraft,
  onFinanceDraftChange,
  editError,
  onApproval,
  onPay,
  onNotify,
  onPrint,
  surface = "page",
}: {
  order: OrderDetail["order"];
  isEditing: boolean;
  financeDraft: FinanceDraftState;
  onFinanceDraftChange: (draft: FinanceDraftState) => void;
  editError?: string;
  onApproval: () => void;
  onPay: () => void;
  onNotify: () => void;
  onPrint: () => void;
  surface?: DetailSurface;
}) {
  const [open, setOpen] = useState(false);
  const paidAmount = inferOrderPaidAmount(order);
  const normalizedDraft = useMemo(
    () => normalizeFinanceDraft(financeDraft, paidAmount),
    [financeDraft, paidAmount],
  );
  const display = isEditing
    ? {
        quotation: normalizedDraft.quotation,
        deposit: normalizedDraft.deposit,
        balance: normalizedDraft.balance,
        isPaid: normalizedDraft.balance === 0,
      }
    : {
        quotation: order.quotation_amount,
        deposit: order.deposit_amount,
        balance: order.balance_amount,
        isPaid: order.is_paid,
      };
  const actionHandlers = {
    onApproval: () => {
      setOpen(false);
      onApproval();
    },
    onPay: () => {
      setOpen(false);
      onPay();
    },
    onNotify: () => {
      setOpen(false);
      onNotify();
    },
    onPrint: () => {
      setOpen(false);
      onPrint();
    },
  };

  return (
    <>
      <div
        className={cn(
          surface === "dialog"
            ? "sticky bottom-0 z-20 mt-2 min-w-0"
            : "fixed inset-x-0 bottom-0 z-30 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] sm:px-4",
        )}
      >
        <div
          className={cn(
            "mx-auto min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-workspace-strong)]/95 p-2 shadow-[var(--shadow-overlay)] backdrop-blur-xl",
            surface === "dialog" ? "w-full" : "w-full max-w-5xl",
          )}
        >
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
              <DockMoney label="总价" amount={display.quotation} strong />
              <DockMoney label="定金" amount={display.deposit} />
              <DockMoney label="待付" amount={display.balance} strong />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 shrink-0 gap-1.5 px-2 text-xs sm:px-3"
              onClick={() => setOpen(true)}
            >
              <ChevronUp className="size-3.5" />
              <span className="hidden sm:inline">展开报价</span>
              <span className="sm:hidden">报价</span>
            </Button>
          </div>
          <div className="mt-1 flex min-w-0 items-center justify-between gap-2 px-0.5 text-[11px] text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1">
              {display.isPaid ? (
                <>
                  <CheckCircle2 className="size-3 text-status-success-foreground" />
                  已结清
                </>
              ) : (
                "未结清"
              )}
            </span>
            <span className="truncate">
              {isEditing ? "报价草稿会随顶部保存一起提交" : "审批、收款和报价项目在详情中处理"}
            </span>
          </div>
        </div>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="mx-auto w-[min(980px,calc(100vw-16px))]">
          <DrawerHeader className="text-left">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <div className="min-w-0">
                <DrawerTitle className="truncate">报价与处理</DrawerTitle>
                <DrawerDescription className="truncate">
                  {order.public_no} · {isEditing ? "编辑报价草稿" : "报价、审批与收款"}
                </DrawerDescription>
              </div>
              <ApprovalBadge status={order.approval_status} />
            </div>
          </DrawerHeader>

          <div className="min-w-0 overflow-y-auto px-4 pb-2">
            <div className="mb-3 grid min-w-0 grid-cols-3 gap-2">
              <DockMoney label="总报价" amount={display.quotation} strong expanded />
              <DockMoney label="押金" amount={display.deposit} expanded />
              <DockMoney label="尾款" amount={display.balance} strong expanded />
            </div>

            {isEditing ? (
              <FinanceEditor
                edit={{ financeDraft, onFinanceDraftChange }}
                normalizedDraft={normalizedDraft}
                error={editError ?? normalizedDraft.error}
              />
            ) : (
              <FinanceDisplay order={order} />
            )}

            <Separator className="my-3" />
            <FinanceActions order={order} {...actionHandlers} />
          </div>

          <DrawerFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              关闭
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export function OrderKeyInfoCard({
  order,
  supplier,
  className,
  surface = "page",
}: {
  order: OrderDetail["order"];
  supplier?: Supplier;
  className?: string;
  surface?: DetailSurface;
}) {
  return (
    <DetailPanel surface={surface} className={className}>
      <h3 className="mb-2 text-sm font-semibold sm:mb-3">关键信息</h3>
      <dl className="grid min-w-0 gap-1 text-xs sm:gap-1.5">
        <Row label="创建时间" value={new Date(order.created_at).toLocaleString("zh-CN")} />
        <Row
          label="完成时间"
          value={order.completed_at ? new Date(order.completed_at).toLocaleString("zh-CN") : "—"}
        />
        <Row
          label="交付时间"
          value={order.delivered_at ? new Date(order.delivered_at).toLocaleString("zh-CN") : "—"}
        />
        {supplier && (
          <Row
            label="外修供应商"
            value={
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: supplier.color }}
                />
                <span className="truncate">{supplier.name}</span>
              </span>
            }
          />
        )}
        {order.cancel_reason && <Row label="取消原因" value={order.cancel_reason} />}
      </dl>
    </DetailPanel>
  );
}

function DetailPanel({
  surface,
  className,
  children,
}: {
  surface: DetailSurface;
  className?: string;
  children: React.ReactNode;
}) {
  if (surface === "dialog") {
    return (
      <DetailDensityContext.Provider value>
        <section className={cn(detailWorkspace.densePanel, className)}>{children}</section>
      </DetailDensityContext.Provider>
    );
  }

  return (
    <DetailDensityContext.Provider value={false}>
      <Card className={cn(overviewPanelClass, className)}>{children}</Card>
    </DetailDensityContext.Provider>
  );
}

function MobileCoreInfoPanel({
  order,
  customer,
  deviceBrand,
  deviceModel,
  deviceImei,
  deviceNotes,
  accessoryNotes,
  defaultWarrantyMonths,
  onQuickImeiSave,
  quickImeiPending,
  edit,
  surface,
}: {
  order: OrderDetail["order"];
  customer?: Customer;
  deviceBrand: string;
  deviceModel: string;
  deviceImei: string;
  deviceNotes?: string;
  accessoryNotes?: string;
  defaultWarrantyMonths: number;
  onQuickImeiSave?: (imei: string) => void | Promise<void>;
  quickImeiPending: boolean;
  edit: OrderEditContext | null;
  surface: DetailSurface;
}) {
  return (
    <DetailPanel surface={surface}>
      <PanelHeader title="核心信息" editing={Boolean(edit)} />
      <div className="min-w-0 space-y-2 sm:space-y-3">
        <section className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
          <CustomerNameField order={order} customer={customer} edit={edit} />
          <InfoField label="技师" tone="soft">
            <ReadonlyValue value={order.technician_name} />
          </InfoField>
        </section>

        <CustomerPhoneField order={order} customer={customer} />
        <BackupPhones order={order} />

        <Separator className="my-2 sm:my-3" />

        <section className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
          <DraftTextField
            field="device_brand"
            label="品牌"
            value={edit?.draft.device_brand ?? deviceBrand}
            required
            tone="hero"
            edit={edit}
            onChange={(value) => patchDraft(edit, { device_brand: value })}
          />
          <DraftTextField
            field="device_model"
            label="型号"
            value={edit?.draft.device_model ?? deviceModel}
            required
            tone="hero"
            edit={edit}
            onChange={(value) => patchDraft(edit, { device_model: value })}
          />
        </section>

        <ImeiField
          value={edit?.draft.device_imei ?? deviceImei}
          edit={edit}
          onQuickSave={onQuickImeiSave}
          quickPending={quickImeiPending}
        />

        <section className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
          <DraftTextField
            field="device_notes"
            label="设备备注"
            value={edit?.draft.device_notes ?? deviceNotes ?? ""}
            tone="note"
            emptyText="—"
            edit={edit}
            onChange={(value) => patchDraft(edit, { device_notes: value })}
          />
          <AccessoryNotesField
            value={edit?.draft.accessory_notes ?? accessoryNotes ?? ""}
            edit={edit}
            onChange={(value) => patchDraft(edit, { accessory_notes: value })}
          />
        </section>

        <Separator className="my-2 sm:my-3" />

        <section className="min-w-0 space-y-2 sm:space-y-3">
          <DraftTextField
            field="issue_description"
            label="故障描述"
            value={edit?.draft.issue_description ?? order.issue_description}
            required
            multiline
            tone="note"
            edit={edit}
            onChange={(value) => patchDraft(edit, { issue_description: value })}
          />
          <DraftTextField
            field="diagnosis_result"
            label="诊断结果"
            value={edit?.draft.diagnosis_result ?? order.diagnosis_result ?? ""}
            multiline
            tone="soft"
            emptyText="—"
            edit={edit}
            onChange={(value) => patchDraft(edit, { diagnosis_result: value })}
          />
          <WarrantyField order={order} edit={edit} defaultWarrantyMonths={defaultWarrantyMonths} />
        </section>

        <Separator className="my-2 sm:my-3" />
        <CustomerSignatureSection order={order} />
      </div>
    </DetailPanel>
  );
}

function CustomerPanel({
  order,
  customer,
  edit,
  surface,
}: {
  order: OrderDetail["order"];
  customer?: Customer;
  edit: OrderEditContext | null;
  surface: DetailSurface;
}) {
  return (
    <DetailPanel surface={surface}>
      <PanelHeader title="客户信息" editing={Boolean(edit)} />
      <div className="min-w-0 space-y-2 sm:space-y-3">
        <section className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 md:grid-cols-1">
          <CustomerNameField order={order} customer={customer} edit={edit} />
          <InfoField label="技师" tone="soft">
            <ReadonlyValue value={order.technician_name} />
          </InfoField>
        </section>

        <CustomerPhoneField order={order} customer={customer} />
        <BackupPhones order={order} />

        <Separator className="my-2 sm:my-3" />
        <CustomerSignatureSection order={order} />
      </div>
    </DetailPanel>
  );
}

function CustomerNameField({
  order,
  customer,
  edit,
}: {
  order: OrderDetail["order"];
  customer?: Customer;
  edit: OrderEditContext | null;
}) {
  return (
    <DraftTextField
      field="customer_name"
      label="客户"
      value={edit?.draft.customer_name ?? order.customer_name ?? customer?.name ?? ""}
      required
      tone="hero"
      edit={edit}
      onChange={(value) => patchDraft(edit, { customer_name: value })}
    />
  );
}

function CustomerPhoneField({
  order,
  customer,
}: {
  order: OrderDetail["order"];
  customer?: Customer;
}) {
  const value = order.customer_phone ?? customer?.phone_e164 ?? "";
  return (
    <InfoField label="主电话" tone="soft">
      <PhoneContactMenu phone={value} />
    </InfoField>
  );
}

function BackupPhones({ order }: { order: OrderDetail["order"] }) {
  if (!order.contact_phones.length) return null;
  return (
    <InfoField label="备用联系电话">
      <div className="flex min-w-0 flex-wrap gap-1">
        {order.contact_phones.map((phone) => (
          <PhoneContactMenu
            key={phone}
            phone={phone}
            className="max-w-full truncate rounded-md border border-border/70 bg-surface-muted/70 px-1.5 py-0.5 text-[11px]"
            compact
          />
        ))}
      </div>
    </InfoField>
  );
}

function CustomerSignatureSection({ order }: { order: OrderDetail["order"] }) {
  const dense = useDenseDetail();
  return (
    <section className="min-w-0">
      <div
        className={cn(
          "flex min-w-0 items-center justify-between gap-2",
          dense ? "mb-1" : "mb-1.5 sm:mb-2",
        )}
      >
        <h4
          className={cn(
            "font-semibold text-muted-foreground",
            dense ? "text-[11px]" : "text-[11px] sm:text-xs",
          )}
        >
          客户签名
        </h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "gap-1 px-1.5 text-[11px]",
            dense ? "h-6" : "h-6 sm:h-7 sm:px-2 sm:text-xs",
          )}
        >
          <Signature className="size-3" />
          {order.customer_signature ? "重新签名" : "请客户签名"}
        </Button>
      </div>
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-dashed border-border/80 bg-surface-muted/20 text-xs text-muted-foreground",
          dense ? "h-14" : "h-16 sm:h-24 sm:rounded-lg",
          order.customer_signature && "border-primary/20 bg-accent/30 text-accent-foreground",
        )}
      >
        {order.customer_signature ? "签名已采集" : "尚未签名"}
      </div>
    </section>
  );
}

function DeviceIssuePanel({
  order,
  deviceBrand,
  deviceModel,
  deviceImei,
  deviceNotes,
  accessoryNotes,
  defaultWarrantyMonths,
  onQuickImeiSave,
  quickImeiPending,
  edit,
  surface,
}: {
  order: OrderDetail["order"];
  deviceBrand: string;
  deviceModel: string;
  deviceImei: string;
  deviceNotes?: string;
  accessoryNotes?: string;
  defaultWarrantyMonths: number;
  onQuickImeiSave?: (imei: string) => void | Promise<void>;
  quickImeiPending: boolean;
  edit: OrderEditContext | null;
  surface: DetailSurface;
}) {
  return (
    <DetailPanel surface={surface}>
      <PanelHeader title="设备与故障" editing={Boolean(edit)} />
      <div className="min-w-0 space-y-2 sm:space-y-3">
        <section className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 md:grid-cols-1 lg:grid-cols-2">
          <DraftTextField
            field="device_brand"
            label="品牌"
            value={edit?.draft.device_brand ?? deviceBrand}
            required
            tone="hero"
            edit={edit}
            onChange={(value) => patchDraft(edit, { device_brand: value })}
          />
          <DraftTextField
            field="device_model"
            label="型号"
            value={edit?.draft.device_model ?? deviceModel}
            required
            tone="hero"
            edit={edit}
            onChange={(value) => patchDraft(edit, { device_model: value })}
          />
        </section>

        <ImeiField
          value={edit?.draft.device_imei ?? deviceImei}
          edit={edit}
          onQuickSave={onQuickImeiSave}
          quickPending={quickImeiPending}
        />

        <section className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 md:grid-cols-1 lg:grid-cols-2">
          <DraftTextField
            field="device_notes"
            label="设备备注"
            value={edit?.draft.device_notes ?? deviceNotes ?? ""}
            tone="note"
            emptyText="—"
            edit={edit}
            onChange={(value) => patchDraft(edit, { device_notes: value })}
          />
          <AccessoryNotesField
            value={edit?.draft.accessory_notes ?? accessoryNotes ?? ""}
            edit={edit}
            onChange={(value) => patchDraft(edit, { accessory_notes: value })}
          />
        </section>

        <Separator className="my-2 sm:my-3" />

        <section className="min-w-0 space-y-2 sm:space-y-3">
          <DraftTextField
            field="issue_description"
            label="故障描述"
            value={edit?.draft.issue_description ?? order.issue_description}
            required
            multiline
            tone="note"
            edit={edit}
            onChange={(value) => patchDraft(edit, { issue_description: value })}
          />
          <DraftTextField
            field="diagnosis_result"
            label="诊断结果"
            value={edit?.draft.diagnosis_result ?? order.diagnosis_result ?? ""}
            multiline
            tone="soft"
            emptyText="—"
            edit={edit}
            onChange={(value) => patchDraft(edit, { diagnosis_result: value })}
          />
          <WarrantyField order={order} edit={edit} defaultWarrantyMonths={defaultWarrantyMonths} />
        </section>
      </div>
    </DetailPanel>
  );
}

function AccessoryNotesField({
  value,
  edit,
  onChange,
}: {
  value: string;
  edit: OrderEditContext | null;
  onChange: (value: string) => void;
}) {
  return (
    <InfoField label="留存备注" tone="note">
      {edit ? (
        <AccessoryNotesPicker value={value} onChange={onChange} compact />
      ) : (
        <AccessoryNotesPills value={value} />
      )}
    </InfoField>
  );
}

function WarrantyField({
  order,
  edit,
  defaultWarrantyMonths,
}: {
  order: OrderDetail["order"];
  edit: OrderEditContext | null;
  defaultWarrantyMonths: number;
}) {
  const valueMonths = edit?.draft.warranty_months ?? order.warranty_months;
  const valueText = edit?.draft.warranty_text ?? order.warranty_text;
  const reason = edit?.draft.warranty_change_reason ?? order.warranty_change_reason;

  return (
    <InfoField label="质保" tone="soft">
      {edit ? (
        <WarrantyPicker
          valueMonths={valueMonths}
          valueText={valueText}
          reason={reason}
          defaultMonths={defaultWarrantyMonths}
          compact
          onChange={(warranty) =>
            patchDraft(edit, {
              warranty_months: warranty.warranty_months,
              warranty_text: warranty.warranty_text,
              warranty_change_reason: warranty.warranty_change_reason,
            })
          }
        />
      ) : (
        <div className="min-w-0 space-y-1">
          <WarrantyTag months={valueMonths} text={valueText} />
          {order.warranty_change_reason && (
            <div className="break-words text-[11px] text-muted-foreground">
              原因：{order.warranty_change_reason}
            </div>
          )}
        </div>
      )}
    </InfoField>
  );
}

function FinanceEditor({
  edit,
  normalizedDraft,
  error,
}: {
  edit: FinanceEditContext;
  normalizedDraft: ReturnType<typeof normalizeFinanceDraft>;
  error?: string;
}) {
  const selectedFaults = useMemo(
    () => normalizeFaultPrices(normalizedDraft.faultPrices),
    [normalizedDraft.faultPrices],
  );

  const patchFault = (index: number, patch: Partial<FinanceFaultDraft>) => {
    const nextFaults = [...edit.financeDraft.faults];
    nextFaults[index] = { ...nextFaults[index], ...patch };
    edit.onFinanceDraftChange({ ...edit.financeDraft, faults: nextFaults });
  };

  return (
    <section className="min-w-0 space-y-2 sm:space-y-3">
      <div>
        <h4 className="mb-1.5 text-[11px] font-semibold text-muted-foreground sm:mb-2 sm:text-xs">
          维修故障选项
        </h4>
        <FaultDiagnosisPicker
          selected={selectedFaults}
          onChange={(items) =>
            edit.onFinanceDraftChange({
              ...edit.financeDraft,
              faults: financeDraftFromPrices(toFaultPriceItems(items), { zeroAsEmpty: true }),
            })
          }
        />
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        {edit.financeDraft.faults.map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            className="grid min-w-0 gap-1.5 sm:grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)_32px] sm:gap-2"
          >
            <Input
              value={item.name}
              onChange={(event) => patchFault(index, { name: event.target.value })}
              placeholder="项目"
            />
            <Input
              type="text"
              inputMode="decimal"
              value={item.priceText}
              onChange={(event) => patchFault(index, { priceText: event.target.value })}
              className="font-mono"
              placeholder="金额"
            />
            <Input
              value={item.note}
              onChange={(event) => patchFault(index, { note: event.target.value })}
              placeholder="备注"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() =>
                edit.onFinanceDraftChange({
                  ...edit.financeDraft,
                  faults: edit.financeDraft.faults.filter((_, itemIndex) => itemIndex !== index),
                })
              }
              aria-label="删除报价项目"
            >
              <Trash2 className="size-3.5 text-muted-foreground" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs sm:h-8"
          onClick={() =>
            edit.onFinanceDraftChange({
              ...edit.financeDraft,
              faults: [...edit.financeDraft.faults, emptyFinanceFaultDraft()],
            })
          }
        >
          <Plus className="size-3.5" /> 添加项目
        </Button>
      </div>

      <InfoField label="押金" tone="metric">
        <Input
          type="text"
          inputMode="decimal"
          value={edit.financeDraft.depositText}
          onChange={(event) =>
            edit.onFinanceDraftChange({
              ...edit.financeDraft,
              depositText: event.target.value,
            })
          }
          className="h-7 font-mono sm:h-8"
        />
      </InfoField>

      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">保存修改时会和工单信息一起提交。</p>
    </section>
  );
}

function FinanceDisplay({ order }: { order: OrderDetail["order"] }) {
  return (
    <section className="min-w-0">
      <h4 className="mb-1.5 text-[11px] font-semibold text-muted-foreground sm:mb-2 sm:text-xs">
        报价项目
      </h4>
      {order.fault_prices.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/80 bg-surface-muted/20 p-2.5 text-xs text-muted-foreground sm:rounded-lg sm:p-3">
          暂无报价项目
        </div>
      ) : (
        <ul className="min-w-0 space-y-1">
          {order.fault_prices.map((item, index) => (
            <li
              key={`${item.name}-${index}`}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md border border-border/60 bg-surface-muted/35 px-2 py-1.5 sm:rounded-lg"
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-medium" title={item.name}>
                  {item.name}
                </div>
                {item.note && (
                  <div className="truncate text-[11px] text-muted-foreground" title={item.note}>
                    {item.note}
                  </div>
                )}
              </div>
              <MoneyText amount={item.price} className="whitespace-nowrap text-xs font-medium" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FinanceActions({
  order,
  onApproval,
  onPay,
  onNotify,
  onPrint,
}: {
  order: OrderDetail["order"];
  onApproval: () => void;
  onPay: () => void;
  onNotify: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 border-primary/25 bg-accent/30 px-2 text-xs text-accent-foreground hover:bg-accent/50"
        onClick={onApproval}
      >
        <Send className="size-3.5" /> 发送审批
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 bg-surface/70 px-2 text-xs"
        disabled={order.is_paid || order.balance_amount <= 0}
        onClick={onPay}
      >
        <CreditCard className="size-3.5" /> 收款
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 bg-surface/70 px-2 text-xs"
        onClick={onNotify}
      >
        <Bell className="size-3.5" /> 通知客户
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 bg-surface/70 px-2 text-xs"
        onClick={onPrint}
      >
        <Printer className="size-3.5" /> 打印
      </Button>
    </div>
  );
}

function DraftTextField({
  field,
  label,
  value,
  edit,
  onChange,
  required,
  multiline,
  inputMode,
  emptyText = "—",
  tone = "plain",
  className,
  renderDisplay,
}: {
  field: OrderEditableField;
  label: string;
  value: string;
  edit: OrderEditContext | null;
  onChange: (value: string) => void;
  required?: boolean;
  multiline?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  emptyText?: string;
  tone?: InfoTone;
  className?: string;
  renderDisplay?: (value: string) => React.ReactNode;
}) {
  const isActive = edit?.activeField === field;
  const displayNode = value.trim() ? renderDisplay?.(value) : null;

  if (!edit || !isActive) {
    return (
      <InfoField label={label} tone={tone}>
        {edit ? (
          <button
            type="button"
            className={cn(
              "group flex min-h-5 w-full min-w-0 items-start justify-between gap-2 rounded-md text-left outline-none transition-colors hover:text-primary focus-visible:ring-1 focus-visible:ring-ring",
              !value.trim() && "text-muted-foreground",
              className,
            )}
            onClick={() => edit.onActiveFieldChange(field)}
          >
            <span className="min-w-0 flex-1 break-words">
              {displayNode ?? <ReadonlyValue value={value} emptyText={emptyText} />}
            </span>
            <span className="shrink-0 text-[10px] font-medium text-primary opacity-70 group-hover:opacity-100">
              编辑
            </span>
          </button>
        ) : (
          (displayNode ?? (
            <ReadonlyValue value={value} emptyText={emptyText} className={className} />
          ))
        )}
      </InfoField>
    );
  }

  return (
    <InfoField label={`${label}${required ? " *" : ""}`} tone={tone}>
      {multiline ? (
        <Textarea
          value={value}
          rows={3}
          className={cn("min-h-16 resize-y text-[13px] sm:min-h-20 sm:text-sm", className)}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          value={value}
          inputMode={inputMode}
          className={cn("h-7 text-[13px] sm:h-8 sm:text-sm", className)}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </InfoField>
  );
}

function ImeiField({
  value,
  edit,
  onQuickSave,
  quickPending,
}: {
  value: string;
  edit: OrderEditContext | null;
  onQuickSave?: (imei: string) => void | Promise<void>;
  quickPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  if (edit) {
    return (
      <InfoField label="IMEI / 序列号" tone="soft">
        <ImeiScannerField
          value={value}
          onChange={(device_imei) => patchDraft(edit, { device_imei })}
          placeholder="扫描或输入 IMEI / 序列号"
          density="compact"
        />
      </InfoField>
    );
  }

  return (
    <InfoField label="IMEI / 序列号" tone="soft">
      <div className="flex min-w-0 items-center gap-1.5">
        <ReadonlyValue value={value} className="min-w-0 flex-1 font-mono" />
        <Popover
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (nextOpen) setDraft(value);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7 shrink-0"
              aria-label="扫码录入 IMEI / 序列号"
            >
              <Camera className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(22rem,calc(100vw-24px))]">
            <div className="mb-2 text-xs font-semibold">扫码录入 IMEI / 序列号</div>
            <ImeiScannerField
              value={draft}
              onChange={setDraft}
              placeholder="扫描或输入 IMEI / 序列号"
              density="compact"
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={quickPending || !onQuickSave}
                onClick={async () => {
                  await onQuickSave?.(draft);
                  setOpen(false);
                }}
              >
                {quickPending ? "保存中…" : "保存 IMEI"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </InfoField>
  );
}

function patchDraft(edit: OrderEditContext | null, patch: Partial<UpdateOrderInput>) {
  if (!edit) return;
  edit.onDraftChange({ ...edit.draft, ...patch });
}

function PanelHeader({ title, editing }: { title: string; editing?: boolean }) {
  const dense = useDenseDetail();
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between gap-2",
        dense ? "mb-1.5" : "mb-2 sm:mb-3",
      )}
    >
      <h3
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 font-semibold",
          dense ? "text-xs" : "text-[13px] sm:gap-2 sm:text-sm",
        )}
      >
        <span className="size-1.5 shrink-0 rounded-full bg-primary/70" />
        <span className="truncate">{title}</span>
      </h3>
      {editing && (
        <span
          className={cn(
            "hidden rounded-full border border-primary/20 bg-accent/25 px-1.5 py-0.5 text-primary sm:inline",
            dense ? "text-[10px]" : "text-[11px]",
          )}
        >
          选择字段编辑
        </span>
      )}
    </div>
  );
}

function DockMoney({
  label,
  amount,
  strong,
  expanded,
}: {
  label: string;
  amount: number;
  strong?: boolean;
  expanded?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border border-border/60 bg-surface-muted/25 px-2 py-1",
        expanded && "rounded-lg px-2.5 py-2",
        strong && "border-primary/20 bg-accent/25",
      )}
    >
      <div className="truncate text-[10px] font-medium leading-none text-muted-foreground">
        {label}
      </div>
      <MoneyText
        amount={amount}
        className={cn(
          "mt-0.5 block truncate font-mono text-[13px] leading-tight",
          expanded && "text-sm sm:text-base",
          strong && "font-semibold text-foreground",
        )}
      />
    </div>
  );
}

function ReadonlyValue({
  value,
  emptyText = "—",
  className,
}: {
  value?: string | null;
  emptyText?: string;
  className?: string;
}) {
  const displayValue = value?.trim() ?? "";
  return (
    <span
      className={cn(
        "block min-h-5 min-w-0 break-words",
        !displayValue && "text-muted-foreground",
        className,
      )}
      title={displayValue || undefined}
    >
      {displayValue || emptyText}
    </span>
  );
}

function InfoField({
  label,
  children,
  tone = "plain",
}: {
  label: string;
  children: React.ReactNode;
  tone?: InfoTone;
}) {
  const dense = useDenseDetail();
  const fieldPadding = dense
    ? "rounded-md px-2 py-1"
    : "rounded-md px-2 py-1.5 sm:rounded-lg sm:px-2.5 sm:py-2";
  return (
    <div
      className={cn(
        "min-w-0",
        tone === "hero" && "border border-border/70 bg-surface-muted/30",
        tone === "soft" && "border border-border/60 bg-surface-muted/20",
        tone === "note" && "border border-border/70 bg-surface-muted/35",
        tone === "metric" && "border border-border/60 bg-surface-muted/25",
        tone === "metricStrong" && "border border-primary/20 bg-accent/25",
        tone !== "plain" && fieldPadding,
      )}
    >
      <div
        className={cn(
          "font-medium text-muted-foreground",
          dense ? "text-[10px]" : "text-[10px] sm:text-[11px]",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 min-w-0 break-words leading-snug",
          dense ? "text-[12px]" : "text-[13px] sm:text-sm",
          tone === "hero" && "font-semibold text-foreground",
          tone === "note" && "text-foreground",
          !dense && tone === "note" && "sm:leading-relaxed",
          tone === "metricStrong" && "text-foreground",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] gap-1.5 rounded-md border border-border/50 bg-surface-muted/25 px-2 py-1 text-[11px] sm:grid-cols-[74px_minmax(0,1fr)] sm:gap-2 sm:rounded-lg sm:py-1.5 sm:text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className="min-w-0 truncate text-right text-foreground"
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
