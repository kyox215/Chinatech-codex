"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";

import { useNavigationGuard } from "@/components/navigation-guard-provider";
import { Button } from "@/components/ui/button";
import { parseCustomerStatusLink } from "@/entities/customer-status/model/customer-status-link";
import { BarcodeScannerSheet } from "@/features/capture/components/barcode-scanner-sheet";
import type { CapturePayload } from "@/features/capture/model/barcode-parser";
import { parseOrderQrPayload } from "@/features/orders/model/order-qr-payload";
import { cn } from "@/lib/utils";

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
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={disabled}
        className={className}
        aria-label="扫描订单二维码"
        onClick={() => setOpen(true)}
      >
        <ScanLine className={cn("size-4", iconClassName)} />
        {showLabel ? <span>{label}</span> : null}
      </Button>
      <OrderQrScannerSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

export function OrderQrScannerSheet({
  open,
  onOpenChange,
  navigateDocument = (href) => window.location.assign(href),
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigateDocument?: (href: string) => void;
}) {
  const router = useRouter();
  const { runGuardedTransition } = useNavigationGuard();

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
        className="min-h-11"
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

  return (
    <BarcodeScannerSheet
      open={open}
      onOpenChange={onOpenChange}
      scanMode="qr-only"
      parsePayload={parseOrderQrPayload}
      title="扫描订单二维码"
      description="仅扫描订单查询二维码；IMEI、SN、EID 和普通条形码不会用于订单查询。"
      renderActions={renderActions}
    />
  );
}
