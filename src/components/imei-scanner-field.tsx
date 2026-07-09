"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { Camera, ClipboardPaste, ImagePlus, Loader2, RotateCcw, ScanLine, X } from "lucide-react";
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
import { imeiKeyboardProps } from "@/shared/lib/mobile-input";

type CommitSource = "manual" | "paste" | "scan" | "clear";
type ImeiScannerFieldDensity = "default" | "compact";
type ImeiCaptureBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type ImeiBarcodeDetection = {
  rawValue: string;
  box?: ImeiCaptureBox;
};
type ImeiSelectableCandidate = ImeiCandidate & {
  box?: ImeiCaptureBox;
  overlayIndex?: number;
};
type ImeiCapturePreview = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
};
type ImeiScannerCameraMode = "enhanced" | "standard" | "default";
type ImeiRecognitionResult = {
  text: string;
  source: ImeiCaptureSource;
  detections?: ImeiBarcodeDetection[];
  preview?: ImeiCapturePreview;
  previewCleanup?: () => void;
};
type ImeiCandidateInput = {
  rawValue: string;
  source: ImeiCaptureSource;
  detections?: readonly ImeiBarcodeDetection[];
  includeGenericSerial?: boolean;
};
type ImeiCaptureViewportSize = {
  width: number;
  height: number;
};
type ImeiScannerDecodeCallback = Parameters<BrowserMultiFormatReader["decodeFromConstraints"]>[2];
type ImeiScannerReader = Pick<BrowserMultiFormatReader, "decodeFromConstraints">;
type ImeiScannerConstraintPlan = {
  mode: ImeiScannerCameraMode;
  constraints: MediaStreamConstraints;
};
type VideoFrameCaptureOptions = {
  alt?: string;
  enhanceForOcr?: boolean;
  cropScale?: number;
};

