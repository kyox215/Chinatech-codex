"use client";

import { lazy, Suspense, useRef, useState } from "react";
import { Camera, ChevronDown, FileText, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
const CameraCaptureSheet = lazy(() =>
  import("@/features/capture/components/camera-capture-sheet").then((module) => ({
    default: module.CameraCaptureSheet,
  })),
);
import {
  attachmentMaxBytes,
  createAttachmentDraft,
  type AttachmentDraft,
  revokeAttachmentDraft,
  type AttachmentDraftKind,
} from "@/features/capture/model/attachment-rules";
import type { NewOrderPhoto } from "@/features/orders/api/use-new-order-photos";
import { OrderWorkspaceSectionHeader } from "@/features/orders/components/order-workspace-primitives";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

const photoTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const groups = ["device_front", "device_back", "other"] as const;

export function NewOrderSupplements({
  notes,
  onNotesChange,
  photos,
  onAdd,
  onRemove,
  disabled,
  locked,
  compact = false,
}: {
  notes: string;
  onNotesChange: (value: string) => void;
  photos: NewOrderPhoto[];
  onAdd: (draft: AttachmentDraft) => void;
  onRemove: (id: string) => void;
  disabled: boolean;
  locked: boolean;
  compact?: boolean;
}) {
  const { t } = useLocale();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [kind, setKind] = useState<AttachmentDraftKind>("device_front");
  const fileInput = useRef<HTMLInputElement>(null);
  const blocked = disabled || locked;
  const PhotoSection = compact ? "div" : "details";
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  return (
    <section
      data-new-order-section="supplements"
      className={
        compact
          ? "min-w-0 space-y-2"
          : cn(repairOs.mobileInfoCard, "min-w-0 space-y-2 p-2.5 md:p-3 md:shadow-none")
      }
    >
      <OrderWorkspaceSectionHeader
        icon={FileText}
        title={t(compact ? "orders.newFlow.devicePhotos" : "orders.newFlow.supplements")}
        action={
          compact ? (
            <span className="text-xs text-muted-foreground">{photos.length}/3</span>
          ) : undefined
        }
      />
      <PhotoSection className="group min-w-0" open={(!compact && photos.length > 0) || undefined}>
        {!compact ? (
          <>
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-md text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <span>
                {t("orders.newFlow.photos")} ·{" "}
                {photos.length
                  ? t("attachment.pendingCount", { count: photos.length })
                  : t("orders.newFlow.optional")}
              </span>
              <ChevronDown className="size-3.5 shrink-0 group-open:rotate-180" />
            </summary>
            <p className="mb-2 text-[11px] leading-4 text-muted-foreground">
              {t("orders.newFlow.photoHelp")}
            </p>
          </>
        ) : null}
        <input
          ref={fileInput}
          type="file"
          accept={photoTypes.join(",")}
          multiple
          className="hidden"
          aria-label={t("orders.newFlow.photos")}
          disabled={blocked}
          onChange={(event) => {
            if (blockedRef.current) return;
            for (const file of Array.from(event.target.files ?? [])) {
              if (
                !photoTypes.includes(file.type) ||
                file.size <= 0 ||
                file.size > attachmentMaxBytes
              ) {
                toast.error(t("orders.newFlow.photoInvalid"));
                continue;
              }
              onAdd(createAttachmentDraft(file, kind));
            }
            event.target.value = "";
          }}
        />
        <div className="grid min-w-0 grid-cols-3 gap-1.5">
          {groups.map((group) => (
            <div
              key={group}
              className={cn(
                "min-w-0 space-y-1.5 rounded-lg",
                !compact && "border border-border p-1.5",
              )}
            >
              {!compact ? (
                <span className="block text-[11px] font-medium leading-4">
                  {t(
                    group === "other"
                      ? "attachment.kind.other"
                      : `orders.newFlow.${group === "device_front" ? "front" : "back"}`,
                  )}
                </span>
              ) : null}
              {photos
                .filter(
                  (photo) =>
                    photo.kind === group ||
                    (group === "other" &&
                      !groups.slice(0, 2).includes(photo.kind as "device_front" | "device_back")),
                )
                .map((photo) => (
                  <div
                    key={photo.id}
                    className="relative min-w-0 rounded-md bg-muted p-1"
                    data-photo-state={photo.uploadState}
                  >
                    <img
                      src={photo.previewUrl}
                      alt={t("orders.newFlow.photoPreview")}
                      className={cn(
                        "w-full rounded object-cover",
                        compact ? "h-[68px]" : "aspect-square",
                      )}
                    />
                    <span className="block py-1 text-[10px] leading-3">
                      {t(`orders.newFlow.photo.${photo.uploadState}`)}
                    </span>
                    {!locked ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        disabled={blocked}
                        className="absolute right-1 top-1 size-7"
                        aria-label={t("attachment.delete", { name: photo.name })}
                        onClick={() => onRemove(photo.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              <div className={cn("grid gap-1", !compact && "grid-cols-2")}>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={compact ? "hidden" : "h-11 w-full"}
                  disabled={blocked}
                  aria-label={`${t("common.select")} ${t(`attachment.kind.${group}`)}`}
                  onClick={() => {
                    setKind(group);
                    fileInput.current?.click();
                  }}
                >
                  <ImagePlus className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn(
                    "h-11 w-full",
                    compact &&
                      "h-[68px] flex-wrap content-center gap-1 border-0 bg-muted text-muted-foreground",
                  )}
                  disabled={blocked}
                  aria-label={`${t("common.capture")} ${t(`attachment.kind.${group}`)}`}
                  onClick={() => {
                    setKind(group);
                    setCameraOpen(true);
                  }}
                >
                  <Camera className="size-4 shrink-0" />
                  {compact ? (
                    <span className="break-words text-[11px]">{t(`attachment.kind.${group}`)}</span>
                  ) : null}
                </Button>
              </div>
            </div>
          ))}
        </div>
        {!compact ? (
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
            {t("orders.newFlow.photoLocal")}
          </p>
        ) : null}
      </PhotoSection>
      {!compact ? (
        <details className="group min-w-0" open={Boolean(notes) || undefined}>
          <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-md text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <span>
              {t("orders.newFlow.notes")} ·{" "}
              {notes ? t("orders.newFlow.filled") : t("orders.newFlow.optional")}
            </span>
            <ChevronDown className="size-3.5 shrink-0 group-open:rotate-180" />
          </summary>
          <Textarea
            value={notes}
            disabled={blocked}
            onChange={(event) => onNotesChange(event.target.value)}
            aria-label={t("orders.newFlow.notes")}
            className="h-[104px] min-h-[104px] resize-none text-base lg:h-[200px] lg:text-sm"
          />
        </details>
      ) : null}
      {cameraOpen && !blocked ? (
        <Suspense fallback={null}>
          <CameraCaptureSheet
            open={cameraOpen && !blocked}
            onOpenChange={setCameraOpen}
            purpose="draft"
            attachmentKind={kind}
            onCapture={(draft) => {
              if (blockedRef.current) revokeAttachmentDraft(draft);
              else onAdd(draft);
            }}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
