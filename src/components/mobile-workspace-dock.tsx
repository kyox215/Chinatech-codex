"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Command } from "lucide-react";

import {
  AttachmentDraftPanel,
  CameraCaptureSheet,
  revokeAttachmentDraft,
  ScanSearchSheet,
  type AttachmentDraft,
} from "@/features/capture";
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
  const [open, setOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>([]);
  const attachmentDraftsRef = useRef<AttachmentDraft[]>([]);
  const router = useRouter();
  const { runGuardedTransition } = useNavigationGuard();
  const shell = useStoreShellContext();
  attachmentDraftsRef.current = attachmentDrafts;

  useEffect(() => {
    return () => {
      attachmentDraftsRef.current.forEach(revokeAttachmentDraft);
    };
  }, []);

  if (pathname === "/" || isMobileWorkspaceRoute) {
    return null;
  }

  const primaryAction = getShellPrimaryAction(pathname, shell.isPlatformAdmin);
  const actions = [
    primaryAction,
    ...globalMobileQuickActions.filter((action) => action.id !== primaryAction.id),
  ];

  const runAction = (action: (typeof actions)[number]) => {
    runRepairDeskShellAction(action, {
      pathname,
      push: (href) =>
        runGuardedTransition({
          kind: "route",
          label: action.label,
          run: () => router.push(href),
        }),
      close: () => setOpen(false),
      openCommand: onOpenCommand,
      openScanner: () => setScannerOpen(true),
      openCamera: () => setCameraOpen(true),
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            data-mobile-workspace-trigger="true"
            className={repairOs.floatingAction}
            aria-label="打开快捷操作"
          >
            <Command className="size-3.5" />
            <span>快捷</span>
            <RealtimeSyncIndicator compact />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className={repairOs.quickSheet}>
          <SheetHeader className="px-1 text-left">
            <SheetTitle className="text-base">快捷操作</SheetTitle>
            <SheetDescription>当前模块动作与扫码、拍照、搜索工具。</SheetDescription>
          </SheetHeader>
          <div className={repairOs.quickActionList}>
            {actions.map((action, index) => {
              const isPrimary = index === 0;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => runAction(action)}
                  className={cn(repairOs.quickActionItem, isPrimary && repairOs.quickActionPrimary)}
                >
                  <span
                    className={cn(
                      repairOs.quickActionIcon,
                      isPrimary && repairOs.quickActionIconPrimary,
                    )}
                  >
                    <action.icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className={repairOs.quickActionLabel}>
                      {isPrimary ? "当前 · " : null}
                      {action.label}
                    </span>
                    <span className={repairOs.quickActionDescription}>{action.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {attachmentDrafts.length > 0 ? (
            <div className="mt-3">
              <AttachmentDraftPanel
                attachments={attachmentDrafts}
                onChange={setAttachmentDrafts}
                onOpenCamera={() => {
                  setOpen(false);
                  setCameraOpen(true);
                }}
                defaultKind="fault_photo"
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
      <ScanSearchSheet open={scannerOpen} onOpenChange={setScannerOpen} scope="global" />
      <CameraCaptureSheet
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(draft) => setAttachmentDrafts((current) => [...current, draft])}
      />
    </>
  );
}

export function shouldHideMobileWorkspaceDock(pathname: string) {
  const isSettingsRoute = pathname === "/settings" || pathname.startsWith("/settings/");
  const isOrdersList = pathname === "/orders";
  const isMobileWorkspaceRoute =
    isOrdersList || pathname === "/orders/new" || /^\/orders\/[^/]+(?:\/task)?$/.test(pathname);
  return isSettingsRoute || isMobileWorkspaceRoute;
}
