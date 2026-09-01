export const KIOSK_PUBLIC_ERROR_CODES = {
  deviceUnauthorized: "KIOSK_DEVICE_UNAUTHORIZED",
  pairingInvalid: "KIOSK_PAIRING_INVALID",
  sessionConflict: "KIOSK_SESSION_CONFLICT",
  requestForbidden: "KIOSK_REQUEST_FORBIDDEN",
  serviceUnavailable: "KIOSK_SERVICE_UNAVAILABLE",
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
    readonly status: 400 | 401 | 403 | 409 | 503,
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
    (candidate.status === 400 ||
      candidate.status === 401 ||
      candidate.status === 403 ||
      candidate.status === 409 ||
      candidate.status === 503) &&
    typeof candidate.message === "string"
  );
}

export function kioskDeviceUnauthorizedError() {
  return new KioskPublicError(
    "Questo iPad non è autorizzato o l'autorizzazione è stata revocata.",
    KIOSK_PUBLIC_ERROR_CODES.deviceUnauthorized,
    401,
  );
}

export function kioskPairingInvalidError() {
  return new KioskPublicError(
    "Il codice di abbinamento non è valido o è scaduto.",
    KIOSK_PUBLIC_ERROR_CODES.pairingInvalid,
    400,
  );
}

export function kioskSessionConflictError(
  message = "L'attività è cambiata. Aggiorna il modulo e riprova.",
) {
  return new KioskPublicError(message, KIOSK_PUBLIC_ERROR_CODES.sessionConflict, 409);
}

export function kioskRequestForbiddenError() {
  return new KioskPublicError(
    "Richiesta non consentita.",
    KIOSK_PUBLIC_ERROR_CODES.requestForbidden,
    403,
  );
}

export function kioskServiceUnavailableError() {
  return new KioskPublicError(
    KIOSK_INTERNAL_ERROR_RESPONSE.message,
    KIOSK_PUBLIC_ERROR_CODES.serviceUnavailable,
    503,
  );
}
