"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Phone,
  Plus,
  Printer,
  RotateCcw,
  Send,
  Signature,
  Trash2,
  X,
} from "lucide-react";

import { ImeiScannerField } from "@/components/imei-scanner-field";
import { ApprovalBadge, MoneyText, PhoneText } from "@/components/orders/badges";
import {
  FaultDiagnosisPicker,
  normalizeFaultPrices,
  toFaultPriceItems,
} from "@/components/orders/fault-diagnosis-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { inferOrderPaidAmount } from "@/features/orders/model/edit-order-form";
import { fadeUp } from "@/lib/motion";
import type {
  Customer,
  FaultPriceItem,
  OrderDetail,
  PatchOrderFinanceInput,
  PatchOrderInput,
  Supplier,
} from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";

type SaveStatus = "idle" | "saving" | "saved" | "error" | "invalid";

const normalizeText = (value: string) => value.trim();
const overviewPanelClass =
  "min-w-0 overflow-hidden border-border/70 bg-card/95 p-2.5 shadow-sm sm:p-4";

export function OrderOverviewTab({
  order,
  customer,
  deviceBrand,
  deviceModel,
  deviceImei,
  deviceNotes,
  accessoryNotes,
  onPatch,
  onFinanceSave,
  financeBusy,
  onApproval,
  onPay,
  onNotify,
  onPrint,
}: {
  order: OrderDetail["order"];
  customer?: Customer;
  deviceBrand: string;
  deviceModel: string;
  deviceImei: string;
  deviceNotes?: string;
  accessoryNotes?: string;
  onPatch: (changes: PatchOrderInput["changes"]) => Promise<unknown>;
  onFinanceSave: (input: Omit<PatchOrderFinanceInput, "expected_updated_at">) => Promise<unknown>;
  financeBusy: boolean;
  onApproval: () => void;
  onPay: () => void;
  onNotify: () => void;
  onPrint: () => void;
}) {
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
          onPatch={onPatch}
        />
        <FinancePanel
          order={order}
          busy={financeBusy}
          onFinanceSave={onFinanceSave}
          onApproval={onApproval}
          onPay={onPay}
          onNotify={onNotify}
          onPrint={onPrint}
        />
      </div>

      <div className="hidden min-w-0 gap-2 sm:gap-3 md:grid md:grid-cols-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(270px,0.95fr)] xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(300px,0.95fr)]">
        <CustomerPanel order={order} customer={customer} onPatch={onPatch} />
        <DeviceIssuePanel
          order={order}
          deviceBrand={deviceBrand}
          deviceModel={deviceModel}
          deviceImei={deviceImei}
          deviceNotes={deviceNotes}
          accessoryNotes={accessoryNotes}
          onPatch={onPatch}
        />
        <FinancePanel
          order={order}
          busy={financeBusy}
          onFinanceSave={onFinanceSave}
          onApproval={onApproval}
          onPay={onPay}
          onNotify={onNotify}
          onPrint={onPrint}
        />
      </div>
    </motion.div>
  );
}

