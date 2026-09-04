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
import { useLocale } from "@/shared/i18n/locale-provider";

export function CancelDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const { t } = useLocale();
  const [reason, setReason] = useState(() => getDefaultOrderTransitionReason("cancelled"));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setReason(getDefaultOrderTransitionReason("cancelled"));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${componentOverlay.modalSm} grid max-h-[calc(100svh-24px)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0`}
      >
        <DialogHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
          <DialogTitle>{t("orders2b2.cancel.title")}</DialogTitle>
          <DialogDescription className="text-xs">{t("orders2b2.cancel.help")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto p-3 sm:p-4">
          <OrderTransitionReasonSelector
            target="cancelled"
            value={reason}
            onChange={setReason}
            disabled={busy}
            compact
          />
        </div>
        <DialogFooter className="border-t border-[var(--border-panel)] px-4 py-3 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !reason.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
                onOpenChange(false);
              } catch {
                // The mutation owner presents the safe error; keep this dialog and its draft open.
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("orders2b2.cancel.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