const imeiImageMaxBytes = 8 * 1024 * 1024;
const imeiBarcodeDecodeTimeoutMs = 2500;
const imeiFastBarcodeDecodeTimeoutMs = 450;
const imeiOcrDecodeTimeoutMs = 8500;
const imeiCenterCropRecognitionScale = 1.8;
const imeiCenterCropScanIntervalMs = 250;
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
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [isFrameLocked, setIsFrameLocked] = useState(false);
  const [warning, setWarning] = useState("");
  const [captureError, setCaptureError] = useState("");
  const [captureCandidates, setCaptureCandidates] = useState<ImeiSelectableCandidate[]>([]);
  const [capturePreview, setCapturePreview] = useState<ImeiCapturePreview | null>(null);
  const [captureViewportSize, setCaptureViewportSize] = useState<ImeiCaptureViewportSize | null>(
    null,
  );
  const [activeCameraMode, setActiveCameraMode] = useState<ImeiScannerCameraMode>("enhanced");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [scannerManualValue, setScannerManualValue] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureViewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const centerCropDecodeIntervalRef = useRef<number | null>(null);
  const capturePreviewCleanupRef = useRef<(() => void) | null>(null);
  const scannerLockInProgressRef = useRef(false);
  const scannerRunIdRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const lastStartScannerTokenRef = useRef(startScannerToken);
  const compact = density === "compact";
  const quiet = appearance === "quiet";
  const selectedCandidate =
    captureCandidates.find((candidate) => candidate.id === selectedCandidateId) ??
    captureCandidates[0] ??
    null;
  const hasOverlayCandidates = captureCandidates.some((candidate) => candidate.box);
  const shouldShowCaptureViewport =
    Boolean(capturePreview) ||
    isStarting ||
    isCameraActive ||
    captureCandidates.length > 0 ||
    !captureError;
  const captureViewportClassName = cn(
    "w-full object-cover sm:aspect-[4/3] sm:h-auto sm:max-h-[38svh]",
    captureCandidates.length > 0 ? "h-[24svh] min-h-40 max-h-56" : "h-[30svh] min-h-44 max-h-72",
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const replaceCapturePreview = useCallback(
    (preview: ImeiCapturePreview | null, cleanup?: () => void) => {
      capturePreviewCleanupRef.current?.();
      capturePreviewCleanupRef.current = cleanup ?? null;
      setCapturePreview(preview);
    },
    [],
  );

  const stopScanner = useCallback(() => {
    scannerRunIdRef.current += 1;
    if (centerCropDecodeIntervalRef.current) {
      window.clearInterval(centerCropDecodeIntervalRef.current);
      centerCropDecodeIntervalRef.current = null;
    }
    controlsRef.current?.stop();
    controlsRef.current = null;
    setIsCameraActive(false);
    setIsStarting(false);
  }, []);

  const resetCaptureState = useCallback(() => {
    setCaptureError("");
    setCaptureCandidates([]);
    replaceCapturePreview(null);
    setCaptureViewportSize(null);
    setActiveCameraMode("enhanced");
    setSelectedCandidateId("");
    setScannerManualValue("");
    setIsImageProcessing(false);
    setIsFrameLocked(false);
    scannerLockInProgressRef.current = false;
  }, [replaceCapturePreview]);

  useEffect(
    () => () => {
      capturePreviewCleanupRef.current?.();
      capturePreviewCleanupRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!scannerOpen || !shouldShowCaptureViewport) {
      setCaptureViewportSize(null);
      return;
    }

    const element = captureViewportRef.current;
    if (!element) return;

    const updateViewportSize = () => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setCaptureViewportSize((current) =>
        current && current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height },
      );
    };

    updateViewportSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewportSize);
      return () => window.removeEventListener("resize", updateViewportSize);
    }

    const observer = new ResizeObserver(updateViewportSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scannerOpen, shouldShowCaptureViewport, capturePreview?.src]);

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
    (
      rawValue: string,
      source: ImeiCaptureSource,
      options: Pick<ImeiRecognitionResult, "detections" | "preview" | "previewCleanup"> = {},
    ) => {
      const orderedCandidates = buildSelectableCandidatesFromInputs([
        {
          rawValue,
          source,
          detections: options.detections,
          includeGenericSerial: true,
        },
      ]);

      if (orderedCandidates.length === 0) {
        if (options.preview) {
          replaceCapturePreview(options.preview, options.previewCleanup);
        }
        setCaptureError("未识别到可用编号。请重拍、上传更清晰照片，或手动输入。");
        stopScanner();
        return;
      }

      const preferred = getPreferredImeiCandidate(orderedCandidates);
      if (options.preview) {
        replaceCapturePreview(options.preview, options.previewCleanup);
      }
      setCaptureCandidates(orderedCandidates);
      setSelectedCandidateId(preferred?.id ?? orderedCandidates[0]?.id ?? "");
      setCaptureError(getCaptureCandidatesMessage(orderedCandidates));
      stopScanner();
    },
    [replaceCapturePreview, stopScanner],
  );

  const handleCapturedCandidateInputs = useCallback(
    (
      inputs: readonly ImeiCandidateInput[],
      options: Pick<ImeiRecognitionResult, "preview" | "previewCleanup"> = {},
    ) => {
      const orderedCandidates = buildSelectableCandidatesFromInputs(inputs);

      if (orderedCandidates.length === 0) {
        if (options.preview) {
          replaceCapturePreview(options.preview, options.previewCleanup);
        }
        setCaptureError("未识别到可用编号。请重拍、上传更清晰照片，或手动输入。");
        stopScanner();
        return;
      }

      const preferred = getPreferredImeiCandidate(orderedCandidates);
      if (options.preview) {
        replaceCapturePreview(options.preview, options.previewCleanup);
      }
      setCaptureCandidates(orderedCandidates);
      setSelectedCandidateId(preferred?.id ?? orderedCandidates[0]?.id ?? "");
      setCaptureError(getCaptureCandidatesMessage(orderedCandidates));
      stopScanner();
    },
    [replaceCapturePreview, stopScanner],
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
      setIsFrameLocked(false);
      scannerLockInProgressRef.current = false;
      setCaptureError("");
      setCaptureCandidates([]);
      replaceCapturePreview(null);
      setSelectedCandidateId("");

      try {
        const recognition = await recognizeTextFromImageFile(file);
        handleCapturedText(recognition.text, recognition.source, recognition);
      } catch (error) {
        const message = getImageRecognitionErrorMessage(error);
        setCaptureError(message);
        toast.error(message);
      } finally {
        setIsImageProcessing(false);
      }
    },
    [handleCapturedText, replaceCapturePreview, stopScanner],
  );

  const handleCurrentFrameCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      const message = "当前没有可识别的摄像头画面。请重新打开摄像头或上传图片。";
      setCaptureError(message);
      toast.error(message);
      return;
    }

    setIsImageProcessing(true);
    setIsFrameLocked(true);
    scannerLockInProgressRef.current = true;
    setCaptureError("");
    setCaptureCandidates([]);
    replaceCapturePreview(null);
    setSelectedCandidateId("");

    try {
      const frame = await createImageElementFromVideoFrame(video, {
        alt: "当前摄像头画面 OCR 截图",
        enhanceForOcr: true,
        cropScale: activeCameraMode === "enhanced" ? imeiCenterCropRecognitionScale : 1,
      });
      stopScanner();
      const recognition = await recognizeTextFromImageElement(frame.image, {
        preferOcr: true,
      });
      handleCapturedText(recognition.text, recognition.source, {
        ...recognition,
        preview: frame.preview,
      });
    } catch (error) {
      const message = getImageRecognitionErrorMessage(error);
      setCaptureError(message);
      toast.error(message);
    } finally {
      setIsImageProcessing(false);
    }
  }, [activeCameraMode, handleCapturedText, replaceCapturePreview, stopScanner]);

  const handleCameraDecodeResult = useCallback(
    async (rawValue: string) => {
      if (scannerLockInProgressRef.current) return;
      scannerLockInProgressRef.current = true;
      setIsFrameLocked(true);
      setIsImageProcessing(true);
      setCaptureError("");
      setCaptureCandidates([]);
      setSelectedCandidateId("");

      const video = videoRef.current;
      if (!video) {
        handleCapturedText(rawValue, "camera");
        setIsImageProcessing(false);
        return;
      }

      let frame: Awaited<ReturnType<typeof createImageElementFromVideoFrame>> | null = null;
      try {
        frame = await createImageElementFromVideoFrame(video, {
          alt: "已锁定的扫码画面",
          cropScale: activeCameraMode === "enhanced" ? imeiCenterCropRecognitionScale : 1,
        });
        stopScanner();
        replaceCapturePreview(frame.preview);

        const inputs = await collectLockedFrameCandidateInputs(frame.image, rawValue);
        handleCapturedCandidateInputs(inputs, {
          preview: frame.preview,
        });
      } catch {
        handleCapturedText(rawValue, "camera", frame ? { preview: frame.preview } : {});
      } finally {
        setIsImageProcessing(false);
      }
    },
    [
      activeCameraMode,
      handleCapturedCandidateInputs,
      handleCapturedText,
      replaceCapturePreview,
      stopScanner,
    ],
  );

  const startCenterCropDecodeLoop = useCallback(
    (runId: number, mode: ImeiScannerCameraMode) => {
      if (centerCropDecodeIntervalRef.current) {
        window.clearInterval(centerCropDecodeIntervalRef.current);
      }
      if (mode !== "enhanced") {
        centerCropDecodeIntervalRef.current = null;
        return;
      }

      let decodeInProgress = false;
      centerCropDecodeIntervalRef.current = window.setInterval(() => {
        if (
          decodeInProgress ||
          scannerLockInProgressRef.current ||
          scannerRunIdRef.current !== runId
        ) {
          return;
        }
        const video = videoRef.current;
        if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

        decodeInProgress = true;
        void (async () => {
          let lockedByThisDecode = false;
          try {
            const frame = await createImageElementFromVideoFrame(video, {
              alt: "中心裁切增强识别截图",
              cropScale: imeiCenterCropRecognitionScale,
            });
            const recognition = await recognizeFastBarcodeFromImageElement(frame.image);
            if (scannerRunIdRef.current !== runId || scannerLockInProgressRef.current) return;
            scannerLockInProgressRef.current = true;
            setIsFrameLocked(true);
            setIsImageProcessing(true);
            lockedByThisDecode = true;
            stopScanner();
            replaceCapturePreview(frame.preview);
            handleCapturedText(recognition.text, "camera", {
              ...recognition,
              preview: frame.preview,
            });
          } catch {
            // The regular ZXing stream scanner continues running; this loop is only an enhanced
            // center-crop assist for small IMEI labels.
          } finally {
            if (lockedByThisDecode) setIsImageProcessing(false);
            decodeInProgress = false;
          }
        })();
      }, imeiCenterCropScanIntervalMs);
    },
    [handleCapturedText, replaceCapturePreview, stopScanner],
  );

  const handleRetryCapture = useCallback(() => {
    scannerLockInProgressRef.current = false;
    setIsFrameLocked(false);
    setCaptureError("");
    setCaptureCandidates([]);
    setSelectedCandidateId("");
    replaceCapturePreview(null);
    setIsImageProcessing(false);
  }, [replaceCapturePreview]);

  useEffect(() => {
    if (!scannerOpen) {
      stopScanner();
      resetCaptureState();
      return;
    }

    if (captureCandidates.length > 0 || captureError || isImageProcessing || isFrameLocked) {
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
      setIsCameraActive(false);
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || scannerRunIdRef.current !== runId || !videoRef.current) return;

        const reader = new BrowserMultiFormatReader();
        let completedByScan = false;
        const onDecodeResult: Parameters<typeof reader.decodeFromConstraints>[2] = (result) => {
          if (!result) return;
          completedByScan = true;
          void handleCameraDecodeResult(result.getText());
        };
        const { controls, mode } = await startScannerWithFallback(
          reader as ImeiScannerReader,
          videoRef.current,
          onDecodeResult,
          () => cancelled || scannerRunIdRef.current !== runId || !videoRef.current,
        );
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
        setActiveCameraMode(mode);
        setIsCameraActive(true);
        startCenterCropDecodeLoop(runId, mode);
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
    handleCameraDecodeResult,
    isFrameLocked,
    isImageProcessing,
    resetCaptureState,
    scannerOpen,
    startCenterCropDecodeLoop,
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
          {...imeiKeyboardProps}
          value={value}
          onChange={(event) => commitValue(event.target.value, "manual")}
          placeholder={placeholder}
          className={cn(
            "font-mono",
            compact &&
              "h-8 min-w-0 text-[13px] placeholder:text-[13px] md:text-[13px] md:placeholder:text-[13px]",
            compact && quiet && "border-0 bg-transparent px-0 shadow-none focus-visible:ring-0",
          )}
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
        <DialogContent
          className="grid max-h-[calc(100svh-12px)] w-[min(32rem,calc(100vw-16px))] max-w-md grid-rows-[minmax(0,1fr)_auto] gap-0 overflow-hidden p-0"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
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
          <div className="min-h-0 space-y-2 overflow-y-auto p-3 pb-2 sm:space-y-3 sm:p-5 sm:pb-4">
            <DialogHeader className="space-y-0.5 pr-8 sm:space-y-1.5">
              <DialogTitle className="text-base sm:text-lg">录入 IMEI / 序列号</DialogTitle>
              <DialogDescription className="text-xs leading-4 sm:text-sm">
                可扫码、上传照片识别，或手动输入。多个编号会先让你选择。
              </DialogDescription>
            </DialogHeader>
            {shouldShowCaptureViewport ? (
              <div
                ref={captureViewportRef}
                className="relative overflow-hidden rounded-md border bg-[var(--capture-preview)]"
              >
                {capturePreview ? (
                  <img
                    src={capturePreview.src}
                    alt={capturePreview.alt}
                    className={cn(captureViewportClassName, "object-contain")}
                  />
                ) : (
                  <video
                    ref={videoRef}
                    className={captureViewportClassName}
                    muted
                    playsInline
                    autoPlay
                    aria-label="摄像头预览"
                  />
                )}
                {hasOverlayCandidates ? (
                  <div className="absolute inset-0">
                    {captureCandidates.map((candidate, index) =>
                      candidate.box ? (
                        <button
                          key={`${candidate.id}:overlay`}
                          type="button"
                          className={cn(
                            "absolute min-h-7 min-w-8 rounded-md border-2 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            selectedCandidateId === candidate.id
                              ? "border-primary bg-primary/15 ring-2 ring-primary/25"
                              : "border-status-warn-foreground/90 bg-background/10 hover:bg-background/20",
                          )}
                          style={{
                            ...getOverlayBoxStyle(
                              candidate.box,
                              capturePreview,
                              captureViewportSize,
                            ),
                          }}
                          aria-label={`选择画面候选 ${candidate.overlayIndex ?? index + 1}`}
                          aria-pressed={selectedCandidateId === candidate.id}
                          title={`${candidate.label} ${candidate.value}`}
                          onClick={() => setSelectedCandidateId(candidate.id)}
                        >
                          <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                            {candidate.overlayIndex ?? index + 1}
                          </span>
                        </button>
                      ) : null,
                    )}
                  </div>
                ) : null}
                {!capturePreview && (isStarting || isCameraActive) ? (
                  <div className="pointer-events-none absolute left-2 top-2 rounded bg-background/85 px-2 py-1 text-[10px] font-semibold text-foreground shadow-sm">
                    {activeCameraMode === "enhanced" ? "1x 取景 · 中心增强" : "1x 兼容扫码"}
                  </div>
                ) : null}
                {isFrameLocked && capturePreview ? (
                  <div className="pointer-events-none absolute left-2 top-2 rounded bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground shadow-sm">
                    画面已锁定
                  </div>
                ) : null}
              </div>
            ) : null}
            {captureError ? (
              <p
                role="alert"
                className="rounded-md bg-status-warn px-2.5 py-1.5 text-xs leading-4 text-status-warn-foreground sm:px-3 sm:py-2 sm:leading-5"
              >
                {captureError}
              </p>
            ) : null}
            {captureCandidates.length > 0 ? (
              <div className="space-y-1.5 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel)] p-1.5 sm:space-y-2 sm:p-2">
                <p className="text-xs font-medium text-muted-foreground">选择要填入的编号</p>
                <div className="grid max-h-[20svh] gap-1 overflow-y-auto pr-0.5 sm:max-h-[28svh] sm:gap-1.5">
                  {captureCandidates.map((candidate, index) => (
                    <button
                      key={candidate.id}
                      type="button"
                      className={cn(
                        "min-w-0 rounded-md border px-2 py-1.5 text-left transition sm:px-2.5 sm:py-2",
                        selectedCandidateId === candidate.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-foreground",
                      )}
                      aria-pressed={selectedCandidateId === candidate.id}
                      onClick={() => setSelectedCandidateId(candidate.id)}
                    >
                      <span className="flex min-w-0 items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {candidate.box ? (
                            <span className="grid size-5 shrink-0 place-items-center rounded bg-primary text-[10px] font-semibold text-primary-foreground">
                              {candidate.overlayIndex ?? index + 1}
                            </span>
                          ) : null}
                          <span className="truncate text-xs font-semibold">{candidate.label}</span>
                        </span>
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
              </div>
            ) : null}
            {captureCandidates.length === 0 ? (
              <div className="grid gap-1.5 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel)] p-1.5 sm:gap-2 sm:p-2">
                <Input
                  {...imeiKeyboardProps}
                  value={scannerManualValue}
                  onChange={(event) => setScannerManualValue(event.target.value)}
                  placeholder="无法识别时可手动输入"
                  className="h-8 font-mono text-sm sm:h-9"
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
            ) : null}
          </div>
          <div className="grid gap-1.5 border-t border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] p-2 text-xs text-muted-foreground sm:gap-2 sm:p-4">
            <span className="min-w-0 leading-5" aria-live="polite">
              {getScannerStatusText({
                isImageProcessing,
                isStarting,
                isCameraActive,
                cameraMode: activeCameraMode,
                candidateCount: captureCandidates.length,
                hasCaptureError: Boolean(captureError),
                isFrameLocked,
              })}
            </span>
            {captureCandidates.length > 0 ? (
              <Button
                type="button"
                size="sm"
                className="h-8 w-full text-xs sm:h-9"
                disabled={!selectedCandidate}
                onClick={() => {
                  if (selectedCandidate) commitCandidate(selectedCandidate);
                }}
              >
                使用选择的编号
              </Button>
            ) : null}
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs sm:h-9"
                onClick={() => void handleCurrentFrameCapture()}
                disabled={isImageProcessing || isStarting || !isCameraActive}
              >
                {isImageProcessing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <ScanLine className="mr-1.5 size-3.5" />
                )}
                拍照 OCR
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs sm:h-9"
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
              {captureError || captureCandidates.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs sm:h-9"
                  onClick={handleRetryCapture}
                >
                  <RotateCcw className="mr-1.5 size-3.5" />
                  重试
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs sm:h-9"
                  onClick={stopScanner}
                >
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

async function recognizeTextFromImageFile(file: File): Promise<ImeiRecognitionResult> {
  const imageSource = await createImageElementFromFile(file);
  try {
    const recognition = await recognizeTextFromImageElement(imageSource.image);
    return {
      ...recognition,
      preview: {
        src: imageSource.image.src,
        alt: "上传图片预览",
        width: imageSource.image.naturalWidth || imageSource.image.width,
        height: imageSource.image.naturalHeight || imageSource.image.height,
      },
      previewCleanup: imageSource.cleanup,
    };
  } catch (error) {
    imageSource.cleanup();
    throw error;
  }
}

async function recognizeTextFromImageElement(
  image: HTMLImageElement,
  options: { preferOcr?: boolean } = {},
): Promise<ImeiRecognitionResult> {
  if (options.preferOcr) {
    const ocrText = await detectTextFromImageElement(image).catch(() => "");
    if (extractImeiCandidates(ocrText, { source: "ocr", includeGenericSerial: true }).length > 0) {
      return {
        text: ocrText,
        source: "ocr",
      };
    }

    const barcodeRecognition = await recognizeBarcodeFromImageElement(image).catch(() => null);
    if (barcodeRecognition) return barcodeRecognition;

    if (ocrText.trim()) {
      return {
        text: ocrText,
        source: "ocr",
      };
    }

    throw new Error(
      "拍照 OCR 未识别到编号。请把 IMEI 文字放在中间区域、避免反光，或上传更清晰照片。",
    );
  }

  const barcodeRecognition = await recognizeBarcodeFromImageElement(image).catch(() => null);
  if (barcodeRecognition) return barcodeRecognition;

  const ocrText = await withImageRecognitionTimeout(
    detectTextFromImageElement(image),
    imeiOcrDecodeTimeoutMs,
    "OCR 识别超时",
  );
  return {
    text: ocrText,
    source: "ocr",
  };
}

async function recognizeBarcodeFromImageElement(
  image: HTMLImageElement,
): Promise<ImeiRecognitionResult> {
  const barcodeDetections = await withImageRecognitionTimeout(
    detectBarcodeValuesFromImageElement(image),
    imeiBarcodeDecodeTimeoutMs,
    "条码识别超时",
  ).catch((): ImeiBarcodeDetection[] => []);

  if (barcodeDetections.length > 0) {
    return {
      text: barcodeDetections.map((detection) => detection.rawValue).join("\n"),
      source: "barcode",
      detections: barcodeDetections,
    };
  }

  const barcodeText = await withImageRecognitionTimeout(
    decodeBarcodeFromImageElement(image),
    imeiBarcodeDecodeTimeoutMs,
    "条码识别超时",
  );
  return {
    text: barcodeText,
    source: "image",
  };
}

async function recognizeFastBarcodeFromImageElement(
  image: HTMLImageElement,
): Promise<ImeiRecognitionResult> {
  const barcodeDetections = await withImageRecognitionTimeout(
    detectBarcodeValuesFromImageElement(image),
    imeiFastBarcodeDecodeTimeoutMs,
    "快速条码识别超时",
  ).catch((): ImeiBarcodeDetection[] => []);

  if (barcodeDetections.length > 0) {
    return {
      text: barcodeDetections.map((detection) => detection.rawValue).join("\n"),
      source: "barcode",
      detections: barcodeDetections,
    };
  }

  const barcodeText = await withImageRecognitionTimeout(
    decodeBarcodeFromImageElement(image),
    imeiFastBarcodeDecodeTimeoutMs,
    "快速条码识别超时",
  );
  return {
    text: barcodeText,
    source: "image",
  };
}

async function collectLockedFrameCandidateInputs(
  image: HTMLImageElement,
  rawValue: string,
): Promise<ImeiCandidateInput[]> {
  const inputs: ImeiCandidateInput[] = [
    {
      rawValue,
      source: "camera",
      includeGenericSerial: true,
    },
  ];

  const barcodeDetections = await withImageRecognitionTimeout(
    detectBarcodeValuesFromImageElement(image),
    imeiBarcodeDecodeTimeoutMs,
    "条码识别超时",
  ).catch((): ImeiBarcodeDetection[] => []);

  if (barcodeDetections.length > 0) {
    inputs.push({
      rawValue: barcodeDetections.map((detection) => detection.rawValue).join("\n"),
      source: "barcode",
      detections: barcodeDetections,
      includeGenericSerial: true,
    });
  } else {
    const barcodeText = await withImageRecognitionTimeout(
      decodeBarcodeFromImageElement(image),
      imeiFastBarcodeDecodeTimeoutMs,
      "快速条码识别超时",
    ).catch(() => "");
    if (barcodeText.trim() && barcodeText.trim() !== rawValue.trim()) {
      inputs.push({
        rawValue: barcodeText,
        source: "image",
        includeGenericSerial: true,
      });
    }
  }

  if (!hasMultiplePriorityImeiCandidates(inputs)) {
    const ocrText = await withImageRecognitionTimeout(
      detectTextFromImageElement(image),
      imeiOcrDecodeTimeoutMs,
      "OCR 识别超时",
    ).catch(() => "");
    if (ocrText.trim()) {
      inputs.push({
        rawValue: ocrText,
        source: "ocr",
        includeGenericSerial: true,
      });
    }
  }

  return inputs;
}

async function createImageElementFromFile(file: File) {
  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = imageUrl;
    await decodeImageElement(image);
    return {
      image,
      cleanup: () => URL.revokeObjectURL(imageUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(imageUrl);
    throw error;
  }
}

async function createImageElementFromVideoFrame(
  video: HTMLVideoElement,
  options: VideoFrameCaptureOptions = {},
) {
  const width = video.videoWidth || video.clientWidth;
  const height = video.videoHeight || video.clientHeight;
  if (!width || !height) {
    throw new Error("当前摄像头画面还没有准备好，请稍等后再拍照识别。");
  }

  const crop = getVideoFrameCrop(width, height, options.cropScale ?? 1);
  const canvas = document.createElement("canvas");
  canvas.width = crop.outputWidth;
  canvas.height = crop.outputHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("当前浏览器无法读取摄像头画面。请上传图片或手动输入。");
  }

  context.imageSmoothingEnabled = Boolean(options.enhanceForOcr);
  if ("filter" in context && options.enhanceForOcr) {
    context.filter = "grayscale(1) contrast(1.35)";
  }
  context.drawImage(
    video,
    crop.sourceX,
    crop.sourceY,
    crop.sourceWidth,
    crop.sourceHeight,
    0,
    0,
    crop.outputWidth,
    crop.outputHeight,
  );
  const image = new Image();
  image.src = canvas.toDataURL("image/png");
  await decodeImageElement(image);
  return {
    image,
    preview: {
      src: image.src,
      alt: options.alt ?? "当前摄像头画面截图",
      width: crop.outputWidth,
      height: crop.outputHeight,
    },
  };
}

function getVideoFrameCrop(width: number, height: number, cropScale: number) {
  const normalizedScale = Math.max(1, Math.min(imeiCenterCropRecognitionScale, cropScale));
  const sourceWidth = Math.max(1, Math.round(width / normalizedScale));
  const sourceHeight = Math.max(1, Math.round(height / normalizedScale));
  const sourceX = Math.max(0, Math.round((width - sourceWidth) / 2));
  const sourceY = Math.max(0, Math.round((height - sourceHeight) / 2));

  return {
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    outputWidth: Math.max(1, Math.min(width, Math.round(sourceWidth * normalizedScale))),
    outputHeight: Math.max(1, Math.min(height, Math.round(sourceHeight * normalizedScale))),
  };
}

async function decodeImageElement(image: HTMLImageElement) {
  if (typeof image.decode === "function") {
    await image.decode();
    return;
  }

  if (image.complete) return;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("图片无法读取。"));
  });
}

