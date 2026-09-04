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
import { useLocale } from "@/shared/i18n/locale-provider";
import { InventoryConsequenceDialog } from "../../components/inventory-consequence-dialog";
import {
  formatInventoryLifecycleDate,
  formatInventoryLifecycleMoney,
  localizeInventoryCancelDisposition,
  localizeInventoryPaymentKind,
  localizeInventoryPaymentMethod,
} from "../model/inventory-lifecycle-i18n";
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
  const { locale, t } = useLocale();
  const facts = [
    [
      t("inventory2b4.sale.agreedPrice"),
      formatInventoryLifecycleMoney(sale.agreed_price, locale, t),
    ],
    [
      t("inventory2b4.sale.paid"),
      formatInventoryLifecycleMoney(sale.signed_paid_amount, locale, t),
    ],
    [t("inventory2b4.sale.balance"), formatInventoryLifecycleMoney(sale.balance, locale, t)],
    [
      t("inventory2b4.sale.expectedPickup"),
      sale.expected_pickup_at
        ? formatInventoryLifecycleDate(sale.expected_pickup_at, locale, t)
        : t("inventory2b4.sale.unscheduled"),
    ],
  ];
  return (
    <section
      className={cn(repairOs.mobileInfoCard, "p-3 sm:p-4")}
      aria-label={t("inventory2b4.sale.overviewAria")}
    >
      <div className="flex items-center gap-2">
        <Banknote className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold">{t("inventory2b4.sale.moneyDelivery")}</h2>
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
          <h3 className="text-[11px] font-semibold">{t("inventory2b4.sale.paymentHistory")}</h3>
          <ol className="mt-1.5 grid gap-1.5">
            {sale.payments.map((payment, index) => (
              <li
                key={`${payment.occurred_at}-${index}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px]"
              >
                <span>
                  {localizeInventoryPaymentKind(payment.kind, paymentKindLabel(payment.kind), t)} ·{" "}
                  {localizeInventoryPaymentMethod(
                    payment.method,
                    paymentMethodLabel(payment.method),
                    t,
                  )}
                </span>
                <strong>
                  {["refund", "reversal"].includes(payment.kind) ? "−" : "+"}
                  {formatInventoryLifecycleMoney(payment.amount, locale, t)}
                </strong>
                <time className="text-muted-foreground">
                  {formatInventoryLifecycleDate(payment.occurred_at, locale, t)}
                </time>
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
  const { locale, t } = useLocale();
  const [amount, setAmount] = useState(String(sale.balance));
  const [method, setMethod] = useState("cash");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationAttempt, setValidationAttempt] = useState(0);
  const validate = () => {
    const value = Number(amount.trim().replace(",", "."));
    const nextErrors: Record<string, string> = {};
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      nextErrors["inventory-sale-payment-amount"] = t("inventory2b4.sale.payment.invalid");
    } else if (value > sale.balance) {
      nextErrors["inventory-sale-payment-amount"] = t("inventory2b4.sale.payment.exceeds");
    }
    if (Object.keys(nextErrors).length > 0) setValidationAttempt((current) => current + 1);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  const issues: InventoryLifecycleValidationIssue[] = errors["inventory-sale-payment-amount"]
    ? [
        {
          fieldId: "inventory-sale-payment-amount",
          label: t("inventory2b4.sale.payment.amount"),
          message: errors["inventory-sale-payment-amount"],
        },
      ]
    : [];
  return (
    <ActionCard
      icon={Banknote}
      title={t("inventory2b4.sale.payment.title")}
      description={t("inventory2b4.sale.payment.description")}
    >
      <InventoryLifecycleValidationSummary
        issues={issues}
        focusRequestKey={validationAttempt}
        onFocusField={(fieldId) => document.getElementById(fieldId)?.focus()}
      />
      <fieldset disabled={pending || writeBlocked} className="contents">
        <Field
          id="inventory-sale-payment-amount"
          label={t("inventory2b4.sale.payment.amount")}
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
          {t("inventory2b4.sale.payment.confirm", {
            amount: formatInventoryLifecycleMoney(Number(amount || 0), locale, t),
          })}
        </Button>
      </fieldset>
      {pending ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {t("inventory2b4.sale.payment.pending")}
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
  const { t } = useLocale();
  return (
    <ActionCard
      icon={PackageCheck}
      title={t("inventory2b4.sale.complete.title")}
      description={t("inventory2b4.sale.complete.description")}
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
          {t("inventory2b4.sale.complete.confirm")}
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
  const { t } = useLocale();
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
      nextErrors["inventory-sale-pickup-warranty-months"] = t(
        "inventory2b4.sale.validation.months",
      );
    }
    if (sale.balance > 0 && reason.trim().length === 0) {
      nextErrors["inventory-sale-pickup-override-reason"] = t(
        "inventory2b4.sale.validation.override",
      );
    }
    if (Object.keys(nextErrors).length > 0) setValidationAttempt((current) => current + 1);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  const issues: InventoryLifecycleValidationIssue[] = Object.entries(errors)
    .filter(([, message]) => Boolean(message))
    .map(([fieldId, message]) => ({
      fieldId,
      label: fieldId.endsWith("months")
        ? t("inventory2b4.sale.warrantyMonths")
        : t("inventory2b4.sale.overrideReason"),
      message,
    }));
  return (
    <ActionCard
      icon={CalendarCheck}
      title={t("inventory2b4.sale.pickup.title")}
      description={t("inventory2b4.sale.pickup.description")}
    >
      <InventoryLifecycleValidationSummary
        issues={issues}
        focusRequestKey={validationAttempt}
        onFocusField={(fieldId) => document.getElementById(fieldId)?.focus()}
      />
      <fieldset disabled={pending || writeBlocked} className="contents">
        <Field
          id="inventory-sale-pickup-warranty-months"
          label={t("inventory2b4.sale.warrantyMonths")}
          error={errors["inventory-sale-pickup-warranty-months"]}
        >
          <Input
            id="inventory-sale-pickup-warranty-months"
            inputMode="numeric"
            placeholder={t("inventory2b4.sale.storeDefault")}
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
            label={t("inventory2b4.sale.overrideReason")}
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
          {t("inventory2b4.sale.pickup.confirm")}
        </Button>
      </fieldset>
      {pending ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {t("inventory2b4.sale.pickup.pending")}
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
  const { t } = useLocale();
  const [months, setMonths] = useState(String(sale.commercial_warranty?.months ?? 12));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationAttempt, setValidationAttempt] = useState(0);
  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!Number.isInteger(Number(months)) || Number(months) < 0 || Number(months) > 120) {
      nextErrors["inventory-sale-warranty-months"] = t("inventory2b4.sale.validation.months");
    }
    if (!reason.trim())
      nextErrors["inventory-sale-warranty-reason"] = t("inventory2b4.sale.warranty.reasonRequired");
    if (Object.keys(nextErrors).length > 0) setValidationAttempt((current) => current + 1);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  const issues: InventoryLifecycleValidationIssue[] = Object.entries(errors)
    .filter(([, message]) => Boolean(message))
    .map(([fieldId, message]) => ({
      fieldId,
      label: fieldId.endsWith("months")
        ? t("inventory2b4.sale.warranty.newMonths")
        : t("inventory2b4.sale.warranty.reason"),
      message,
    }));
  return (
    <ActionCard
      icon={ShieldCheck}
      title={t("inventory2b4.sale.warranty.title")}
      description={t("inventory2b4.sale.warranty.description")}
    >
      <InventoryLifecycleValidationSummary
        issues={issues}
        focusRequestKey={validationAttempt}
        onFocusField={(fieldId) => document.getElementById(fieldId)?.focus()}
      />
      <fieldset disabled={pending || writeBlocked} className="contents">
        <Field
          id="inventory-sale-warranty-months"
          label={t("inventory2b4.sale.warranty.newMonths")}
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
          label={t("inventory2b4.sale.warranty.reason")}
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
          {t("inventory2b4.sale.warranty.confirm")}
        </Button>
      </fieldset>
      {pending ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {t("inventory2b4.sale.warranty.pending")}
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
  const { t } = useLocale();
  const [issue, setIssue] = useState("");
  const [error, setError] = useState("");
  const [validationAttempt, setValidationAttempt] = useState(0);
  return (
    <ActionCard
      icon={RefreshCw}
      title={t("inventory2b4.sale.afterSales.title")}
      description={t("inventory2b4.sale.afterSales.description")}
    >
      <InventoryLifecycleValidationSummary
        issues={
          error
            ? [
                {
                  fieldId: "inventory-sale-after-sales-issue",
                  label: t("inventory2b4.sale.afterSales.issue"),
                  message: error,
                },
              ]
            : []
        }
        focusRequestKey={validationAttempt}
        onFocusField={(fieldId) => document.getElementById(fieldId)?.focus()}
      />
      <fieldset disabled={pending || writeBlocked} className="contents">
        <Field
          id="inventory-sale-after-sales-issue"
          label={t("inventory2b4.sale.afterSales.issue")}
          required
          error={error}
        >
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
              setError(t("inventory2b4.sale.afterSales.issueRequired"));
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
          {t("inventory2b4.sale.afterSales.confirm")}
        </Button>
      </fieldset>
      {pending ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {t("inventory2b4.sale.afterSales.pending")}
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
  const { t } = useLocale();
  const [reason, setReason] = useState("");
  const [disposition, setDisposition] = useState("pending");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [validationAttempt, setValidationAttempt] = useState(0);
  const cancelTriggerRef = useRef<HTMLElement | null>(null);
  const dispositionLabel = localizeInventoryCancelDisposition(
    disposition,
    disposition === "refund_pending" ? "待退款" : disposition === "retain" ? "确认保留" : "待决定",
    t,
  );

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
    setError(t("inventory2b4.sale.cancel.reasonRequired"));
    return false;
  };

  return (
    <ActionCard
      icon={RefreshCw}
      title={t("inventory2b4.sale.cancel.title")}
      description={t("inventory2b4.sale.cancel.description")}
      danger
    >
      <InventoryLifecycleValidationSummary
        issues={
          error
            ? [
                {
                  fieldId: "inventory-sale-cancel-reason",
                  label: t("inventory2b4.sale.cancel.reason"),
                  message: error,
                },
              ]
            : []
        }
        focusRequestKey={validationAttempt}
        onFocusField={(fieldId) => document.getElementById(fieldId)?.focus()}
      />
      <fieldset disabled={pending || writeBlocked} className="contents">
        <Field
          id="inventory-sale-cancel-disposition"
          label={t("inventory2b4.sale.cancel.disposition")}
        >
          <select
            id="inventory-sale-cancel-disposition"
            className="h-11 w-full rounded-md border bg-background px-3 text-sm"
            value={disposition}
            onChange={(event) => setDisposition(event.target.value)}
          >
            {(["pending", "refund_pending", "retain"] as const).map((value) => (
              <option key={value} value={value}>
                {localizeInventoryCancelDisposition(value, value, t)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="inventory-sale-cancel-reason"
          label={t("inventory2b4.sale.cancel.reason")}
          required
          error={error}
        >
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
          {t("inventory2b4.sale.cancel.confirm")}
        </Button>
      </fieldset>
      <InventoryConsequenceDialog
        open={confirmOpen}
        title={t("inventory2b4.sale.cancel.dialogTitle")}
        description={t("inventory2b4.sale.cancel.dialogDescription")}
        consequences={[
          t("inventory2b4.sale.cancel.inventoryConsequence"),
          t("inventory2b4.sale.cancel.depositConsequence", { disposition: dispositionLabel }),
          t("inventory2b4.sale.cancel.auditConsequence"),
        ]}
        confirmLabel={t("inventory2b4.sale.cancel.confirm")}
        cancelLabel={t("inventory2b4.sale.cancel.continueEditing")}
        tone="danger"
        pending={pending}
        blocked={writeBlocked}
        onConfirm={confirmCancel}
        onOpenChange={setConfirmOpen}
        returnFocusRef={cancelTriggerRef}
      />
      {pending ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {t("inventory2b4.sale.cancel.pending")}
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
  const { t } = useLocale();
  return (
    <Field id="inventory-sale-payment-method" label={t("inventory2b4.sale.payment.method")}>
      <select
        id="inventory-sale-payment-method"
        className="h-11 w-full rounded-md border bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {methods.map(([key, label]) => (
          <option key={key} value={key}>
            {localizeInventoryPaymentMethod(key, label, t)}
          </option>
        ))}
      </select>
    </Field>
  );
}
function shortId(value: string) {
  return value.slice(0, 8).toUpperCase();
}
function paymentKindLabel(kind: InventoryLifecycleSaleDetail["payments"][number]["kind"]) {
  return (
    {
      deposit: "定金",
      balance: "尾款",
      payment: "收款",
      refund: "退款",
      reversal: "冲正",
    }[kind] ?? kind
  );
}

function paymentMethodLabel(method: InventoryLifecycleSaleDetail["payments"][number]["method"]) {
  return (
    {
      cash: "现金",
      card: "银行卡",
      bancomat: "Bancomat",
      transfer: "转账",
      other: "其他",
    }[method] ?? method
  );
}