export function OrderKeyInfoCard({
  order,
  supplier,
  className,
}: {
  order: OrderDetail["order"];
  supplier?: Supplier;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0 overflow-hidden p-3 sm:p-4", className)}>
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
    </Card>
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
  onPatch,
}: {
  order: OrderDetail["order"];
  customer?: Customer;
  deviceBrand: string;
  deviceModel: string;
  deviceImei: string;
  deviceNotes?: string;
  accessoryNotes?: string;
  onPatch: (changes: PatchOrderInput["changes"]) => Promise<unknown>;
}) {
  return (
    <Card className={overviewPanelClass}>
      <PanelHeader title="核心信息" />
      <div className="min-w-0 space-y-2 sm:space-y-3">
        <section className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
          <InlineEditableField
            label="客户"
            value={customer?.name || order.customer_name || ""}
            required
            tone="hero"
            emptyText="-"
            onSave={(customer_name) => onPatch({ customer_name })}
          />
          <InlineEditableField
            label="技师"
            value={order.technician_name || ""}
            required
            tone="soft"
            emptyText="—"
            onSave={(technician_name) => onPatch({ technician_name })}
          />
        </section>

        <InlineEditableField
          label="主电话"
          value={customer?.phone_e164 ?? order.customer_phone ?? ""}
          required
          tone="soft"
          inputMode="tel"
          className="font-mono"
          renderDisplay={(value) => (
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <Phone className="size-3 shrink-0" />
              <PhoneText value={value} />
            </span>
          )}
          onSave={(customer_phone) => onPatch({ customer_phone })}
        />

        {!!order.contact_phones.length && (
          <InfoField label="备用联系电话">
            <div className="flex min-w-0 flex-wrap gap-1">
              {order.contact_phones.map((phone) => (
                <span
                  key={phone}
                  className="max-w-full truncate rounded-md border border-border/70 bg-surface-muted/70 px-1.5 py-0.5 font-mono text-[11px]"
                  title={phone}
                >
                  {phone}
                </span>
              ))}
            </div>
          </InfoField>
        )}

        <Separator className="my-2 sm:my-3" />

        <section className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
          <InlineEditableField
            label="品牌"
            value={deviceBrand}
            required
            tone="hero"
            onSave={(device_brand) => onPatch({ device_brand })}
          />
          <InlineEditableField
            label="型号"
            value={deviceModel}
            required
            tone="hero"
            onSave={(device_model) => onPatch({ device_model })}
          />
        </section>

        <InlineImeiScannerField
          label="IMEI / 序列号"
          value={deviceImei}
          onSave={(device_imei) => onPatch({ device_imei })}
        />

        <section className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
          <InlineEditableField
            label="设备备注"
            value={deviceNotes ?? ""}
            tone="note"
            emptyText="点击添加设备备注"
            onSave={(device_notes) => onPatch({ device_notes })}
          />
          <InlineEditableField
            label="留存备注"
            value={accessoryNotes ?? ""}
            tone="note"
            emptyText="SIM卡托、手机壳、充电器"
            onSave={(accessory_notes) => onPatch({ accessory_notes })}
          />
        </section>

        <Separator className="my-2 sm:my-3" />

        <section className="min-w-0 space-y-2 sm:space-y-3">
          <InlineEditableField
            label="故障描述"
            value={order.issue_description || ""}
            required
            multiline
            tone="note"
            onSave={(issue_description) => onPatch({ issue_description })}
          />
          <InlineEditableField
            label="诊断结果"
            value={order.diagnosis_result || ""}
            multiline
            tone="soft"
            emptyText="尚未填写"
            onSave={(diagnosis_result) => onPatch({ diagnosis_result })}
          />
          <InlineEditableField
            label="质保"
            value={order.warranty_text || ""}
            tone="soft"
            emptyText="点击添加质保"
            onSave={(warranty_text) => onPatch({ warranty_text })}
          />
        </section>

        <Separator className="my-2 sm:my-3" />
        <CustomerSignatureSection order={order} />
      </div>
    </Card>
  );
}

function CustomerPanel({
  order,
  customer,
  onPatch,
}: {
  order: OrderDetail["order"];
  customer?: Customer;
  onPatch: (changes: PatchOrderInput["changes"]) => Promise<unknown>;
}) {
  return (
    <Card className={overviewPanelClass}>
      <PanelHeader title="客户信息" />
      <div className="min-w-0 space-y-2 sm:space-y-3">
        <section className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 md:grid-cols-1">
          <InlineEditableField
            label="客户"
            value={customer?.name || order.customer_name || ""}
            required
            tone="hero"
            emptyText="-"
            onSave={(customer_name) => onPatch({ customer_name })}
          />
          <InlineEditableField
            label="技师"
            value={order.technician_name || ""}
            required
            tone="soft"
            emptyText="—"
            onSave={(technician_name) => onPatch({ technician_name })}
          />
        </section>

        <InlineEditableField
          label="主电话"
          value={customer?.phone_e164 ?? order.customer_phone ?? ""}
          required
          tone="soft"
          inputMode="tel"
          className="font-mono"
          renderDisplay={(value) => (
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <Phone className="size-3 shrink-0" />
              <PhoneText value={value} />
            </span>
          )}
          onSave={(customer_phone) => onPatch({ customer_phone })}
        />

        {!!order.contact_phones.length && (
          <InfoField label="备用联系电话">
            <div className="flex min-w-0 flex-wrap gap-1">
              {order.contact_phones.map((phone) => (
                <span
                  key={phone}
                  className="max-w-full truncate rounded-md border border-border/70 bg-surface-muted/70 px-1.5 py-0.5 font-mono text-[11px]"
                  title={phone}
                >
                  {phone}
                </span>
              ))}
            </div>
          </InfoField>
        )}

        <Separator className="my-2 sm:my-3" />
        <CustomerSignatureSection order={order} />
      </div>
    </Card>
  );
}

