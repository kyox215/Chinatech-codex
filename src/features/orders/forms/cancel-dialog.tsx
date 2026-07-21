"use client";

import { useEffect, useMemo, useState } from "react";

import { OrderTransitionReasonSelector } from "@/features/orders/components/order-transition-reason-selector";
import { ResponsiveOrderActionOverlay } from "@/features/orders/components/responsive-order-action-overlay";
import { Button } from "@/components/ui/button";
import {
  buildBusinessReasonSelection,
  createEmptyOrderReasonDraft,
  getOrderReasonCatalog,
} from "@/features/orders/model/order-reason-catalog";
import type { BusinessReasonSelectionV2 } from "@/lib/repairdesk/types";

export function CancelDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reasonSelection: BusinessReasonSelectionV2) => Promise<void>;
}) {
  const catalog = getOrderReasonCatalog("transition.cancel");
  const [reason, setReason] = useState(createEmptyOrderReasonDraft);
  const [busy, setBusy] = useState(false);
  const selection = useMemo(() => buildBusinessReasonSelection(catalog, reason), [catalog, reason]);

  useEffect(() => {
    if (open) setReason(createEmptyOrderReasonDraft());
  }, [open]);

  const dirty = Boolean(reason.primaryCode || reason.note);

  return (
    <ResponsiveOrderActionOverlay
      open={open}
      pending={busy}
      dirty={dirty}
      onOpenChange={onOpenChange}
      title="取消工单"
      description="选择实际原因；只有“其他原因”需要填写说明。"
      contentClassName="w-[min(520px,calc(100vw-24px))]"
      dataAttribute="data-order-cancel-overlay"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            返回
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !selection}
            onClick={async () => {
              if (!selection) return;
              setBusy(true);
              try {
                await onConfirm(selection);
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            确认取消
          </Button>
        </>
      }
    >
      <OrderTransitionReasonSelector
        target="cancelled"
        value={reason}
        onChange={setReason}
        disabled={busy}
        compact
      />
    </ResponsiveOrderActionOverlay>
  );
}
