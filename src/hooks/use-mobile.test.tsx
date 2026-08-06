import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIsCompactWorkspace, useIsMobile, useViewportMode } from "@/hooks/use-mobile";

type MediaController = {
  setWidth: (width: number) => void;
  dispatch: () => void;
  addEventListenerCalls: number;
  removeEventListenerCalls: number;
};

function installMatchMedia(initialWidth: number, legacy = false): MediaController {
  let width = initialWidth;
  const queries = new Map<string, { matches: boolean; listeners: Set<() => void> }>();
  let addEventListenerCalls = 0;
  let removeEventListenerCalls = 0;

  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: initialWidth,
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => {
      const state =
        queries.get(query) ??
        (() => {
          const next = { matches: false, listeners: new Set<() => void>() };
          queries.set(query, next);
          return next;
        })();
      const maxWidth = Number(query.match(/max-width:\s*(\d+)px/)?.[1]);
      state.matches = Number.isFinite(maxWidth) ? width <= maxWidth : width >= 1024;
      const add = (_eventName: string, listener: () => void) => {
        addEventListenerCalls += 1;
        state.listeners.add(listener);
      };
      const remove = (_eventName: string, listener: () => void) => {
        removeEventListenerCalls += 1;
        state.listeners.delete(listener);
      };
      const addLegacy = (listener: () => void) => add("change", listener);
      const removeLegacy = (listener: () => void) => remove("change", listener);
      return {
        get matches() {
          return state.matches;
        },
        media: query,
        onchange: null,
        addEventListener: legacy ? undefined : add,
        removeEventListener: legacy ? undefined : remove,
        addListener: legacy ? addLegacy : undefined,
        removeListener: legacy ? removeLegacy : undefined,
        dispatchEvent: () => true,
      } as unknown as MediaQueryList;
    }),
  );

  return {
    setWidth(nextWidth) {
      width = nextWidth;
      Object.defineProperty(window, "innerWidth", { configurable: true, value: nextWidth });
      queries.forEach((state, query) => {
        const maxWidth = Number(query.match(/max-width:\s*(\d+)px/)?.[1]);
        state.matches = Number.isFinite(maxWidth) ? width <= maxWidth : width >= 1024;
      });
    },
    dispatch() {
      queries.forEach((state) => state.listeners.forEach((listener) => listener()));
    },
    get addEventListenerCalls() {
      return addEventListenerCalls;
    },
    get removeEventListenerCalls() {
      return removeEventListenerCalls;
    },
  };
}

describe("useViewportMode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses pending as the server snapshot", () => {
    function Probe() {
      return <output>{useViewportMode()}</output>;
    }

    expect(renderToString(<Probe />)).toContain(">pending<");
  });

  it("resolves compact below 1024 and desktop at the boundary", () => {
    installMatchMedia(390);
    const compact = renderHook(() => useViewportMode());
    expect(compact.result.current).toBe("compact");
    compact.unmount();

    installMatchMedia(1024);
    const desktop = renderHook(() => useViewportMode());
    expect(desktop.result.current).toBe("desktop");
    desktop.unmount();
  });

  it("updates on viewport changes and cleans up modern listeners", () => {
    const media = installMatchMedia(390);
    const hook = renderHook(() => useViewportMode());
    expect(hook.result.current).toBe("compact");
    expect(media.addEventListenerCalls).toBe(1);

    act(() => {
      media.setWidth(1024);
      media.dispatch();
    });
    expect(hook.result.current).toBe("desktop");

    hook.unmount();
    expect(media.removeEventListenerCalls).toBe(1);
  });

  it("supports the legacy Safari listener API", () => {
    const media = installMatchMedia(390, true);
    const hook = renderHook(() => useViewportMode());
    expect(hook.result.current).toBe("compact");
    expect(media.addEventListenerCalls).toBe(1);
    hook.unmount();
    expect(media.removeEventListenerCalls).toBe(1);
  });

  it("keeps the existing mobile and compact hooks compatible", () => {
    installMatchMedia(390);
    const mobile = renderHook(() => useIsMobile());
    const compact = renderHook(() => useIsCompactWorkspace());
    expect(mobile.result.current).toBe(true);
    expect(compact.result.current).toBe(true);
    mobile.unmount();
    compact.unmount();

    installMatchMedia(1024);
    const desktopMobile = renderHook(() => useIsMobile());
    const desktopCompact = renderHook(() => useIsCompactWorkspace());
    expect(desktopMobile.result.current).toBe(false);
    expect(desktopCompact.result.current).toBe(false);
    desktopMobile.unmount();
    desktopCompact.unmount();
  });
});