type BrowserBarcodeDetectionResult = {
  rawValue?: string;
  boundingBox?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
};

type BrowserBarcodeDetector = {
  detect: (source: unknown) => Promise<BrowserBarcodeDetectionResult[]>;
};

type BrowserWindowWithBarcodeDetector = Window & {
  BarcodeDetector?: new (options?: { formats?: string[] }) => BrowserBarcodeDetector;
};

async function detectBarcodeValuesFromImageElement(image: HTMLImageElement) {
  const BarcodeDetectorCtor = (window as BrowserWindowWithBarcodeDetector).BarcodeDetector;
  if (!BarcodeDetectorCtor) {
    throw new Error("当前浏览器暂不支持本机多条码识别。");
  }

  let detector: BrowserBarcodeDetector;
  try {
    detector = new BarcodeDetectorCtor({
      formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "data_matrix"],
    });
  } catch {
    detector = new BarcodeDetectorCtor();
  }

  const results = await detector.detect(image);
  const detections = results.reduce<ImeiBarcodeDetection[]>((items, item) => {
    const rawValue = item.rawValue?.trim();
    if (!rawValue || items.some((existing) => existing.rawValue === rawValue)) return items;
    items.push({
      rawValue,
      box: getNormalizedDetectionBox(item, image),
    });
    return items;
  }, []);
  if (detections.length === 0) {
    throw new Error("未识别到条码。");
  }
  return detections;
}

