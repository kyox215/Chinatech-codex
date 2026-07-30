"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { parseCustomerStatusLink } from "@/entities/customer-status/model/customer-status-link";
import { BarcodeScannerSheet } from "@/features/capture/components/barcode-scanner-sheet";
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
  const resolvedLabel = label ?? "扫码";

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        className={className}
        aria-label={`${getScanSearchScopeLabel(scope)}扫码查询`}
        onClick={() => setOpen(true)}
      >
        <ScanLine className={cn("size-4", iconClassName)} />
        {showLabel ? <span>{resolvedLabel}</span> : null}
      </Button>
      <ScanSearchSheet open={open} onOpenChange={setOpen} scope={scope} onSearch={onSearch} />
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

  return (
    <BarcodeScannerSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${getScanSearchScopeLabel(scope)}扫码查询`}
      description="扫描工单二维码、库存标签、客户标签、IMEI 条码或手动输入内容。"
      renderActions={renderActions}
    />
  );
}
