"use client";

import { lazy, Suspense } from "react";
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
import { componentOverlay } from "@/lib/component-patterns";
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
        data-new-order-dialog="true"
        showCloseButton={false}
        className={componentOverlay.formWorkspace}
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
                className="relative flex h-full min-h-[20rem] items-center justify-center gap-2 px-4 text-sm text-muted-foreground"
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
