"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Command } from "lucide-react";

import {
  AttachmentDraftPanel,
  BarcodeScannerSheet,
  CameraCaptureSheet,
  revokeAttachmentDraft,
  type AttachmentDraft,
  type CapturePayload,
} from "@/features/capture";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
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

interface MobileWorkspaceDockProps {
  onOpenCommand: () => void;
}

export function MobileWorkspaceDock({ onOpenCommand }: MobileWorkspaceDockProps) {
  const [open, setOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>([]);
  const attachmentDraftsRef = useRef<AttachmentDraft[]>([]);
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const shell = useStoreShellContext();
  const isOrdersList = pathname === "/orders";
  const isMobileWorkspaceRoute =
    isOrdersList || pathname === "/orders/new" || /^\/orders\/[^/]+(?:\/task)?$/.test(pathname);

  attachmentDraftsRef.current = attachmentDrafts;

  useEffect(() => {
    return () => {
      attachmentDraftsRef.current.forEach(revokeAttachmentDraft);
    };
  }, []);

  if (isMobileWorkspaceRoute) {
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
      push: (href) => router.push(href),
      close: () => setOpen(false),
      openCommand: onOpenCommand,
      openScanner: () => setScannerOpen(true),
      openCamera: () => setCameraOpen(true),
    });
  };

  const renderScannerActions = (payload: CapturePayload, helpers: { close: () => void }) => {
    if (payload.targetHref) {
      return (
        <Button
          type="button"
          size="sm"
          onClick={() => {
            helpers.close();
            router.push(payload.targetHref!);
          }}
        >
          打开目标
        </Button>
      );
    }

    if (payload.kind === "imei" || payload.kind === "serial") {
      return (
        <Button
          type="button"
          size="sm"
          onClick={() => {
            helpers.close();
            router.push(`/orders/new?imei=${encodeURIComponent(payload.value)}`);
          }}
        >
          新建工单并带入
        </Button>
      );
    }

    return null;
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
      <BarcodeScannerSheet
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        renderActions={renderScannerActions}
      />
      <CameraCaptureSheet
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(draft) => setAttachmentDrafts((current) => [...current, draft])}
      />
    </>
  );
}