function CustomerSignatureSection({ order }: { order: OrderDetail["order"] }) {
  return (
    <section className="min-w-0">
      <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2 sm:mb-2">
        <h4 className="text-[11px] font-semibold text-muted-foreground sm:text-xs">客户签名</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 gap-1 px-1.5 text-[11px] sm:h-7 sm:px-2 sm:text-xs"
        >
          <Signature className="size-3" />
          {order.customer_signature ? "重新签名" : "请客户签名"}
        </Button>
      </div>
      <div
        className={cn(
          "flex h-16 items-center justify-center rounded-md border border-dashed border-border/80 bg-surface-muted/20 text-xs text-muted-foreground sm:h-24 sm:rounded-lg",
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
  onPatch,
}: {
  order: OrderDetail["order"];
  deviceBrand: string;
  deviceModel: string;
  deviceImei: string;
  deviceNotes?: string;
  accessoryNotes?: string;
  onPatch: (changes: PatchOrderInput["changes"]) => Promise<unknown>;
}) {
  return (
    <Card className={overviewPanelClass}>
      <PanelHeader title="设备与故障" />
      <div className="min-w-0 space-y-2 sm:space-y-3">
        <section className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 md:grid-cols-1 lg:grid-cols-2">
          <InlineEditableField
            label="品牌"
            value={deviceBrand}
            required
            tone="hero"
            onSave={(device_brand) => onPatch({ device_brand })}
          />
          <InlineEditableField
            label="型号"
            value={deviceModel}
            required
            tone="hero"
            onSave={(device_model) => onPatch({ device_model })}
          />
        </section>

        <InlineImeiScannerField
          label="IMEI / 序列号"
          value={deviceImei}
          onSave={(device_imei) => onPatch({ device_imei })}
        />

        <section className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 md:grid-cols-1 lg:grid-cols-2">
          <InlineEditableField
            label="设备备注"
            value={deviceNotes ?? ""}
            tone="note"
            emptyText="点击添加设备备注"
            onSave={(device_notes) => onPatch({ device_notes })}
          />
          <InlineEditableField
            label="留存备注"
            value={accessoryNotes ?? ""}
            tone="note"
            emptyText="SIM卡托、手机壳、充电器"
            onSave={(accessory_notes) => onPatch({ accessory_notes })}
          />
        </section>

        <Separator className="my-2 sm:my-3" />

        <section className="min-w-0 space-y-2 sm:space-y-3">
          <InlineEditableField
            label="故障描述"
            value={order.issue_description || ""}
            required
            multiline
            tone="note"
            onSave={(issue_description) => onPatch({ issue_description })}
          />
          <InlineEditableField
            label="诊断结果"
            value={order.diagnosis_result || ""}
            multiline
            tone="soft"
            emptyText="尚未填写"
            onSave={(diagnosis_result) => onPatch({ diagnosis_result })}
          />
          <InlineEditableField
            label="质保"
            value={order.warranty_text || ""}
            tone="soft"
            emptyText="点击添加质保"
            onSave={(warranty_text) => onPatch({ warranty_text })}
          />
        </section>
      </div>
    </Card>
  );
}

function FinancePanel({
  order,
  busy,
  onFinanceSave,
  onApproval,
  onPay,
  onNotify,
  onPrint,
}: {
  order: OrderDetail["order"];
  busy: boolean;
  onFinanceSave: (input: Omit<PatchOrderFinanceInput, "expected_updated_at">) => Promise<unknown>;
  onApproval: () => void;
  onPay: () => void;
  onNotify: () => void;
  onPrint: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [faults, setFaults] = useState<FaultPriceItem[]>(order.fault_prices);
  const [deposit, setDeposit] = useState(order.deposit_amount);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) {
      setFaults(order.fault_prices);
      setDeposit(order.deposit_amount);
      setError("");
    }
  }, [editing, order.deposit_amount, order.fault_prices]);

  const paidAmount = inferOrderPaidAmount(order);
  const quotation = useMemo(
    () => faults.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    [faults],
  );
  const nextBalance = Math.max(0, quotation - Number(deposit || 0) - paidAmount);
  const selectedFaults = useMemo(() => normalizeFaultPrices(faults), [faults]);
  const validFaults = faults.filter((item) => item.name.trim() || Number(item.price) > 0);
  const canSave =
    !busy &&
    validFaults.every((item) => item.name.trim() && Number(item.price) >= 0) &&
    Number(deposit) >= 0 &&
    Number(deposit) <= quotation;

  const patchFault = (index: number, patch: Partial<FaultPriceItem>) => {
    const next = [...faults];
    next[index] = { ...next[index], ...patch };
    setFaults(next);
    setError("");
  };

  const saveFinance = async () => {
    if (!canSave) {
      setError("请检查报价项目名称、金额和押金。");
      return;
    }
    try {
      await onFinanceSave({
        fault_prices: validFaults.map((item) => ({
          name: item.name.trim(),
          price: Number(item.price),
          ...(item.note?.trim() ? { note: item.note.trim() } : {}),
        })),
        deposit_amount: Number(deposit || 0),
      });
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    }
  };

  return (
    <Card className="min-w-0 overflow-hidden border-primary/15 bg-card/95 p-2.5 shadow-sm sm:p-4 md:col-span-2 lg:col-span-1">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2 sm:mb-3">
        <h3 className="text-[13px] font-semibold sm:text-sm">报价与处理</h3>
        <div className="flex shrink-0 items-center gap-2">
          <ApprovalBadge status={order.approval_status} />
          {!editing && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setEditing(true)}
            >
              编辑金额
            </Button>
          )}
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-1.5 text-sm sm:gap-2">
        <MoneyBlock label="总报价" amount={editing ? quotation : order.quotation_amount} strong />
        <MoneyBlock label="尾款" amount={editing ? nextBalance : order.balance_amount} strong />
        <MoneyBlock label="押金" amount={editing ? Number(deposit || 0) : order.deposit_amount} />
        <InfoField label="结清状态">
          {(editing ? nextBalance === 0 : order.is_paid) ? (
            <span className="inline-flex items-center gap-1 text-status-success-foreground">
              <CheckCircle2 className="size-3.5" /> 已结清
            </span>
          ) : (
            <span className="text-muted-foreground">未结清</span>
          )}
        </InfoField>
      </div>

      {editing && (
        <div className="mt-2 rounded-md border border-border/60 bg-surface-muted/20 px-2 py-1.5 text-xs text-muted-foreground sm:rounded-lg sm:px-2.5 sm:py-2">
          已付金额 <MoneyText amount={paidAmount} className="font-medium text-foreground" />
        </div>
      )}

      <Separator className="my-2 sm:my-3" />

      {editing ? (
        <section className="min-w-0 space-y-2 sm:space-y-3">
          <div>
            <h4 className="mb-1.5 text-[11px] font-semibold text-muted-foreground sm:mb-2 sm:text-xs">
              维修故障选项
            </h4>
            <FaultDiagnosisPicker
              selected={selectedFaults}
              onChange={(items) => {
                setFaults(toFaultPriceItems(items));
                setError("");
              }}
            />
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            {faults.map((item, index) => (
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
                  type="number"
                  min={0}
                  value={item.price}
                  onChange={(event) => patchFault(index, { price: Number(event.target.value) })}
                  className="font-mono"
                  placeholder="金额"
                />
                <Input
                  value={item.note ?? ""}
                  onChange={(event) => patchFault(index, { note: event.target.value })}
                  placeholder="备注"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => {
                    setFaults(faults.filter((_, itemIndex) => itemIndex !== index));
                    setError("");
                  }}
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
              onClick={() => setFaults([...faults, { name: "", price: 0 }])}
            >
              <Plus className="size-3.5" /> 添加项目
            </Button>
          </div>
          <InfoField label="押金" tone="metric">
            <Input
              type="number"
              min={0}
              value={deposit}
              onChange={(event) => {
                setDeposit(Number(event.target.value));
                setError("");
              }}
              className="h-7 font-mono sm:h-8"
            />
          </InfoField>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={!canSave}
              onClick={() => void saveFinance()}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <SaveIcon />}
              确认更新金额
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                setEditing(false);
                setError("");
              }}
            >
              <X className="size-3.5" /> 取消
            </Button>
          </div>
        </section>
      ) : (
        <FinanceDisplay
          order={order}
          onApproval={onApproval}
          onPay={onPay}
          onNotify={onNotify}
          onPrint={onPrint}
        />
      )}
    </Card>
  );
}

