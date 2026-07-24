"use client";

import { Printer, Scissors } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PrintPaperMode } from "@/features/orders/components/print-portal";

const STORAGE_KEY = "repairdesk.order-print-paper-mode";

export function readOrderPrintPaperMode(): PrintPaperMode {
  if (typeof window === "undefined") return "a5-landscape";
  return window.localStorage.getItem(STORAGE_KEY) === "a4-portrait-half"
    ? "a4-portrait-half"
    : "a5-landscape";
}

export function rememberOrderPrintPaperMode(mode: PrintPaperMode) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, mode);
}

export function OrderPrintPaperDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mode: PrintPaperMode) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>选择打印纸张</DialogTitle>
          <DialogDescription>
            将生成固定尺寸 PDF；工单内容和排版完全相同，只改变纸张承载方式。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            className="h-auto min-h-20 justify-start gap-3 whitespace-normal p-3 text-left"
            onClick={() => onSelect("a5-landscape")}
          >
            <Printer className="size-5 shrink-0" />
            <span>
              <strong className="block">A5 横向打印</strong>
              <small className="font-normal opacity-80">A5 纸直接打印，推荐</small>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-20 justify-start gap-3 whitespace-normal p-3 text-left"
            onClick={() => onSelect("a4-portrait-half")}
          >
            <Scissors className="size-5 shrink-0" />
            <span>
              <strong className="block">A4 对半裁切</strong>
              <small className="font-normal text-muted-foreground">打印在上半页，沿线裁切</small>
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
