import { act, cleanup, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useVirtualKeyboardSurface } from "./use-virtual-keyboard-surface";

const compactQuery = "(max-width: 1023px)";
const coarseQuery = "(pointer: coarse)";
const anyCoarseQuery = "(any-pointer: coarse)";

function browser(platform = "", maxTouchPoints = 5, userAgent = "UnknownBrowser/1.0") {
  vi.stubGlobal("navigator", { userAgent, platform, maxTouchPoints });
  vi.stubGlobal("innerWidth", 390);
}

function mediaQueries(legacy = false) {
  const records = new Map<string, ReturnType<typeof makeQuery>>();
  function makeQuery(query: string) {
    const listeners = new Set<() => void>();
    const add = vi.fn((_event: string, listener: () => void) => listeners.add(listener));
    const remove = vi.fn((_event: string, listener: () => void) => listeners.delete(listener));
    const result = {
      matches: query === compactQuery,
      addEventListener: legacy ? undefined : add,
      removeEventListener: legacy ? undefined : remove,
      addListener: vi.fn((listener: () => void) => listeners.add(listener)),
      removeListener: vi.fn((listener: () => void) => listeners.delete(listener)),
      listeners,
      change(matches: boolean) {
        result.matches = matches;
        act(() => listeners.forEach((listener) => listener()));
      },
    };
    return result;
  }
  vi.stubGlobal("matchMedia", (query: string) => {
    if (!records.has(query)) records.set(query, makeQuery(query));
    return records.get(query);
  });
  return records;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("useVirtualKeyboardSurface", () => {
  it("renders native on the server and the initial client render before resolving a tablet", () => {
    browser("iPad", 5, "iPad");
    mediaQueries();
    function Probe() {
      return <span>{useVirtualKeyboardSurface()}</span>;
    }
    expect(renderToString(<Probe />)).toBe("<span>native</span>");
    const renders: string[] = [];
    const { result } = renderHook(() => {
      const surface = useVirtualKeyboardSurface();
      renders.push(surface);
      return surface;
    });
    expect(renders[0]).toBe("native");
    expect(result.current).toBe("virtual");
  });

  it("keeps narrow touch desktops native and ignores obsolete stored preferences", () => {
    browser("Win32", 10, "Mozilla/5.0 (Windows NT 10.0)");
    const queries = mediaQueries();
    localStorage.setItem("repairdesk:desktop-virtual-keyboard:v1:test-user", "enabled");
    const readStorage = vi.spyOn(Storage.prototype, "getItem");
    const renders: string[] = [];
    renderHook(() => renders.push(useVirtualKeyboardSurface()));
    queries.get(coarseQuery)!.change(true);
    queries.get(anyCoarseQuery)!.change(true);
    expect(renders.every((surface) => surface === "native")).toBe(true);
    expect(readStorage).not.toHaveBeenCalled();
  });

  it("recomputes unknown devices on viewport and primary pointer changes", () => {
    browser();
    const queries = mediaQueries();
    const { result } = renderHook(useVirtualKeyboardSurface);
    expect(result.current).toBe("native");
    queries.get(coarseQuery)!.change(true);
    expect(result.current).toBe("virtual");
    queries.get(compactQuery)!.change(false);
    expect(result.current).toBe("native");
    queries.get(compactQuery)!.change(true);
    expect(result.current).toBe("virtual");
    queries.get(coarseQuery)!.change(false);
    queries.get(anyCoarseQuery)!.change(true);
    expect(result.current).toBe("native");
  });

  it.each([false, true])(
    "tracks iPadOS any-pointer changes and removes listeners (legacy=%s)",
    (legacy) => {
      browser("MacIntel", 5, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
      const queries = mediaQueries(legacy);
      const removeWindow = vi.spyOn(window, "removeEventListener");
      const { result, unmount } = renderHook(useVirtualKeyboardSurface);
      expect(result.current).toBe("native");
      queries.get(anyCoarseQuery)!.change(true);
      expect(result.current).toBe("virtual");
      queries.get(anyCoarseQuery)!.change(false);
      expect(result.current).toBe("native");
      unmount();
      for (const query of queries.values()) {
        expect(query.listeners.size).toBe(0);
        expect(legacy ? query.addListener : query.addEventListener).toHaveBeenCalledOnce();
        expect(legacy ? query.removeListener : query.removeEventListener).toHaveBeenCalledOnce();
      }
      expect(removeWindow).toHaveBeenCalledWith("resize", expect.any(Function));
      expect(removeWindow).toHaveBeenCalledWith("orientationchange", expect.any(Function));
    },
  );

  it("recomputes the width fallback on resize and orientation changes", () => {
    browser();
    vi.stubGlobal("matchMedia", (query: string) =>
      query === compactQuery ? undefined : { matches: true },
    );
    const { result } = renderHook(useVirtualKeyboardSurface);
    expect(result.current).toBe("virtual");
    vi.stubGlobal("innerWidth", 1280);
    act(() => window.dispatchEvent(new Event("resize")));
    expect(result.current).toBe("native");
    vi.stubGlobal("innerWidth", 430);
    act(() => window.dispatchEvent(new Event("orientationchange")));
    expect(result.current).toBe("virtual");
  });

  it("handles browsers without matchMedia conservatively", () => {
    browser();
    vi.stubGlobal("matchMedia", undefined);
    const { result, unmount } = renderHook(useVirtualKeyboardSurface);
    expect(result.current).toBe("native");
    unmount();
    browser("iPad", 5, "iPad");
    expect(renderHook(useVirtualKeyboardSurface).result.current).toBe("virtual");
  });
});
