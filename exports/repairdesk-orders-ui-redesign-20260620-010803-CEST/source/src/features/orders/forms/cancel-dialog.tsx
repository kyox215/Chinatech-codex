"use client";

import { useEffect, useState } from "react";

import { OrderTransitionReasonSelector } from "@/features/orders/components/order-transition-reason-selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDefaultOrderTransitionReason } from "@/features/orders/model/order-transition-reasons";
import { componentOverlay } from "@/lib/component-patterns";

export function CancelDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState(() => getDefaultOrderTransitionReason("cancelled"));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setReason(getDefaultOrderTransitionReason("cancelled"));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${componentOverlay.modalSm} grid max-h-[calc(100svh-24px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-4 sm:p-5`}
      >
        <DialogHeader>
          <DialogTitle>取消工单</DialogTitle>
          <DialogDescription>选择一个常见原因，也可以改成更准确的说明。</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto">
          <OrderTransitionReasonSelector
            target="cancelled"
            value={reason}
            onChange={setReason}
            disabled={busy}
            compact
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            返回
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !reason.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            确认取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