function FinanceDisplay({
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
    <>
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

      <div className="mt-2 grid min-w-0 grid-cols-2 gap-1.5 sm:mt-3 sm:gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 border-primary/25 bg-accent/30 px-2 text-xs text-accent-foreground hover:bg-accent/50 sm:h-8"
          onClick={onApproval}
        >
          <Send className="size-3.5" /> 发送审批
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 bg-surface/70 px-2 text-xs sm:h-8"
          disabled={order.is_paid || order.balance_amount <= 0}
          onClick={onPay}
        >
          <CreditCard className="size-3.5" /> 收款
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 bg-surface/70 px-2 text-xs sm:h-8"
          onClick={onNotify}
        >
          <Bell className="size-3.5" /> 通知客户
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 bg-surface/70 px-2 text-xs sm:h-8"
          onClick={onPrint}
        >
          <Printer className="size-3.5" /> 打印
        </Button>
      </div>
    </>
  );
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="mb-2 flex min-w-0 items-center justify-between gap-2 sm:mb-3">
      <h3 className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold sm:gap-2 sm:text-sm">
        <span className="size-1.5 shrink-0 rounded-full bg-primary/70" />
        <span className="truncate">{title}</span>
      </h3>
      <span className="hidden text-[11px] text-muted-foreground sm:inline">点击字段编辑</span>
    </div>
  );
}

