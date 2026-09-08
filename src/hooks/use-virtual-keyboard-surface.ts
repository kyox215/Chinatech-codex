"use client";

import { useEffect, useState } from "react";

import {
  resolveVirtualKeyboardSurface,
  type VirtualKeyboardSurface,
} from "@/shared/lib/virtual-keyboard-device";

const compactViewportBreakpoint = 1024;

export function useVirtualKeyboardSurface(): VirtualKeyboardSurface {
  // Keep SSR and the first hydration render native, including narrow desktop windows.
  const [surface, setSurface] = useState<VirtualKeyboardSurface>("native");

  useEffect(() => {
    const media = (query: string) =>
      typeof window.matchMedia === "function" ? window.matchMedia(query) : undefined;
    const compact = media(`(max-width: ${compactViewportBreakpoint - 1}px)`);
    const coarse = media("(pointer: coarse)");
    const anyCoarse = media("(any-pointer: coarse)");
    const update = () =>
      setSurface(
        resolveVirtualKeyboardSurface({
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          maxTouchPoints: navigator.maxTouchPoints ?? 0,
          compactViewport: compact?.matches ?? window.innerWidth < compactViewportBreakpoint,
          coarsePointer: coarse?.matches ?? false,
          anyCoarsePointer: anyCoarse?.matches ?? false,
        }),
      );
    const unsubscribe = [compact, coarse, anyCoarse].map((query) => {
      if (typeof query?.addEventListener === "function") {
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
      }
      if (typeof query?.addListener === "function") {
        query.addListener(update);
        return () => query.removeListener(update);
      }
      return () => undefined;
    });

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    update();

    return () => {
      unsubscribe.forEach((remove) => remove());
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return surface;
}
