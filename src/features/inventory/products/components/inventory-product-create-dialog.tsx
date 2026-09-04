"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { COMPACT_WORKSPACE_BREAKPOINT } from "@/hooks/use-mobile";
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

import type { InventoryProductIntakeState } from "../screens/inventory-product-intake-screen";

const LazyInventoryProductIntakeScreen = lazy(() =>
  import("../screens/inventory-product-intake-screen").then((module) => ({
    default: module.InventoryProductIntakeScreen,
  })),
);

const cleanIntakeState: InventoryProductIntakeState = {
  isDirty: false,
  isPending: false,
};

export function InventoryProductCreateDialog({
  open,
  sessionKey,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  sessionKey: number;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void | Promise<void>;
}) {
  const { t } = useLocale();
  const [intakeState, setIntakeState] = useState(cleanIntakeState);
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);
  const [closeNotice, setCloseNotice] = useState("");
  const dialogContentRef = useRef<HTMLDivElement | null>(null);
  const focusBeforePromptRef = useRef<HTMLElement | null>(null);
  const continueEditingRef = useRef<HTMLButtonElement | null>(null);
  const discardAndCloseRef = useRef<HTMLButtonElement | null>(null);

  const forceClose = useCallback(() => {
    setDiscardPromptOpen(false);
    setCloseNotice("");
    setIntakeState(cleanIntakeState);
    onOpenChange(false);
  }, [onOpenChange]);

  const requestClose = useCallback(() => {
    if (intakeState.isPending) {
      setCloseNotice(t("inventory2b4.quick.dialog.pendingClose"));
      return;
    }
    if (intakeState.isDirty) {
      focusBeforePromptRef.current = document.activeElement as HTMLElement | null;
      setCloseNotice("");
      setDiscardPromptOpen(true);
      return;
    }
    forceClose();
  }, [forceClose, intakeState.isDirty, intakeState.isPending, t]);

  const continueEditing = useCallback(() => {
    setDiscardPromptOpen(false);
    requestAnimationFrame(() => focusBeforePromptRef.current?.focus());
  }, []);

  const confirmDiscard = useCallback(() => {
    if (intakeState.isPending) {
      setCloseNotice(t("inventory2b4.quick.dialog.pendingClose"));
      return;
    }
    forceClose();
  }, [forceClose, intakeState.isPending, t]);

  const handleStateChange = useCallback((state: InventoryProductIntakeState) => {
    setIntakeState(state);
    if (!state.isPending) setCloseNotice("");
  }, []);

  const handleAuthorityInvalidated = useCallback(() => {
    toast.warning(t("inventory2b4.quick.dialog.authorityChanged"));
    forceClose();
  }, [forceClose, t]);

  const handleCreated = useCallback(
    async (id: string) => {
      await onCreated(id);
      forceClose();
    },
    [forceClose, onCreated],
  );

  useEffect(() => {
    if (open) return;
    setDiscardPromptOpen(false);
    setCloseNotice("");
    setIntakeState(cleanIntakeState);
  }, [open, sessionKey]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) onOpenChange(true);
        else requestClose();
      }}
    >
      <DialogContent
        ref={dialogContentRef}
        data-inventory-product-create-dialog="true"
        showCloseButton={false}
        className={cn(
          componentOverlay.formWorkspace,
          "sm:w-[min(860px,calc(100vw-32px))] sm:max-w-[calc(100vw-32px)]",
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (window.innerWidth < COMPACT_WORKSPACE_BREAKPOINT) {
            requestAnimationFrame(() => {
              dialogContentRef.current?.focus({ preventScroll: true });
            });
          }
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => focusVisibleCreateTrigger());
        }}
        onEscapeKeyDown={(event) => {
          if (
            event.target instanceof HTMLElement &&
            event.target.closest('[data-inventory-catalog-picker="inline"]')
          ) {
            event.preventDefault();
            return;
          }
          if (discardPromptOpen) {
            event.preventDefault();
            continueEditing();
            return;
          }
          if (intakeState.isDirty || intakeState.isPending) {
            event.preventDefault();
            requestClose();
          }
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("inventory2b4.quick.dialog.title")}</DialogTitle>
          <DialogDescription>{t("inventory2b4.quick.dialog.description")}</DialogDescription>
        </DialogHeader>

        <div
          className="contents"
          inert={discardPromptOpen || undefined}
          aria-hidden={discardPromptOpen || undefined}
        >
          {open ? (
            <Suspense
              fallback={
                <div className="flex h-[min(28rem,calc(100svh-16px))] items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  <span role="status">{t("inventory2b4.quick.dialog.preparing")}</span>
                </div>
              }
            >
              <LazyInventoryProductIntakeScreen
                key={sessionKey}
                surface="dialog"
                onCancel={requestClose}
                onCreated={handleCreated}
                onStateChange={handleStateChange}
                onAuthorityInvalidated={handleAuthorityInvalidated}
              />
            </Suspense>
          ) : null}
        </div>

        {closeNotice ? (
          <p
            className="absolute left-1/2 top-2 z-50 w-[calc(100%-1rem)] max-w-md -translate-x-1/2 rounded-lg border border-status-warn-foreground/20 bg-status-warn px-3 py-2 text-center text-xs font-medium text-status-warn-foreground shadow-[var(--shadow-card)]"
            role="status"
            aria-live="polite"
          >
            {closeNotice}
          </p>
        ) : null}

        {discardPromptOpen ? (
          <div
            data-ui="inventory-product-discard-confirm"
            className="absolute inset-0 z-40 grid place-items-end rounded-[var(--radius-lg)] bg-[var(--overlay-scrim)] p-2 sm:place-items-center sm:p-4"
            role="region"
            aria-labelledby="inventory-product-discard-title"
            aria-describedby="inventory-product-discard-description"
          >
            <section
              className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] p-3 shadow-[var(--shadow-overlay)] sm:p-4"
              onKeyDown={(event) => {
                if (event.key !== "Tab") return;
                if (event.shiftKey && document.activeElement === continueEditingRef.current) {
                  event.preventDefault();
                  discardAndCloseRef.current?.focus();
                } else if (
                  !event.shiftKey &&
                  document.activeElement === discardAndCloseRef.current
                ) {
                  event.preventDefault();
                  continueEditingRef.current?.focus();
                }
              }}
            >
              <h2 id="inventory-product-discard-title" className="font-semibold">
                {t("inventory2b4.quick.dialog.discardTitle")}
              </h2>
              <p
                id="inventory-product-discard-description"
                className="mt-1 text-sm text-muted-foreground"
              >
                {t("inventory2b4.quick.dialog.discardDescription")}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  ref={continueEditingRef}
                  type="button"
                  variant="outline"
                  autoFocus
                  disabled={intakeState.isPending}
                  onClick={continueEditing}
                >
                  {t("inventory2b4.quick.frame.continueCreate")}
                </Button>
                <Button
                  ref={discardAndCloseRef}
                  type="button"
                  variant="destructive"
                  disabled={intakeState.isPending}
                  onClick={confirmDiscard}
                >
                  {t("inventory2b4.quick.dialog.discardAndClose")}
                </Button>
              </div>
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function focusVisibleCreateTrigger() {
  const triggers = Array.from(
    document.querySelectorAll<HTMLElement>('[data-inventory-product-create-trigger="true"]'),
  );
  const visibleTrigger = triggers.find((trigger) => {
    const rect = trigger.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  visibleTrigger?.focus();
}
