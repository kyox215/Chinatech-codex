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
      <button
        type="button"
        className="relative grid h-20 min-w-0 place-items-center overflow-hidden rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        disabled={uploadPending || (!canUpload && (!attachment || !source || imageFailed))}
        onClick={(event) => {
          if (canUpload && onCapture) onCapture(slot.kind, event.currentTarget);
          else if (attachment && source && !imageFailed) onOpenAttachment?.(attachment);
        }}
        aria-label={
          canUpload
            ? `${t("orders2b2.overview.capture")} ${t(slot.label)}`
            : `${t(slot.label)}: ${t("orders2b2.photo.device")}`
        }
      >
        {source && !imageFailed ? (
          <img
            src={source}
            alt=""
            className="absolute inset-0 size-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <ImageIcon className="size-5" aria-hidden="true" />
        )}
        <span className="relative z-10 flex max-w-full items-center gap-1 rounded bg-background/90 px-1.5 py-1 text-xs">
          {canUpload ? <Camera className="size-3.5 shrink-0" aria-hidden="true" /> : null}
          {t(slot.label)}
          {attachments.length ? ` (${attachments.length})` : ""}
        </span>
      </button>
      {attachment && (!source || imageFailed) ? (
        <p
          role="status"
          className="line-clamp-2 break-words text-[10px] leading-3 text-muted-foreground"
        >
          {t("orders2b2.photo.unavailable")}: {attachment.file_name || t(slot.label)}
        </p>
      ) : null}
      {attachments.length ? (
        <div className="flex min-w-0 flex-wrap gap-1" aria-label={t(slot.label)}>
          {attachments.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="min-h-8 min-w-8 rounded border border-[var(--border-panel)] bg-background px-2 text-xs text-primary focus-visible:ring-2 focus-visible:ring-ring"
              disabled={!item.signed_url && !item.public_url}
              onClick={() => onOpenAttachment?.(item)}
              aria-label={t("orders2b2.overview.openPhoto", {
                file: `${t(slot.label)} ${index + 1}: ${item.file_name || t("orders2b2.photo.device")}`,
              })}
            >
              {index + 1}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
