"use client";

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LazyModalErrorBoundary, LazyModalShell } from "@/components/lazy-modal-shell";
import { parseCustomerStatusLink } from "@/entities/customer-status/model/customer-status-link";
import type { CapturePayload } from "@/features/capture/model/barcode-parser";
import {
  getScanSearchScopeLabel,
  resolveScanSearchActions,
  type ScanSearchAction,
  type ScanSearchScope,
} from "@/features/capture/model/scan-search-resolver";
import { createScanSearchIntent } from "@/features/capture/model/scan-intent";
import { cn } from "@/lib/utils";
import { useNavigationGuard } from "@/components/navigation-guard-provider";

interface ScanSearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: ScanSearchScope;
  onSearch?: (value: string) => void;
  navigateDocument?: (href: string) => void;
}

interface ScanSearchButtonProps {
  scope: ScanSearchScope;
  onSearch?: (value: string) => void;
  className?: string;
  iconClassName?: string;
  showLabel?: boolean;
  label?: string;
  size?: "sm" | "icon";
  variant?: "outline" | "ghost";
  disabled?: boolean;
}

function createLazyBarcodeScannerSheet(attempt: number) {
  return lazy(() => {
    void attempt;
    return import("@/features/capture/components/barcode-scanner-sheet").then((module) => ({
      default: module.BarcodeScannerSheet,
    }));
  });
}

export function ScanSearchButton({
  scope,
  onSearch,
  className,
  iconClassName,
  showLabel = false,
  label,
  size = "icon",
  variant = "outline",
  disabled = false,
}: ScanSearchButtonProps) {
  const [open, setOpen] = useState(false);
  const [activated, setActivated] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const resolvedLabel = label ?? "扫码";
  const restoreTriggerFocus = () => {
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        className={className}
        aria-label={`${getScanSearchScopeLabel(scope)}扫码查询`}
        onClick={() => {
          setActivated(true);
          setOpen(true);
        }}
      >
        <ScanLine className={cn("size-4", iconClassName)} />
        {showLabel ? <span>{resolvedLabel}</span> : null}
      </Button>
      {activated ? (
        <ScanSearchSheet
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) restoreTriggerFocus();
          }}
          scope={scope}
          onSearch={onSearch}
        />
      ) : null}
    </>
  );
}

export function ScanSearchSheet({
  open,
  onOpenChange,
  scope,
  onSearch,
  navigateDocument = (href) => window.location.assign(href),
}: ScanSearchSheetProps) {
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

  const executeAction = (
    action: ScanSearchAction,
    helpers: { close: () => void; rescan: () => void },
  ) => {
    if (action.kind === "search" && onSearch) {
      helpers.close();
      onSearch(action.searchValue);
      toast.success(`已填入${getScanSearchScopeLabel(scope)}搜索`);
      return;
    }
    if (action.kind === "search") {
      createScanSearchIntent(action.scope, action.searchValue);
    }
    void runGuardedTransition({
      kind: "route",
      label: action.label,
      run: () => {
        helpers.close();
        if (action.id === "open:customer_status_link") {
          const destination = parseCustomerStatusLink(action.href, window.location.origin);
          if (destination?.kind !== "valid") {
            toast.error("维修工单二维码无效，请重新扫描");
            return;
          }
          navigateDocument(destination.href);
          return;
        }
        router.push(action.href);
      },
    });
  };

  const renderActions = (
    payload: CapturePayload,
    helpers: { close: () => void; rescan: () => void },
  ) => {
    const resolution = resolveScanSearchActions(payload, scope);
    if (resolution.actions.length === 0) return null;

    return (
      <div className="grid w-full gap-2">
        <p className="text-xs leading-5 text-muted-foreground">{resolution.hint}</p>
        <div className="flex flex-wrap gap-2">
          {resolution.actions.map((action) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              className="min-h-11"
              variant={action.primary ? "default" : "outline"}
              onClick={() => executeAction(action, helpers)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    );
  };

  const closeBeforeLoad = () => {
    setScannerActivated(false);
    onOpenChange(false);
  };

  return scannerActivated ? (
    <LazyModalErrorBoundary
      key={loaderVersion}
      open={open}
      title={`${getScanSearchScopeLabel(scope)}扫码查询`}
      onCancel={closeBeforeLoad}
      onRetry={() => setLoaderVersion((current) => current + 1)}
    >
      <Suspense
        fallback={
          <LazyModalShell
            title={`${getScanSearchScopeLabel(scope)}扫码查询`}
            description="扫码工具正在加载，可以取消并返回当前页面。"
            onCancel={closeBeforeLoad}
            dataAttribute="scan-search-lazy-fallback"
          />
        }
      >
        <LazyBarcodeScannerSheet
          open={open}
          onOpenChange={onOpenChange}
          title={`${getScanSearchScopeLabel(scope)}扫码查询`}
          description="扫描工单二维码、库存标签、客户标签、IMEI 条码或手动输入内容。"
          renderActions={renderActions}
        />
      </Suspense>
    </LazyModalErrorBoundary>
  ) : null;
}
