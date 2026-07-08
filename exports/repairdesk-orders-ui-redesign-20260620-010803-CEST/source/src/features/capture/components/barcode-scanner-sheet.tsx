"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { IScannerControls } from "@zxing/browser";
import { ClipboardPaste, Copy, Loader2, RotateCcw, ScanLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { parseBarcodePayload, type CapturePayload } from "@/features/capture/model/barcode-parser";
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";

interface BarcodeScannerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onDetected?: (payload: CapturePayload) => void;
  renderActions?: (
    payload: CapturePayload,
    helpers: { close: () => void; rescan: () => void },
  ) => ReactNode;
}

export function BarcodeScannerSheet({
  open,
  onOpenChange,
  title = "扫码读取",
  description = "对准工单二维码、IMEI 条码、库存标签或客户标签。",
  onDetected,
  renderActions,
}: BarcodeScannerSheetProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [lastPayload, setLastPayload] = useState<CapturePayload | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setIsStarting(false);
  }, []);

  const commitRawValue = useCallback(
    (rawValue: string) => {
      const payload = parseBarcodePayload(rawValue, window.location.origin);
      setLastPayload(payload);
      onDetected?.(payload);
      stopScanner();
      if (payload.value) {
        toast.success(`已识别：${payload.label}`);
      }
    },
    [onDetected, stopScanner],
  );

  const rescan = useCallback(() => {
    setLastPayload(null);
    setManualValue("");
  }, []);

  useEffect(() => {
    if (!open) {
      stopScanner();
      setLastPayload(null);
      setManualValue("");
      return;
    }

    if (lastPayload) {
      stopScanner();
      return;
    }

    let cancelled = false;

    async function startScanner() {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("当前浏览器不支持摄像头扫码，请使用手动输入");
        return;
      }

      setIsStarting(true);
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !videoRef.current) return;

        const reader = new BrowserMultiFormatReader();
        controlsRef.current = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (!result) return;
            commitRawValue(result.getText());
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "无法打开摄像头";
        toast.error(message || "无法打开摄像头，请检查权限后重试");
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [commitRawValue, lastPayload, open, stopScanner]);

  const copyValue = async () => {
    if (!lastPayload?.value) return;
    try {
      await navigator.clipboard.writeText(lastPayload.value);
      toast.success("已复制扫码内容");
    } catch {
      toast.error("复制失败，请手动选择内容");
    }
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
              <ScanLine className="size-4 text-primary" />
              {title}
            </SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>

          <div className={cn(componentOverlay.body, "space-y-3 pt-3")}>
            {!lastPayload ? (
              <>
                <div className="overflow-hidden rounded-lg border border-[var(--border-panel)] bg-[var(--capture-preview)]">
                  <video
                    ref={videoRef}
                    className="aspect-[4/3] w-full object-cover"
                    muted
                    playsInline
                  />
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{isStarting ? "正在启动摄像头…" : "需要 HTTPS 或 localhost 环境。"}</span>
                  <Button type="button" variant="outline" size="sm" onClick={stopScanner}>
                    {isStarting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                    停止
                  </Button>
                </div>
                <div className="grid gap-2 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel)] p-2">
                  <div className="flex min-w-0 gap-2">
                    <Input
                      value={manualValue}
                      onChange={(event) => setManualValue(event.target.value)}
                      placeholder="无法扫码时，可手动输入或粘贴"
                      className="h-9 min-w-0 font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-9 shrink-0"
                      aria-label="粘贴扫码内容"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          setManualValue(text);
                        } catch {
                          toast.error("无法读取剪贴板，请手动粘贴");
                        }
                      }}
                    >
                      <ClipboardPaste className="size-4" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    disabled={!manualValue.trim()}
                    onClick={() => commitRawValue(manualValue)}
                  >
                    识别内容
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel)] p-3">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground/70">
                    {lastPayload.label}
                  </p>
                  <p className="mt-1 break-all font-mono text-sm font-semibold text-foreground">
                    {lastPayload.value || lastPayload.raw || "空内容"}
                  </p>
                  {lastPayload.raw !== lastPayload.value ? (
                    <p className="mt-2 break-all text-xs text-muted-foreground">
                      原始内容：{lastPayload.raw || "-"}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={copyValue}>
                    <Copy className="mr-1.5 size-3.5" />
                    复制
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={rescan}>
                    <RotateCcw className="mr-1.5 size-3.5" />
                    继续扫描
                  </Button>
                  {renderActions?.(lastPayload, {
                    close: () => onOpenChange(false),
                    rescan,
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
