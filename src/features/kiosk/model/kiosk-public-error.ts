export const KIOSK_PUBLIC_ERROR_CODES = {
  deviceUnauthorized: "KIOSK_DEVICE_UNAUTHORIZED",
  pairingInvalid: "KIOSK_PAIRING_INVALID",
  sessionConflict: "KIOSK_SESSION_CONFLICT",
} as const;

export const KIOSK_INTERNAL_ERROR_RESPONSE = {
  code: "KIOSK_INTERNAL_ERROR",
  message: "Servizio temporaneamente non disponibile. Riprova tra poco.",
} as const;

export type KioskPublicErrorCode =
  (typeof KIOSK_PUBLIC_ERROR_CODES)[keyof typeof KIOSK_PUBLIC_ERROR_CODES];

export class KioskPublicError extends Error {
  constructor(
    message: string,
    readonly code: KioskPublicErrorCode,
    readonly status: 400 | 401 | 409,
  ) {
    super(message);
    this.name = "KioskPublicError";
  }
}

export function isKioskPublicError(error: unknown): error is KioskPublicError {
  if (error instanceof KioskPublicError) return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; status?: unknown; message?: unknown };
  return (
    Object.values(KIOSK_PUBLIC_ERROR_CODES).includes(candidate.code as KioskPublicErrorCode) &&
    (candidate.status === 400 || candidate.status === 401 || candidate.status === 409) &&
    typeof candidate.message === "string"
  );
}

export function kioskDeviceUnauthorizedError() {
  return new KioskPublicError(
    "iPad 未绑定或已撤销",
    KIOSK_PUBLIC_ERROR_CODES.deviceUnauthorized,
    401,
  );
}

export function kioskPairingInvalidError() {
  return new KioskPublicError("配对码无效或已过期", KIOSK_PUBLIC_ERROR_CODES.pairingInvalid, 400);
}

export function kioskSessionConflictError(message = "当前任务已变化，请重新读取后再试") {
  return new KioskPublicError(message, KIOSK_PUBLIC_ERROR_CODES.sessionConflict, 409);
}
