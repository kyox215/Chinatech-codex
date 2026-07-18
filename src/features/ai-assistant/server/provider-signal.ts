export function createAiProviderSignal(parent: AbortSignal | undefined, timeoutMs: number) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) {
    throw new Error("invalid AI provider deadline");
  }
  const deadline = AbortSignal.timeout(timeoutMs);
  return parent ? AbortSignal.any([parent, deadline]) : deadline;
}

export function isAiProviderTimeoutError(error: unknown) {
  if (!error || typeof error !== "object" || !("name" in error)) return false;
  const name = error.name;
  return name === "TimeoutError";
}
