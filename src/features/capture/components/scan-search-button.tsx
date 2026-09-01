"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
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
import { useLocale } from "@/shared/i18n/locale-provider";

interface ScanSearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: ScanSearchScope;
  onSearch?: (value: string) => void;
  navigateDocument?: (href: string) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onOutsideDismiss?: () => void;
  onCloseAutoFocus?: (event: Event) => void;
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
  const outsideDismissedRef = useRef(false);
  const { locale, t } = useLocale();
  const resolvedLabel = label ?? t("scanner.title");
  const handleCloseAutoFocus = useCallback((event: Event) => {
    if (!outsideDismissedRef.current) {
      event.preventDefault();
      triggerRef.current?.focus({ preventScroll: true });
    }
    outsideDismissedRef.current = false;
  }, []);

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        className={className}
        aria-label={t("scanSearch.title", { scope: getScanSearchScopeLabel(scope, locale) })}
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
        <ScanSearchSheet
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (nextOpen) outsideDismissedRef.current = false;
          }}
          scope={scope}
          onSearch={onSearch}
          onOutsideDismiss={() => {
            outsideDismissedRef.current = true;
          }}
          onCloseAutoFocus={handleCloseAutoFocus}
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
  returnFocusRef,
  onOutsideDismiss,
  onCloseAutoFocus,
}: ScanSearchSheetProps) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const { runGuardedTransition } = useNavigationGuard();
  const openerRef = useRef<HTMLElement | null>(null);
  const previousOpenRef = useRef(false);
  const outsideDismissedRef = useRef(false);
  const [scannerActivated, setScannerActivated] = useState(open);
  const [loaderVersion, setLoaderVersion] = useState(0);
  const LazyBarcodeScannerSheet = useMemo(
    () => createLazyBarcodeScannerSheet(loaderVersion),
    [loaderVersion],
  );

  useEffect(() => {
    if (open) setScannerActivated(true);
  }, [open]);

  if (open && !previousOpenRef.current) {
    const activeElement = typeof document === "undefined" ? null : document.activeElement;
    openerRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    outsideDismissedRef.current = false;
  }
  previousOpenRef.current = open;

  const handleCloseAutoFocus = useCallback(
    (event: Event) => {
      onCloseAutoFocus?.(event);
      if (!event.defaultPrevented && !outsideDismissedRef.current) {
        event.preventDefault();
        (returnFocusRef?.current ?? openerRef.current)?.focus({ preventScroll: true });
      }
      outsideDismissedRef.current = false;
    },
    [onCloseAutoFocus, returnFocusRef],
  );

  const executeAction = (
    action: ScanSearchAction,
    helpers: { close: () => void; rescan: () => void },
  ) => {
    if (action.kind === "search" && onSearch) {
      helpers.close();
      onSearch(action.searchValue);
      toast.success(t("scanSearch.filled", { scope: getScanSearchScopeLabel(scope, locale) }));
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
            toast.error(t("orderQr.invalidToast"));
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
    const resolution = resolveScanSearchActions(payload, scope, locale);
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
      title={t("scanSearch.title", { scope: getScanSearchScopeLabel(scope, locale) })}
      onCancel={closeBeforeLoad}
      onRetry={() => setLoaderVersion((current) => current + 1)}
    >
      <Suspense
        fallback={
          <LazyModalShell
            title={t("scanSearch.title", { scope: getScanSearchScopeLabel(scope, locale) })}
            description={t("scanSearch.lazyDescription")}
            onCancel={closeBeforeLoad}
            dataAttribute="scan-search-lazy-fallback"
          />
        }
      >
        <LazyBarcodeScannerSheet
          open={open}
          onOpenChange={onOpenChange}
          title={t("scanSearch.title", { scope: getScanSearchScopeLabel(scope, locale) })}
          description={t("scanSearch.description")}
          renderActions={renderActions}
          onOutsideDismiss={() => {
            outsideDismissedRef.current = true;
            onOutsideDismiss?.();
          }}
          onCloseAutoFocus={handleCloseAutoFocus}
        />
      </Suspense>
    </LazyModalErrorBoundary>
  ) : null;
}
