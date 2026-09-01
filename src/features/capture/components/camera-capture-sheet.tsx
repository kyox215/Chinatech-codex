"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getBarcodeScannerCameraErrorKind,
  getCameraCaptureErrorMessageKey,
  type ScannerErrorKind,
} from "@/features/capture/model/scanner-errors";
import {
  createAttachmentDraft,
  getAttachmentValidationIssue,
  type AttachmentDraft,
  type AttachmentDraftKind,
} from "@/features/capture/model/attachment-rules";
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

interface CameraCaptureSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  attachmentKind?: AttachmentDraftKind;
  purpose?: "draft" | "order-attachment";
  onOutsideDismiss?: () => void;
  onCloseAutoFocus?: (event: Event) => void;
  onCapture: (draft: AttachmentDraft) => void;
}

const cameraCaptureErrorToastId = "repairdesk-camera-capture-error";

export function CameraCaptureSheet({
  open,
  onOpenChange,
  title,
  description,
  attachmentKind = "fault_photo",
  purpose,
  onOutsideDismiss,
  onCloseAutoFocus,
  onCapture,
}: CameraCaptureSheetProps) {
  const { t } = useLocale();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const resolvedPurpose = purpose ?? "draft";
  const resolvedTitle = title ?? t("camera.title");
  const resolvedDescription =
    description ??
    t(
      resolvedPurpose === "order-attachment"
        ? "camera.descriptionOrder"
        : "camera.descriptionDraft",
    );
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [cameraErrorKind, setCameraErrorKind] = useState<ScannerErrorKind | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const outsideDismissedRef = useRef(false);
  const cameraErrorToastIdRef = useRef<string | number | null>(null);
  const lastErrorToastKindRef = useRef<ScannerErrorKind | null>(null);
  const cameraError = cameraErrorKind ? t(getCameraCaptureErrorMessageKey(cameraErrorKind)) : "";

  const dismissCameraErrorToast = useCallback(() => {
    if (cameraErrorToastIdRef.current !== null) {
      toast.dismiss(cameraErrorToastIdRef.current);
      cameraErrorToastIdRef.current = null;
    }
    lastErrorToastKindRef.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setIsStarting(false);
  }, []);

  const clearPhoto = useCallback(() => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setPhotoBlob(null);
  }, [photoUrl]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) dismissCameraErrorToast();
    onOpenChange(nextOpen);
  };

  useEffect(() => {
    if (!open) {
      dismissCameraErrorToast();
      stopCamera();
      clearPhoto();
      setCameraErrorKind(null);
      setIsPaused(false);
      return;
    }

    if (photoBlob || isPaused || cameraErrorKind) {
      stopCamera();
      return;
    }

    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraErrorKind("unsupported");
        return;
      }

      setIsStarting(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (error) {
        if (cancelled) return;
        const kind = getBarcodeScannerCameraErrorKind(error);
        setCameraErrorKind(kind);
        if (lastErrorToastKindRef.current !== kind) {
          lastErrorToastKindRef.current = kind;
          const toastId = toast.error(tRef.current(getCameraCaptureErrorMessageKey(kind)), {
            id: cameraCaptureErrorToastId,
          });
          cameraErrorToastIdRef.current = toastId ?? cameraCaptureErrorToastId;
        }
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [cameraErrorKind, clearPhoto, dismissCameraErrorToast, isPaused, open, photoBlob, stopCamera]);

  useEffect(() => () => dismissCameraErrorToast(), [dismissCameraErrorToast]);

  const restartCamera = () => {
    dismissCameraErrorToast();
    setCameraErrorKind(null);
    setIsPaused(false);
  };

  const captureFrame = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error(t("camera.notReady"));
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      toast.error(t("camera.captureFailed"));
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    if (!blob) {
      toast.error(t("camera.captureFailed"));
      return;
    }

    clearPhoto();
    setPhotoBlob(blob);
    setPhotoUrl(URL.createObjectURL(blob));
  };

  const confirmCapture = () => {
    if (!photoBlob) return;
    const file = new File([photoBlob], `repairdesk-photo-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    onCapture(createAttachmentDraft(file, attachmentKind));
    clearPhoto();
    handleOpenChange(false);
  };

  const handleSelectedImage = (file: File | undefined) => {
    if (!file) return;
    const issue = getAttachmentValidationIssue(file);
    if (issue) {
      const error =
        issue.code === "file-too-large"
          ? t("attachment.fileTooLarge", { size: Math.round(issue.maxBytes / 1024 / 1024) })
          : t("attachment.fileType");
      toast.error(`${file.name}: ${error}`);
      return;
    }
    onCapture(createAttachmentDraft(file, attachmentKind));
    clearPhoto();
    stopCamera();
    handleOpenChange(false);
  };

  const retake = () => {
    clearPhoto();
  };

  const handleCloseAutoFocus = (event: Event) => {
    onCloseAutoFocus?.(event);
    outsideDismissedRef.current = false;
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        closeLabel={t("common.close")}
        onPointerDownOutside={() => {
          outsideDismissedRef.current = true;
          onOutsideDismiss?.();
        }}
        onCloseAutoFocus={handleCloseAutoFocus}
        className="max-h-[calc(100svh-16px)] rounded-t-xl p-0 sm:mx-auto sm:max-w-xl"
      >
        <div className="flex max-h-[calc(100svh-16px)] min-w-0 flex-col overflow-hidden">
          <SheetHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Camera className="size-4 text-primary" />
              {resolvedTitle}
            </SheetTitle>
            <SheetDescription>{resolvedDescription}</SheetDescription>
          </SheetHeader>

          <div className={cn(componentOverlay.body, "space-y-3 pt-3")}>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                handleSelectedImage(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <div className="overflow-hidden rounded-lg border border-[var(--border-panel)] bg-foreground">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={t("camera.photoPreview")}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <video
                  ref={videoRef}
                  className="aspect-[4/3] w-full object-cover"
                  muted
                  playsInline
                  aria-label={t("camera.videoPreview")}
                />
              )}
            </div>

            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span role={cameraError ? "alert" : "status"} aria-live="polite">
                {cameraError ||
                  (isStarting
                    ? t("camera.statusStarting")
                    : resolvedPurpose === "order-attachment"
                      ? t("camera.statusOrder")
                      : t("camera.statusDraft"))}
              </span>
              {!photoUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  onClick={
                    cameraError || isPaused
                      ? restartCamera
                      : () => {
                          stopCamera();
                          setIsPaused(true);
                        }
                  }
                >
                  {isStarting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                  {cameraError || isPaused ? t("common.restart") : t("common.stop")}
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {photoUrl ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={retake}
                  >
                    <RotateCcw className="mr-1.5 size-3.5" />
                    {t("common.retake")}
                  </Button>
                  <Button type="button" size="sm" className="min-h-11" onClick={confirmCapture}>
                    {t("common.usePhoto")}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => inputRef.current?.click()}
                  >
                    <ImagePlus className="mr-1.5 size-3.5" />
                    {t("common.album")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-11"
                    onClick={captureFrame}
                    disabled={isStarting}
                  >
                    <Camera className="mr-1.5 size-3.5" />
                    {t("common.capture")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
