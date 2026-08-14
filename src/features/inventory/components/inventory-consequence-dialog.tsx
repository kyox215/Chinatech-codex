"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";

export type InventoryConsequenceDialogTone = "warning" | "danger";

export type InventoryConsequenceDialogProps = {
  open: boolean;
  title: string;
  description: string;
  consequences?: readonly React.ReactNode[];
  confirmLabel: string;
  cancelLabel: string;
  tone?: InventoryConsequenceDialogTone;
  pending?: boolean;
  /** Blocks controls while a stale/conflict guard is active without claiming a mutation is running. */
  blocked?: boolean;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
};

/**
 * Controlled destructive/confirm flow used by inventory forms and lifecycle
 * actions. Radix owns the modal focus trap and Escape handling; this wrapper
 * deliberately focuses the safe cancel action and restores the originating
 * control because the dialog is not opened through an AlertDialog.Trigger.
 */
export function InventoryConsequenceDialog({
  open,
  title,
  description,
  consequences = [],
  confirmLabel,
  cancelLabel,
  tone = "warning",
  pending = false,
  blocked = false,
  onConfirm,
  onOpenChange,
  returnFocusRef,
  className,
}: InventoryConsequenceDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const wasOpenRef = React.useRef(open);

  const focusCancel = React.useCallback(() => {
    window.requestAnimationFrame(() => cancelRef.current?.focus());
  }, []);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) focusCancel();
    wasOpenRef.current = open;
  }, [focusCancel, open]);

  const closeAndRestore = React.useCallback(() => {
    onOpenChange(false);
    window.requestAnimationFrame(() => returnFocusRef?.current?.focus());
  }, [onOpenChange, returnFocusRef]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if ((pending || blocked) && !nextOpen) return;
      if (!nextOpen) {
        closeAndRestore();
        return;
      }
      onOpenChange(true);
    },
    [blocked, closeAndRestore, onOpenChange, pending],
  );

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        data-ui="inventory-consequence-dialog"
        aria-busy={pending || undefined}
        className={cn(componentOverlay.content, "max-w-[calc(100vw-24px)]", className)}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focusCancel();
        }}
        onEscapeKeyDown={(event) => {
          if (pending || blocked) event.preventDefault();
        }}
      >
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {consequences.length > 0 ? (
          <ul
            aria-label="操作后果"
            className={cn(
              "grid gap-1.5 rounded-lg border px-3 py-2 text-xs leading-5",
              tone === "danger"
                ? "border-destructive/30 bg-destructive/5 text-foreground"
                : "border-border bg-muted/40 text-foreground",
            )}
          >
            {consequences.map((consequence, index) => (
              <li key={index} className="flex min-w-0 gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-current" />
                <span className="min-w-0">{consequence}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {pending ? (
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
            正在处理；请等待当前操作完成，不要重复提交或关闭此确认框。
          </p>
        ) : null}

        <AlertDialogFooter className="gap-2 sm:flex-row sm:justify-end sm:space-x-0">
          <AlertDialogCancel
            ref={cancelRef}
            className="mt-0 min-h-11 flex-1 sm:flex-none"
            disabled={pending || blocked}
            onClick={(event) => {
              event.preventDefault();
              closeAndRestore();
            }}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <Button
            type="button"
            variant={tone === "danger" ? "destructive" : "default"}
            className="min-h-11 flex-1 sm:flex-none"
            disabled={pending || blocked}
            onClick={() => void onConfirm()}
          >
            {pending ? "处理中…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
