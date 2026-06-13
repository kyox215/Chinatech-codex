"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Camera,
  ClipboardPlus,
  Command,
  MessageSquare,
  Package,
  Recycle,
  ScanLine,
  Search,
  Settings2,
  Users,
} from "lucide-react";

import {
  AttachmentDraftPanel,
  BarcodeScannerSheet,
  CameraCaptureSheet,
  revokeAttachmentDraft,
  type AttachmentDraft,
  type CapturePayload,
} from "@/features/capture";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { REPAIRDESK_NEW_ORDER_EVENT } from "@/lib/app-events";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

interface MobileWorkspaceDockProps {
  onOpenCommand: () => void;
}

interface QuickAction {
  label: string;
  description: string;
  icon: LucideIcon;
  run: () => void;
}

export function MobileWorkspaceDock({ onOpenCommand }: MobileWorkspaceDockProps) {
  const [open, setOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>([]);
  const attachmentDraftsRef = useRef<AttachmentDraft[]>([]);
  const pathname = usePathname() ?? "/";
  const router = useRouter();
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

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const primaryAction: QuickAction = (() => {
    if (pathname.startsWith("/customers")) {
      return {
        label: "新建客户",
        description: "录入客户资料与联系方式",
        icon: Users,
        run: () => go("/customers?new=1"),
      };
    }
    if (pathname.startsWith("/buyback")) {
      return {
        label: "新建回收",
        description: "创建旧机估价与检测记录",
        icon: Recycle,
        run: () => go("/buyback?new=1"),
      };
    }
    if (pathname.startsWith("/inventory")) {
      return {
        label: "库存入库",
        description: "新增配件、翻新机或商品",
        icon: Package,
        run: () => go("/inventory?new=1"),
      };
    }
    if (pathname.startsWith("/settings")) {
      return {
        label: "邀请成员",
        description: "进入成员权限与邀请",
        icon: Settings2,
        run: () => go("/settings#settings-members"),
      };
    }
    return {
      label: "新建工单",
      description: "快速进入接单流程",
      icon: ClipboardPlus,
      run: () => {
        setOpen(false);
        if (isOrdersList) {
          window.dispatchEvent(new CustomEvent(REPAIRDESK_NEW_ORDER_EVENT));
          return;
        }
        router.push("/orders/new");
      },
    };
  })();

  const actions: QuickAction[] = [
    primaryAction,
    {
      label: "扫码读取",
      description: "识别工单、IMEI、库存标签",
      icon: ScanLine,
      run: () => {
        setOpen(false);
        setScannerOpen(true);
      },
    },
    {
      label: "拍照采集",
      description: "采集设备外观或故障照片",
      icon: Camera,
      run: () => {
        setOpen(false);
        setCameraOpen(true);
      },
    },
    {
      label: "消息模板",
      description: "打开 WhatsApp / SMS 模板",
      icon: MessageSquare,
      run: () => go("/messages"),
    },
    {
      label: "全局搜索",
      description: "搜索工单、客户和设备",
      icon: Search,
      run: () => {
        setOpen(false);
        onOpenCommand();
      },
    },
  ];

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
                  onClick={action.run}
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
