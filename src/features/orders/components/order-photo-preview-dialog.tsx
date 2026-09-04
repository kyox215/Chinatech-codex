"use client";

import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatAttachmentSize } from "@/features/capture";
import { localizeOrderAttachmentKind } from "@/features/orders/model/order-detail-i18n";
import type { OrderAttachment } from "@/lib/repairdesk/types";
import { useLocale } from "@/shared/i18n/locale-provider";

export function OrderPhotoPreviewDialog({
  attachments,
  activeId,
  onActiveIdChange,
}: {
  attachments: OrderAttachment[];
  activeId: string | null;
  onActiveIdChange: (id: string | null) => void;
}) {
  const { t } = useLocale();
  const activeIndex = activeId
    ? attachments.findIndex((attachment) => attachment.id === activeId)
    : -1;
  const active = activeIndex >= 0 ? attachments[activeIndex] : undefined;
  const source = active?.signed_url || active?.public_url;
  const open = Boolean(active && source);
  const hasMultiple = attachments.length > 1;

  const move = (direction: -1 | 1) => {
    if (!hasMultiple || activeIndex < 0) return;
    const nextIndex = (activeIndex + direction + attachments.length) % attachments.length;
    onActiveIdChange(attachments[nextIndex]?.id ?? null);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onActiveIdChange(null)}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100vw-16px)] max-w-[430px] rounded-2xl border border-[var(--border-panel)] bg-card p-2 shadow-[var(--shadow-elevated)] sm:max-w-2xl sm:p-3"
      >
        <DialogHeader className="px-1 pt-1">
          <DialogTitle className="truncate text-sm">
            {active?.file_name || t("orders2b2.photo.device")}
          </DialogTitle>
          <DialogDescription className="truncate text-[11px]">
            {active
              ? `${localizeOrderAttachmentKind(active.kind, t)} · ${formatAttachmentSize(active.file_size)}`
              : t("orders2b2.photo.savedDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-2 grid max-h-[70svh] min-h-[280px] place-items-center overflow-hidden rounded-xl bg-black">
          {source ? (
            <img
              src={source}
              alt={active?.file_name || t("orders2b2.photo.device")}
              className="max-h-[70svh] w-full object-contain"
            />
          ) : (
            <div className="grid place-items-center text-muted-foreground">
              <ImageIcon className="size-8" />
            </div>
          )}

          {hasMultiple ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 size-8 -translate-y-1/2 rounded-full bg-background/85"
                onClick={() => move(-1)}
                aria-label={t("orders2b2.photo.previous")}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 size-8 -translate-y-1/2 rounded-full bg-background/85"
                onClick={() => move(1)}
                aria-label={t("orders2b2.photo.next")}
              >
                <ChevronRight className="size-4" />
              </Button>
            </>
          ) : null}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 px-1 pb-1 sm:justify-between sm:space-x-0">
          <p className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
            {activeIndex >= 0 ? `${activeIndex + 1} / ${attachments.length}` : ""}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg text-xs"
            onClick={() => onActiveIdChange(null)}
          >
            {t("orders2b2.photo.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
