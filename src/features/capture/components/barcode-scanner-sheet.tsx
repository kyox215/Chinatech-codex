"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { usePathname } from "next/navigation";
import { ClipboardPaste, Copy, ImagePlus, Loader2, RotateCcw, ScanLine } from "lucide-react";
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
import { getCapturePayloadDisplayLabel } from "@/features/capture/model/capture-presentation";
import {
  createCameraStartFailedError,
  createImageDecodeTimeoutError,
  createImageReadFailedError,
  getBarcodeScannerCameraErrorKind,
  getCameraErrorMessageKey,
  getImageDecodeErrorMessage,
  isImageDecodeTimeout,
} from "@/features/capture/model/scanner-errors";
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

interface BarcodeScannerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  scanMode?: "multi-format" | "qr-only";
  parsePayload?: (rawValue: string, origin: string) => CapturePayload;
  onDetected?: (payload: CapturePayload) => void;
  onOutsideDismiss?: () => void;
  onCloseAutoFocus?: (event: Event) => void;
  renderActions?: (
    payload: CapturePayload,
    helpers: { close: () => void; rescan: () => void },
  ) => ReactNode;
}

type ScannerReader = Pick<
  BrowserMultiFormatReader,
  "decodeFromConstraints" | "decodeFromImageElement"
>;
type ScannerDecodeCallback = Parameters<BrowserMultiFormatReader["decodeFromConstraints"]>[2];
type ScannerCameraMode = "enhanced" | "standard" | "default";

const scannerImageMaxBytes = 12 * 1024 * 1024;
const scannerImageDecodeTimeoutMs = 8_000;
const scannerManualMaxLength = 4_096;
const scannerCameraErrorToastId = "repairdesk-scanner-camera-error";