async function decodeBarcodeFromImageElement(image: HTMLImageElement) {
  const { BrowserMultiFormatReader } = await import("@zxing/browser");
  const reader = new BrowserMultiFormatReader();
  const result = await reader.decodeFromImageElement(image);
  return result.getText();
}

type BrowserTextDetector = {
  detect: (source: unknown) => Promise<Array<{ rawValue?: string }>>;
};

type BrowserWindowWithTextDetector = Window & {
  TextDetector?: new () => BrowserTextDetector;
};

async function detectTextFromImageElement(image: HTMLImageElement) {
  const TextDetectorCtor = (window as BrowserWindowWithTextDetector).TextDetector;
  if (TextDetectorCtor) {
    const detector = new TextDetectorCtor();
    const results = await detector.detect(image);
    const nativeText = results
      .map((item) => item.rawValue?.trim())
      .filter((item): item is string => Boolean(item))
      .join(" ");
    if (nativeText.trim()) return nativeText;
  }

  return detectTextWithTesseract(image);
}

async function detectTextWithTesseract(image: HTMLImageElement) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const configurableWorker = worker as unknown as {
      setParameters?: (parameters: Record<string, string>) => Promise<unknown>;
    };
    await configurableWorker.setParameters?.({
      preserve_interword_spaces: "1",
      tessedit_char_whitelist:
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz:/-_. ",
    });
    const result = await worker.recognize(image.src);
    return result.data.text?.trim() ?? "";
  } finally {
    await worker.terminate();
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

async function startScannerWithFallback(
  reader: ImeiScannerReader,
  video: HTMLVideoElement,
  callback: ImeiScannerDecodeCallback,
  shouldCancel: () => boolean,
) {
  let lastError: unknown;
  for (const plan of getScannerConstraintPlans()) {
    if (shouldCancel()) break;
    try {
      const controls = await reader.decodeFromConstraints(plan.constraints, video, callback);
      return {
        controls,
        mode: plan.mode,
      };
    } catch (error) {
      lastError = error;
      if (!shouldRetryWithDefaultCamera(error)) throw error;
    }
  }

  throw lastError ?? new Error("无法打开摄像头，请改用照片上传或手动输入。");
}

function getScannerConstraintPlans(): ImeiScannerConstraintPlan[] {
  return [
    {
      mode: "enhanced",
      constraints: {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 24, max: 30 },
        },
      },
    },
    {
      mode: "standard",
      constraints: {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
      },
    },
    {
      mode: "default",
      constraints: {
        audio: false,
        video: true,
      },
    },
  ];
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

