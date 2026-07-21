"use client";

import { useEffect, useMemo, useState } from "react";

import { MoneyKeypadInput } from "@/components/orders/money-keypad-input";
import { Button } from "@/components/ui/button";
import { OrderReasonField } from "@/features/orders/components/order-reason-field";
import { ResponsiveOrderActionOverlay } from "@/features/orders/components/responsive-order-action-overlay";
import {
  buildBusinessReasonSelection,
  createEmptyOrderReasonDraft,
  getOrderReasonCatalog,
} from "@/features/orders/model/order-reason-catalog";
import { formatMoney } from "@/lib/money";
import type { BusinessReasonSelectionV2, RepairOrder } from "@/lib/repairdesk/types";
import { moneyDraftValue, parseMoneyDraft } from "@/shared/lib/mobile-input";

export function InitialDepositCorrectionDialog({
  open,
  order,
  pending,
  blockedReason,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  order: RepairOrder;
  pending: boolean;
  blockedReason?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: {
    depositAmount: number;
    reasonSelection: BusinessReasonSelectionV2;
  }) => Promise<void>;
}) {
  const catalog = getOrderReasonCatalog("finance.initial_deposit_correction");
  const [depositAmount, setDepositAmount] = useState(order.deposit_amount);
  const [reason, setReason] = useState(createEmptyOrderReasonDraft);
  const selection = useMemo(() => buildBusinessReasonSelection(catalog, reason), [catalog, reason]);
  const amountInvalid =
    !Number.isFinite(depositAmount) ||
    depositAmount < 0 ||
    depositAmount > order.quotation_amount ||
    depositAmount === order.deposit_amount;
  const dirty =
    depositAmount !== order.deposit_amount || Boolean(reason.primaryCode || reason.note);

  useEffect(() => {
    if (!open) return;
    setDepositAmount(order.deposit_amount);
    setReason(createEmptyOrderReasonDraft());
  }, [open, order.deposit_amount]);

  return (
    <ResponsiveOrderActionOverlay
      open={open}
      pending={pending}
      dirty={dirty}
      onOpenChange={onOpenChange}
      title="更正初始定金"
      description="只更正建单时记录的初始金额；退款、支付方式和后续收款请使用支付账本。"
      contentClassName="w-[min(560px,calc(100vw-24px))]"
      dataAttribute="data-order-initial-deposit-correction-overlay"
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            返回
          </Button>
          <Button
            type="button"
            disabled={pending || Boolean(blockedReason) || amountInvalid || !selection}
            onClick={() => {
              if (!selection || amountInvalid || blockedReason) return;
              void onConfirm({ depositAmount, reasonSelection: selection });
            }}
          >
            {pending ? "更正中…" : "确认更正"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2 text-xs">
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground">当前初始定金</p>
            <p className="mt-0.5 truncate font-mono font-semibold">
              {formatMoney(order.deposit_amount)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground">当前报价上限</p>
            <p className="mt-0.5 truncate font-mono font-semibold">
              {formatMoney(order.quotation_amount)}
            </p>
          </div>
        </div>

        {blockedReason ? (
          <p
            className="rounded-lg bg-status-warn px-2.5 py-2 text-xs text-status-warn-foreground"
            role="alert"
          >
            {blockedReason}
          </p>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold">更正后的初始定金</span>
          <MoneyKeypadInput
            ariaLabel="更正后的初始定金"
            value={moneyDraftValue(depositAmount)}
            onChange={(value) => setDepositAmount(parseMoneyDraft(value))}
            disabled={pending || Boolean(blockedReason)}
            triggerClassName="h-10 w-full justify-start rounded-lg border-[var(--border-panel)] bg-card px-3 font-mono"
            placeholder="0"
          />
          {depositAmount > order.quotation_amount ? (
            <span className="block text-[10px] text-status-danger-foreground">
              定金不能超过当前报价。
            </span>
          ) : depositAmount === order.deposit_amount ? (
            <span className="block text-[10px] text-muted-foreground">
              请输入与当前记录不同的金额。
            </span>
          ) : null}
        </label>

        <OrderReasonField
          catalog={catalog}
          value={reason}
          onChange={setReason}
          disabled={pending || Boolean(blockedReason)}
          compact
        />
      </div>
    </ResponsiveOrderActionOverlay>
  );
}
