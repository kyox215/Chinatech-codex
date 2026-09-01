"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Command, Sparkles } from "lucide-react";

import {
  revokeAttachmentDraft,
  type AttachmentDraft,
} from "@/features/capture/model/attachment-rules";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { RealtimeSyncIndicator } from "@/features/realtime";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { repairOs } from "@/lib/ui-patterns";
import { globalMobileQuickActions, getShellPrimaryAction } from "@/shared/config/navigation";
import { runRepairDeskShellAction } from "@/shared/lib/shell-actions";
import { cn } from "@/lib/utils";
import { useNavigationGuard } from "@/components/navigation-guard-provider";
import { useAiAssistantWorkspace } from "@/features/ai-assistant";
import { createNewOrderSessionId } from "@/features/orders/model/new-order-intent";
import { buildNewOrderWorkspaceHref } from "@/features/orders/model/order-workspace-intent";
import { LazyModalErrorBoundary, LazyModalShell } from "@/components/lazy-modal-shell";
import { useLocale } from "@/shared/i18n/locale-provider";
import { localizeShellAction } from "@/shared/i18n/navigation";

function createLazyAttachmentDraftPanel(attempt: number) {
  return lazy(() => {
    void attempt;
    return import("@/features/capture/components/attachment-draft-panel").then((module) => ({
      default: module.AttachmentDraftPanel,
    }));
  });
}

function createLazyCameraCaptureSheet(attempt: number) {
  return lazy(() => {
    void attempt;
    return import("@/features/capture/components/camera-capture-sheet").then((module) => ({
      default: module.CameraCaptureSheet,
    }));
  });
}

function createLazyScanSearchSheet(attempt: number) {
  return lazy(() => {
    void attempt;
    return import("@/features/capture/components/scan-search-button").then((module) => ({
      default: module.ScanSearchSheet,
    }));
  });
}

interface MobileWorkspaceDockProps {
  onOpenCommand: () => void;
}

export function MobileWorkspaceDock({ onOpenCommand }: MobileWorkspaceDockProps) {
  const pathname = usePathname() ?? "/";
  if (shouldHideMobileWorkspaceDock(pathname)) return null;

  return <MobileWorkspaceDockContent pathname={pathname} onOpenCommand={onOpenCommand} />;
}

