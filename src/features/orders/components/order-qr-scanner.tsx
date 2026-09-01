"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";

import { useNavigationGuard } from "@/components/navigation-guard-provider";
import { Button } from "@/components/ui/button";
import { LazyModalErrorBoundary, LazyModalShell } from "@/components/lazy-modal-shell";
import { parseCustomerStatusLink } from "@/entities/customer-status/model/customer-status-link";
import type { CapturePayload } from "@/features/capture/model/barcode-parser";
import { parseOrderQrPayload } from "@/features/orders/model/order-qr-payload";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

function createLazyBarcodeScannerSheet(attempt: number) {
  return lazy(() => {
    void attempt;
    return import("@/features/capture/components/barcode-scanner-sheet").then((module) => ({
      default: module.BarcodeScannerSheet,
    }));
  });
}

export function OrderQrScannerButton({
  className,
  iconClassName,
  showLabel = false,
  label,
  ariaLabel,
  size = "icon",
  disabled = false,
}: {
  className?: string;
  iconClassName?: string;
  showLabel?: boolean;
  label?: string;
  ariaLabel?: string;
  size?: "sm" | "icon";
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const resolvedLabel = label ?? t("orders.scanOrderQrShort");
  const resolvedAriaLabel = ariaLabel ?? t("orderQr.title");
  const [open, setOpen] = useState(false);
  const [activated, setActivated] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const outsideDismissedRef = useRef(false);
  const handleCloseAutoFocus = useCallback((event: Event) => {
    if (!outsideDismissedRef.current) {
      event.preventDefault();
      triggerRef.current?.focus({ preventScroll: true });
    }
    outsideDismissedRef.current = false;
  }, []);
  const closeBeforeLoad = () => {
    setOpen(false);
    setActivated(false);
    triggerRef.current?.focus({ preventScroll: true });
  };
  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size={size}
        disabled={disabled}
        className={className}
        aria-label={resolvedAriaLabel}
        onClick={() => {
          outsideDismissedRef.current = false;
          setActivated(true);
          setOpen(true);
        }}
      >
        <ScanLine className={cn("size-4", iconClassName)} />
        {showLabel ? <span>{resolvedLabel}</span> : null}
      </Button>
      {activated ? (
        <OrderQrScannerSheet
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (nextOpen) outsideDismissedRef.current = false;
          }}
          onOutsideDismiss={() => {
            outsideDismissedRef.current = true;
          }}
          closeBeforeLoad={closeBeforeLoad}
          onCloseAutoFocus={handleCloseAutoFocus}
        />
      ) : null}
    </>
  );
}

export function OrderQrScannerSheet({
  open,
  onOpenChange,
  navigateDocument = (href) => window.location.assign(href),
  closeBeforeLoad,
  onOutsideDismiss,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigateDocument?: (href: string) => void;
  closeBeforeLoad?: () => void;
  onOutsideDismiss?: () => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const { runGuardedTransition } = useNavigationGuard();
  const [scannerActivated, setScannerActivated] = useState(open);
  const [loaderVersion, setLoaderVersion] = useState(0);
  const LazyBarcodeScannerSheet = useMemo(
    () => createLazyBarcodeScannerSheet(loaderVersion),
    [loaderVersion],
  );

  useEffect(() => {
    if (open) setScannerActivated(true);
  }, [open]);

  const renderActions = (
    payload: CapturePayload,
    helpers: { close: () => void; rescan: () => void },
  ) => {
    if (!payload.targetHref) {
      return <p className="text-xs text-destructive">{t("orderQr.invalid")}</p>;
    }
    const targetHref = payload.targetHref;
    return (
      <Button
        type="button"
        size="sm"
        className="min-h-10"
        onClick={() => {
          void runGuardedTransition({
            kind: "route",
            label: t("orderQr.open"),
            run: () => {
              helpers.close();
              if (payload.kind === "customer_status_link") {
                const destination = parseCustomerStatusLink(targetHref, window.location.origin);
                if (destination?.kind !== "valid") {
                  toast.error(t("orderQr.invalidToast"));
                  return;
                }
                navigateDocument(destination.href);
                return;
              }
              router.push(targetHref);
            },
          });
        }}
      >
        {t("orderQr.open")}
      </Button>
    );
  };

  const cancelLazyScanner =
    closeBeforeLoad ??
    (() => {
      setScannerActivated(false);
      onOpenChange(false);
    });

  return scannerActivated ? (
    <LazyModalErrorBoundary
      key={loaderVersion}
      open={open}
      title={t("orderQr.title")}
      onCancel={cancelLazyScanner}
      onRetry={() => setLoaderVersion((current) => current + 1)}
    >
      <Suspense
        fallback={
          <LazyModalShell
            title={t("orderQr.title")}
            description={t("orderQr.lazyDescription")}
            onCancel={cancelLazyScanner}
            dataAttribute="order-qr-scanner-lazy-fallback"
          />
        }
      >
        <LazyBarcodeScannerSheet
          open={open}
          onOpenChange={onOpenChange}
          scanMode="qr-only"
          parsePayload={parseOrderQrPayload}
          title={t("orderQr.title")}
          description={t("scanner.qrOnlyDescription")}
          renderActions={renderActions}
          onOutsideDismiss={onOutsideDismiss}
          onCloseAutoFocus={onCloseAutoFocus}
        />
      </Suspense>
    </LazyModalErrorBoundary>
  ) : null;
}
