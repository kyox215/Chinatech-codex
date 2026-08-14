"use client";

import { useRef, useState } from "react";
import { Banknote, CalendarCheck, PackageCheck, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  InventoryLifecycleCommand,
  InventoryLifecycleSaleDetail,
} from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { InventoryConsequenceDialog } from "../../components/inventory-consequence-dialog";
import {
  InventoryLifecycleField,
  InventoryLifecycleValidationSummary,
  type InventoryLifecycleValidationIssue,
} from "./inventory-lifecycle-field-feedback";

const methods = [
  ["cash", "现金"],
  ["card", "银行卡"],
  ["bancomat", "Bancomat"],
  ["transfer", "转账"],
  ["other", "其他"],
] as const;

export function InventoryLifecycleSaleMoneyOverview({
  sale,
}: {
  sale: InventoryLifecycleSaleDetail;
}) {
  const facts = [
    ["约定售价", euro(sale.agreed_price)],
    ["累计已收", euro(sale.signed_paid_amount)],
    ["待收尾款", euro(sale.balance)],
    ["预计取走", formatDate(sale.expected_pickup_at)],
  ];
  return (
    <section className={cn(repairOs.mobileInfoCard, "p-3 sm:p-4")} aria-label="销售金额摘要">
      <div className="flex items-center gap-2">
        <Banknote className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold">金额与交付</h2>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-[var(--surface-panel-muted)] p-2.5">
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>
      {sale.payments.length ? (
        <div className="mt-3 border-t border-[var(--border-panel)] pt-2">
          <h3 className="text-[11px] font-semibold">不可变付款记录</h3>
          <ol className="mt-1.5 grid gap-1.5">
            {sale.payments.map((payment, index) => (
              <li
                key={`${payment.occurred_at}-${index}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px]"
              >
                <span>
                  {paymentKindLabel(payment.kind)} · {paymentMethodLabel(payment.method)}
                </span>
                <strong>
                  {["refund", "reversal"].includes(payment.kind) ? "−" : "+"}
                  {euro(payment.amount)}
                </strong>
                <time className="text-muted-foreground">{formatDate(payment.occurred_at)}</time>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

export type InventoryLifecycleSaleSubmit = (
  command: InventoryLifecycleCommand,
  payload: Record<string, unknown>,
) => void;

export function InventoryLifecycleSalePaymentPanel({
  sale,
  pending,
  writeBlocked,
  submit,
}: InventoryLifecycleSalePanelProps) {
  const [amount, setAmount] = useState(String(sale.balance));
  const [method, setMethod] = useState("cash");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationAttempt, setValidationAttempt] = useState(0);
  const validate = () => {
    const value = Number(amount.trim().replace(",", "."));
    const nextErrors: Record<string, string> = {};
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      nextErrors["inventory-sale-payment-amount"] = "请输入大于 0 的收款金额。";
    } else if (value > sale.balance) {
      nextErrors["inventory-sale-payment-amount"] = "收款金额不能超过当前待收余额。";
    }
    if (Object.keys(nextErrors).length > 0) setValidationAttempt((current) => current + 1);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  const issues: InventoryLifecycleValidationIssue[] = errors["inventory-sale-payment-amount"]
    ? [
        {
          fieldId: "inventory-sale-payment-amount",
          label: "本次收款",
          message: errors["inventory-sale-payment-amount"],
        },
      ]
    : [];
  return (
    <ActionCard icon={Banknote} title="追加收款" description="付款记录只追加，不可覆盖历史。">
      <InventoryLifecycleValidationSummary
        issues={issues}
        focusRequestKey={validationAttempt}
        onFocusField={(fieldId) => document.getElementById(fieldId)?.focus()}
      />
      <fieldset disabled={pending || writeBlocked} className="contents">
        <Field
          id="inventory-sale-payment-amount"
          label="本次收款"
          required
          error={errors["inventory-sale-payment-amount"]}
        >
          <Input
            id="inventory-sale-payment-amount"
            required
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setErrors({});
            }}
            aria-invalid={Boolean(errors["inventory-sale-payment-amount"]) || undefined}
            aria-describedby={
              errors["inventory-sale-payment-amount"]
                ? "inventory-sale-payment-amount-error"
                : undefined
            }
            className="h-11"
          />
        </Field>
        <Method value={method} onChange={setMethod} />
        <Button
          className="min-h-11"
          disabled={pending || writeBlocked}
          onClick={() => {
            if (!validate()) return;
            const value = Number(amount.trim().replace(",", "."));
            submit("payment.append", {
              sale_order_id: sale.sale_order_id,
              expected_order_version: sale.order_version,
              kind: "payment",
              amount: value,
              method,
            });
          }}
        >
          确认追加 {euro(Number(amount || 0))}
        </Button>
      </fieldset>
      {pending ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          正在处理收款，完成前不可重复提交。
        </p>
      ) : null}
    </ActionCard>
  );
}

export function CompleteSalePanel({
  sale,
  pending,
  writeBlocked,
  submit,
}: InventoryLifecycleSalePanelProps) {
  return (
    <ActionCard
      icon={PackageCheck}
      title="完成成交"
      description="仅在约定价与累计已收完全一致时可成交。"
    >
      <fieldset disabled={pending || writeBlocked} className="contents">
        <Button
          className="min-h-11"
          disabled={pending || writeBlocked || sale.balance !== 0}
          onClick={() =>
            submit("sale.complete", {
              sale_order_id: sale.sale_order_id,
              expected_order_version: sale.order_version,
              expected_unit_version: sale.unit_version,
            })
          }
        >
          完成销售并写入库存出库
        </Button>
      </fieldset>
    </ActionCard>
  );
}

export function InventoryLifecycleSalePickupPanel({
  sale,
  pending,
  writeBlocked,
  submit,
}: InventoryLifecycleSalePanelProps) {
  const [months, setMonths] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationAttempt, setValidationAttempt] = useState(0);
  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (
      months !== "" &&
      (!Number.isInteger(Number(months)) || Number(months) < 0 || Number(months) > 120)
    ) {
      nextErrors["inventory-sale-pickup-warranty-months"] = "请输入 0 到 120 的整数月数。";
    }
    if (sale.balance > 0 && reason.trim().length === 0) {
      nextErrors["inventory-sale-pickup-override-reason"] = "余额未清时必须填写例外原因。";
    }
    if (Object.keys(nextErrors).length > 0) setValidationAttempt((current) => current + 1);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  const issues: InventoryLifecycleValidationIssue[] = Object.entries(errors)
    .filter(([, message]) => Boolean(message))
    .map(([fieldId, message]) => ({
      fieldId,
      label: fieldId.endsWith("months") ? "商业保修（月）" : "余额未清例外原因",
      message,
    }));
  return (
    <ActionCard
      icon={CalendarCheck}
      title="确认客户取走"
      description="商业保修从实际取走时间开始；留空使用当前门店默认值。"
    >
      <InventoryLifecycleValidationSummary
        issues={issues}
        focusRequestKey={validationAttempt}
        onFocusField={(fieldId) => document.getElementById(fieldId)?.focus()}
      />
      <fieldset disabled={pending || writeBlocked} className="contents">
        <Field
          id="inventory-sale-pickup-warranty-months"
          label="商业保修（月）"
          error={errors["inventory-sale-pickup-warranty-months"]}
        >
          <Input
            id="inventory-sale-pickup-warranty-months"
            inputMode="numeric"
            placeholder="门店默认"
            value={months}
            onChange={(event) => {
              setMonths(event.target.value);
              setErrors((current) => {
                const next = { ...current };
                delete next["inventory-sale-pickup-warranty-months"];
                return next;
              });
            }}
            aria-invalid={Boolean(errors["inventory-sale-pickup-warranty-months"]) || undefined}
            aria-describedby={
              errors["inventory-sale-pickup-warranty-months"]
                ? "inventory-sale-pickup-warranty-months-error"
                : undefined
            }
            className="h-11"
          />
        </Field>
        {sale.balance > 0 ? (
          <Field
            id="inventory-sale-pickup-override-reason"
            label="余额未清例外原因"
            required
            error={errors["inventory-sale-pickup-override-reason"]}
          >
            <Textarea
              id="inventory-sale-pickup-override-reason"
              required
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setErrors((current) => {
                  const next = { ...current };
                  delete next["inventory-sale-pickup-override-reason"];
                  return next;
                });
              }}
              aria-invalid={Boolean(errors["inventory-sale-pickup-override-reason"]) || undefined}
              aria-describedby={
                errors["inventory-sale-pickup-override-reason"]
                  ? "inventory-sale-pickup-override-reason-error"
                  : undefined
              }
              className="min-h-20"
            />
          </Field>
        ) : null}
        <Button
          className="min-h-11"
          disabled={pending || writeBlocked}
          onClick={() => {
            if (!validate()) return;
            submit("pickup.confirm", {
              sale_order_id: sale.sale_order_id,
              expected_order_version: sale.order_version,
              ...(months === "" ? {} : { warranty_months: Number(months) }),
              ...(reason.trim() ? { override_reason: reason.trim() } : {}),
            });
          }}
        >
          确认已取走并开始保修
        </Button>
      </fieldset>
      {pending ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          正在处理取走确认，完成前不可重复提交。
        </p>
      ) : null}
    </ActionCard>
  );
}

export function WarrantyPanel({
  sale,
  pending,
  writeBlocked,
  submit,
}: InventoryLifecycleSalePanelProps) {
  const [months, setMonths] = useState(String(sale.commercial_warranty?.months ?? 12));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationAttempt, setValidationAttempt] = useState(0);
  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!Number.isInteger(Number(months)) || Number(months) < 0 || Number(months) > 120) {
      nextErrors["inventory-sale-warranty-months"] = "请输入 0 到 120 的整数月数。";
    }
    if (!reason.trim()) nextErrors["inventory-sale-warranty-reason"] = "请补充调整原因。";
    if (Object.keys(nextErrors).length > 0) setValidationAttempt((current) => current + 1);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  const issues: InventoryLifecycleValidationIssue[] = Object.entries(errors)
    .filter(([, message]) => Boolean(message))
    .map(([fieldId, message]) => ({
      fieldId,
      label: fieldId.endsWith("months") ? "新商业保修（月）" : "调整原因",
      message,
    }));
  return (
    <ActionCard
      icon={ShieldCheck}
      title="调整商业保修"
      description="法定保障保持独立；本操作新增版本，不覆盖历史。"
    >
      <InventoryLifecycleValidationSummary
        issues={issues}
        focusRequestKey={validationAttempt}
        onFocusField={(fieldId) => document.getElementById(fieldId)?.focus()}
      />
      <fieldset disabled={pending || writeBlocked} className="contents">
        <Field
          id="inventory-sale-warranty-months"
          label="新商业保修（月）"
          required
          error={errors["inventory-sale-warranty-months"]}
        >
          <Input
            id="inventory-sale-warranty-months"
            required
            inputMode="numeric"
            value={months}
            onChange={(event) => {
              setMonths(event.target.value);
              setErrors((current) => {
                const next = { ...current };
                delete next["inventory-sale-warranty-months"];
                return next;
              });
            }}
            aria-invalid={Boolean(errors["inventory-sale-warranty-months"]) || undefined}
            aria-describedby={
              errors["inventory-sale-warranty-months"]
                ? "inventory-sale-warranty-months-error"
                : undefined
            }
            className="h-11"
          />
        </Field>
        <Field
          id="inventory-sale-warranty-reason"
          label="调整原因"
          required
          error={errors["inventory-sale-warranty-reason"]}
        >
          <Textarea
            id="inventory-sale-warranty-reason"
            required
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setErrors((current) => {
                const next = { ...current };
                delete next["inventory-sale-warranty-reason"];
                return next;
              });
            }}
            aria-invalid={Boolean(errors["inventory-sale-warranty-reason"]) || undefined}
            aria-describedby={
              errors["inventory-sale-warranty-reason"]
                ? "inventory-sale-warranty-reason-error"
                : undefined
            }
            className="min-h-20"
          />
        </Field>
        <Button
          className="min-h-11"
          disabled={pending || writeBlocked}
          onClick={() => {
            if (!validate()) return;
            submit("warranty.adjust", {
              sale_order_id: sale.sale_order_id,
              expected_order_version: sale.order_version,
              expected_warranty_version: sale.warranty_version ?? 0,
              months: Number(months),
              reason: reason.trim(),
            });
          }}
        >
          保存新的商业保修版本
        </Button>
      </fieldset>
      {pending ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          正在保存商业保修，完成前不可重复提交。
        </p>
      ) : null}
    </ActionCard>
  );
}

export function AfterSalesIntakePanel({
  sale,
  pending,
  writeBlocked,
  submit,
}: InventoryLifecycleSalePanelProps) {
  const [issue, setIssue] = useState("");
  const [error, setError] = useState("");
  const [validationAttempt, setValidationAttempt] = useState(0);
  return (
    <ActionCard
      icon={RefreshCw}
      title="登记返修 / 售后"
      description="建立独立案件，不覆盖原销售与首次交付。"
    >
      <InventoryLifecycleValidationSummary
        issues={
          error
            ? [
                {
                  fieldId: "inventory-sale-after-sales-issue",
                  label: "客户反映问题",
                  message: error,
                },
              ]
            : []
        }
        focusRequestKey={validationAttempt}
        onFocusField={(fieldId) => document.getElementById(fieldId)?.focus()}
      />
      <fieldset disabled={pending || writeBlocked} className="contents">
        <Field id="inventory-sale-after-sales-issue" label="客户反映问题" required error={error}>
          <Textarea
            id="inventory-sale-after-sales-issue"
            required
            value={issue}
            onChange={(event) => {
              setIssue(event.target.value);
              setError("");
            }}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "inventory-sale-after-sales-issue-error" : undefined}
            className="min-h-24"
          />
        </Field>
        <Button
          className="min-h-11"
          disabled={pending || writeBlocked}
          onClick={() => {
            if (!issue.trim()) {
              setValidationAttempt((current) => current + 1);
              setError("请补充客户反映的问题。");
              return;
            }
            submit("after_sales.create", {
              sale_order_id: sale.sale_order_id,
              expected_order_version: sale.order_version,
              issue_summary: issue.trim(),
              coverage_decision: "pending",
            });
          }}
        >
          建立售后案件
        </Button>
      </fieldset>
      {pending ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          正在建立售后案件，完成前不可重复提交。
        </p>
      ) : null}
    </ActionCard>
  );
}

export function CancelPanel({
  sale,
  pending,
  writeBlocked,
  submit,
}: InventoryLifecycleSalePanelProps) {
  const [reason, setReason] = useState("");
  const [disposition, setDisposition] = useState("pending");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [validationAttempt, setValidationAttempt] = useState(0);
  const cancelTriggerRef = useRef<HTMLElement | null>(null);
  const dispositionLabel =
    disposition === "refund_pending" ? "待退款" : disposition === "retain" ? "确认保留" : "待决定";

  const confirmCancel = () => {
    if (pending) return;
    setConfirmOpen(false);
    submit("reservation.cancel", {
      sale_order_id: sale.sale_order_id,
      expected_order_version: sale.order_version,
      expected_unit_version: sale.unit_version,
      disposition,
      reason: reason.trim(),
    });
  };

  const validate = () => {
    if (reason.trim()) {
      setError("");
      return true;
    }
    setValidationAttempt((current) => current + 1);
    setError("请补充取消原因；确认前不会打开危险操作。");
    return false;
  };

  return (
    <ActionCard
      icon={RefreshCw}
      title="取消预订"
      description="定金处理只记录决定；不会自动声称已退款或没收。"
      danger
    >
      <InventoryLifecycleValidationSummary
        issues={
          error
            ? [{ fieldId: "inventory-sale-cancel-reason", label: "取消原因", message: error }]
            : []
        }
        focusRequestKey={validationAttempt}
        onFocusField={(fieldId) => document.getElementById(fieldId)?.focus()}
      />
      <fieldset disabled={pending || writeBlocked} className="contents">
        <Field id="inventory-sale-cancel-disposition" label="定金处理状态">
          <select
            id="inventory-sale-cancel-disposition"
            className="h-11 w-full rounded-md border bg-background px-3 text-sm"
            value={disposition}
            onChange={(event) => setDisposition(event.target.value)}
          >
            <option value="pending">待决定</option>
            <option value="refund_pending">待退款</option>
            <option value="retain">确认保留</option>
          </select>
        </Field>
        <Field id="inventory-sale-cancel-reason" label="取消原因" required error={error}>
          <Textarea
            id="inventory-sale-cancel-reason"
            required
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError("");
            }}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "inventory-sale-cancel-reason-error" : undefined}
            className="min-h-20"
          />
        </Field>
        <Button
          variant="destructive"
          className="min-h-11"
          disabled={pending || writeBlocked}
          onClick={(event) => {
            cancelTriggerRef.current = event.currentTarget;
            if (!pending && !writeBlocked && validate()) setConfirmOpen(true);
          }}
        >
          确认取消预订
        </Button>
      </fieldset>
      <InventoryConsequenceDialog
        open={confirmOpen}
        title="确认取消此预订？"
        description="确认后库存将重新变为可售；取消动作会按当前版本写入审计历史。"
        consequences={[
          "库存：取消完成后该设备回到可售队列。",
          `定金处理：${dispositionLabel}（不会自动声称已退款或没收）。`,
          "审计：取消原因、当前定金处理选择和版本会保留在历史中。",
        ]}
        confirmLabel="确认取消预订"
        cancelLabel="继续编辑"
        tone="danger"
        pending={pending}
        blocked={writeBlocked}
        onConfirm={confirmCancel}
        onOpenChange={setConfirmOpen}
        returnFocusRef={cancelTriggerRef}
      />
      {pending ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          正在处理取消，完成前不可重复提交。
        </p>
      ) : null}
    </ActionCard>
  );
}

export type InventoryLifecycleSalePanelProps = {
  sale: InventoryLifecycleSaleDetail;
  pending: boolean;
  writeBlocked: boolean;
  submit: InventoryLifecycleSaleSubmit;
};

function ActionCard({
  icon: Icon,
  title,
  description,
  danger,
  children,
}: {
  icon: typeof Banknote;
  title: string;
  description: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        repairOs.mobileInfoCard,
        "grid content-start gap-3 p-3 sm:p-4",
        danger && "border-destructive/30",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary",
            danger && "bg-destructive/10 text-destructive",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <InventoryLifecycleField id={id} label={label} required={required} error={error}>
      {children}
    </InventoryLifecycleField>
  );
}
function Method({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field id="inventory-sale-payment-method" label="支付方式">
      <select
        id="inventory-sale-payment-method"
        className="h-11 w-full rounded-md border bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {methods.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </Field>
  );
}
function euro(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}
function formatDate(value?: string) {
  return value
    ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "未安排";
}
function shortId(value: string) {
  return value.slice(0, 8).toUpperCase();
}
function paymentKindLabel(kind: InventoryLifecycleSaleDetail["payments"][number]["kind"]) {
  return {
    deposit: "定金",
    balance: "尾款",
    payment: "收款",
    refund: "退款",
    reversal: "冲正",
  }[kind];
}

function paymentMethodLabel(method: InventoryLifecycleSaleDetail["payments"][number]["method"]) {
  return {
    cash: "现金",
    card: "银行卡",
    bancomat: "Bancomat",
    transfer: "转账",
    other: "其他",
  }[method];
}
