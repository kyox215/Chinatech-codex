import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePrintLifecycle } from "./use-print-lifecycle";

describe("usePrintLifecycle", () => {
  const print = vi.fn();
  let mediaChange: ((event: MediaQueryListEvent) => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    print.mockReset();
    Object.defineProperty(window, "print", { configurable: true, value: print });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(Date.now()), 16),
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value: (id: number) => window.clearTimeout(id),
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
          mediaChange = listener;
        },
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("waits for committed layout, blocks overlap, and clears after print", async () => {
    const complete = vi.fn();
    const { result } = renderHook(() => usePrintLifecycle(complete));

    await expect(result.current()).resolves.toBe("started");
    await expect(result.current()).resolves.toBe("busy");
    expect(print).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(32));
    expect(print).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(complete).toHaveBeenCalledTimes(1);
    await expect(result.current()).resolves.toBe("started");
  });

  it("reports print errors and releases the active job", async () => {
    const onError = vi.fn();
    print.mockImplementation(() => {
      throw new Error("print unavailable");
    });
    const { result } = renderHook(() => usePrintLifecycle(undefined, onError));

    await expect(result.current()).resolves.toBe("started");
    act(() => vi.advanceTimersByTime(32));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "print unavailable" }));
    await expect(result.current()).resolves.toBe("started");
  });

  it("clears on print-media exit and on the fallback timer", async () => {
    const complete = vi.fn();
    const { result } = renderHook(() => usePrintLifecycle(complete));

    await expect(result.current()).resolves.toBe("started");
    act(() => vi.advanceTimersByTime(32));
    act(() => mediaChange?.({ matches: false } as MediaQueryListEvent));
    expect(complete).toHaveBeenCalledTimes(1);

    await expect(result.current()).resolves.toBe("started");
    act(() => vi.advanceTimersByTime(32 + 30_000));
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("waits for asynchronous preparation and fails closed when preparation rejects", async () => {
    const onError = vi.fn();
    let releasePreparation: (() => void) | undefined;
    const prepare = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releasePreparation = resolve;
        }),
    );
    const { result } = renderHook(() => usePrintLifecycle(undefined, onError));

    const pending = result.current(prepare);
    await Promise.resolve();
    await expect(result.current(prepare)).resolves.toBe("busy");
    expect(prepare).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(100));
    expect(print).not.toHaveBeenCalled();
    releasePreparation?.();
    await act(async () => {
      await pending;
    });
    act(() => vi.advanceTimersByTime(32));
    expect(print).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event("afterprint")));

    await expect(result.current(() => Promise.reject(new Error("QR unavailable")))).resolves.toBe(
      "failed",
    );
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "QR unavailable" }));
    expect(print).toHaveBeenCalledTimes(1);
  });
});
