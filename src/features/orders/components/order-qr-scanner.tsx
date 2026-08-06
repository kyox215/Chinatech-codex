"use client";

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  label = "扫码",
  size = "icon",
  disabled = false,
}: {
  className?: string;
  iconClassName?: string;
  showLabel?: boolean;
  label?: string;
  size?: "sm" | "icon";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activated, setActivated] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreTriggerFocus = () => {
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const closeBeforeLoad = () => {
    setOpen(false);
    setActivated(false);
    restoreTriggerFocus();
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
        aria-label="扫描订单二维码"
        onClick={() => {
          setActivated(true);
          setOpen(true);
        }}
      >
        <ScanLine className={cn("size-4", iconClassName)} />
        {showLabel ? <span>{label}</span> : null}
      </Button>
      {activated ? (
        <OrderQrScannerSheet
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) restoreTriggerFocus();
          }}
          closeBeforeLoad={closeBeforeLoad}
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigateDocument?: (href: string) => void;
  closeBeforeLoad?: () => void;
}) {
  const router = useRouter();
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
      return <p className="text-xs text-destructive">只接受有效的订单二维码，请重新扫描。</p>;
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
            label: "打开扫码订单",
            run: () => {
              helpers.close();
              if (payload.kind === "customer_status_link") {
                const destination = parseCustomerStatusLink(targetHref, window.location.origin);
                if (destination?.kind !== "valid") {
                  toast.error("维修工单二维码无效，请重新扫描");
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
        打开订单
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
      title="扫描订单二维码"
      onCancel={cancelLazyScanner}
      onRetry={() => setLoaderVersion((current) => current + 1)}
    >
      <Suspense
        fallback={
          <LazyModalShell
            title="扫描订单二维码"
            description="订单二维码扫描器正在加载，可以取消并返回当前页面。"
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
          title="扫描订单二维码"
          description="仅扫描订单查询二维码；IMEI、SN、EID 和普通条形码不会用于订单查询。"
          renderActions={renderActions}
        />
      </Suspense>
    </LazyModalErrorBoundary>
  ) : null;
}
