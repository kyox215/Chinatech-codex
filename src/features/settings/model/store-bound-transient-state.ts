export interface StoreBoundTransientValue<T> {
  storeId: string;
  value: T;
  expiresAt: string;
}

interface AcceptStoreBoundTransientValueInput<T> {
  requestedStoreId?: string;
  responseStoreId?: string;
  currentStoreId?: string;
  requestEpoch: number;
  currentEpoch: number;
  value: T;
  expiresAt?: string;
  now?: number;
}

/**
 * Accepts a short-lived value only when the request, response, and currently
 * selected store still agree. This prevents late mutation responses from one
 * tenant being rendered after the operator switches to another tenant.
 */
export function acceptStoreBoundTransientValue<T>({
  requestedStoreId,
  responseStoreId,
  currentStoreId,
  requestEpoch,
  currentEpoch,
  value,
  expiresAt,
  now = Date.now(),
}: AcceptStoreBoundTransientValueInput<T>): StoreBoundTransientValue<T> | null {
  if (!requestedStoreId || !currentStoreId) return null;
  if (!responseStoreId) return null;
  if (requestedStoreId !== currentStoreId) return null;
  if (responseStoreId !== requestedStoreId) return null;
  if (requestEpoch !== currentEpoch) return null;
  if (!expiresAt) return null;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) return null;

  return {
    storeId: requestedStoreId,
    value,
    expiresAt,
  };
}

export function valueForActiveStore<T>(
  state: StoreBoundTransientValue<T> | null,
  activeStoreId?: string,
  now = Date.now(),
): T | null {
  if (!state || !activeStoreId || state.storeId !== activeStoreId) return null;
  const expiresAtMs = new Date(state.expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) return null;
  return state.value;
}
