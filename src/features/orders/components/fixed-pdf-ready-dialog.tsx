"use client";

import { Download, ExternalLink, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PrintPaperMode } from "@/features/orders/components/print-portal";
import type { PreparedFixedPdf } from "@/features/orders/print/fixed-order-pdf-delivery";

const paperLabels: Record<PrintPaperMode, string> = {
  "a5-landscape": "A5 横向",
  "a4-landscape-full": "A4 横向铺满",
  "a4-portrait-half": "A4 上半裁切",
  "a4-portrait-duplicate": "A4 双联",
};

export function FixedPdfReadyDialog({
  prepared,
  pending,
  errorMessage,
  onClose,
  onShare,
  onOpenPdf,
  onDownload,
}: {
  prepared: PreparedFixedPdf | null;
  pending: boolean;
  errorMessage?: string;
  onClose: () => void;
  onShare: () => void;
  onOpenPdf: () => void;
  onDownload: () => void;
}) {
  return (
    <Dialog open={Boolean(prepared)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-fixed-pdf-ready-dialog="true"
        className="max-w-md"
        closeClassName="size-9 sm:size-8"
        onOpenAutoFocus={(event) => {
          if (!prepared) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>PDF 已准备好</DialogTitle>
          <DialogDescription>
            {prepared ? `${paperLabels[prepared.paperMode]} · ` : ""}
            手机端请打开系统菜单后选择“打印”。PDF 内容和清晰度不会改变。
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-xs text-status-danger-foreground"
          >
            {errorMessage}
          </div>
        ) : null}

        <div role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {prepared?.metrics.cacheHit
            ? "已复用当前订单的高质量 PDF，可立即打开。"
            : "已按 3× 高质量生成并保存在当前页面内存中。"}
        </div>

        <DialogFooter className="grid gap-2 sm:grid-cols-2">
          {prepared?.canShare ? (
            <Button
              type="button"
              className="h-9 w-full"
              disabled={pending}
              aria-busy={pending}
              onClick={onShare}
            >
              <Printer className="size-4" aria-hidden="true" />
              打印或分享 PDF
            </Button>
          ) : (
            <Button type="button" className="h-10 w-full" onClick={onOpenPdf}>
              <ExternalLink className="size-4" aria-hidden="true" />
              打开 PDF
            </Button>
          )}
          {prepared?.canShare ? (
            <Button type="button" variant="outline" className="h-9 w-full" onClick={onOpenPdf}>
              <ExternalLink className="size-4" aria-hidden="true" />
              查看 PDF
            </Button>
          ) : (
            <Button type="button" variant="outline" className="h-9 w-full" onClick={onDownload}>
              <Download className="size-4" aria-hidden="true" />
              下载 PDF
            </Button>
          )}
        </DialogFooter>

        {prepared?.canShare ? (
          <Button type="button" variant="ghost" className="h-9 w-full" onClick={onDownload}>
            <Download className="size-4" aria-hidden="true" />
            下载备用文件
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
