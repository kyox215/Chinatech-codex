"use client";

import { useEffect, useState } from "react";
import { CircleDollarSign } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { componentOverlay } from "@/lib/component-patterns";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function InitialDepositCorrectionDialog({
  open,
  onOpenChange,
  quotation,
  currentDeposit,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: number;
  currentDeposit: number;
  pending: boolean;
  onConfirm: (depositAmount: number, reason: string, idempotencyKey: string) => Promise<void>;
}) {
  const [amountText, setAmountText] = useState(String(currentDeposit));
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const amount = parseAmount(amountText);
  const nextBalance = amount === undefined ? quotation - currentDeposit : quotation - amount;
  const amountError =
    amount === undefined
      ? "请输入最多两位小数的有效金额。"
      : amount < 0
        ? "定金不能为负数。"
        : amount > quotation
          ? "定金不能超过总报价。"
          : amount === currentDeposit
            ? "新定金与当前金额相同。"
            : "";
  const reasonError =
    reason.trim().length > 0 && reason.trim().length < 5 ? "原因至少需要 5 个字符。" : "";
  const canSubmit = !pending && !amountError && !reasonError && reason.trim().length >= 5;

  useEffect(() => {
    if (!open) return;
    setAmountText(String(currentDeposit));
    setReason("");
    setIdempotencyKey(crypto.randomUUID());
  }, [currentDeposit, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(componentOverlay.modalSm, "p-0")}
        data-initial-deposit-correction-dialog="true"
      >
        <DialogHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CircleDollarSign className="size-4 text-primary" />
            更正初始定金
          </DialogTitle>
          <DialogDescription className="text-xs">
            仅用于修正建单时录错的定金，不代表新增收款；新增收到的钱请使用“登记收款”。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-4 py-3">
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-[var(--surface-panel-muted)] p-2 text-xs">
            <Summary label="当前定金" value={formatMoney(currentDeposit)} />
            <Summary label="更正后定金" value={amount === undefined ? "—" : formatMoney(amount)} />
            <Summary label="更正后尾款" value={formatMoney(Math.max(0, nextBalance))} />
          </div>
          <div>
            <Label className="text-xs">正确的定金金额</Label>
            <MoneyKeypadInput
              ariaLabel="正确的定金金额"
              value={amountText}
              onChange={(value) => {
                setAmountText(value);
                setIdempotencyKey(crypto.randomUUID());
              }}
              invalid={Boolean(amountError)}
              triggerClassName="mt-1 h-9 font-mono tabular-nums"
              placeholder="0"
            />
            <p
              className={cn(
                "mt-1 text-[11px]",
                amountError ? "text-status-danger-foreground" : "text-muted-foreground",
              )}
            >
              {amountError || `总报价 ${formatMoney(quotation)}`}
            </p>
          </div>
          <div>
            <Label htmlFor="initial-deposit-correction-reason" className="text-xs">
              更正原因
            </Label>
            <Textarea
              id="initial-deposit-correction-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setIdempotencyKey(crypto.randomUUID());
              }}
              maxLength={240}
              placeholder="例如：建单时现金定金录入错误"
              className="mt-1 min-h-20 text-sm"
            />
            <p
              className={cn(
                "mt-1 text-[11px]",
                reasonError ? "text-status-danger-foreground" : "text-muted-foreground",
              )}
            >
              {reasonError || "原因会进入工单时间线和审计记录。"}
            </p>
          </div>
        </div>
        <DialogFooter className={cn(componentOverlay.footer, "px-4 pb-4")}>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={async () => {
              if (amount === undefined) return;
              try {
                await onConfirm(amount, reason.trim(), idempotencyKey || crypto.randomUUID());
              } catch {
                // Parent mutation keeps the dialog open and presents the actionable error.
              }
            }}
          >
            {pending ? "正在更正…" : "确认更正"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] text-muted-foreground">{label}</p>
      <p className="truncate font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function parseAmount(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return undefined;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : undefined;
}
