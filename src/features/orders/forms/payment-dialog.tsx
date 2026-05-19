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
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

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
  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState("现金");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) setAmount(balance);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>登记收款</DialogTitle>
          <DialogDescription>未结清尾款 {formatMoney(balance)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">收款金额</Label>
            <Input
              type="number"
              min={0}
              max={balance}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">支付方式</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {["现金", "刷卡"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs",
                    method === m
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-surface hover:bg-accent",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={busy || amount <= 0 || amount > balance}
            onClick={async () => {
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
