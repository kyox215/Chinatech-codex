"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw } from "lucide-react";
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
  createAttachmentDraft,
  type AttachmentDraft,
  type AttachmentDraftKind,
} from "@/features/capture/model/attachment-rules";
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";

interface CameraCaptureSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  attachmentKind?: AttachmentDraftKind;
  onCapture: (draft: AttachmentDraft) => void;
}

export function CameraCaptureSheet({
  open,
  onOpenChange,
  title = "拍照采集",
  description = "拍摄设备外观、故障位置或取件凭证。",
  attachmentKind = "fault_photo",
  onCapture,
}: CameraCaptureSheetProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsStarting(false);
  }, []);

  const clearPhoto = useCallback(() => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setPhotoBlob(null);
  }, [photoUrl]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      clearPhoto();
      return;
    }

    if (photoBlob) {
      stopCamera();
      return;
    }

    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("当前浏览器不支持摄像头，请使用文件上传");
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
        const message = error instanceof Error ? error.message : "无法打开摄像头";
        toast.error(message || "无法打开摄像头，请检查权限后重试");
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [clearPhoto, open, photoBlob, stopCamera]);

  const captureFrame = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error("摄像头画面尚未准备好");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      toast.error("无法生成照片");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    if (!blob) {
      toast.error("无法生成照片");
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
    onOpenChange(false);
  };

  const retake = () => {
    clearPhoto();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[calc(100svh-16px)] rounded-t-xl p-0 sm:mx-auto sm:max-w-xl"
      >
        <div className="flex max-h-[calc(100svh-16px)] min-w-0 flex-col overflow-hidden">
          <SheetHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Camera className="size-4 text-primary" />
              {title}
            </SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>

          <div className={cn(componentOverlay.body, "space-y-3 pt-3")}>
            <div className="overflow-hidden rounded-lg border border-[var(--border-panel)] bg-foreground">
              {photoUrl ? (
                <img src={photoUrl} alt="照片预览" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <video
                  ref={videoRef}
                  className="aspect-[4/3] w-full object-cover"
                  muted
                  playsInline
                />
              )}
            </div>

            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{isStarting ? "正在启动摄像头…" : "确认后会保存到当前工单。"}</span>
              {!photoUrl ? (
                <Button type="button" variant="outline" size="sm" onClick={stopCamera}>
                  {isStarting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                  停止
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {photoUrl ? (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={retake}>
                    <RotateCcw className="mr-1.5 size-3.5" />
                    重拍
                  </Button>
                  <Button type="button" size="sm" onClick={confirmCapture}>
                    使用照片
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" onClick={captureFrame} disabled={isStarting}>
                  <Camera className="mr-1.5 size-3.5" />
                  拍照
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
