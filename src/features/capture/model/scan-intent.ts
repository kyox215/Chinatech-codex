export type ScanIntentScope = "orders" | "customers" | "buyback" | "inventory";

export interface ScanSearchIntent {
  id: string;
  scope: ScanIntentScope;
  value: string;
  createdAt: number;
}

const SCAN_INTENT_EVENT = "repairdesk:scan-intent";
const DEFAULT_SCAN_INTENT_TTL_MS = 60_000;
const intents = new Map<ScanIntentScope, ScanSearchIntent>();

function createScanIntentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export function createScanSearchIntent(scope: ScanIntentScope, value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  const intent: ScanSearchIntent = {
    id: createScanIntentId(),
    scope,
    value: normalized,
    createdAt: Date.now(),
  };
  intents.set(scope, intent);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SCAN_INTENT_EVENT, { detail: { scope, id: intent.id } }));
  }

  return intent;
}

export function consumeScanSearchIntent(
  scope: ScanIntentScope,
  maxAgeMs = DEFAULT_SCAN_INTENT_TTL_MS,
) {
  const intent = intents.get(scope);
  if (!intent) return "";

  intents.delete(scope);
  if (Date.now() - intent.createdAt > maxAgeMs) return "";
  return intent.value;
}

export function subscribeScanSearchIntent(
  scope: ScanIntentScope,
  onIntent: (value: string) => void,
) {
  if (typeof window === "undefined") return () => undefined;

  const handleIntent = (event: Event) => {
    const detail = (event as CustomEvent<{ scope?: ScanIntentScope }>).detail;
    if (detail?.scope !== scope) return;
    const value = consumeScanSearchIntent(scope);
    if (value) onIntent(value);
  };

  window.addEventListener(SCAN_INTENT_EVENT, handleIntent);
  return () => window.removeEventListener(SCAN_INTENT_EVENT, handleIntent);
}

export function clearScanSearchIntents() {
  intents.clear();
}