function findDetectionForCandidate(
  candidate: ImeiCandidate,
  detections: readonly ImeiBarcodeDetection[] | undefined,
  fallbackIndex: number,
) {
  if (!detections?.length) return null;
  const directMatch = detections.find((detection) =>
    normalizeCaptureIdentifier(detection.rawValue).includes(candidate.value),
  );
  return directMatch ?? detections[fallbackIndex] ?? null;
}

function buildSelectableCandidatesFromInputs(inputs: readonly ImeiCandidateInput[]) {
  const candidatesByValue = new Map<
    string,
    {
      candidate: ImeiCandidate;
      box?: ImeiCaptureBox;
      firstIndex: number;
    }
  >();
  let nextIndex = 0;

  for (const input of inputs) {
    const candidates = extractImeiCandidates(input.rawValue, {
      source: input.source,
      includeGenericSerial: input.includeGenericSerial ?? true,
    });

    candidates.forEach((candidate, candidateIndex) => {
      const detection = findDetectionForCandidate(candidate, input.detections, candidateIndex);
      const existing = candidatesByValue.get(candidate.value);
      const next = {
        candidate,
        box: detection?.box,
        firstIndex: nextIndex,
      };
      nextIndex += 1;

      if (!existing || shouldPreferCandidate(next, existing)) {
        candidatesByValue.set(candidate.value, next);
      }
    });
  }

  return orderCandidatesByPriorityAndVisualPosition(
    [...candidatesByValue.values()].map(({ candidate, box }, index) => ({
      ...candidate,
      id: `${candidate.kind}:${candidate.value}:${index}`,
      box,
    })),
  );
}

