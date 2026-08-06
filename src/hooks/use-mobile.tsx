"use client";

import { useSyncExternalStore } from "react";

export const MOBILE_BREAKPOINT = 768;
export const COMPACT_WORKSPACE_BREAKPOINT = 1024;

export type ViewportMode = "pending" | "compact" | "desktop";

type ViewportListener = () => void;

interface ViewportStore {
  subscribe: (listener: ViewportListener) => () => void;
  getSnapshot: () => boolean | undefined;
  getServerSnapshot: () => boolean | undefined;
}

function createViewportStore(breakpoint: number): ViewportStore {
  let mediaQuery: MediaQueryList | undefined;
  let mediaListener: (() => void) | undefined;
  const listeners = new Set<ViewportListener>();

  const getMediaQuery = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    mediaQuery ??= window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    return mediaQuery;
  };

  const getSnapshot = () => {
    if (typeof window === "undefined") return undefined;
    const media = getMediaQuery();
    return media?.matches ?? window.innerWidth < breakpoint;
  };

  const getServerSnapshot = () => undefined;

  const subscribe = (listener: ViewportListener) => {
    const media = getMediaQuery();
    listeners.add(listener);
    if (listeners.size === 1) {
      mediaListener = () => listeners.forEach((entry) => entry());
      if (media && typeof media.addEventListener === "function") {
        media.addEventListener("change", mediaListener);
      } else if (media && typeof media.addListener === "function") {
        media.addListener(mediaListener);
      } else if (typeof window !== "undefined") {
        window.addEventListener("resize", mediaListener);
      }
    }

    return () => {
      listeners.delete(listener);
      if (listeners.size > 0 || !mediaListener) return;
      if (media && typeof media.removeEventListener === "function") {
        media.removeEventListener("change", mediaListener);
      } else if (media && typeof media.removeListener === "function") {
        media.removeListener(mediaListener);
      } else if (typeof window !== "undefined") {
        window.removeEventListener("resize", mediaListener);
      }
      mediaListener = undefined;
      mediaQuery = undefined;
    };
  };

  return { subscribe, getSnapshot, getServerSnapshot };
}

const mobileViewportStore = createViewportStore(MOBILE_BREAKPOINT);
const compactWorkspaceStore = createViewportStore(COMPACT_WORKSPACE_BREAKPOINT);

/**
 * Resolves the single app-shell boundary used by list pages and RepairOS
 * compact workspaces. The server snapshot intentionally stays pending so a
 * hydration pass cannot render a complete desktop tree before the viewport is
 * known.
 */
export function useViewportMode(): ViewportMode {
  const isCompact = useSyncExternalStore(
    compactWorkspaceStore.subscribe,
    compactWorkspaceStore.getSnapshot,
    compactWorkspaceStore.getServerSnapshot,
  );

  if (isCompact === undefined) return "pending";
  return isCompact ? "compact" : "desktop";
}

function useViewportBelow(store: ViewportStore) {
  const matches = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return matches === true;
}

/** Existing 768px mobile semantics retained for high-risk callers. */
export function useIsMobile() {
  return useViewportBelow(mobileViewportStore);
}

// Touch-first iPad widths use the drawer shell without changing the meaning of
// "mobile" for existing high-risk consumers such as store lifecycle actions.
export function useIsCompactWorkspace() {
  return useViewportBelow(compactWorkspaceStore);
}
