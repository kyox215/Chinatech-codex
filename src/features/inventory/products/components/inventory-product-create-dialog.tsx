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
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";

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
  const [intakeState, setIntakeState] = useState(cleanIntakeState);
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);
  const [closeNotice, setCloseNotice] = useState("");
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
      setCloseNotice("正在保存商品，请等待结果后再关闭。");
      return;
    }
    if (intakeState.isDirty) {
      focusBeforePromptRef.current = document.activeElement as HTMLElement | null;
      setCloseNotice("");
      setDiscardPromptOpen(true);
      return;
    }
    forceClose();
  }, [forceClose, intakeState.isDirty, intakeState.isPending]);

  const continueEditing = useCallback(() => {
    setDiscardPromptOpen(false);
    requestAnimationFrame(() => focusBeforePromptRef.current?.focus());
  }, []);

  const confirmDiscard = useCallback(() => {
    if (intakeState.isPending) {
      setCloseNotice("正在保存商品，请等待结果后再关闭。");
      return;
    }
    forceClose();
  }, [forceClose, intakeState.isPending]);

  const handleStateChange = useCallback((state: InventoryProductIntakeState) => {
    setIntakeState(state);
    if (!state.isPending) setCloseNotice("");
  }, []);

  const handleAuthorityInvalidated = useCallback(() => {
    toast.warning("门店或权限已变化，未保存的商品草稿已清除。");
    forceClose();
  }, [forceClose]);

  const handleCreated = useCallback(
    async (id: string) => {
      forceClose();
      await onCreated(id);
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
        data-inventory-product-create-dialog="true"
        showCloseButton={false}
        className={cn(
          componentOverlay.formWorkspace,
          "sm:w-[min(860px,calc(100vw-32px))] sm:max-w-[calc(100vw-32px)]",
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => document.getElementById("product-brand")?.focus());
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => focusVisibleCreateTrigger());
        }}
        onEscapeKeyDown={(event) => {
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
          <DialogTitle>快速录入商品</DialogTitle>
          <DialogDescription>
            在当前商品库存页面的弹窗中填写类别、品牌、型号、设备标识与经营资料。
          </DialogDescription>
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
                  <span role="status">正在准备商品录入</span>
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
                放弃本次未保存商品？
              </h2>
              <p
                id="inventory-product-discard-description"
                className="mt-1 text-sm text-muted-foreground"
              >
                只会丢弃当前弹窗里的未保存内容，不会影响已经录入的库存商品。
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
                  继续填写
                </Button>
                <Button
                  ref={discardAndCloseRef}
                  type="button"
                  variant="destructive"
                  disabled={intakeState.isPending}
                  onClick={confirmDiscard}
                >
                  放弃并关闭
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
