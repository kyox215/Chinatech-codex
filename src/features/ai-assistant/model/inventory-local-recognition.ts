import { aiInventoryRecognitionSchema, type AiInventoryRecognition } from "./contracts";
import { buildLocalInventoryRecognition } from "./inventory-recognition";
import type { PreparedAiInventoryImage } from "./inventory-image";
import { extractImeiCandidates } from "@/features/capture/model/barcode-parser";
import { recognizeTextWithLocalOcr } from "@/features/capture/model/local-ocr";

const barcodeTimeoutMs = 9_000;
const barcodeWorkerTimeoutMs = 7_000;
const ocrTimeoutMs = 35_000;
const maxLocalOcrCharacters = 12_000;
const maxBarcodeCandidates = 12;
const maxWorkerImageEdge = 1_600;
const localWorkerFallbackEnabled = process.env.NEXT_PUBLIC_INVENTORY_LOCAL_IMEI_RECOGNITION !== "0";

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
    withDeadline(detectBarcodeValues(image, options.signal), barcodeTimeoutMs, options.signal),
    withDeadline(detectOcrText(image, options.signal), ocrTimeoutMs, options.signal),
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

async function detectBarcodeValues(image: HTMLImageElement, signal?: AbortSignal) {
  const NativeDetector = (window as RecognitionWindow).BarcodeDetector;
  let nativeValues: string[] = [];
  if (NativeDetector) {
    try {
      let detector: NativeBarcodeDetector;
      try {
        detector = new NativeDetector({
          formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "data_matrix"],
        });
      } catch {
        detector = new NativeDetector();
      }
      nativeValues = (await detector.detect(image))
        .map((result) => result.rawValue?.trim() ?? "")
        .filter(Boolean);
    } catch {
      nativeValues = [];
    }
  }

  if (!localWorkerFallbackEnabled || hasValidImeiCandidate(nativeValues)) {
    if (nativeValues.length > 0) return unique(nativeValues);
    throw new Error("local barcode detector unavailable");
  }

  try {
    const workerValues = await detectBarcodeValuesInWorker(image, signal);
    const combined = unique([...nativeValues, ...workerValues]);
    if (combined.length > 0) return combined;
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (nativeValues.length > 0) return unique(nativeValues);
  }
  throw new Error("local barcode detector unavailable");
}

async function detectBarcodeValuesInWorker(image: HTMLImageElement, signal?: AbortSignal) {
  throwIfAborted(signal);
  if (typeof Worker === "undefined") throw new Error("barcode worker unavailable");
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  if (!imageWidth || !imageHeight) throw new Error("barcode image unavailable");
  const scale = Math.min(1, maxWorkerImageEdge / Math.max(imageWidth, imageHeight));
  const width = Math.max(1, Math.round(imageWidth * scale));
  const height = Math.max(1, Math.round(imageHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("barcode canvas unavailable");
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const requestId = crypto.randomUUID();

  return new Promise<string[]>((resolve, reject) => {
    const worker = new Worker(new URL("./inventory-barcode.worker.ts", import.meta.url), {
      type: "module",
    });
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
      worker.terminate();
      callback();
    };
    const handleAbort = () => finish(() => reject(createAbortError()));
    const timeoutId = setTimeout(
      () => finish(() => reject(new Error("barcode worker timeout"))),
      barcodeWorkerTimeoutMs,
    );
    worker.onmessage = (event: MessageEvent<{ id?: string; values?: unknown }>) => {
      if (event.data.id !== requestId || !Array.isArray(event.data.values)) return;
      const values = event.data.values.filter(
        (value): value is string => typeof value === "string" && Boolean(value.trim()),
      );
      finish(() => resolve(unique(values)));
    };
    worker.onerror = () => finish(() => reject(new Error("barcode worker failed")));
    signal?.addEventListener("abort", handleAbort, { once: true });
    if (signal?.aborted) {
      handleAbort();
      return;
    }
    worker.postMessage({ id: requestId, width, height, pixels }, [pixels.buffer]);
  });
}

function hasValidImeiCandidate(values: readonly string[]) {
  return extractImeiCandidates(values.join("\n"), { source: "barcode" }).some(
    (candidate) => candidate.kind === "imei",
  );
}

async function detectOcrText(image: HTMLImageElement, signal?: AbortSignal) {
  const NativeDetector = (window as RecognitionWindow).TextDetector;
  if (NativeDetector) {
    try {
      const text = (await new NativeDetector().detect(image))
        .map((result) => result.rawValue?.trim() ?? "")
        .filter(Boolean)
        .join("\n");
      if (text) return text;
    } catch {
      // Continue to the fixed-version same-origin OCR worker.
    }
  }
  if (!localWorkerFallbackEnabled) {
    throw new Error("same-origin OCR disabled");
  }
  return recognizeTextWithLocalOcr(image.src, { signal, timeoutMs: ocrTimeoutMs - 1_000 });
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

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}
