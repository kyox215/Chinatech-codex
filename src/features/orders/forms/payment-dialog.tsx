"use client";

import { useEffect, useState } from "react";
import { Banknote, CheckCircle2, CreditCard } from "lucide-react";

import { MoneyKeypadInput } from "@/components/orders/money-keypad-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";
import { getOrderDetailSafeErrorMessage } from "@/features/orders/model/order-detail-i18n";
import { formatCurrency } from "@/shared/i18n/format";
import { useLocale } from "@/shared/i18n/locale-provider";

const paymentMethods = ["现金", "刷卡"] as const;

export function PaymentDialog({
  open,
  onOpenChange,
  balance,
  onPay,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  balance: number;
  onPay: (amount: number, method: string, idempotencyKey: string) => Promise<void>;
}) {
  const { locale, t } = useLocale();
  const [amountText, setAmountText] = useState(() => formatPaymentDraft(balance));
  const [method, setMethod] = useState("现金");
  const [busy, setBusy] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [submitError, setSubmitError] = useState("");
  const amount = parsePaymentAmount(amountText);
  const balanceAmount = Math.max(0, Number.isFinite(balance) ? balance : 0);
  const remainingAmount =
    amount === undefined ? balanceAmount : Math.max(0, balanceAmount - amount);
  const canPay = !busy && amount !== undefined && amount > 0 && amount <= balanceAmount;
  const willSettle = canPay && remainingAmount === 0;
  const validationMessage =
    amountText.trim() && amount === undefined
      ? t("orders2b2.payment.invalid")
      : amount !== undefined && amount > balanceAmount
        ? t("orders2b2.payment.over")
        : amount !== undefined && amount <= 0
          ? t("orders2b2.payment.positive")
          : "";

  useEffect(() => {
    if (!open) return;
    setAmountText(formatPaymentDraft(balanceAmount));
    setBusy(false);
    setSubmitError("");
    setIdempotencyKey(crypto.randomUUID());
  }, [balanceAmount, open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setAmountText(formatPaymentDraft(balanceAmount));
          setBusy(false);
          setSubmitError("");
          setIdempotencyKey(crypto.randomUUID());
        }
      }}
    >
      <DialogContent
        data-order-desktop-payment-dialog="true"
        className={cn(
          componentOverlay.modalMd,
          "grid max-h-[calc(100svh-24px)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0",
        )}
      >
        <DialogHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-4 text-primary" />
            {t("orders2b2.payment.title")}
          </DialogTitle>
          <DialogDescription className="text-xs">{t("orders2b2.payment.help")}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 min-w-0 gap-0 overflow-y-auto md:grid-cols-[minmax(0,1fr)_260px]">
          <section className="min-w-0 space-y-2.5 p-3 sm:p-4">
            <div className="grid min-w-0 gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.72fr)]">
              <div className="min-w-0">
                <Label className="text-xs">{t("orders2b2.payment.amount")}</Label>
                <div className="mt-1 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <MoneyKeypadInput
                    ariaLabel={t("orders2b2.payment.amount")}
                    value={amountText}
                    onChange={(value) => {
                      setAmountText(value);
                      setIdempotencyKey(crypto.randomUUID());
                    }}
                    invalid={Boolean(validationMessage)}
                    triggerClassName="h-9 font-mono tabular-nums"
                    placeholder="0"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 px-2 text-xs"
                    onClick={() => {
                      setAmountText(formatPaymentDraft(balanceAmount));
                      setIdempotencyKey(crypto.randomUUID());
                    }}
                  >
                    {t("orders2b2.payment.full")}
                  </Button>
                </div>
                <p
                  className={cn(
                    "mt-1 text-[11px] leading-4",
                    validationMessage ? "text-status-danger-foreground" : "text-muted-foreground",
                  )}
                >
                  {validationMessage ||
                    t("orders2b2.payment.maximum", {
                      amount: formatCurrency(balanceAmount, locale),
                    })}
                </p>
              </div>

              <div className="min-w-0">
                <Label className="text-xs">{t("orders2b2.payment.method")}</Label>
                <div
                  data-order-payment-methods="true"
                  className="mt-1 grid min-w-0 grid-cols-2 gap-1.5"
                >
                  {paymentMethods.map((item) => {
                    const active = method === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        className={cn(
                          "grid h-9 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-1.5 rounded-md border px-2 text-left text-xs font-medium transition-colors",
                          active
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-[var(--border-panel)] bg-[var(--surface-panel)] text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                        )}
                        aria-pressed={active}
                        onClick={() => {
                          setMethod(item);
                          setIdempotencyKey(crypto.randomUUID());
                        }}
                      >
                        {item === "现金" ? (
                          <Banknote className="size-3.5 shrink-0" />
                        ) : (
                          <CreditCard className="size-3.5 shrink-0" />
                        )}
                        <span className="truncate">
                          {t(item === "现金" ? "orders2b2.payment.cash" : "orders2b2.payment.card")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              data-order-payment-result="true"
              className={cn(
                "grid min-w-0 gap-2 rounded-lg border px-2.5 py-2",
                willSettle
                  ? "border-status-success-foreground/30 bg-status-success/55"
                  : "border-[var(--border-panel)] bg-[var(--surface-panel-muted)]",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg",
                    willSettle
                      ? "bg-status-success text-status-success-foreground"
                      : "bg-[var(--surface-panel)] text-muted-foreground",
                  )}
                >
                  <CheckCircle2 className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">
                    {willSettle ? t("orders2b2.payment.settled") : t("orders2b2.payment.remaining")}
                  </p>
                  <p className="truncate text-[11px] leading-4 text-muted-foreground">
                    {t("orders2b2.payment.next")}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <aside
            data-order-payment-summary="true"
            className="min-w-0 border-t border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/65 p-2.5 md:border-l md:border-t-0"
          >
            <div className="grid min-w-0 gap-1.5">
              <PaymentSummaryLine
                label={t("orders2b2.payment.balance")}
                value={formatCurrency(balanceAmount, locale)}
                strong
              />
              <PaymentSummaryLine
                label={t("orders2b2.payment.this")}
                value={
                  amount === undefined
                    ? t("orders2b2.payment.pendingValue")
                    : formatCurrency(amount, locale)
                }
              />
              <PaymentSummaryLine
                label={t("orders2b2.payment.after")}
                value={formatCurrency(remainingAmount, locale)}
                strong={!willSettle}
                dataAttr="data-order-payment-remaining"
              />
            </div>
            <div className="mt-2 rounded-lg border border-[var(--border-panel)] bg-card/80 px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
              {t("orders2b2.payment.versionHelp")}
            </div>
            {submitError ? (
              <p role="alert" className="mt-2 text-xs text-status-danger-foreground">
                {submitError}
              </p>
            ) : null}
          </aside>
        </div>

        <DialogFooter className="border-t border-[var(--border-panel)] px-4 py-3 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!canPay}
            onClick={async () => {
              if (amount === undefined) return;
              setBusy(true);
              setSubmitError("");
              try {
                await onPay(amount, method, idempotencyKey || crypto.randomUUID());
                onOpenChange(false);
              } catch (error) {
                setSubmitError(getOrderDetailSafeErrorMessage(error, "payment", t));
              } finally {
                setBusy(false);
              }
            }}
          >
            <CreditCard className="mr-1.5 size-3.5" />
            {busy
              ? t("orders2b2.payment.recording")
              : t("orders2b2.payment.confirm", {
                  method: t(
                    method === "现金" ? "orders2b2.payment.cash" : "orders2b2.payment.card",
                  ),
                })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatPaymentDraft(value: number) {
  return Number.isFinite(value) && value > 0 ? String(value) : "";
}

function parsePaymentAmount(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return undefined;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : undefined;
}

function PaymentSummaryLine({
  label,
  value,
  strong,
  dataAttr,
}: {
  label: string;
  value: string;
  strong?: boolean;
  dataAttr?: "data-order-payment-remaining";
}) {
  return (
    <div
      {...(dataAttr ? { [dataAttr]: "true" } : {})}
      className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--border-panel)] bg-card/75 px-2 py-1.5"
    >
      <span className="truncate text-[11px] leading-4 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "shrink-0 font-mono text-xs tabular-nums",
          strong && "text-sm font-semibold text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
