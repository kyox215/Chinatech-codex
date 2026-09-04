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
import { useLocale } from "@/shared/i18n/locale-provider";

const paperLabelKeys: Record<PrintPaperMode, Parameters<ReturnType<typeof useLocale>["t"]>[0]> = {
  "a5-landscape": "orders2b2.printPaper.a5",
  "a4-landscape-full": "orders2b2.printPaper.a4Landscape",
  "a4-portrait-half": "orders2b2.printPaper.a4Half",
  "a4-portrait-duplicate": "orders2b2.printPaper.a4Duplicate",
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
  const { t } = useLocale();
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
          <DialogTitle>{t("orders2b2.pdf.title")}</DialogTitle>
          <DialogDescription>
            {prepared ? `${t(paperLabelKeys[prepared.paperMode])} · ` : ""}
            {t("orders2b2.pdf.help")}
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
          {prepared?.metrics.cacheHit ? t("orders2b2.pdf.cached") : t("orders2b2.pdf.generated")}
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
              {t("orders2b2.pdf.share")}
            </Button>
          ) : (
            <Button type="button" className="h-10 w-full" onClick={onOpenPdf}>
              <ExternalLink className="size-4" aria-hidden="true" />
              {t("orders2b2.pdf.open")}
            </Button>
          )}
          {prepared?.canShare ? (
            <Button type="button" variant="outline" className="h-9 w-full" onClick={onOpenPdf}>
              <ExternalLink className="size-4" aria-hidden="true" />
              {t("orders2b2.pdf.view")}
            </Button>
          ) : (
            <Button type="button" variant="outline" className="h-9 w-full" onClick={onDownload}>
              <Download className="size-4" aria-hidden="true" />
              {t("orders2b2.pdf.download")}
            </Button>
          )}
        </DialogFooter>

        {prepared?.canShare ? (
          <Button type="button" variant="ghost" className="h-9 w-full" onClick={onDownload}>
            <Download className="size-4" aria-hidden="true" />
            {t("orders2b2.pdf.backup")}
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
