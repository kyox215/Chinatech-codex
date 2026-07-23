"use client";

import { lazy, Suspense } from "react";
import { LoaderCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { componentOverlay } from "@/lib/component-patterns";
import type { NewOrderPrefill } from "@/features/orders/model/new-order-intent";

const LazyNewOrderScreen = lazy(() =>
  import("@/features/orders/screens/new-order-screen").then((module) => ({
    default: module.NewOrderScreen,
  })),
);

export function NewOrderDialog({
  open,
  sessionKey,
  prefill,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  sessionKey: number;
  prefill?: NewOrderPrefill;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-new-order-dialog="true"
        showCloseButton={false}
        className={componentOverlay.formWorkspace}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>新建维修工单</DialogTitle>
          <DialogDescription>在弹窗中填写客户、设备、故障与报价信息。</DialogDescription>
        </DialogHeader>
        {open ? (
          <Suspense
            fallback={
              <div className="flex h-full min-h-[20rem] items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                <span role="status">正在准备新建工单</span>
              </div>
            }
          >
            <LazyNewOrderScreen
              key={sessionKey}
              surface="dialog"
              prefill={prefill}
              onCancel={() => onOpenChange(false)}
              onCreated={onCreated}
            />
          </Suspense>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
