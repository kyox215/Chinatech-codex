"use client";

import { useState } from "react";
import { Banknote, CheckCircle2, CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { componentOverlay } from "@/lib/component-patterns";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

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
  onPay: (amount: number, method: string) => Promise<void>;
}) {
  const [amountText, setAmountText] = useState(() => formatPaymentDraft(balance));
  const [method, setMethod] = useState("现金");
  const [busy, setBusy] = useState(false);
  const amount = parsePaymentAmount(amountText);
  const balanceAmount = Math.max(0, Number.isFinite(balance) ? balance : 0);
  const remainingAmount =
    amount === undefined ? balanceAmount : Math.max(0, balanceAmount - amount);
  const canPay = !busy && amount !== undefined && amount > 0 && amount <= balanceAmount;
  const willSettle = canPay && remainingAmount === 0;
  const validationMessage =
    amountText.trim() && amount === undefined
      ? "请输入有效金额，可以使用小数点或逗号。"
      : amount !== undefined && amount > balanceAmount
        ? "收款金额不能超过未结清尾款。"
        : amount !== undefined && amount <= 0
          ? "收款金额必须大于 0。"
          : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setAmountText(formatPaymentDraft(balanceAmount));
          setBusy(false);
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
            登记收款
          </DialogTitle>
          <DialogDescription>核对尾款并登记本次收款，收款后会写入工单时间线。</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 min-w-0 gap-0 overflow-y-auto md:grid-cols-[minmax(0,1fr)_260px]">
          <section className="min-w-0 space-y-3 p-4">
            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.72fr)]">
              <div className="min-w-0">
                <Label className="text-xs">本次收款金额</Label>
                <div className="mt-1 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={amountText}
                    onChange={(e) => setAmountText(e.target.value)}
                    className={cn(
                      "h-9 font-mono tabular-nums",
                      validationMessage && "border-status-danger-foreground/50",
                    )}
                    placeholder="0"
                    aria-invalid={Boolean(validationMessage)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 px-2 text-xs"
                    onClick={() => setAmountText(formatPaymentDraft(balanceAmount))}
                  >
                    全额
                  </Button>
                </div>
                <p
                  className={cn(
                    "mt-1 text-[11px] leading-4",
                    validationMessage ? "text-status-danger-foreground" : "text-muted-foreground",
                  )}
                >
                  {validationMessage || `最多可收 ${formatMoney(balanceAmount)}`}
                </p>
              </div>

              <div className="min-w-0">
                <Label className="text-xs">支付方式</Label>
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
                        onClick={() => setMethod(item)}
                      >
                        {item === "现金" ? (
                          <Banknote className="size-3.5 shrink-0" />
                        ) : (
                          <CreditCard className="size-3.5 shrink-0" />
                        )}
                        <span className="truncate">{item}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              data-order-payment-result="true"
              className={cn(
                "grid min-w-0 gap-2 rounded-lg border px-3 py-2",
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
                    {willSettle ? "本次收款后可结清工单" : "本次收款后仍有尾款"}
                  </p>
                  <p className="truncate text-[11px] leading-4 text-muted-foreground">
                    完成收款后，可继续流转到取机或结案步骤。
                  </p>
                </div>
              </div>
            </div>
          </section>

          <aside
            data-order-payment-summary="true"
            className="min-w-0 border-t border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/65 p-3 md:border-l md:border-t-0"
          >
            <div className="grid min-w-0 gap-2">
              <PaymentSummaryLine label="未结清尾款" value={formatMoney(balanceAmount)} strong />
              <PaymentSummaryLine
                label="本次收款"
                value={amount === undefined ? "待填写" : formatMoney(amount)}
              />
              <PaymentSummaryLine
                label="收款后剩余"
                value={formatMoney(remainingAmount)}
                strong={!willSettle}
                dataAttr="data-order-payment-remaining"
              />
            </div>
            <div className="mt-3 rounded-lg border border-[var(--border-panel)] bg-card/80 px-2.5 py-2 text-[11px] leading-4 text-muted-foreground">
              收款金额会与当前工单版本一起提交，若其他人已修改报价或尾款，系统会要求刷新后再操作。
            </div>
          </aside>
        </div>

        <DialogFooter className="border-t border-[var(--border-panel)] px-4 py-3 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={!canPay}
            onClick={async () => {
              if (amount === undefined) return;
              setBusy(true);
              try {
                await onPay(amount, method);
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            <CreditCard className="mr-1.5 size-3.5" />
            {busy ? "登记中..." : `确认收款（${method}）`}
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
      className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--border-panel)] bg-card/75 px-2.5 py-2"
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