function MoneyBlock({
  label,
  amount,
  strong,
}: {
  label: string;
  amount: number;
  strong?: boolean;
}) {
  return (
    <InfoField label={label} tone={strong ? "metricStrong" : "metric"}>
      <MoneyText
        amount={amount}
        className={cn(
          "font-medium tabular-nums",
          strong && "text-[15px] font-semibold sm:text-base",
        )}
      />
    </InfoField>
  );
}

function InlineEditableField({
  label,
  value,
  onSave,
  required,
  multiline,
  inputMode,
  placeholder,
  emptyText = "点击填写",
  tone = "plain",
  className,
  renderDisplay,
  renderEditor,
}: {
  label: string;
  value: string;
  onSave: (value: string) => Promise<unknown>;
  required?: boolean;
  multiline?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
  emptyText?: string;
  tone?: InfoTone;
  className?: string;
  renderDisplay?: (value: string) => React.ReactNode;
  renderEditor?: (input: { value: string; onChange: (value: string) => void }) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");
  const lastSavedRef = useRef(normalizeText(value));
  const pendingValueRef = useRef<string | null>(null);
  const pendingPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    lastSavedRef.current = normalizeText(value);
    if (!editing) setDraft(value);
  }, [editing, value]);

  useEffect(() => {
    if (status !== "saved") return;
    const timer = window.setTimeout(() => setStatus("idle"), 1400);
    return () => window.clearTimeout(timer);
  }, [status]);

  const commit = useCallback(
    async (opts: { close?: boolean } = {}) => {
      const nextValue = normalizeText(draft);
      if (required && !nextValue) {
        setStatus("invalid");
        setError(`${label}不能为空`);
        return;
      }
      if (nextValue === lastSavedRef.current) {
        setStatus("idle");
        setError("");
        if (opts.close) setEditing(false);
        return;
      }
      if (pendingPromiseRef.current && pendingValueRef.current === nextValue) {
        return pendingPromiseRef.current;
      }

      setStatus("saving");
      setError("");
      pendingValueRef.current = nextValue;
      const promise = onSave(nextValue)
        .then(() => {
          lastSavedRef.current = nextValue;
          setStatus("saved");
          if (opts.close) setEditing(false);
        })
        .catch((saveError) => {
          setStatus("error");
          setError(saveError instanceof Error ? saveError.message : "保存失败");
          throw saveError;
        })
        .finally(() => {
          pendingValueRef.current = null;
          pendingPromiseRef.current = null;
        });
      pendingPromiseRef.current = promise;
      return promise;
    },
    [draft, label, onSave, required],
  );

  useEffect(() => {
    if (!editing) return;
    const timer = window.setTimeout(() => {
      void commit().catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [commit, draft, editing]);

  const cancel = () => {
    setDraft(lastSavedRef.current);
    setStatus("idle");
    setError("");
    setEditing(false);
  };

  const statusNode = (
    <SaveStatusText
      status={status}
      error={error}
      onRetry={() => void commit().catch(() => undefined)}
    />
  );

  if (editing) {
    return (
      <InfoField label={label} tone={tone}>
        <div
          className="space-y-1 sm:space-y-1.5"
          onBlur={(event) => {
            const nextFocus = event.relatedTarget;
            if (nextFocus instanceof Node && event.currentTarget.contains(nextFocus)) return;
            void commit({ close: true }).catch(() => undefined);
          }}
        >
          {renderEditor ? (
            renderEditor({ value: draft, onChange: setDraft })
          ) : multiline ? (
            <Textarea
              value={draft}
              rows={3}
              placeholder={placeholder}
              className={cn("min-h-16 resize-y text-[13px] sm:min-h-20 sm:text-sm", className)}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancel();
                }
              }}
              autoFocus
            />
          ) : (
            <Input
              value={draft}
              placeholder={placeholder}
              inputMode={inputMode}
              className={cn("h-7 text-[13px] sm:h-8 sm:text-sm", className)}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancel();
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  void commit({ close: true }).catch(() => undefined);
                }
              }}
              autoFocus
            />
          )}
          <div className="flex min-w-0 items-center justify-between gap-2">
            {statusNode}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-[11px]"
              onClick={cancel}
            >
              <X className="size-3" /> 取消
            </Button>
          </div>
        </div>
      </InfoField>
    );
  }

  const displayValue = lastSavedRef.current || "";
  return (
    <InfoField label={label} tone={tone}>
      <button
        type="button"
        className={cn(
          "block min-h-5 w-full rounded-md text-left outline-none transition-colors hover:text-primary focus-visible:ring-1 focus-visible:ring-ring",
          !displayValue && "text-muted-foreground",
        )}
        onClick={() => {
          setDraft(displayValue);
          setEditing(true);
        }}
      >
        {displayValue ? (renderDisplay ? renderDisplay(displayValue) : displayValue) : emptyText}
      </button>
      {statusNode}
    </InfoField>
  );
}

