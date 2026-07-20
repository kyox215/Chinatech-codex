export interface NewOrderPrefill {
  key: string;
  customerId?: string;
  deviceId?: string;
  identifier?: string;
}

export type NewOrderIntentSource = "dashboard" | "command" | "mobile" | "customer" | "unknown";

type SearchParamValue = string | string[] | undefined;

export function parseNewOrderPrefill(params: Record<string, SearchParamValue>): NewOrderPrefill {
  const intakeSession = normalizeParam(params.intakeSession, 80);
  const customerId = normalizeParam(params.customerId, 128);
  const deviceId = normalizeParam(params.deviceId, 128);
  const identifier = normalizeParam(params.imei, 128) || normalizeParam(params.serial, 128);
  return {
    key: [intakeSession, customerId, deviceId, identifier].join(":"),
    customerId: customerId || undefined,
    deviceId: deviceId || undefined,
    identifier: identifier || undefined,
  };
}

export function buildNewOrderHref({
  source,
  sessionId,
}: {
  source: NewOrderIntentSource;
  sessionId: string;
}) {
  const params = new URLSearchParams({ source, intakeSession: sessionId });
  return `/orders/new?${params.toString()}`;
}

export function createNewOrderSessionId() {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function normalizeParam(value: SearchParamValue, maxLength: number) {
  const scalar = Array.isArray(value) ? value[0] : value;
  return Array.from((scalar ?? "").trim())
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .slice(0, maxLength);
}