function hasMultiplePriorityImeiCandidates(inputs: readonly ImeiCandidateInput[]) {
  return (
    buildSelectableCandidatesFromInputs(inputs).filter((candidate) => candidate.kind === "imei")
      .length >= 2
  );
}

function shouldPreferCandidate(
  next: { candidate: ImeiCandidate; box?: ImeiCaptureBox },
  existing: { candidate: ImeiCandidate; box?: ImeiCaptureBox },
) {
  const priorityDifference =
    getCandidateKindPriority(next.candidate) - getCandidateKindPriority(existing.candidate);
  if (priorityDifference !== 0) return priorityDifference < 0;
  if (next.box && !existing.box) return true;
  return (
    getCandidateConfidencePriority(next.candidate) <
    getCandidateConfidencePriority(existing.candidate)
  );
}

function orderCandidatesByPriorityAndVisualPosition(
  candidates: readonly ImeiSelectableCandidate[],
) {
  if (!candidates.some((candidate) => candidate.box)) {
    return [...candidates].sort(compareCandidatesByPriority);
  }

  let nextOverlayIndex = 0;
  return [...candidates]
    .map((candidate, originalIndex) => ({ candidate, originalIndex }))
    .sort((left, right) => {
      const leftBox = left.candidate.box;
      const rightBox = right.candidate.box;
      const priorityDifference = compareCandidatesByPriority(left.candidate, right.candidate);
      if (priorityDifference !== 0) return priorityDifference;

      if (leftBox && rightBox) {
        return (
          leftBox.y - rightBox.y ||
          leftBox.x - rightBox.x ||
          left.originalIndex - right.originalIndex
        );
      }
      if (leftBox) return -1;
      if (rightBox) return 1;
      return left.originalIndex - right.originalIndex;
    })
    .map(({ candidate }) =>
      candidate.box
        ? { ...candidate, overlayIndex: (nextOverlayIndex += 1) }
        : { ...candidate, overlayIndex: undefined },
    );
}

