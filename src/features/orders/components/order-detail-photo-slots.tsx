"use client";

import { Camera, Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

import type { OrderAttachment, OrderAttachmentKind } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export type OrderDetailPhotoSlotKey = "front" | "back" | "other";
export type OrderDetailPhotoCaptureKind = Extract<
  OrderAttachmentKind,
  "device_front" | "device_back" | "other"
>;

export interface OrderDetailPhotoSlotsProps {
  attachments: OrderAttachment[];
  canUpload?: boolean;
  uploadPending?: boolean;
  onCapture?: (kind: OrderDetailPhotoCaptureKind, trigger: HTMLButtonElement) => void;
  onOpenAttachment?: (attachment: OrderAttachment) => void;
  className?: string;
}

const slotDefinitions: ReadonlyArray<{
  key: OrderDetailPhotoSlotKey;
  kind: OrderDetailPhotoCaptureKind;
  label: "orders2b2.photo.front" | "orders2b2.photo.back" | "orders2b2.photo.other";
}> = [
  { key: "front", kind: "device_front", label: "orders2b2.photo.front" },
  { key: "back", kind: "device_back", label: "orders2b2.photo.back" },
  { key: "other", kind: "other", label: "orders2b2.photo.other" },
];

export function getOrderDetailPhotoSlot(kind: OrderAttachmentKind): OrderDetailPhotoSlotKey {
  if (kind === "device_front") return "front";
  if (kind === "device_back") return "back";
  return "other";
}

export function OrderDetailPhotoSlots({
  attachments,
  canUpload = false,
  uploadPending = false,
  onCapture,
  onOpenAttachment,
  className,
}: OrderDetailPhotoSlotsProps) {
  const { t } = useLocale();
  const grouped = new Map<OrderDetailPhotoSlotKey, OrderAttachment[]>();
  for (const attachment of attachments) {
    if (attachment.kind === "signature") continue;
    const key = getOrderDetailPhotoSlot(attachment.kind);
    const group = grouped.get(key) ?? [];
    group.push(attachment);
    grouped.set(key, group);
  }

  return (
    <div
      data-order-detail-photo-slots="true"
      className={cn("grid min-w-0 grid-cols-3 gap-1.5", className)}
    >
      {slotDefinitions.map((slot) => {
        const group = grouped.get(slot.key) ?? [];
        return (
          <OrderDetailPhotoSlot
            key={slot.key}
            slot={slot}
            attachments={group}
            canUpload={canUpload}
            uploadPending={uploadPending}
            onCapture={onCapture}
            onOpenAttachment={onOpenAttachment}
          />
        );
      })}
    </div>
  );
}

function OrderDetailPhotoSlot({
  slot,
  attachments,
  canUpload,
  uploadPending,
  onCapture,
  onOpenAttachment,
}: {
  slot: (typeof slotDefinitions)[number];
  attachments: OrderAttachment[];
  canUpload: boolean;
  uploadPending: boolean;
  onCapture?: (kind: OrderDetailPhotoCaptureKind, trigger: HTMLButtonElement) => void;
  onOpenAttachment?: (attachment: OrderAttachment) => void;
}) {
  const { t } = useLocale();
  const attachment = attachments[0];
  const source = attachment?.signed_url || attachment?.public_url;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [attachment?.id, source]);

  return (
    <div data-order-detail-photo-slot={slot.key} className="grid min-w-0 gap-1">
      {attachment ? (
        <button
          type="button"
          className="group relative grid h-14 min-w-0 place-items-center overflow-hidden rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            if (source && !imageFailed) onOpenAttachment?.(attachment);
          }}
          disabled={!source || imageFailed}
          aria-label={
            source && !imageFailed
              ? t("orders2b2.overview.openPhoto", {
                  file: attachment.file_name || t(slot.label),
                })
              : `${t(slot.label)}: ${t("orders2b2.photo.unavailable")}`
          }
        >
          {source && !imageFailed ? (
            <img
              src={source}
              alt={attachment.file_name || t(slot.label)}
              className="size-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="grid min-w-0 place-items-center gap-0.5 px-1 text-center text-[9px] text-muted-foreground">
              <ImageIcon className="size-4 text-primary" aria-hidden="true" />
              <span className="line-clamp-2 break-words">
                {attachment.file_name || t("orders2b2.photo.unavailable")}
              </span>
            </span>
          )}
          <span className="absolute inset-x-1 bottom-1 truncate rounded bg-background/85 px-1 py-0.5 text-center text-[8px] font-medium leading-3 text-muted-foreground backdrop-blur lg:text-[11px] lg:leading-4">
            {t(slot.label)}
            {attachments.length > 1 ? ` +${attachments.length - 1}` : ""}
          </span>
        </button>
      ) : (
        <div className="grid h-14 min-w-0 place-items-center rounded-lg border border-dashed border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-1 text-center text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
          <span className="grid place-items-center gap-0.5">
            <ImageIcon className="size-3.5 opacity-70" aria-hidden="true" />
            {t(slot.label)}
          </span>
        </div>
      )}
      {attachments.length > 1 ? (
        <div className="flex min-w-0 flex-wrap justify-center gap-1" aria-label={t(slot.label)}>
          {attachments.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="size-6 rounded border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-[9px] font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onOpenAttachment?.(item)}
              aria-label={`${t(slot.label)} ${index + 1}: ${item.file_name || t("orders2b2.photo.device")}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      ) : null}
      {canUpload && onCapture ? (
        <button
          type="button"
          className="inline-flex min-h-8 min-w-0 items-center justify-center gap-1 rounded-md border border-dashed border-primary/35 bg-primary/5 px-1 text-[9px] font-medium leading-3 text-primary transition-colors hover:bg-primary/10 disabled:opacity-60 lg:text-[11px] lg:leading-4"
          disabled={uploadPending}
          onClick={(event) => onCapture(slot.kind, event.currentTarget)}
          aria-label={`${t("orders2b2.overview.capture")} ${t(slot.label)}`}
        >
          <Camera className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {uploadPending ? t("orders2b2.overview.uploading") : t("orders2b2.overview.capture")}
          </span>
        </button>
      ) : null}
    </div>
  );
}
