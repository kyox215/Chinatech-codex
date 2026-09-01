import { translateMessage } from "@/shared/i18n/messages";
import type { AppLocale } from "@/shared/i18n/locales";

export type ScannerErrorKind =
  | "permission-denied"
  | "not-found"
  | "unsupported"
  | "unavailable"
  | "unknown";

export function getBarcodeScannerCameraErrorKind(error?: unknown): ScannerErrorKind {
  const name = getErrorName(error).toLowerCase();
  if (name === "notallowederror" || name === "securityerror") return "permission-denied";
  if (name === "notfounderror" || name === "devicenotfounderror") return "not-found";
  if (name === "notsupportederror") return "unsupported";
  if (name === "aborterror" || name === "invalidstateerror" || name === "notreadableerror") {
    return "unavailable";
  }
  return "unknown";
}

export function getBarcodeScannerCameraErrorMessage(error?: unknown, locale: AppLocale = "zh-CN") {
  return translateMessage(
    locale,
    getCameraErrorMessageKey(getBarcodeScannerCameraErrorKind(error)),
  );
}

export function getCameraErrorMessageKey(kind: ScannerErrorKind) {
  switch (kind) {
    case "permission-denied":
      return "scanner.error.permission" as const;
    case "not-found":
      return "scanner.error.notFound" as const;
    case "unsupported":
      return "scanner.error.unsupported" as const;
    case "unavailable":
      return "scanner.error.unavailable" as const;
    default:
      return "scanner.error.generic" as const;
  }
}

export function getCameraCaptureErrorMessageKey(kind: ScannerErrorKind) {
  switch (kind) {
    case "permission-denied":
      return "camera.error.permission" as const;
    case "not-found":
      return "camera.error.notFound" as const;
    case "unsupported":
      return "camera.error.unsupported" as const;
    case "unavailable":
      return "camera.error.unavailable" as const;
    default:
      return "camera.error.generic" as const;
  }
}

export const IMAGE_DECODE_TIMEOUT_CODE = "image-decode-timeout";
export const CAMERA_START_FAILED_CODE = "camera-start-failed";
export const IMAGE_READ_FAILED_CODE = "image-read-failed";

export function createCameraStartFailedError() {
  const error = new Error(CAMERA_START_FAILED_CODE);
  error.name = "CameraStartFailedError";
  return error;
}

export function createImageReadFailedError() {
  const error = new Error(IMAGE_READ_FAILED_CODE);
  error.name = "ImageReadFailedError";
  return error;
}

export function createImageDecodeTimeoutError() {
  const error = new Error(IMAGE_DECODE_TIMEOUT_CODE);
  error.name = "ImageDecodeTimeoutError";
  return error;
}

export function getImageDecodeErrorMessage(error: unknown, locale: AppLocale = "zh-CN") {
  const key = isImageDecodeTimeout(error) ? "scanner.imageTimeout" : "scanner.imageDecodeFailed";
  return translateMessage(locale, key);
}

export function isImageDecodeTimeout(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "ImageDecodeTimeoutError" || error.message === IMAGE_DECODE_TIMEOUT_CODE)
  );
}

function getErrorName(error: unknown) {
  if (!error || typeof error !== "object" || !("name" in error)) return "";
  return String((error as { name?: unknown }).name ?? "");
}