function MobileWorkspaceDockContent({
  pathname,
  onOpenCommand,
}: MobileWorkspaceDockProps & { pathname: string }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scannerActivated, setScannerActivated] = useState(false);
  const [cameraActivated, setCameraActivated] = useState(false);
  const [scannerLoaderVersion, setScannerLoaderVersion] = useState(0);
  const [cameraLoaderVersion, setCameraLoaderVersion] = useState(0);
  const [attachmentLoaderVersion, setAttachmentLoaderVersion] = useState(0);
  const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>([]);
  const attachmentDraftsRef = useRef<AttachmentDraft[]>([]);
  const dockTriggerRef = useRef<HTMLButtonElement | null>(null);
  const scannerOutsideDismissedRef = useRef(false);
  const cameraOutsideDismissedRef = useRef(false);
  const router = useRouter();
  const { runGuardedTransition } = useNavigationGuard();
  const shell = useStoreShellContext();
  const aiAssistant = useAiAssistantWorkspace();
  const LazyAttachmentDraftPanel = useMemo(
    () => createLazyAttachmentDraftPanel(attachmentLoaderVersion),
    [attachmentLoaderVersion],
  );
  const LazyCameraCaptureSheet = useMemo(
    () => createLazyCameraCaptureSheet(cameraLoaderVersion),
    [cameraLoaderVersion],
  );
  const LazyScanSearchSheet = useMemo(
    () => createLazyScanSearchSheet(scannerLoaderVersion),
    [scannerLoaderVersion],
  );
  attachmentDraftsRef.current = attachmentDrafts;

  useEffect(() => {
    return () => {
      attachmentDraftsRef.current.forEach(revokeAttachmentDraft);
    };
  }, []);

  const resolvedPrimaryAction = getShellPrimaryAction(pathname, shell.isPlatformAdmin);
  const primaryAction =
    resolvedPrimaryAction.id === "new-memo" && !shell.permissions?.canCreateMemos
      ? globalMobileQuickActions.find((action) => action.id === "search")!
      : resolvedPrimaryAction;
  const actions = [
    primaryAction,
    ...globalMobileQuickActions.filter((action) => action.id !== primaryAction.id),
  ].map((action) => localizeShellAction(action, t));

  const restoreDockTriggerFocus = useCallback(() => {
    dockTriggerRef.current?.focus({ preventScroll: true });
  }, []);
  const handleScannerCloseAutoFocus = useCallback(
    (event: Event) => {
      if (!scannerOutsideDismissedRef.current) {
        event.preventDefault();
        restoreDockTriggerFocus();
      }
      scannerOutsideDismissedRef.current = false;
    },
    [restoreDockTriggerFocus],
  );
  const handleCameraCloseAutoFocus = useCallback(
    (event: Event) => {
      if (!cameraOutsideDismissedRef.current) {
        event.preventDefault();
        restoreDockTriggerFocus();
      }
      cameraOutsideDismissedRef.current = false;
    },
    [restoreDockTriggerFocus],
  );
  const cancelScanner = () => {
    setScannerOpen(false);
    setScannerActivated(false);
    restoreDockTriggerFocus();
  };
  const cancelCamera = () => {
    setCameraOpen(false);
    setCameraActivated(false);
    restoreDockTriggerFocus();
  };
  const cancelAttachmentPanel = () => {
    setOpen(false);
    restoreDockTriggerFocus();
  };
  const scannerPanelState = getMobileWorkspaceLazyPanelState(scannerActivated, scannerOpen);
  const cameraPanelState = getMobileWorkspaceLazyPanelState(cameraActivated, cameraOpen);

  const runAction = (action: (typeof actions)[number]) => {
    runRepairDeskShellAction(action, {
      pathname,
      push: (href) => {
        const target =
          action.id === "new-order"
            ? buildNewOrderWorkspaceHref({
                source: "mobile",
                sessionId: createNewOrderSessionId(),
              })
            : href;
        return runGuardedTransition({
          kind: "route",
          label: action.label,
          run: () => router.push(target),
        }).then((outcome) => {
          if (outcome.status === "ignored" || outcome.status === "failed") setOpen(true);
          return outcome;
        });
      },
      close: () => setOpen(false),
      openCommand: onOpenCommand,
      openScanner: () => {
        scannerOutsideDismissedRef.current = false;
        setScannerActivated(true);
        setScannerOpen(true);
      },
      openCamera: () => {
        cameraOutsideDismissedRef.current = false;
        setCameraActivated(true);
        setCameraOpen(true);
      },
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            ref={dockTriggerRef}
            size="sm"
            variant="outline"
            data-mobile-workspace-trigger="true"
            className={repairOs.floatingAction}
            aria-label={t("shell.openQuickActions")}
          >
            <Command className="size-3.5" />
            <span>{t("shell.quick")}</span>
            <RealtimeSyncIndicator compact />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className={repairOs.quickSheet}>
          <SheetHeader className="px-1 text-left">
            <SheetTitle className="text-base">{t("shell.quickActions")}</SheetTitle>
            <SheetDescription>{t("shell.quickActionsDescription")}</SheetDescription>
          </SheetHeader>
          <div className={repairOs.quickActionList}>
            {actions.slice(0, 1).map((action) => (
              <button
                key={action.label}
                type="button"
                data-mobile-workspace-action="primary"
                onClick={() => runAction(action)}
                className={cn(repairOs.quickActionItem, repairOs.quickActionPrimary)}
              >
                <span className={cn(repairOs.quickActionIcon, repairOs.quickActionIconPrimary)}>
                  <action.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className={repairOs.quickActionLabel}>
                    {t("shell.currentAction", { action: action.label })}
                  </span>
                  <span className={repairOs.quickActionDescription}>{action.description}</span>
                </span>
              </button>
            ))}
            {aiAssistant.canOpenOrderAssistant ? (
              <button
                type="button"
                data-ai-assistant-trigger="mobile-dock"
                onClick={() => {
                  setOpen(false);
                  window.requestAnimationFrame(aiAssistant.openAssistant);
                }}
                className={repairOs.quickActionItem}
              >
                <span className={repairOs.quickActionIcon}>
                  <Sparkles className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className={repairOs.quickActionLabel}>{t("shell.aiAssistantMobile")}</span>
                  <span className={repairOs.quickActionDescription}>
                    {t("shell.aiAssistantDescription")}
                  </span>
                </span>
              </button>
            ) : null}
            {actions.slice(1).map((action) => {
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => runAction(action)}
                  className={repairOs.quickActionItem}
                >
                  <span className={repairOs.quickActionIcon}>
                    <action.icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className={repairOs.quickActionLabel}>{action.label}</span>
                    <span className={repairOs.quickActionDescription}>{action.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {attachmentDrafts.length > 0 ? (
            <div className="mt-3">
              <LazyModalErrorBoundary
                key={`attachment-${attachmentLoaderVersion}`}
                open={open}
                title={t("shell.attachmentPanel")}
                onCancel={cancelAttachmentPanel}
                onRetry={() => setAttachmentLoaderVersion((current) => current + 1)}
              >
                <Suspense
                  fallback={
                    <CapturePanelFallback
                      label={t("shell.loadingAttachmentPanel")}
                      onCancel={cancelAttachmentPanel}
                    />
                  }
                >
                  <LazyAttachmentDraftPanel
                    attachments={attachmentDrafts}
                    onChange={setAttachmentDrafts}
                    onOpenCamera={() => {
                      setOpen(false);
                      cameraOutsideDismissedRef.current = false;
                      setCameraActivated(true);
                      setCameraOpen(true);
                    }}
                    defaultKind="fault_photo"
                  />
                </Suspense>
              </LazyModalErrorBoundary>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
      {scannerPanelState.mounted ? (
        <LazyModalErrorBoundary
          key={`scanner-${scannerLoaderVersion}`}
          open={scannerOpen}
          title={t("shell.scanner")}
          onCancel={cancelScanner}
          onRetry={() => setScannerLoaderVersion((current) => current + 1)}
        >
          <Suspense
            fallback={
              <CapturePanelFallback label={t("shell.openingScanner")} onCancel={cancelScanner} />
            }
          >
            <LazyScanSearchSheet
              open={scannerPanelState.open}
              onOpenChange={(nextOpen) => {
                setScannerOpen(nextOpen);
                if (nextOpen) scannerOutsideDismissedRef.current = false;
              }}
              onOutsideDismiss={() => {
                scannerOutsideDismissedRef.current = true;
              }}
              onCloseAutoFocus={handleScannerCloseAutoFocus}
              scope="global"
            />
          </Suspense>
        </LazyModalErrorBoundary>
      ) : null}
      {cameraPanelState.mounted ? (
        <LazyModalErrorBoundary
          key={`camera-${cameraLoaderVersion}`}
          open={cameraOpen}
          title={t("shell.camera")}
          onCancel={cancelCamera}
          onRetry={() => setCameraLoaderVersion((current) => current + 1)}
        >
          <Suspense
            fallback={
              <CapturePanelFallback label={t("shell.openingCamera")} onCancel={cancelCamera} />
            }
          >
            <LazyCameraCaptureSheet
              open={cameraPanelState.open}
              onOpenChange={(nextOpen) => {
                setCameraOpen(nextOpen);
                if (nextOpen) cameraOutsideDismissedRef.current = false;
              }}
              onOutsideDismiss={() => {
                cameraOutsideDismissedRef.current = true;
              }}
              onCloseAutoFocus={handleCameraCloseAutoFocus}
              onCapture={(draft) => setAttachmentDrafts((current) => [...current, draft])}
            />
          </Suspense>
        </LazyModalErrorBoundary>
      ) : null}
    </>
  );
}

export function getMobileWorkspaceLazyPanelState(activated: boolean, open: boolean) {
  return { mounted: activated, open: activated && open };
}

function CapturePanelFallback({ label, onCancel }: { label: string; onCancel: () => void }) {
  const { t } = useLocale();
  return (
    <LazyModalShell
      title={label}
      description={t("shell.quickToolLoading")}
      onCancel={onCancel}
      dataAttribute="mobile-workspace-lazy-fallback"
    />
  );
}

export function shouldHideMobileWorkspaceDock(pathname: string) {
  const isSettingsRoute = pathname === "/settings" || pathname.startsWith("/settings/");
  const isOrdersList = pathname === "/orders";
  const isCustomerDetail = /^\/customers\/[^/]+$/.test(pathname);
  const isMobileWorkspaceRoute =
    isOrdersList || pathname === "/orders/new" || /^\/orders\/[^/]+(?:\/task)?$/.test(pathname);
  return pathname === "/" || isSettingsRoute || isMobileWorkspaceRoute || isCustomerDetail;
}
