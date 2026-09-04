"use client";

import { CheckCircle2, History } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { localizeInventoryOperationReceipt } from "@/features/inventory/lifecycle/model/inventory-lifecycle-i18n";

import type { InventoryOperationReceipt } from "../model/inventory-operation-receipt";

export type InventoryOperationReceiptNextAction = {
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
};

export type InventoryOperationReceiptPanelProps = {
  receipt: InventoryOperationReceipt;
  receiptKey?: string | number;
  nextAction?: InventoryOperationReceiptNextAction;
  privacyRedacted?: boolean;
  className?: string;
};

/**
 * Presents proof that a lifecycle mutation was accepted. It intentionally
 * does not imply that a subsequent invalidate/refetch succeeded; that belongs
 * to InventorySyncStatusPanel.
 */
export function InventoryOperationReceiptPanel({
  receipt,
  receiptKey,
  nextAction,
  privacyRedacted = false,
  className,
}: InventoryOperationReceiptPanelProps) {
  const { t } = useLocale();
  const displayReceipt = localizeInventoryOperationReceipt(receipt, t);
  const panelRef = useRef<HTMLElement>(null);
  const lastFocusSignatureRef = useRef<string | undefined>(undefined);
  const signature = `${receiptKey ?? ""}|${receipt.command}|${receipt.kind}|${receipt.title}`;
  const isReplay = receipt.kind === "idempotent-replay";

  useEffect(() => {
    if (lastFocusSignatureRef.current === signature) return;
    lastFocusSignatureRef.current = signature;
    panelRef.current?.focus({ preventScroll: true });
  }, [signature]);

  return (
    <section
      ref={panelRef}
      data-ui="inventory-operation-receipt-panel"
      data-operation-receipt-kind={receipt.kind}
      data-operation-receipt-command={receipt.command}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      tabIndex={-1}
      className={cn(
        "grid min-w-0 gap-2 rounded-xl border border-status-success/40 bg-status-success/10 p-3 text-foreground sm:p-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-background/80"
        >
          {isReplay ? (
            <History className="size-4 text-status-success-foreground" />
          ) : (
            <CheckCircle2 className="size-4 text-status-success-foreground" />
          )}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{displayReceipt.title}</h2>
          <p className="mt-1 text-xs leading-5 text-foreground">{displayReceipt.description}</p>
        </div>
      </div>
      <p className="text-xs leading-5 text-foreground">{displayReceipt.ledgerSemantics}</p>
      <p className="text-xs leading-5 text-muted-foreground">
        {isReplay
          ? t("inventory2b4.operationReceipt.replay")
          : t("inventory2b4.operationReceipt.confirmed")}
      </p>
      <p className="text-xs leading-5 text-muted-foreground">{displayReceipt.nextStep}</p>
      {privacyRedacted ? (
        <p className="text-xs leading-5 text-muted-foreground">
          {t("inventory2b4.common.privacyRedacted")}
        </p>
      ) : null}
      {nextAction ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-fit"
          disabled={nextAction.disabled}
          onClick={() => void nextAction.onClick()}
        >
          {nextAction.label}
        </Button>
      ) : null}
    </section>
  );
}
