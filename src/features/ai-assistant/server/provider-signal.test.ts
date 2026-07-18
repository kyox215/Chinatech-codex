import { describe, expect, it } from "vitest";

import { createAiProviderSignal, isAiProviderTimeoutError } from "./provider-signal";

describe("AI provider signal", () => {
  it("propagates caller cancellation into the bounded provider signal", () => {
    const controller = new AbortController();
    const signal = createAiProviderSignal(controller.signal, 1_000);
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
  });

  it("rejects unbounded or invalid deadlines", () => {
    expect(() => createAiProviderSignal(undefined, 0)).toThrow(/deadline/);
    expect(() => createAiProviderSignal(undefined, 60_001)).toThrow(/deadline/);
  });

  it("recognizes Node deadline timeouts without conflating caller cancellation", async () => {
    const signal = createAiProviderSignal(undefined, 100);
    await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));

    expect(signal.reason).toMatchObject({ name: "TimeoutError" });
    expect(isAiProviderTimeoutError(signal.reason)).toBe(true);
    expect(isAiProviderTimeoutError(new DOMException("cancelled", "AbortError"))).toBe(false);
    expect(isAiProviderTimeoutError(new Error("transport"))).toBe(false);
  });
});