function compareCandidatesByPriority(left: ImeiCandidate, right: ImeiCandidate) {
  return (
    getCandidateKindPriority(left) - getCandidateKindPriority(right) ||
    getCandidateConfidencePriority(left) - getCandidateConfidencePriority(right)
  );
}

function getCandidateKindPriority(candidate: ImeiCandidate) {
  if (candidate.kind === "imei") return 0;
  if (candidate.kind === "suspect_imei") return 1;
  return 2;
}

function getCandidateConfidencePriority(candidate: ImeiCandidate) {
  if (candidate.confidence === "high") return 0;
  if (candidate.confidence === "medium") return 1;
  return 2;
}

function getOverlayBoxStyle(
  box: ImeiCaptureBox,
  preview: ImeiCapturePreview | null,
  viewport: ImeiCaptureViewportSize | null,
) {
  if (!preview?.width || !preview.height || !viewport?.width || !viewport.height) {
    return {
      left: `${box.x * 100}%`,
      top: `${box.y * 100}%`,
      width: `${box.width * 100}%`,
      height: `${box.height * 100}%`,
    };
  }

  const imageRatio = preview.width / preview.height;
  const viewportRatio = viewport.width / viewport.height;
  const rendered =
    viewportRatio > imageRatio
      ? {
          width: viewport.height * imageRatio,
          height: viewport.height,
          x: (viewport.width - viewport.height * imageRatio) / 2,
          y: 0,
        }
      : {
          width: viewport.width,
          height: viewport.width / imageRatio,
          x: 0,
          y: (viewport.height - viewport.width / imageRatio) / 2,
        };

  const left = rendered.x + box.x * rendered.width;
  const top = rendered.y + box.y * rendered.height;
  const width = box.width * rendered.width;
  const height = box.height * rendered.height;

  return {
    left: `${(left / viewport.width) * 100}%`,
    top: `${(top / viewport.height) * 100}%`,
    width: `${(width / viewport.width) * 100}%`,
    height: `${(height / viewport.height) * 100}%`,
  };
}

