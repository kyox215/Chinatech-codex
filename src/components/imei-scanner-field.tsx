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
  normalizeCaptureIdentifier,
  type ImeiCandidate,
  type ImeiCaptureSource,
} from "@/features/capture/model/barcode-parser";
import {
  extractValidImeiCandidates,
  getPreferredValidImeiCandidate,
} from "@/entities/device/model/imei-candidates";
import { recognizeTextWithLocalOcr } from "@/features/capture/model/local-ocr";
import { inspectAiInventoryImage } from "@/features/ai-assistant/model/inventory-image";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";
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
type Translate = (key: MessageKey, values?: MessageValues) => string;

const imeiBarcodeDecodeTimeoutMs = 2500;
const imeiFastBarcodeDecodeTimeoutMs = 450;
const imeiOcrDecodeTimeoutMs = 32_000;
const imeiCenterCropRecognitionScale = 1.8;
const imeiCenterCropScanIntervalMs = 250;
const imeiCameraAccessPreferenceKey = "repairdesk:imei-camera-access:v1";
const imeiImageAccept = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

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
  placeholder,
  density = "default",
  showPaste = true,
  showScanner = true,
  startScannerToken,
  appearance = "outlined",
  inputId,
  inputAriaLabel,
  identifierLabel,
  inputMode,
  ariaInvalid,
  ariaDescribedBy,
  ariaRequired,
  onCommitSource,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  density?: ImeiScannerFieldDensity;
  showPaste?: boolean;
  showScanner?: boolean;
  startScannerToken?: number;
  appearance?: "outlined" | "quiet";
  inputId?: string;
  inputAriaLabel?: string;
  identifierLabel?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  ariaRequired?: boolean;
  onCommitSource?: (source: "manual" | "scan") => void;
}) {
  const { t } = useLocale();
  const actionIdentifierLabel = identifierLabel ?? "IMEI";
  const resolvedPlaceholder = placeholder ?? t("inventory2b4.scanner.placeholder");
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
  const activeCameraModeRef = useRef<ImeiScannerCameraMode>("enhanced");
  const rememberedCameraModeRef = useRef<ImeiScannerCameraMode | null>(readRememberedCameraMode());
  const onChangeRef = useRef(onChange);
  const onCommitSourceRef = useRef(onCommitSource);
  const lastStartScannerTokenRef = useRef(startScannerToken);
  const compact = density === "compact";
  const quiet = appearance === "quiet";
  const showClear = Boolean(value);
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
    onCommitSourceRef.current = onCommitSource;
  }, [onChange, onCommitSource]);

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
    activeCameraModeRef.current = "enhanced";
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
      onCommitSourceRef.current?.("scan");
      toast.success(t("inventory2b4.scanner.recorded"));
      stopScanner();
      setScannerOpen(false);
      resetCaptureState();
    },
    [resetCaptureState, stopScanner, t],
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
        },
      ]);

      if (orderedCandidates.length === 0) {
        if (options.preview) {
          replaceCapturePreview(options.preview, options.previewCleanup);
        }
        setCaptureError(t("inventory2b4.scanner.noValid"));
        stopScanner();
        return;
      }

      const preferred = getPreferredValidImeiCandidate(orderedCandidates);
      if (options.preview) {
        replaceCapturePreview(options.preview, options.previewCleanup);
      }
      setCaptureCandidates(orderedCandidates);
      setSelectedCandidateId(preferred?.id ?? orderedCandidates[0]?.id ?? "");
      setCaptureError(getCaptureCandidatesMessage(orderedCandidates, t));
      stopScanner();
    },
    [replaceCapturePreview, stopScanner, t],
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
        setCaptureError(t("inventory2b4.scanner.noValid"));
        stopScanner();
        return;
      }

      const preferred = getPreferredValidImeiCandidate(orderedCandidates);
      if (options.preview) {
        replaceCapturePreview(options.preview, options.previewCleanup);
      }
      setCaptureCandidates(orderedCandidates);
      setSelectedCandidateId(preferred?.id ?? orderedCandidates[0]?.id ?? "");
      setCaptureError(getCaptureCandidatesMessage(orderedCandidates, t));
      stopScanner();
    },
    [replaceCapturePreview, stopScanner, t],
  );

  const commitValue = useCallback(
    (rawValue: string, source: CommitSource) => {
      if (source === "clear") {
        setWarning("");
        onChangeRef.current("");
        return true;
      }

      const capturedImei =
        source === "scan" || source === "paste"
          ? getPreferredValidImeiCandidate(
              extractValidImeiCandidates(rawValue, {
                source: source === "paste" ? "paste" : "manual",
              }),
            )
          : null;
      if ((source === "scan" || source === "paste") && !capturedImei) {
        toast.error(t("inventory2b4.scanner.automaticImeiOnly"));
        return false;
      }
      const normalized = normalizeImeiIdentifier(capturedImei?.value ?? rawValue);
      setWarning(normalized.hadUnsupported ? t("inventory2b4.scanner.unsupportedRemoved") : "");
      onChangeRef.current(normalized.value);
      onCommitSourceRef.current?.(source === "scan" ? "scan" : "manual");

      if (source === "scan") {
        toast.success(t("inventory2b4.scanner.recorded"));
      } else if (source === "paste") {
        toast.success(t("inventory2b4.scanner.pasted"));
      }

      if (normalized.hadUnsupported && source !== "manual") {
        toast.warning(t("inventory2b4.scanner.normalized"));
      }
      return true;
    },
    [t],
  );

  const handleImageFile = useCallback(
    async (file?: File) => {
      if (!file) return;

      try {
        await inspectAiInventoryImage(file);
      } catch {
        const message = t(
          ["image/jpeg", "image/png", "image/webp"].includes(file.type)
            ? "inventory2b4.scanner.imageUnsafe"
            : "inventory2b4.scanner.imageUnsupported",
        );
        setCaptureError(message);
        toast.error(message);
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
        handleCapturedText(recognition.text, recognition.source, {
          ...recognition,
          preview: recognition.preview
            ? { ...recognition.preview, alt: t("inventory2b4.scanner.uploadPreview") }
            : undefined,
        });
      } catch (error) {
        const message = getImageRecognitionErrorMessage(t);
        setCaptureError(message);
        toast.error(message);
      } finally {
        setIsImageProcessing(false);
      }
    },
    [handleCapturedText, replaceCapturePreview, stopScanner, t],
  );

  const handleCurrentFrameCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      const message = t("inventory2b4.scanner.noFrame");
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
        alt: t("inventory2b4.scanner.previewCurrentOcr"),
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
      const message = getImageRecognitionErrorMessage(t);
      setCaptureError(message);
      toast.error(message);
    } finally {
      setIsImageProcessing(false);
    }
  }, [activeCameraMode, handleCapturedText, replaceCapturePreview, stopScanner, t]);

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
      const cameraMode = activeCameraModeRef.current;
      try {
        frame = await createImageElementFromVideoFrame(video, {
          alt: t("inventory2b4.scanner.previewLocked"),
          cropScale: cameraMode === "enhanced" ? imeiCenterCropRecognitionScale : 1,
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
    [handleCapturedCandidateInputs, handleCapturedText, replaceCapturePreview, stopScanner, t],
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
              alt: t("inventory2b4.scanner.previewEnhanced"),
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
    [handleCapturedText, replaceCapturePreview, stopScanner, t],
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
        setCaptureError(t("inventory2b4.scanner.cameraUnsupported"));
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
          rememberedCameraModeRef.current,
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
        rememberCameraMode(mode);
        rememberedCameraModeRef.current = mode;
        activeCameraModeRef.current = mode;
        setActiveCameraMode(mode);
        setIsCameraActive(true);
        startCenterCropDecodeLoop(runId, mode);
      } catch (error) {
        if (cancelled || scannerRunIdRef.current !== runId) return;
        if (getErrorName(error) === "NotAllowedError") {
          forgetCameraMode();
          rememberedCameraModeRef.current = null;
        }
        setCaptureError(getCameraErrorMessage(error, t));
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
    t,
  ]);

  useEffect(() => {
    const stopWhenHidden = () => {
      if (document.visibilityState === "hidden") stopScanner();
    };
    const stopOnPageHide = () => stopScanner();
    document.addEventListener("visibilitychange", stopWhenHidden);
    window.addEventListener("pagehide", stopOnPageHide);
    return () => {
      document.removeEventListener("visibilitychange", stopWhenHidden);
      window.removeEventListener("pagehide", stopOnPageHide);
    };
  }, [stopScanner]);

  useEffect(() => {
    if (!showScanner || startScannerToken === undefined) return;
    if (lastStartScannerTokenRef.current === startScannerToken) return;
    lastStartScannerTokenRef.current = startScannerToken;
    setScannerOpen(true);
  }, [showScanner, startScannerToken]);

  return (
    <div className={cn("space-y-1.5", compact && "space-y-1")}>
      <div
        className={cn(
          "flex gap-2",
          compact &&
            (showScanner
              ? showPaste
                ? showClear
                  ? "grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-1.5"
                  : "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5"
                : showClear
                  ? "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5"
                  : "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5"
              : showPaste
                ? showClear
                  ? "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5"
                  : "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5"
                : showClear
                  ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5"
                  : "grid grid-cols-1 items-center gap-1.5"),
        )}
      >
        <Input
          {...imeiKeyboardProps}
          id={inputId}
          aria-label={inputAriaLabel}
          aria-invalid={ariaInvalid || undefined}
          aria-describedby={ariaDescribedBy}
          aria-required={ariaRequired || undefined}
          inputMode={inputMode ?? imeiKeyboardProps.inputMode}
          value={value}
          onChange={(event) => commitValue(event.target.value, "manual")}
          placeholder={resolvedPlaceholder}
          className={cn(
            "font-mono",
            compact &&
              "h-11 min-w-0 text-base placeholder:text-base lg:h-8 lg:text-[13px] lg:placeholder:text-[13px]",
            compact && quiet && "border-0 bg-transparent px-0 shadow-none focus-visible:ring-0",
          )}
        />
        {showScanner ? (
          <Button
            type="button"
            variant={quiet ? "ghost" : "outline"}
            size="icon"
            className={cn(
              "shrink-0",
              compact && "size-11 lg:size-8",
              quiet && "rounded-lg bg-[var(--surface-panel-muted)] text-foreground",
            )}
            onClick={() => setScannerOpen(true)}
            aria-label={t("inventory2b4.scanner.cameraAction", {
              identifier: actionIdentifierLabel,
            })}
          >
            <Camera className="size-4" />
          </Button>
        ) : null}
        {showPaste ? (
          <Button
            type="button"
            variant={quiet ? "ghost" : "outline"}
            size="icon"
            className={cn(
              "shrink-0",
              compact && "size-11 lg:size-8",
              quiet && "rounded-lg bg-[var(--surface-panel-muted)] text-foreground",
            )}
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                commitValue(text, "paste");
              } catch {
                toast.error(t("inventory2b4.scanner.clipboardError"));
              }
            }}
            aria-label={t("inventory2b4.scanner.pasteAction", {
              identifier: actionIdentifierLabel,
            })}
          >
            <ClipboardPaste className="size-4" />
          </Button>
        ) : null}
        {showClear ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("shrink-0", compact && "size-11 lg:size-8")}
            onClick={() => commitValue("", "clear")}
            aria-label={t("inventory2b4.scanner.clearAction", {
              identifier: actionIdentifierLabel,
            })}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      {warning && <p className="text-xs text-status-warn-foreground">{warning}</p>}

      <Dialog open={showScanner && scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="grid max-h-[calc(100svh-12px)] w-[min(32rem,calc(100vw-16px))] max-w-md grid-rows-[minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
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
              <DialogTitle className="text-base sm:text-lg">
                {t("inventory2b4.scanner.title")}
              </DialogTitle>
              <DialogDescription className="text-xs leading-4 sm:text-sm">
                {t("inventory2b4.scanner.description")}
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
                    aria-label={t("inventory2b4.scanner.cameraPreview")}
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
                            "absolute min-h-11 min-w-11 rounded-md border-2 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:min-h-8 lg:min-w-8",
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
                          aria-label={t("inventory2b4.scanner.chooseOverlay", {
                            index: candidate.overlayIndex ?? index + 1,
                          })}
                          aria-pressed={selectedCandidateId === candidate.id}
                          title={`${candidate.label} ${maskCandidateValue(candidate.value)}`}
                          onClick={() => setSelectedCandidateId(candidate.id)}
                        >
                          <span className="absolute left-1 top-1 flex max-w-[calc(100%-0.5rem)] items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground shadow-sm">
                            <span>{candidate.overlayIndex ?? index + 1}</span>
                            <span className="min-w-0 truncate font-mono">
                              {getOverlayDisplayValue(candidate.value)}
                            </span>
                          </span>
                        </button>
                      ) : null,
                    )}
                  </div>
                ) : null}
                {!capturePreview && (isStarting || isCameraActive) ? (
                  <div className="pointer-events-none absolute left-2 top-2 rounded bg-background/85 px-2 py-1 text-[10px] font-semibold text-foreground shadow-sm">
                    {t(
                      activeCameraMode === "enhanced"
                        ? "inventory2b4.scanner.cameraEnhanced"
                        : "inventory2b4.scanner.cameraCompatible",
                    )}
                  </div>
                ) : null}
                {isFrameLocked && capturePreview ? (
                  <div className="pointer-events-none absolute left-2 top-2 rounded bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground shadow-sm">
                    {t("inventory2b4.scanner.frameLocked")}
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
                <p className="text-xs font-medium text-muted-foreground">
                  {t("inventory2b4.scanner.choose")}
                </p>
                <div className="grid max-h-[20svh] gap-1 overflow-y-auto pr-0.5 sm:max-h-[28svh] sm:gap-1.5">
                  {captureCandidates.map((candidate, index) => (
                    <button
                      key={candidate.id}
                      type="button"
                      className={cn(
                        "min-h-11 min-w-0 rounded-md border px-2 py-1.5 text-left transition sm:px-2.5 sm:py-2 lg:min-h-9",
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
                          {getCandidateEvidenceLabel(candidate, t)}
                        </span>
                      </span>
                      <span className="mt-1 block break-all font-mono text-xs">
                        {maskScannerCandidate(candidate.value)}
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
                  placeholder={t("inventory2b4.scanner.manualPlaceholder")}
                  className="h-11 font-mono text-base"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 text-sm"
                  disabled={!scannerManualValue.trim()}
                  onClick={() => {
                    if (commitValue(scannerManualValue, "scan")) setScannerOpen(false);
                  }}
                >
                  {t("inventory2b4.scanner.manualApply")}
                </Button>
              </div>
            ) : null}
          </div>
          <div className="grid gap-1.5 border-t border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] p-2 text-xs text-muted-foreground sm:gap-2 sm:p-4">
            <span className="min-w-0 leading-5" aria-live="polite">
              {getScannerStatusText(
                {
                  isImageProcessing,
                  isStarting,
                  isCameraActive,
                  cameraMode: activeCameraMode,
                  candidateCount: captureCandidates.length,
                  hasCaptureError: Boolean(captureError),
                  isFrameLocked,
                },
                t,
              )}
            </span>
            {captureCandidates.length > 0 ? (
              <Button
                type="button"
                size="sm"
                className="h-11 w-full text-sm lg:h-9 lg:text-xs"
                disabled={!selectedCandidate}
                onClick={() => {
                  if (selectedCandidate) commitCandidate(selectedCandidate);
                }}
              >
                {t("inventory2b4.scanner.useSelected")}
              </Button>
            ) : null}
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 text-xs lg:h-9"
                onClick={() => void handleCurrentFrameCapture()}
                disabled={isImageProcessing || isStarting || !isCameraActive}
              >
                {isImageProcessing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <ScanLine className="mr-1.5 size-3.5" />
                )}
                {t("inventory2b4.scanner.captureOcr")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 text-xs lg:h-9"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImageProcessing}
              >
                {isImageProcessing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="mr-1.5 size-3.5" />
                )}
                {t("inventory2b4.scanner.upload")}
              </Button>
              {captureError || captureCandidates.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 text-xs lg:h-9"
                  onClick={handleRetryCapture}
                >
                  <RotateCcw className="mr-1.5 size-3.5" />
                  {t("inventory2b4.scanner.retry")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 text-xs lg:h-9"
                  onClick={stopScanner}
                >
                  {isStarting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                  {t("inventory2b4.scanner.stop")}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
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

function maskScannerCandidate(value: string) {
  const normalized = value.trim();
  return normalized.length <= 4 ? `••••${normalized}` : `•••• ${normalized.slice(-4)}`;
}

async function recognizeTextFromImageElement(
  image: HTMLImageElement,
  options: { preferOcr?: boolean } = {},
): Promise<ImeiRecognitionResult> {
  if (options.preferOcr) {
    const ocrText = await detectTextFromImageElement(image).catch(() => "");
    if (extractValidImeiCandidates(ocrText, { source: "ocr" }).length > 0) {
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
  return recognizeTextWithLocalOcr(image.src, { timeoutMs: imeiOcrDecodeTimeoutMs });
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

function getCameraErrorMessage(error: unknown, t: Translate) {
  if (!(error instanceof DOMException) && !(error instanceof Error)) {
    return t("inventory2b4.scanner.cameraGeneric");
  }

  if (error.name === "NotAllowedError") {
    return t("inventory2b4.scanner.cameraDenied");
  }
  if (error.name === "NotFoundError") {
    return t("inventory2b4.scanner.cameraNotFound");
  }
  if (error.name === "NotReadableError") {
    return t("inventory2b4.scanner.cameraBusy");
  }
  if (error.name === "OverconstrainedError") {
    return t("inventory2b4.scanner.cameraConstraints");
  }
  if (error.name === "TypeError") {
    return t("inventory2b4.scanner.cameraContext");
  }

  return t("inventory2b4.scanner.cameraGeneric");
}

async function startScannerWithFallback(
  reader: ImeiScannerReader,
  video: HTMLVideoElement,
  callback: ImeiScannerDecodeCallback,
  shouldCancel: () => boolean,
  preferredMode?: ImeiScannerCameraMode | null,
) {
  let lastError: unknown;
  for (const plan of getScannerConstraintPlans(preferredMode)) {
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

function getScannerConstraintPlans(preferredMode?: ImeiScannerCameraMode | null) {
  const plans: ImeiScannerConstraintPlan[] = [
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
  if (!preferredMode || preferredMode === "enhanced") return plans;
  return [
    ...plans.filter((plan) => plan.mode === preferredMode),
    ...plans.filter((plan) => plan.mode !== preferredMode),
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

function readRememberedCameraMode(): ImeiScannerCameraMode | null {
  if (typeof window === "undefined") return null;
  try {
    const rawPreference = window.localStorage.getItem(imeiCameraAccessPreferenceKey);
    if (!rawPreference) return null;
    const preference = JSON.parse(rawPreference) as { mode?: unknown };
    return isImeiScannerCameraMode(preference.mode) ? preference.mode : null;
  } catch {
    return null;
  }
}

function rememberCameraMode(mode: ImeiScannerCameraMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      imeiCameraAccessPreferenceKey,
      JSON.stringify({ granted: true, mode, updatedAt: Date.now() }),
    );
  } catch {
    // Private browsing or storage restrictions should not block camera scanning.
  }
}

function forgetCameraMode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(imeiCameraAccessPreferenceKey);
  } catch {
    // Ignore storage restrictions.
  }
}

function isImeiScannerCameraMode(value: unknown): value is ImeiScannerCameraMode {
  return value === "enhanced" || value === "standard" || value === "default";
}

function findDetectionForCandidate(
  candidate: ImeiCandidate,
  detections: readonly ImeiBarcodeDetection[] | undefined,
) {
  if (!detections?.length) return null;
  return detections.find((detection) => doesDetectionMatchCandidate(detection, candidate)) ?? null;
}

function doesDetectionMatchCandidate(detection: ImeiBarcodeDetection, candidate: ImeiCandidate) {
  const detectionValue = normalizeCaptureIdentifier(detection.rawValue);
  if (!detectionValue || !candidate.value) return false;
  return detectionValue.includes(candidate.value);
}

function buildSelectableCandidatesFromInputs(inputs: readonly ImeiCandidateInput[]) {
  const candidatesByValue = new Map<
    string,
    {
      candidate: ImeiCandidate;
      box?: ImeiCaptureBox;
    }
  >();

  for (const input of inputs) {
    const candidates = extractValidImeiCandidates(input.rawValue, {
      source: input.source,
    });

    candidates.forEach((candidate) => {
      const detection = findDetectionForCandidate(candidate, input.detections);
      const existing = candidatesByValue.get(candidate.value);
      const next = {
        candidate,
        box: detection?.box,
      };

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
  const candidatesWithOverlayIndexes = assignVisualOverlayIndexes(candidates);
  if (!candidatesWithOverlayIndexes.some((candidate) => candidate.box)) {
    return [...candidatesWithOverlayIndexes].sort(compareCandidatesByPriority);
  }

  return [...candidatesWithOverlayIndexes]
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
    .map(({ candidate }) => candidate);
}

function assignVisualOverlayIndexes(candidates: readonly ImeiSelectableCandidate[]) {
  const overlayIndexById = new Map<string, number>();
  [...candidates]
    .map((candidate, originalIndex) => ({ candidate, originalIndex }))
    .filter(({ candidate }) => Boolean(candidate.box))
    .sort((left, right) => {
      const leftBox = left.candidate.box;
      const rightBox = right.candidate.box;
      if (leftBox && rightBox) {
        return (
          leftBox.y - rightBox.y ||
          leftBox.x - rightBox.x ||
          left.originalIndex - right.originalIndex
        );
      }
      return left.originalIndex - right.originalIndex;
    })
    .forEach(({ candidate }, index) => {
      overlayIndexById.set(candidate.id, index + 1);
    });

  return candidates.map((candidate) =>
    candidate.box
      ? { ...candidate, overlayIndex: overlayIndexById.get(candidate.id) }
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
  return 1;
}

function getCandidateConfidencePriority(candidate: ImeiCandidate) {
  if (candidate.confidence === "high") return 0;
  if (candidate.confidence === "medium") return 1;
  return 2;
}

function getOverlayDisplayValue(value: string) {
  return maskCandidateValue(value);
}

function maskCandidateValue(value: string) {
  return `•••• ${value.slice(-4)}`;
}

function getCandidateEvidenceLabel(candidate: ImeiSelectableCandidate, t: Translate) {
  const confidenceLabel = t(
    candidate.confidence === "high"
      ? "inventory2b4.scanner.evidenceHigh"
      : "inventory2b4.scanner.evidenceConfirm",
  );
  if (candidate.box && candidate.overlayIndex) {
    return t("inventory2b4.scanner.evidenceFrame", {
      index: candidate.overlayIndex,
      confidence: confidenceLabel,
    });
  }
  if (candidate.source === "ocr") {
    return t("inventory2b4.scanner.evidenceOcr", { confidence: confidenceLabel });
  }
  return confidenceLabel;
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

function getCaptureCandidatesMessage(candidates: readonly ImeiCandidate[], t: Translate) {
  if (candidates.length > 1) {
    return t("inventory2b4.scanner.candidatesMany", { count: candidates.length });
  }
  return t("inventory2b4.scanner.candidateOne");
}

function getScannerStatusText(
  {
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
  },
  t: Translate,
) {
  if (isFrameLocked && isImageProcessing) {
    return t("inventory2b4.scanner.statusLockedProcessing");
  }
  if (isImageProcessing) return t("inventory2b4.scanner.statusProcessing");
  if (isStarting) return t("inventory2b4.scanner.statusStarting");
  if (candidateCount > 0) {
    return t("inventory2b4.scanner.statusCandidates", { count: candidateCount });
  }
  if (isFrameLocked) return t("inventory2b4.scanner.statusLocked");
  if (hasCaptureError) return t("inventory2b4.scanner.statusRecover");
  if (isCameraActive && cameraMode === "enhanced") {
    return t("inventory2b4.scanner.statusActiveEnhanced");
  }
  if (isCameraActive) return t("inventory2b4.scanner.statusActive");
  return t("inventory2b4.scanner.statusStopped");
}

function getImageRecognitionErrorMessage(t: Translate) {
  return t("inventory2b4.scanner.recognitionFailed");
}