export function BarcodeScannerSheet({
  open,
  onOpenChange,
  title,
  description,
  scanMode = "multi-format",
  parsePayload = parseBarcodePayload,
  onDetected,
  renderActions,
  onOutsideDismiss,
  onCloseAutoFocus,
}: BarcodeScannerSheetProps) {
  const { locale, t } = useLocale();
  const tRef = useRef(t);
  const localeRef = useRef(locale);
  useEffect(() => {
    tRef.current = t;
    localeRef.current = locale;
  }, [locale, t]);
  const resolvedTitle = title ?? t("scanner.title");
  const resolvedDescription =
    description ??
    (scanMode === "qr-only" ? t("scanner.qrOnlyDescription") : t("scanner.description"));
  const pathname = usePathname();
  const [isStarting, setIsStarting] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [cameraErrorKind, setCameraErrorKind] = useState<ReturnType<
    typeof getBarcodeScannerCameraErrorKind
  > | null>(null);
  const cameraError = cameraErrorKind ? t(getCameraErrorMessageKey(cameraErrorKind)) : "";
  const [recognitionErrorKind, setRecognitionErrorKind] = useState<"timeout" | "decode" | null>(
    null,
  );
  const recognitionError = recognitionErrorKind
    ? t(recognitionErrorKind === "timeout" ? "scanner.imageTimeout" : "scanner.imageDecodeFailed")
    : "";
  const [manualValue, setManualValue] = useState("");
  const [lastPayload, setLastPayload] = useState<CapturePayload | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const runIdRef = useRef(0);
  const imageRequestIdRef = useRef(0);
  const resultAcceptedRef = useRef(false);
  const pathnameRef = useRef(pathname);
  const openerRef = useRef<HTMLElement | null>(null);
  const previousOpenRef = useRef(false);
  const outsideDismissedRef = useRef(false);
  const scannerToastIdsRef = useRef<Array<string | number>>([]);
  const cameraErrorToastIdRef = useRef<string | number | null>(null);
  const lastCameraErrorToastKindRef = useRef<ReturnType<
    typeof getBarcodeScannerCameraErrorKind
  > | null>(null);

  if (open && !previousOpenRef.current) {
    const activeElement = typeof document === "undefined" ? null : document.activeElement;
    openerRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    outsideDismissedRef.current = false;
  }
  previousOpenRef.current = open;

  const stopScanner = useCallback((options: { pause?: boolean } = {}) => {
    runIdRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
    clearVideoElement(videoRef.current);
    setIsStarting(false);
    setIsCameraActive(false);
    if (options.pause) setIsPaused(true);
  }, []);

  const dismissCameraErrorToast = useCallback(() => {
    if (cameraErrorToastIdRef.current === null) return;
    const toastId = cameraErrorToastIdRef.current;
    toast.dismiss(toastId);
    scannerToastIdsRef.current = scannerToastIdsRef.current.filter((id) => id !== toastId);
    cameraErrorToastIdRef.current = null;
    lastCameraErrorToastKindRef.current = null;
  }, []);

  const dismissScannerToasts = useCallback(() => {
    scannerToastIdsRef.current.forEach((id) => toast.dismiss(id));
    scannerToastIdsRef.current = [];
    cameraErrorToastIdRef.current = null;
    lastCameraErrorToastKindRef.current = null;
  }, []);

  const showCameraErrorToast = useCallback(
    (kind: ReturnType<typeof getBarcodeScannerCameraErrorKind>, message: string) => {
      if (lastCameraErrorToastKindRef.current === kind) return;
      dismissCameraErrorToast();
      lastCameraErrorToastKindRef.current = kind;
      toast.error(message, { id: scannerCameraErrorToastId });
      cameraErrorToastIdRef.current = scannerCameraErrorToastId;
      scannerToastIdsRef.current.push(cameraErrorToastIdRef.current);
    },
    [dismissCameraErrorToast],
  );

  const cancelImageRecognition = useCallback(() => {
    imageRequestIdRef.current += 1;
    setIsImageProcessing(false);
  }, []);

  useEffect(
    () => () => {
      imageRequestIdRef.current += 1;
    },
    [],
  );

  const commitRawValue = useCallback(
    (rawValue: string) => {
      if (resultAcceptedRef.current) return;
      if (rawValue.length > scannerManualMaxLength) {
        toast.error(tRef.current("scanner.tooLong"));
        stopScanner({ pause: true });
        return;
      }
      resultAcceptedRef.current = true;
      const payload = parsePayload(rawValue, window.location.origin);
      setLastPayload(payload);
      onDetected?.(payload);
      safelyVibrate();
      stopScanner();
      if (payload.value) {
        const toastId = toast.success(
          tRef.current("scanner.recognized", {
            label: getCapturePayloadDisplayLabel(payload, localeRef.current),
          }),
        );
        scannerToastIdsRef.current.push(toastId);
      }
    },
    [onDetected, parsePayload, stopScanner],
  );

  const handleImageSelected = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error(tRef.current("scanner.invalidImage"));
        return;
      }
      if (file.size > scannerImageMaxBytes) {
        toast.error(tRef.current("scanner.imageTooLarge"));
        return;
      }

      stopScanner({ pause: true });
      const imageRequestId = imageRequestIdRef.current + 1;
      imageRequestIdRef.current = imageRequestId;
      setIsImageProcessing(true);
      setCameraErrorKind(null);
      const imageUrl = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.src = imageUrl;
        await decodeImageElement(image);
        const reader = await createBarcodeReader(scanMode);
        const result = await withTimeout(
          reader.decodeFromImageElement(image),
          scannerImageDecodeTimeoutMs,
          createImageDecodeTimeoutError(),
        );
        if (imageRequestIdRef.current !== imageRequestId || resultAcceptedRef.current) return;
        commitRawValue(result.getText());
      } catch (error) {
        if (imageRequestIdRef.current !== imageRequestId) return;
        const message = getImageDecodeErrorMessage(error, localeRef.current);
        setRecognitionErrorKind(isImageDecodeTimeout(error) ? "timeout" : "decode");
        toast.error(message);
      } finally {
        URL.revokeObjectURL(imageUrl);
        if (imageRequestIdRef.current === imageRequestId) setIsImageProcessing(false);
      }
    },
    [commitRawValue, scanMode, stopScanner],
  );

  const rescan = useCallback(() => {
    dismissScannerToasts();
    cancelImageRecognition();
    resultAcceptedRef.current = false;
    setLastPayload(null);
    setManualValue("");
    setIsPaused(false);
    setCameraErrorKind(null);
    setRecognitionErrorKind(null);
  }, [cancelImageRecognition, dismissScannerToasts]);

  useEffect(() => {
    if (!open) {
      dismissScannerToasts();
      cancelImageRecognition();
      stopScanner();
      resultAcceptedRef.current = false;
      setIsPaused(false);
      setCameraErrorKind(null);
      setRecognitionErrorKind(null);
      setLastPayload(null);
      setManualValue("");
      return;
    }

    if (lastPayload) {
      stopScanner();
      return;
    }

    if (isPaused || isImageProcessing) {
      stopScanner();
      return;
    }

    let cancelled = false;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    resultAcceptedRef.current = false;

    const isCurrentRun = () => !cancelled && runIdRef.current === runId;

    async function startScanner() {
      if (!navigator.mediaDevices?.getUserMedia) {
        const message = tRef.current(getCameraErrorMessageKey("unknown"));
        setCameraErrorKind("unknown");
        setIsPaused(true);
        showCameraErrorToast("unknown", message);
        return;
      }

      setIsStarting(true);
      setCameraErrorKind(null);
      setRecognitionErrorKind(null);
      try {
        const reader = await createBarcodeReader(scanMode);
        if (!isCurrentRun() || !videoRef.current) return;

        const controls = await startScannerWithFallback(
          reader,
          videoRef.current,
          (result) => {
            if (!result || !isCurrentRun() || resultAcceptedRef.current) return;
            commitRawValue(result.getText());
          },
          () => !isCurrentRun() || !videoRef.current,
        );
        if (!isCurrentRun()) {
          controls.stop();
          clearVideoElement(videoRef.current);
          return;
        }
        controlsRef.current = controls;
        setIsCameraActive(true);
      } catch (error) {
        if (isCurrentRun()) {
          const kind = getBarcodeScannerCameraErrorKind(error);
          const message = tRef.current(getCameraErrorMessageKey(kind));
          setCameraErrorKind(kind);
          setIsPaused(true);
          showCameraErrorToast(kind, message);
        }
      } finally {
        if (isCurrentRun()) setIsStarting(false);
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [
    cancelImageRecognition,
    commitRawValue,
    dismissScannerToasts,
    isImageProcessing,
    isPaused,
    lastPayload,
    open,
    scanMode,
    showCameraErrorToast,
    stopScanner,
  ]);

  useEffect(() => {
    if (!open) return;

    const pauseForLifecycle = () => {
      cancelImageRecognition();
      stopScanner({ pause: true });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") pauseForLifecycle();
    };

    window.addEventListener("pagehide", pauseForLifecycle);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", pauseForLifecycle);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [cancelImageRecognition, open, stopScanner]);

  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    if (!open) return;
    cancelImageRecognition();
    stopScanner({ pause: true });
    onOpenChange(false);
  }, [cancelImageRecognition, onOpenChange, open, pathname, stopScanner]);

  const copyValue = async () => {
    if (!lastPayload?.value || lastPayload.sensitive) return;
    try {
      await navigator.clipboard.writeText(lastPayload.value);
      toast.success(t("common.copy"));
    } catch {
      toast.error(t("scanner.copyFailed"));
    }
  };

  const hasResult = Boolean(lastPayload);
  const handleCloseAutoFocus = (event: Event) => {
    onCloseAutoFocus?.(event);
    if (!event.defaultPrevented && !outsideDismissedRef.current) {
      event.preventDefault();
      openerRef.current?.focus({ preventScroll: true });
    }
    outsideDismissedRef.current = false;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        closeLabel={t("common.close")}
        onPointerDownOutside={() => {
          outsideDismissedRef.current = true;
          onOutsideDismiss?.();
        }}
        onCloseAutoFocus={handleCloseAutoFocus}
        className={cn(
          "rounded-t-xl p-0 sm:mx-auto sm:max-w-xl",
          hasResult ? "h-[min(82svh,42rem)] max-h-[calc(100svh-8px)]" : "max-h-[calc(100svh-16px)]",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-col overflow-hidden",
            hasResult ? "h-full max-h-[calc(100svh-8px)]" : "max-h-[calc(100svh-16px)]",
          )}
        >
          <SheetHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <ScanLine className="size-4 text-primary" />
              {resolvedTitle}
            </SheetTitle>
            <SheetDescription>{resolvedDescription}</SheetDescription>
          </SheetHeader>

          <div
            className={cn(
              componentOverlay.body,
              "min-h-0 flex-1 space-y-3 pt-3",
              hasResult
                ? "pb-[calc(env(safe-area-inset-bottom)+4.5rem)]"
                : "pb-[calc(env(safe-area-inset-bottom)+1rem)]",
            )}
          >
            {!lastPayload ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    void handleImageSelected(file);
                  }}
                />
                <div className="relative overflow-hidden rounded-lg border border-[var(--border-panel)] bg-[var(--capture-preview)]">
                  <video
                    ref={videoRef}
                    className="aspect-[4/3] w-full object-cover"
                    muted
                    playsInline
                    aria-label={
                      scanMode === "qr-only"
                        ? t("scanner.videoQrLabel")
                        : t("scanner.videoBarcodeLabel")
                    }
                  />
                  <div
                    className="pointer-events-none absolute inset-0 grid place-items-center bg-black/10"
                    aria-hidden="true"
                  >
                    <div className="relative h-[46%] w-[78%] rounded-xl border-2 border-white/90 shadow-[0_0_0_999px_rgb(0_0_0/0.28)]">
                      {isCameraActive ? (
                        <span className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-primary shadow-[0_0_12px_var(--primary)]" />
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span
                    role={cameraError || recognitionError ? "alert" : "status"}
                    aria-live="polite"
                    aria-atomic="true"
                    className="min-w-0 flex-1"
                  >
                    {getScannerStatusMessage({
                      cameraError,
                      recognitionError,
                      t,
                      isCameraActive,
                      isImageProcessing,
                      isPaused,
                      isStarting,
                    })}
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      disabled={isImageProcessing}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus className="mr-1.5 size-4" />
                      {t("scanner.album")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      disabled={isImageProcessing}
                      onClick={() => {
                        if (isPaused || cameraError) {
                          dismissCameraErrorToast();
                          setCameraErrorKind(null);
                          setRecognitionErrorKind(null);
                          setIsPaused(false);
                          return;
                        }
                        stopScanner({ pause: true });
                      }}
                    >
                      {isStarting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                      {isPaused || cameraError ? t("common.restart") : t("common.stop")}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel)] p-2">
                  <div className="flex min-w-0 gap-2">
                    <Input
                      value={manualValue}
                      onChange={(event) => setManualValue(event.target.value)}
                      maxLength={scannerManualMaxLength}
                      aria-label={t("scanner.manualLabel")}
                      placeholder={t("scanner.manualPlaceholder")}
                      className="h-11 min-w-0 font-mono text-base lg:h-9 lg:text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11 shrink-0 lg:size-9"
                      aria-label={t("scanner.pasteAria")}
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          setManualValue(text);
                        } catch {
                          toast.error(t("scanner.pasteFailed"));
                        }
                      }}
                    >
                      <ClipboardPaste className="size-4" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-11 lg:min-h-9"
                    disabled={!manualValue.trim()}
                    onClick={() => commitRawValue(manualValue)}
                  >
                    {t("common.recognize")}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel)] p-3">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground/70">
                    {getCapturePayloadDisplayLabel(lastPayload, locale)}
                  </p>
                  <p className="mt-1 break-all font-mono text-sm font-semibold text-foreground">
                    {lastPayload.sensitive
                      ? t("scanner.protected")
                      : lastPayload.value || lastPayload.raw || t("scanner.empty")}
                  </p>
                  {!lastPayload.sensitive && lastPayload.raw !== lastPayload.value ? (
                    <p className="mt-2 break-all text-xs text-muted-foreground">
                      {t("scanner.original", { value: lastPayload.raw || "-" })}
                    </p>
                  ) : null}
                </div>

                <div className="sticky bottom-0 z-10 -mx-3 border-t border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] px-3 py-3 shadow-[var(--shadow-overlay)] sm:-mx-4 sm:px-4">
                  <div className="flex flex-wrap gap-2">
                    {!lastPayload.sensitive ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        onClick={copyValue}
                      >
                        <Copy className="mr-1.5 size-3.5" />
                        {t("common.copy")}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      onClick={rescan}
                    >
                      <RotateCcw className="mr-1.5 size-3.5" />
                      {t("common.rescan")}
                    </Button>
                    {renderActions?.(lastPayload, {
                      close: () => onOpenChange(false),
                      rescan,
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function clearVideoElement(video: HTMLVideoElement | null) {
  if (!video) return;

  const source = video.srcObject;
  if (source && typeof (source as MediaStream).getTracks === "function") {
    for (const track of (source as MediaStream).getTracks()) {
      track.stop();
    }
  }
  video.pause();
  video.srcObject = null;
}

async function createBarcodeReader(scanMode: "multi-format" | "qr-only"): Promise<ScannerReader> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library"),
  ]);
  const formats =
    scanMode === "qr-only"
      ? [BarcodeFormat.QR_CODE]
      : [
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
        ];
  const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, formats]]);
  return new BrowserMultiFormatReader(hints);
}

