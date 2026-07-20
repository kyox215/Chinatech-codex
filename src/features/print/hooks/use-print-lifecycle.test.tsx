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

  it("waits for committed layout, blocks overlap, and clears after print", () => {
    const complete = vi.fn();
    const { result } = renderHook(() => usePrintLifecycle(complete));

    expect(result.current()).toBe("started");
    expect(result.current()).toBe("busy");
    expect(print).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(32));
    expect(print).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(complete).toHaveBeenCalledTimes(1);
    expect(result.current()).toBe("started");
  });

  it("reports print errors and releases the active job", () => {
    const onError = vi.fn();
    print.mockImplementation(() => {
      throw new Error("print unavailable");
    });
    const { result } = renderHook(() => usePrintLifecycle(undefined, onError));

    expect(result.current()).toBe("started");
    act(() => vi.advanceTimersByTime(32));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "print unavailable" }));
    expect(result.current()).toBe("started");
  });

  it("clears on print-media exit and on the fallback timer", () => {
    const complete = vi.fn();
    const { result } = renderHook(() => usePrintLifecycle(complete));

    expect(result.current()).toBe("started");
    act(() => vi.advanceTimersByTime(32));
    act(() => mediaChange?.({ matches: false } as MediaQueryListEvent));
    expect(complete).toHaveBeenCalledTimes(1);

    expect(result.current()).toBe("started");
    act(() => vi.advanceTimersByTime(32 + 30_000));
    expect(complete).toHaveBeenCalledTimes(2);
  });
});
