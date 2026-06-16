"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Camera, ClipboardPaste, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CommitSource = "manual" | "paste" | "scan" | "clear";
type ImeiScannerFieldDensity = "default" | "compact";

export function normalizeImeiIdentifier(value: string) {
  const withoutCommonSeparators = value.trim().replace(/[\s\-:：_.,/\\|]+/g, "");
  const normalized = withoutCommonSeparators.replace(/[^A-Za-z0-9]/g, "");
  return {
    value: normalized,
    hadUnsupported: withoutCommonSeparators.length !== normalized.length,
    hadSeparators: withoutCommonSeparators !== value.trim(),
  };
}

export function ImeiScannerField({
  value,
  onChange,
  placeholder = "扫描或输入 IMEI / 序列号",
  density = "default",
  showPaste = true,
  startScannerToken,
  appearance = "outlined",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  density?: ImeiScannerFieldDensity;
  showPaste?: boolean;
  startScannerToken?: number;
  appearance?: "outlined" | "quiet";
}) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [warning, setWarning] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastStartScannerTokenRef = useRef(startScannerToken);
  const compact = density === "compact";
  const quiet = appearance === "quiet";

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setIsStarting(false);
  }, []);

  const commitValue = useCallback(
    (rawValue: string, source: CommitSource) => {
      if (source === "clear") {
        setWarning("");
        onChange("");
        return;
      }

      const normalized = normalizeImeiIdentifier(rawValue);
      setWarning(normalized.hadUnsupported ? "已移除不支持的字符；字母数字序列号会被保留。" : "");
      onChange(normalized.value);

      if (source === "scan") {
        toast.success(`已录入 ${normalized.value || "扫码结果"}`);
      } else if (source === "paste") {
        toast.success("已粘贴并整理 IMEI / 序列号");
      }

      if (normalized.hadUnsupported && source !== "manual") {
        toast.warning("检测到非法字符，已自动移除");
      }
    },
    [onChange],
  );

  useEffect(() => {
    if (!scannerOpen) {
      stopScanner();
      return;
    }

    let cancelled = false;

    async function startScanner() {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("当前浏览器不支持摄像头扫码，请手动输入");
        setScannerOpen(false);
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
            commitValue(result.getText(), "scan");
            stopScanner();
            setScannerOpen(false);
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "无法打开摄像头";
        toast.error(message || "无法打开摄像头，请检查权限后重试");
        setScannerOpen(false);
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [commitValue, scannerOpen, stopScanner]);

  useEffect(() => {
    if (startScannerToken === undefined) return;
    if (lastStartScannerTokenRef.current === startScannerToken) return;
    lastStartScannerTokenRef.current = startScannerToken;
    setScannerOpen(true);
  }, [startScannerToken]);

  return (
    <div className={cn("space-y-1.5", compact && "space-y-1")}>
      <div
        className={cn(
          "flex gap-2",
          compact &&
            (showPaste
              ? "grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-1.5"
              : "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5"),
        )}
      >
        <Input
          value={value}
          onChange={(event) => commitValue(event.target.value, "manual")}
          placeholder={placeholder}
          className={cn(
            "font-mono",
            compact &&
              "h-8 min-w-0 text-base placeholder:text-base md:text-[13px] md:placeholder:text-[13px]",
            compact && quiet && "border-0 bg-transparent px-0 shadow-none focus-visible:ring-0",
          )}
          inputMode="text"
          autoComplete="off"
        />
        <Button
          type="button"
          variant={quiet ? "ghost" : "outline"}
          size="icon"
          className={cn(
            "shrink-0",
            compact && "size-8",
            quiet && "rounded-lg bg-[var(--surface-panel-muted)] text-foreground",
          )}
          onClick={() => setScannerOpen(true)}
          aria-label="摄像头扫码录入 IMEI"
        >
          <Camera className="size-4" />
        </Button>
        {showPaste ? (
          <Button
            type="button"
            variant={quiet ? "ghost" : "outline"}
            size="icon"
            className={cn(
              "shrink-0",
              compact && "size-8",
              quiet && "rounded-lg bg-[var(--surface-panel-muted)] text-foreground",
            )}
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                commitValue(text, "paste");
              } catch {
                toast.error("无法读取剪贴板，请手动粘贴");
              }
            }}
            aria-label="粘贴 IMEI"
          >
            <ClipboardPaste className="size-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("shrink-0", compact && "size-8")}
          onClick={() => commitValue("", "clear")}
          disabled={!value}
          aria-label="清空 IMEI"
        >
          <X className="size-4" />
        </Button>
      </div>
      {warning && <p className="text-xs text-status-warn-foreground">{warning}</p>}

      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>摄像头扫码录入</DialogTitle>
            <DialogDescription>对准 IMEI 条码或序列号二维码，识别后会自动写入。</DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-md border bg-[var(--capture-preview)]">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          </div>
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{isStarting ? "正在启动摄像头…" : "需要 HTTPS 或 localhost 环境。"}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setScannerOpen(false)}>
              {isStarting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              停止
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
