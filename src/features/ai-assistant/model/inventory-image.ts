import {
  AI_INVENTORY_IMAGE_MAX_DERIVED_BYTES,
  AI_INVENTORY_IMAGE_MAX_EDGE,
  AI_INVENTORY_IMAGE_MAX_ORIGINAL_BYTES,
  AI_INVENTORY_IMAGE_MAX_PIXELS,
} from "./inventory-image-policy";
import {
  aiInventoryImageMimeTypes,
  detectAiInventoryImageMime,
  isAnimatedAiInventoryImage,
  readAiInventoryImageDimensions,
  type AiInventoryImageMimeType,
} from "./inventory-image-format";

export {
  AI_INVENTORY_IMAGE_MAX_DERIVED_BYTES,
  AI_INVENTORY_IMAGE_MAX_EDGE,
  AI_INVENTORY_IMAGE_MAX_ORIGINAL_BYTES,
  AI_INVENTORY_IMAGE_MAX_PIXELS,
} from "./inventory-image-policy";
export {
  detectAiInventoryImageMime,
  isAnimatedAiInventoryImage,
  type AiInventoryImageMimeType,
} from "./inventory-image-format";

const derivedMaxEdge = 2048;
export const AI_INVENTORY_IMAGE_DATA_URL_TIMEOUT_MS = 8_000;
export const AI_INVENTORY_CLIENT_PIPELINE_TIMEOUT_MS = 75_000;
export type AiInventoryImageErrorCode =
  | "empty"
  | "too_large"
  | "unsupported_type"
  | "mime_mismatch"
  | "animated"
  | "decode_failed"
  | "dimensions"
  | "processing_failed"
  | "derived_too_large";

export class AiInventoryImageError extends Error {
  readonly code: AiInventoryImageErrorCode;

  constructor(code: AiInventoryImageErrorCode, message: string) {
    super(message);
    this.name = "AiInventoryImageError";
    this.code = code;
  }
}

export type PreparedAiInventoryImage = {
  blob: Blob;
  mimeType: "image/jpeg";
  byteLength: number;
  width: number;
  height: number;
  previewUrl: string;
  dispose: () => void;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

export type AiInventoryImageRuntime = {
  decode: (file: File) => Promise<DecodedImage>;
  createCanvas: (width: number, height: number) => HTMLCanvasElement;
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
};

export async function inspectAiInventoryImage(file: File) {
  if (file.size === 0) {
    throw new AiInventoryImageError("empty", "图片内容为空，请重新拍摄或选择图片。");
  }
  if (file.size > AI_INVENTORY_IMAGE_MAX_ORIGINAL_BYTES) {
    throw new AiInventoryImageError("too_large", "原图不能超过 4 MiB，请裁剪标签区域后重试。");
  }

  const declaredMime = normalizeMimeType(file.type);
  if (!declaredMime) {
    throw new AiInventoryImageError("unsupported_type", "仅支持 JPEG、PNG 或 WebP 静态图片。");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedMime = detectAiInventoryImageMime(bytes);
  if (!detectedMime) {
    throw new AiInventoryImageError(
      "unsupported_type",
      "图片内容不是受支持的 JPEG、PNG 或 WebP 格式。",
    );
  }
  if (declaredMime !== detectedMime) {
    throw new AiInventoryImageError(
      "mime_mismatch",
      "图片声明格式与实际内容不一致，请重新导出后再试。",
    );
  }
  if (isAnimatedAiInventoryImage(bytes, detectedMime)) {
    throw new AiInventoryImageError("animated", "不支持动画图片，请上传单帧静态照片。");
  }

  const dimensions = readAiInventoryImageDimensions(bytes, detectedMime);
  if (!dimensions) {
    throw new AiInventoryImageError("dimensions", "无法安全读取图片尺寸，请重新导出为 JPG。");
  }
  validateDecodedDimensions(dimensions.width, dimensions.height);

  return { mimeType: detectedMime, bytes, dimensions };
}

export async function prepareAiInventoryImage(
  file: File,
  runtime: AiInventoryImageRuntime = browserImageRuntime,
): Promise<PreparedAiInventoryImage> {
  const inspected = await inspectAiInventoryImage(file);

  let decoded: DecodedImage;
  try {
    decoded = await runtime.decode(file);
  } catch {
    throw new AiInventoryImageError(
      "decode_failed",
      "浏览器无法安全解码这张图片，请重新拍摄或导出为 JPG。",
    );
  }

  try {
    validateDecodedDimensions(decoded.width, decoded.height);
    validateDecodedDimensionsMatch(inspected.dimensions, decoded);
    const encoded = await encodeMetadataFreeJpeg(decoded, runtime);
    const previewUrl = runtime.createObjectUrl(encoded.blob);
    let disposed = false;
    return {
      blob: encoded.blob,
      mimeType: "image/jpeg",
      byteLength: encoded.blob.size,
      width: encoded.width,
      height: encoded.height,
      previewUrl,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        runtime.revokeObjectUrl(previewUrl);
      },
    };
  } finally {
    decoded.dispose();
  }
}

function validateDecodedDimensionsMatch(
  header: { width: number; height: number },
  decoded: { width: number; height: number },
) {
  const same = header.width === decoded.width && header.height === decoded.height;
  const orientationSwapped = header.width === decoded.height && header.height === decoded.width;
  if (!same && !orientationSwapped) {
    throw new AiInventoryImageError(
      "dimensions",
      "图片声明尺寸与解码结果不一致，请重新导出为 JPG。",
    );
  }
}

export function aiInventoryImageBlobToDataUrl(
  blob: Blob,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    const timeoutMs = Math.max(
      1,
      Math.min(options.timeoutMs ?? AI_INVENTORY_IMAGE_DATA_URL_TIMEOUT_MS, 60_000),
    );
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", handleSignalAbort);
      reader.onload = null;
      reader.onerror = null;
      reader.onabort = null;
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const abortReader = () => {
      if (reader.readyState !== 1) return;
      try {
        reader.abort();
      } catch {
        // The Promise has already settled with a safe timeout/abort result.
      }
    };
    const handleSignalAbort = () => {
      finish(() => reject(createAbortError()));
      abortReader();
    };
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      if (value.startsWith("data:image/jpeg;base64,")) {
        finish(() => resolve(value));
      } else {
        finish(() =>
          reject(new AiInventoryImageError("processing_failed", "图片编码失败，请重试。")),
        );
      }
    };
    reader.onerror = () =>
      finish(() =>
        reject(new AiInventoryImageError("processing_failed", "图片读取失败，请重试。")),
      );
    reader.onabort = () =>
      finish(() =>
        reject(
          new AiInventoryImageError("processing_failed", "图片读取已取消，请重试或继续手工录入。"),
        ),
      );
    options.signal?.addEventListener("abort", handleSignalAbort, { once: true });
    if (options.signal?.aborted) {
      handleSignalAbort();
      return;
    }
    timeoutId = setTimeout(() => {
      finish(() =>
        reject(
          new AiInventoryImageError("processing_failed", "图片读取超时，请重试或继续手工录入。"),
        ),
      );
      abortReader();
    }, timeoutMs);
    try {
      reader.readAsDataURL(blob);
    } catch {
      finish(() =>
        reject(new AiInventoryImageError("processing_failed", "图片读取失败，请重试。")),
      );
    }
  });
}

