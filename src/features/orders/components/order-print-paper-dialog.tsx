"use client";

import { Copy, Maximize2, Printer, Scissors } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PrintPaperMode } from "@/features/orders/components/print-portal";
import { useLocale } from "@/shared/i18n/locale-provider";

const STORAGE_KEY = "repairdesk.order-print-paper-mode";

export function readOrderPrintPaperMode(): PrintPaperMode {
  if (typeof window === "undefined") return "a5-landscape";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (
    stored === "a5-landscape" ||
    stored === "a4-landscape-full" ||
    stored === "a4-portrait-half" ||
    stored === "a4-portrait-duplicate"
  ) {
    return stored;
  }
  return "a5-landscape";
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
  const { t } = useLocale();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("orders2b2.printPaper.title")}</DialogTitle>
          <DialogDescription>{t("orders2b2.printPaper.help")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            className="h-auto min-h-20 justify-start gap-3 whitespace-normal p-3 text-left"
            onClick={() => onSelect("a5-landscape")}
          >
            <Printer className="size-5 shrink-0" />
            <span>
              <strong className="block">{t("orders2b2.printPaper.a5")}</strong>
              <small className="font-normal opacity-80">{t("orders2b2.printPaper.a5Help")}</small>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-20 justify-start gap-3 whitespace-normal p-3 text-left"
            onClick={() => onSelect("a4-landscape-full")}
          >
            <Maximize2 className="size-5 shrink-0" />
            <span>
              <strong className="block">{t("orders2b2.printPaper.a4Landscape")}</strong>
              <small className="font-normal text-muted-foreground">
                {t("orders2b2.printPaper.a4LandscapeHelp")}
              </small>
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
              <strong className="block">{t("orders2b2.printPaper.a4Half")}</strong>
              <small className="font-normal text-muted-foreground">
                {t("orders2b2.printPaper.a4HalfHelp")}
              </small>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-20 justify-start gap-3 whitespace-normal p-3 text-left"
            onClick={() => onSelect("a4-portrait-duplicate")}
          >
            <Copy className="size-5 shrink-0" />
            <span>
              <strong className="block">{t("orders2b2.printPaper.a4Duplicate")}</strong>
              <small className="font-normal text-muted-foreground">
                {t("orders2b2.printPaper.a4DuplicateHelp")}
              </small>
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
