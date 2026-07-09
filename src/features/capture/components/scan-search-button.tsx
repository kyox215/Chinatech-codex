"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BarcodeScannerSheet } from "@/features/capture/components/barcode-scanner-sheet";
import type { CapturePayload } from "@/features/capture/model/barcode-parser";
import {
  getScanSearchScopeLabel,
  resolveScanSearchActions,
  type ScanSearchAction,
  type ScanSearchScope,
} from "@/features/capture/model/scan-search-resolver";
import { cn } from "@/lib/utils";

interface ScanSearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: ScanSearchScope;
  onSearch?: (value: string) => void;
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
}: ScanSearchButtonProps) {
  const [open, setOpen] = useState(false);
  const resolvedLabel = label ?? "扫码";

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
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

export function ScanSearchSheet({ open, onOpenChange, scope, onSearch }: ScanSearchSheetProps) {
  const router = useRouter();

  const executeAction = (
    action: ScanSearchAction,
    helpers: { close: () => void; rescan: () => void },
  ) => {
    helpers.close();
    if (action.kind === "search" && onSearch) {
      onSearch(action.searchValue);
      toast.success(`已填入${getScanSearchScopeLabel(scope)}搜索`);
      return;
    }
    router.push(action.href);
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
