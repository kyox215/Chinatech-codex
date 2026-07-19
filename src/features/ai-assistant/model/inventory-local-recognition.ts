import { aiInventoryRecognitionSchema, type AiInventoryRecognition } from "./contracts";
import { buildLocalInventoryRecognition } from "./inventory-recognition";
import type { PreparedAiInventoryImage } from "./inventory-image";

const barcodeTimeoutMs = 4_000;
const ocrTimeoutMs = 12_000;
const maxLocalOcrCharacters = 12_000;
const maxBarcodeCandidates = 12;

type NativeBarcodeResult = { rawValue?: string };
type NativeBarcodeDetector = { detect: (source: unknown) => Promise<NativeBarcodeResult[]> };
type NativeTextDetector = {
  detect: (source: unknown) => Promise<Array<{ rawValue?: string }>>;
};
type RecognitionWindow = Window & {
  BarcodeDetector?: new (options?: { formats?: string[] }) => NativeBarcodeDetector;
  TextDetector?: new () => NativeTextDetector;
};

export async function recognizeAiInventoryImageLocally(
  prepared: Pick<PreparedAiInventoryImage, "previewUrl">,
  options: { signal?: AbortSignal } = {},
): Promise<AiInventoryRecognition> {
  throwIfAborted(options.signal);
  const image = await loadImage(prepared.previewUrl, options.signal);
  const [barcodeResult, ocrResult] = await Promise.allSettled([
    withDeadline(detectBarcodeValues(image), barcodeTimeoutMs, options.signal),
    withDeadline(detectOcrText(image), ocrTimeoutMs, options.signal),
  ]);
  throwIfAborted(options.signal);

  const barcodeValues =
    barcodeResult.status === "fulfilled"
      ? unique(
          barcodeResult.value.map((value) => value.trim().slice(0, 256)).filter(Boolean),
        ).slice(0, maxBarcodeCandidates)
      : [];
  const ocrText =
    ocrResult.status === "fulfilled" ? ocrResult.value.slice(0, maxLocalOcrCharacters) : "";
  const recognition = buildLocalInventoryRecognition({ ocrText, barcodeValues });
  const warnings = [...recognition.warnings];
  if (barcodeResult.status === "rejected") {
    warnings.push("本地条码识别未完成，请人工核对设备标识符。");
  }
  if (ocrResult.status === "rejected") {
    warnings.push("本地文字识别未完成，请人工核对型号与容量。");
  }

  // Only the structured candidates survive this function. Raw OCR and barcode
  // evidence remains in local variables and is never returned or logged.
  return aiInventoryRecognitionSchema.parse({
    ...recognition,
    warnings: unique(warnings),
  });
}

async function loadImage(src: string, signal?: AbortSignal) {
  const image = new Image();
  image.src = src;
  if (typeof image.decode === "function") {
    await withDeadline(image.decode(), 5_000, signal);
  } else {
    await withDeadline(
      new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("image decode failed"));
      }),
      5_000,
      signal,
    );
  }
  throwIfAborted(signal);
  return image;
}

async function detectBarcodeValues(image: HTMLImageElement) {
  const NativeDetector = (window as RecognitionWindow).BarcodeDetector;
  if (!NativeDetector) throw new Error("native barcode detector unavailable");
  try {
    let detector: NativeBarcodeDetector;
    try {
      detector = new NativeDetector({
        formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "data_matrix"],
      });
    } catch {
      detector = new NativeDetector();
    }
    const values = (await detector.detect(image))
      .map((result) => result.rawValue?.trim() ?? "")
      .filter(Boolean);
    return unique(values);
  } catch {
    // The inventory-label photo path must remain preemptible. Dedicated camera
    // scanners keep their own ZXing flow; this optional local pass degrades to
    // scan/manual entry when the browser-native detector is unavailable.
    throw new Error("native barcode detector unavailable");
  }
}

async function detectOcrText(image: HTMLImageElement) {
  const NativeDetector = (window as RecognitionWindow).TextDetector;
  if (NativeDetector) {
    try {
      const text = (await new NativeDetector().detect(image))
        .map((result) => result.rawValue?.trim() ?? "")
        .filter(Boolean)
        .join("\n");
      if (text) return text;
    } catch {
      // Native OCR failures degrade to the safe unavailable path below.
    }
  }
  // Do not let tesseract.js load worker/core/language assets from a third-party CDN.
  // OCR degrades safely until fixed-version same-origin assets and CSP are approved.
  throw new Error("same-origin OCR unavailable");
}

function withDeadline<T>(operation: Promise<T>, timeoutMs: number, signal?: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
      callback();
    };
    const handleAbort = () => finish(() => reject(createAbortError()));
    const timeoutId = setTimeout(
      () => finish(() => reject(new Error("local recognition timeout"))),
      timeoutMs,
    );
    signal?.addEventListener("abort", handleAbort, { once: true });
    if (signal?.aborted) {
      handleAbort();
      return;
    }
    operation.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw createAbortError();
}

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}