function getNormalizedDetectionBox(
  result: BrowserBarcodeDetectionResult,
  image: HTMLImageElement,
): ImeiCaptureBox | undefined {
  const box = result.boundingBox;
  if (!box) return undefined;

  const rawX = Number(box.x ?? 0);
  const rawY = Number(box.y ?? 0);
  const rawWidth = Number(box.width ?? 0);
  const rawHeight = Number(box.height ?? 0);
  if (
    ![rawX, rawY, rawWidth, rawHeight].every(Number.isFinite) ||
    rawWidth <= 0 ||
    rawHeight <= 0
  ) {
    return undefined;
  }

  const looksNormalized =
    rawX >= 0 && rawY >= 0 && rawWidth <= 1 && rawHeight <= 1 && rawX + rawWidth <= 1.05;
  if (looksNormalized) {
    return normalizeBoxBounds(rawX, rawY, rawWidth, rawHeight);
  }

  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  if (!imageWidth || !imageHeight) return undefined;

  return normalizeBoxBounds(
    rawX / imageWidth,
    rawY / imageHeight,
    rawWidth / imageWidth,
    rawHeight / imageHeight,
  );
}

function normalizeBoxBounds(x: number, y: number, width: number, height: number): ImeiCaptureBox {
  const left = clampRatio(x);
  const top = clampRatio(y);
  const maxWidth = Math.max(0.01, 1 - left);
  const maxHeight = Math.max(0.01, 1 - top);
  return {
    x: left,
    y: top,
    width: Math.min(Math.max(0.04, clampRatio(width)), maxWidth),
    height: Math.min(Math.max(0.04, clampRatio(height)), maxHeight),
  };
}

function clampRatio(value: number) {
  return Math.min(1, Math.max(0, value));
}

function getCaptureCandidatesMessage(candidates: readonly ImeiCandidate[]) {
  if (candidates.length > 1) {
    return `已识别 ${candidates.length} 个候选，请选择要填入的编号。`;
  }
  if (candidates[0]?.kind === "suspect_imei") {
    return "已识别 1 个疑似编号，请确认后再填入。";
  }
  return "已识别 1 个编号，请确认后再填入。";
}

function getScannerStatusText({
  isImageProcessing,
  isFrameLocked,
  isStarting,
  isCameraActive,
  cameraMode,
  candidateCount,
  hasCaptureError,
}: {
  isImageProcessing: boolean;
  isFrameLocked: boolean;
  isStarting: boolean;
  isCameraActive: boolean;
  cameraMode: ImeiScannerCameraMode;
  candidateCount: number;
  hasCaptureError: boolean;
}) {
  if (isFrameLocked && isImageProcessing) return "已锁定画面，正在识别更多编号...";
  if (isImageProcessing) return "正在识别图片 / OCR...";
  if (isStarting) return "正在启动 1x 摄像头，识别时会自动中心裁切增强...";
  if (candidateCount > 0) return `已识别 ${candidateCount} 个候选，请选择要填入的编号。`;
  if (isFrameLocked) return "已锁定画面，可选择候选、重试或上传图片。";
  if (hasCaptureError) return "可重试、上传图片或手动输入。";
  if (isCameraActive && cameraMode === "enhanced") {
    return "1x 取景中；对准条码会自动锁定画面并快速识别。";
  }
  if (isCameraActive) return "正在扫描，保持条码在画面中；识别后会在下方显示候选。";
  return "摄像头已停止，可上传图片或手动输入。";
}

function getImageRecognitionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/摄像头画面|无法读取摄像头|图片无法读取/.test(message)) {
    return message;
  }
  if (/当前浏览器暂不支持本机 OCR/.test(message)) {
    return "当前浏览器暂不支持本机 OCR。请使用条码照片、摄像头扫码或手动输入。";
  }
  if (/超时|timeout/i.test(message)) {
    return "图片识别超时，请重试、换一张更清晰的照片或手动输入。";
  }
  return "图片识别失败，请换一张更清晰的照片或手动输入。";
}