async function startScannerWithFallback(
  reader: ScannerReader,
  video: HTMLVideoElement,
  callback: ScannerDecodeCallback,
  shouldCancel: () => boolean,
) {
  let lastError: unknown;
  for (const plan of getScannerConstraintPlans()) {
    if (shouldCancel()) break;
    try {
      return await reader.decodeFromConstraints(plan.constraints, video, callback);
    } catch (error) {
      lastError = error;
      if (getErrorName(error) !== "OverconstrainedError") throw error;
    }
  }
  throw lastError ?? createCameraStartFailedError();
}

function getScannerConstraintPlans(): Array<{
  mode: ScannerCameraMode;
  constraints: MediaStreamConstraints;
}> {
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
      constraints: { audio: false, video: true },
    },
  ];
}

function getScannerStatusMessage({
  cameraError,
  recognitionError,
  t,
  isCameraActive,
  isImageProcessing,
  isPaused,
  isStarting,
}: {
  cameraError: string;
  recognitionError: string;
  t: ReturnType<typeof useLocale>["t"];
  isCameraActive: boolean;
  isImageProcessing: boolean;
  isPaused: boolean;
  isStarting: boolean;
}) {
  if (isImageProcessing) return t("scanner.statusImage");
  if (cameraError) return cameraError;
  if (recognitionError) return recognitionError;
  if (isPaused) return t("scanner.statusPaused");
  if (isStarting) return t("scanner.statusStarting");
  if (isCameraActive) return t("scanner.statusActive");
  return t("scanner.statusPreparing");
}

function safelyVibrate() {
  try {
    navigator.vibrate?.(35);
  } catch {
    // Haptic feedback is optional and must never block a successful scan.
  }
}

async function decodeImageElement(image: HTMLImageElement) {
  if (typeof image.decode === "function") {
    await image.decode();
    return;
  }
  if (image.complete) return;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(createImageReadFailedError());
  });
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutError: Error | string,
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(timeoutError instanceof Error ? timeoutError : new Error(timeoutError)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function getErrorName(error: unknown) {
  if (!error || typeof error !== "object" || !("name" in error)) return "";
  return String((error as { name?: unknown }).name ?? "");
}
