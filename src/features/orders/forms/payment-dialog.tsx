"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { componentOverlay } from "@/lib/component-patterns";
import { formatMoney } from "@/lib/money";

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
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) setAmountText(formatPaymentDraft(balance));
      }}
    >
      <DialogContent className={`${componentOverlay.modalSm} p-4 sm:p-5`}>
        <DialogHeader>
          <DialogTitle>登记收款</DialogTitle>
          <DialogDescription>未结清尾款 {formatMoney(balance)}</DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">收款金额</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              className="mt-1 font-mono"
              placeholder="0"
            />
          </div>
          <div>
            <Label className="text-xs">支付方式</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={busy || amount === undefined || amount <= 0 || amount > balance}
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
            <CreditCard className="mr-1.5 size-3.5" /> 确认收款（{method}）
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
