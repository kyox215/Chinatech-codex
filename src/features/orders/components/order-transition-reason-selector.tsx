"use client";

import { OrderReasonField } from "@/features/orders/components/order-reason-field";
import {
  getOrderReasonCatalog,
  getOrderTransitionReasonContext,
  type OrderReasonDraft,
} from "@/features/orders/model/order-reason-catalog";
import type { RepairOrderStatus } from "@/lib/mock/enums";

export function OrderTransitionReasonSelector({
  target,
  value,
  onChange,
  disabled = false,
  compact = false,
  error,
}: {
  target: RepairOrderStatus;
  value: OrderReasonDraft;
  onChange: (value: OrderReasonDraft) => void;
  disabled?: boolean;
  compact?: boolean;
  error?: string;
}) {
  const context = getOrderTransitionReasonContext(target);
  if (!context) return null;

  return (
    <OrderReasonField
      catalog={getOrderReasonCatalog(context)}
      value={value}
      onChange={onChange}
      disabled={disabled}
      compact={compact}
      error={error}
    />
  );
}