function normalizeMimeType(value: string): AiInventoryImageMimeType | null {
  const mimeType = value.trim().toLowerCase();
  return aiInventoryImageMimeTypes.find((candidate) => candidate === mimeType) ?? null;
}

function validateDecodedDimensions(width: number, height: number) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new AiInventoryImageError("dimensions", "图片尺寸无效，请重新拍摄。");
  }
  if (
    width > AI_INVENTORY_IMAGE_MAX_EDGE ||
    height > AI_INVENTORY_IMAGE_MAX_EDGE ||
    width * height > AI_INVENTORY_IMAGE_MAX_PIXELS
  ) {
    throw new AiInventoryImageError(
      "dimensions",
      "图片尺寸过大，请裁剪标签区域至 4096 像素以内后重试。",
    );
  }
}

async function encodeMetadataFreeJpeg(decoded: DecodedImage, runtime: AiInventoryImageRuntime) {
  let scale = Math.min(1, derivedMaxEdge / Math.max(decoded.width, decoded.height));
  let quality = 0.86;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = runtime.createCanvas(width, height);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new AiInventoryImageError(
        "processing_failed",
        "当前浏览器无法处理图片，请改用手工录入。",
      );
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded.source, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, quality);
    if (blob.size > 0 && blob.size <= AI_INVENTORY_IMAGE_MAX_DERIVED_BYTES) {
      return { blob, width, height };
    }
    quality = Math.max(0.55, quality - 0.08);
    if (attempt >= 2) scale *= 0.78;
  }

  throw new AiInventoryImageError("derived_too_large", "图片压缩后仍然过大，请靠近标签重新拍摄。");
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else {
          reject(
            new AiInventoryImageError(
              "processing_failed",
              "浏览器无法生成安全图片，请改用手工录入。",
            ),
          );
        }
      },
      "image/jpeg",
      quality,
    );
  });
}

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

const browserImageRuntime: AiInventoryImageRuntime = {
  decode: decodeBrowserImage,
  createCanvas: (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  },
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
};

async function decodeBrowserImage(file: File): Promise<DecodedImage> {
  if (typeof globalThis.createImageBitmap === "function") {
    const bitmap = await globalThis.createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    if (typeof image.decode === "function") {
      await image.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("decode failed"));
      });
    }
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}