function InlineImeiScannerField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (value: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");
  const lastSavedRef = useRef(normalizeText(value));
  const pendingValueRef = useRef<string | null>(null);
  const pendingPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    lastSavedRef.current = normalizeText(value);
    setDraft(value);
    setError("");
    setStatus("idle");
  }, [value]);

  useEffect(() => {
    if (status !== "saved") return;
    const timer = window.setTimeout(() => setStatus("idle"), 1400);
    return () => window.clearTimeout(timer);
  }, [status]);

  const commit = useCallback(async () => {
    const nextValue = normalizeText(draft);
    if (nextValue === lastSavedRef.current) {
      setStatus("idle");
      setError("");
      return;
    }
    if (pendingPromiseRef.current && pendingValueRef.current === nextValue) {
      return pendingPromiseRef.current;
    }

    setStatus("saving");
    setError("");
    pendingValueRef.current = nextValue;
    const promise = onSave(nextValue)
      .then(() => {
        lastSavedRef.current = nextValue;
        setStatus("saved");
      })
      .catch((saveError) => {
        setStatus("error");
        setError(saveError instanceof Error ? saveError.message : "保存失败");
        throw saveError;
      })
      .finally(() => {
        pendingValueRef.current = null;
        pendingPromiseRef.current = null;
      });
    pendingPromiseRef.current = promise;
    return promise;
  }, [draft, onSave]);

  useEffect(() => {
    const nextValue = normalizeText(draft);
    if (nextValue === lastSavedRef.current) return;
    const timer = window.setTimeout(() => {
      void commit().catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [commit, draft]);

  return (
    <InfoField label={label} tone="soft">
      <div
        className="space-y-1"
        onBlur={(event) => {
          const nextFocus = event.relatedTarget;
          if (nextFocus instanceof Node && event.currentTarget.contains(nextFocus)) return;
          void commit().catch(() => undefined);
        }}
      >
        <ImeiScannerField
          value={draft}
          onChange={setDraft}
          placeholder="扫描或输入 IMEI / 序列号"
          density="compact"
        />
        <SaveStatusText
          status={status}
          error={error}
          onRetry={() => void commit().catch(() => undefined)}
        />
      </div>
    </InfoField>
  );
}

function SaveStatusText({
  status,
  error,
  onRetry,
}: {
  status: SaveStatus;
  error: string;
  onRetry: () => void;
}) {
  if (status === "idle") return null;
  if (status === "saving") {
    return (
      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground sm:mt-1">
        <Loader2 className="size-3 animate-spin" /> 保存中…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-status-success-foreground sm:mt-1">
        <Check className="size-3" /> 已保存
      </span>
    );
  }
  return (
    <span className="mt-0.5 inline-flex min-w-0 flex-wrap items-center gap-1 text-[11px] text-destructive sm:mt-1">
      {error || "保存失败"}
      {status === "error" && (
        <button
          type="button"
          className="inline-flex items-center gap-1 underline"
          onClick={onRetry}
        >
          <RotateCcw className="size-3" /> 重试
        </button>
      )}
    </span>
  );
}

type InfoTone = "plain" | "hero" | "soft" | "note" | "metric" | "metricStrong";

function InfoField({
  label,
  children,
  tone = "plain",
}: {
  label: string;
  children: React.ReactNode;
  tone?: InfoTone;
}) {
  return (
    <div
      className={cn(
        "min-w-0",
        tone === "hero" &&
          "rounded-md border border-border/70 bg-surface-muted/30 px-2 py-1.5 sm:rounded-lg sm:px-2.5 sm:py-2",
        tone === "soft" &&
          "rounded-md border border-border/60 bg-surface-muted/20 px-2 py-1.5 sm:rounded-lg sm:px-2.5 sm:py-2",
        tone === "note" &&
          "rounded-md border border-border/70 bg-surface-muted/35 px-2 py-1.5 sm:rounded-lg sm:px-2.5 sm:py-2",
        tone === "metric" &&
          "rounded-md border border-border/60 bg-surface-muted/25 px-2 py-1.5 sm:rounded-lg sm:px-2.5 sm:py-2",
        tone === "metricStrong" &&
          "rounded-md border border-primary/20 bg-accent/25 px-2 py-1.5 sm:rounded-lg sm:px-2.5 sm:py-2",
      )}
    >
      <div className="text-[10px] font-medium text-muted-foreground sm:text-[11px]">{label}</div>
      <div
        className={cn(
          "mt-0.5 min-w-0 break-words text-[13px] leading-snug sm:text-sm",
          tone === "hero" && "font-semibold text-foreground",
          tone === "note" && "text-foreground sm:leading-relaxed",
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

function SaveIcon() {
  return <Check className="size-3.5" />;
}
