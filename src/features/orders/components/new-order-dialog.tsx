"use client";

import { lazy, Suspense, useRef } from "react";
import { useNavigationGuard } from "@/components/navigation-guard-provider";
import { LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { NewOrderPrefill } from "@/features/orders/model/new-order-intent";
import { useLocale } from "@/shared/i18n/locale-provider";

const LazyNewOrderScreen = lazy(() =>
  import("@/features/orders/screens/new-order-screen").then((module) => ({
    default: module.NewOrderScreen,
  })),
);

export function NewOrderDialog({
  open,
  sessionKey,
  prefill,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  sessionKey: number;
  prefill?: NewOrderPrefill;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const { t } = useLocale();
  const { runGuardedTransition } = useNavigationGuard();
  const openerRef = useRef<HTMLElement | null>(null);
  const close = () => {
    void runGuardedTransition({
      kind: "route",
      label: t("common.close"),
      run: () => onOpenChange(false),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else close();
      }}
    >
      <DialogContent
        initialFocus="container"
        editorLayout
        data-new-order-dialog="true"
        showCloseButton={false}
        className="inset-0 h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-background p-0 shadow-none transition-none sm:gap-0 sm:p-0"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
        onOpenAutoFocus={() => {
          openerRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          const opener = openerRef.current;
          if (!opener || opener.isConnected) return;
          const isListEntry = (element: HTMLElement) =>
            element.dataset.orderListNewButton === "true" ||
            element.getAttribute("aria-label") === t("orders.new");
          if (!isListEntry(opener)) return;
          // Rotation can replace the compact/desktop toolbar while the editor stays mounted.
          const currentEntry = Array.from(
            document.querySelectorAll<HTMLElement>(
              '[data-order-list-new-button="true"], button[aria-label]',
            ),
          ).find((element) => isListEntry(element) && element.getClientRects().length > 0);
          if (currentEntry) {
            event.preventDefault();
            currentEntry.focus({ preventScroll: true });
          }
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("orders2b1.new.title")}</DialogTitle>
          <DialogDescription>{t("orders2b1.new.dialogDescription")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <Suspense
            fallback={
              <div
                data-new-order-loading="true"
                className="relative flex min-h-0 flex-1 items-center justify-center gap-2 px-4 text-sm text-muted-foreground"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 size-11"
                  aria-label={t("common.close")}
                  onClick={close}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
                <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                <span role="status" className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                  {t("orders2b1.new.dialogLoading")}
                </span>
              </div>
            }
          >
            <LazyNewOrderScreen
              key={sessionKey}
              surface="dialog"
              prefill={prefill}
              onCancel={close}
              onCreated={onCreated}
            />
          </Suspense>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
