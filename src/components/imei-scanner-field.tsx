"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Camera, ClipboardPaste, ImagePlus, Loader2, RotateCcw, X } from "lucide-react";
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
import {
  extractImeiCandidates,
  getPreferredImeiCandidate,
  normalizeCaptureIdentifier,
  type ImeiCandidate,
  type ImeiCaptureSource,
} from "@/features/capture/model/barcode-parser";
import { cn } from "@/lib/utils";

type CommitSource = "manual" | "paste" | "scan" | "clear";
type ImeiScannerFieldDensity = "default" | "compact";

const imeiImageMaxBytes = 8 * 1024 * 1024;
const imeiBarcodeDecodeTimeoutMs = 2500;
const imeiOcrDecodeTimeoutMs = 5000;
const imeiImageAccept =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";
const imeiImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const imeiImageExtensionPattern = /\.(?:jpe?g|png|webp|heic|heif)$/i;

export function normalizeImeiIdentifier(value: string) {
  const withoutCommonSeparators = value.trim().replace(/[\s\-:：_.,/\\|]+/g, "");
  const normalized = normalizeCaptureIdentifier(value);
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
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [warning, setWarning] = useState("");
  const [captureError, setCaptureError] = useState("");
  const [captureCandidates, setCaptureCandidates] = useState<ImeiCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [scannerManualValue, setScannerManualValue] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scannerRunIdRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const lastStartScannerTokenRef = useRef(startScannerToken);
  const compact = density === "compact";
  const quiet = appearance === "quiet";
  const selectedCandidate =
    captureCandidates.find((candidate) => candidate.id === selectedCandidateId) ??
    captureCandidates[0] ??
    null;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const stopScanner = useCallback(() => {
    scannerRunIdRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
    setIsStarting(false);
  }, []);

  const resetCaptureState = useCallback(() => {
    setCaptureError("");
    setCaptureCandidates([]);
    setSelectedCandidateId("");
    setScannerManualValue("");
    setIsImageProcessing(false);
  }, []);

  const commitCandidate = useCallback(
    (candidate: ImeiCandidate) => {
      setWarning(candidate.reason ?? "");
      onChangeRef.current(candidate.value);
      toast.success("已录入 IMEI / 序列号");
      stopScanner();
      setScannerOpen(false);
      resetCaptureState();
    },
    [resetCaptureState, stopScanner],
  );

  const handleCapturedText = useCallback(
    (rawValue: string, source: ImeiCaptureSource) => {
      const candidates = extractImeiCandidates(rawValue, {
        source,
        includeGenericSerial: true,
      });

      if (candidates.length === 0) {
        setCaptureError("未识别到可用编号。请重拍、上传更清晰照片，或手动输入。");
        stopScanner();
        return;
      }

      const preferred = getPreferredImeiCandidate(candidates);
      if (candidates.length === 1 && preferred && preferred.kind !== "suspect_imei") {
        commitCandidate(preferred);
        return;
      }

      setCaptureCandidates(candidates);
      setSelectedCandidateId(preferred?.id ?? candidates[0]?.id ?? "");
      setCaptureError(
        candidates.length > 1
          ? "找到多个可能的编号，请选择一个后保存。"
          : "找到疑似编号，请确认后再填入。",
      );
      stopScanner();
    },
    [commitCandidate, stopScanner],
  );

  const commitValue = useCallback((rawValue: string, source: CommitSource) => {
    if (source === "clear") {
      setWarning("");
      onChangeRef.current("");
      return;
    }

    const normalized = normalizeImeiIdentifier(rawValue);
    setWarning(normalized.hadUnsupported ? "已移除不支持的字符；字母数字序列号会被保留。" : "");
    onChangeRef.current(normalized.value);

    if (source === "scan") {
      toast.success("已录入 IMEI / 序列号");
    } else if (source === "paste") {
      toast.success("已粘贴并整理 IMEI / 序列号");
    }

    if (normalized.hadUnsupported && source !== "manual") {
      toast.warning("检测到非法字符，已自动移除");
    }
  }, []);

  const handleImageFile = useCallback(
    async (file?: File) => {
      if (!file) return;

      const fileError = validateImeiImageFile(file);
      if (fileError) {
        setCaptureError(fileError);
        toast.error(fileError);
        return;
      }

      stopScanner();
      setIsImageProcessing(true);
      setCaptureError("");
      setCaptureCandidates([]);
      setSelectedCandidateId("");

      try {
        try {
          const barcodeText = await withImageRecognitionTimeout(
            decodeBarcodeFromImageFile(file),
            imeiBarcodeDecodeTimeoutMs,
            "条码识别超时",
          );
          handleCapturedText(barcodeText, "image");
          return;
        } catch {
          // Barcode decoding often fails on plain numeric labels; fall through to local OCR.
        }

        const ocrText = await withImageRecognitionTimeout(
          detectTextFromImageFile(file),
          imeiOcrDecodeTimeoutMs,
          "OCR 识别超时",
        );
        handleCapturedText(ocrText, "ocr");
      } catch (error) {
        const message = getImageRecognitionErrorMessage(error);
        setCaptureError(message);
        toast.error(message);
      } finally {
        setIsImageProcessing(false);
      }
    },
    [handleCapturedText, stopScanner],
  );

  useEffect(() => {
    if (!scannerOpen) {
      stopScanner();
      resetCaptureState();
      return;
    }

    if (captureCandidates.length > 0 || captureError || isImageProcessing) {
      stopScanner();
      return;
    }

    let cancelled = false;
    const runId = scannerRunIdRef.current + 1;
    scannerRunIdRef.current = runId;

    async function startScanner() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCaptureError("当前浏览器不支持摄像头扫码。请使用照片上传或手动输入。");
        return;
      }

      setIsStarting(true);
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || scannerRunIdRef.current !== runId || !videoRef.current) return;

        const reader = new BrowserMultiFormatReader();
        let completedByScan = false;
        const onDecodeResult: Parameters<typeof reader.decodeFromConstraints>[2] = (result) => {
          if (!result) return;
          completedByScan = true;
          handleCapturedText(result.getText(), "camera");
        };
        let controls: IScannerControls;
        try {
          controls = await reader.decodeFromConstraints(
            {
              audio: false,
              video: { facingMode: { ideal: "environment" } },
            },
            videoRef.current,
            onDecodeResult,
          );
        } catch (error) {
          if (
            !shouldRetryWithDefaultCamera(error) ||
            cancelled ||
            scannerRunIdRef.current !== runId ||
            !videoRef.current
          ) {
            throw error;
          }
          controls = await reader.decodeFromConstraints(
            {
              audio: false,
              video: true,
            },
            videoRef.current,
            onDecodeResult,
          );
        }
        if (cancelled || scannerRunIdRef.current !== runId || completedByScan) {
          controls.stop();
          return;
        }
        await ensureVideoPreviewPlayback(videoRef.current);
        if (cancelled || scannerRunIdRef.current !== runId || completedByScan) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (error) {
        if (cancelled || scannerRunIdRef.current !== runId) return;
        setCaptureError(getCameraErrorMessage(error));
      } finally {
        if (!cancelled && scannerRunIdRef.current === runId) setIsStarting(false);
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [
    captureCandidates.length,
    captureError,
    handleCapturedText,
    isImageProcessing,
    resetCaptureState,
    scannerOpen,
    stopScanner,
  ]);

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
              "h-8 min-w-0 text-[13px] placeholder:text-[13px] md:text-[13px] md:placeholder:text-[13px]",
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
            <DialogTitle>录入 IMEI / 序列号</DialogTitle>
            <DialogDescription>
              可扫码、上传照片识别，或手动输入。多个编号会先让你选择。
            </DialogDescription>
          </DialogHeader>
          <input
            ref={fileInputRef}
            type="file"
            accept={imeiImageAccept}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void handleImageFile(file);
            }}
          />
          <div className="overflow-hidden rounded-md border bg-[var(--capture-preview)]">
            <video
              ref={videoRef}
              className="aspect-[4/3] w-full object-cover"
              muted
              playsInline
              autoPlay
              aria-label="摄像头预览"
            />
          </div>
          {captureError ? (
            <p
              role="alert"
              className="rounded-md bg-status-warn px-3 py-2 text-xs leading-5 text-status-warn-foreground"
            >
              {captureError}
            </p>
          ) : null}
          {captureCandidates.length > 0 ? (
            <div className="space-y-2 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel)] p-2">
              <p className="text-xs font-medium text-muted-foreground">选择要填入的编号</p>
              <div className="grid gap-1.5">
                {captureCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className={cn(
                      "min-w-0 rounded-md border px-2.5 py-2 text-left transition",
                      selectedCandidateId === candidate.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-foreground",
                    )}
                    aria-pressed={selectedCandidateId === candidate.id}
                    onClick={() => setSelectedCandidateId(candidate.id)}
                  >
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold">{candidate.label}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {candidate.confidence === "high" ? "高可信" : "需确认"}
                      </span>
                    </span>
                    <span className="mt-1 block break-all font-mono text-xs">
                      {candidate.value}
                    </span>
                    {candidate.reason ? (
                      <span className="mt-1 block text-[10px] leading-4 text-status-warn-foreground">
                        {candidate.reason}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                className="h-8 w-full text-xs"
                disabled={!selectedCandidate}
                onClick={() => {
                  if (selectedCandidate) commitCandidate(selectedCandidate);
                }}
              >
                使用选择的编号
              </Button>
            </div>
          ) : null}
          <div className="grid gap-2 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel)] p-2">
            <Input
              value={scannerManualValue}
              onChange={(event) => setScannerManualValue(event.target.value)}
              placeholder="无法识别时可手动输入"
              className="h-9 font-mono text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={!scannerManualValue.trim()}
              onClick={() => {
                commitValue(scannerManualValue, "manual");
                setScannerOpen(false);
              }}
            >
              填入手动编号
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span aria-live="polite">
              {isImageProcessing
                ? "正在识别图片..."
                : isStarting
                  ? "正在启动摄像头..."
                  : "需要 HTTPS 或 localhost 环境。"}
            </span>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImageProcessing}
              >
                {isImageProcessing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="mr-1.5 size-3.5" />
                )}
                上传图片
              </Button>
              {captureError ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCaptureError("");
                    setCaptureCandidates([]);
                    setSelectedCandidateId("");
                  }}
                >
                  <RotateCcw className="mr-1.5 size-3.5" />
                  重试
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={stopScanner}>
                  {isStarting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                  停止
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function validateImeiImageFile(file: File) {
  if (!imeiImageMimeTypes.has(file.type) && !imeiImageExtensionPattern.test(file.name)) {
    return "仅支持 JPG、PNG、WebP、HEIC 或 HEIF 图片。";
  }
  if (file.size > imeiImageMaxBytes) {
    return "图片不能超过 8 MB。";
  }
  return "";
}

async function decodeBarcodeFromImageFile(file: File) {
  const { BrowserMultiFormatReader } = await import("@zxing/browser");
  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = imageUrl;
    await image.decode();
    const reader = new BrowserMultiFormatReader();
    const result = await reader.decodeFromImageElement(image);
    return result.getText();
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

type BrowserTextDetector = {
  detect: (source: unknown) => Promise<Array<{ rawValue?: string }>>;
};

type BrowserWindowWithTextDetector = Window & {
  TextDetector?: new () => BrowserTextDetector;
};

async function detectTextFromImageFile(file: File) {
  const TextDetectorCtor = (window as BrowserWindowWithTextDetector).TextDetector;
  if (!TextDetectorCtor) {
    throw new Error("当前浏览器暂不支持本机 OCR。请使用条码照片、摄像头扫码或手动输入。");
  }

  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = imageUrl;
    await image.decode();
    const detector = new TextDetectorCtor();
    const results = await detector.detect(image);
    return results
      .map((item) => item.rawValue?.trim())
      .filter((item): item is string => Boolean(item))
      .join(" ");
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function withImageRecognitionTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function getCameraErrorMessage(error: unknown) {
  if (!(error instanceof DOMException) && !(error instanceof Error)) {
    return "无法打开摄像头，请改用照片上传或手动输入。";
  }

  if (error.name === "NotAllowedError") {
    return "摄像头权限被拒绝。请在浏览器设置允许相机后重试，或改用照片上传 / 手动输入。";
  }
  if (error.name === "NotFoundError") {
    return "没有找到可用摄像头。请改用照片上传或手动输入。";
  }
  if (error.name === "NotReadableError") {
    return "摄像头正被其他应用占用。关闭占用后重试，或改用照片上传 / 手动输入。";
  }
  if (error.name === "OverconstrainedError") {
    return "当前设备不支持请求的摄像头模式。请重试或改用照片上传。";
  }
  if (error.name === "TypeError") {
    return "当前页面无法使用摄像头。请确认使用 HTTPS 或 localhost。";
  }

  return "无法打开摄像头，请改用照片上传或手动输入。";
}

function shouldRetryWithDefaultCamera(error: unknown) {
  return getErrorName(error) === "OverconstrainedError";
}

async function ensureVideoPreviewPlayback(video: HTMLVideoElement | null) {
  if (!video) return;
  video.muted = true;
  video.playsInline = true;
  try {
    await video.play();
  } catch {
    // ZXing has already attached the stream and will surface camera failures.
    // Some mobile browsers reject a redundant play() call while still showing/scanning the stream.
  }
}

function getErrorName(error: unknown) {
  if (!error || typeof error !== "object" || !("name" in error)) return "";
  return String((error as { name?: unknown }).name ?? "");
}

function getImageRecognitionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/当前浏览器暂不支持本机 OCR/.test(message)) {
    return "当前浏览器暂不支持本机 OCR。请使用条码照片、摄像头扫码或手动输入。";
  }
  if (/超时|timeout/i.test(message)) {
    return "图片识别超时，请重试、换一张更清晰的照片或手动输入。";
  }
  return "图片识别失败，请换一张更清晰的照片或手动输入。";
}
