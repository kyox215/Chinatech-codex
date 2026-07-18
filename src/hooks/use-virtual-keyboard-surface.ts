"use client";

import { useEffect, useState } from "react";

import { useDesktopVirtualKeyboardPreference } from "@/components/desktop-virtual-keyboard-preference-context";

const desktopBreakpoint = 1024;

function readDesktopViewport() {
  return typeof window !== "undefined" && window.innerWidth >= desktopBreakpoint;
}

export function useVirtualKeyboardSurface() {
  const { desktopVirtualKeyboardEnabled } = useDesktopVirtualKeyboardPreference();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.(`(min-width: ${desktopBreakpoint}px)`);
    const update = () => setIsDesktop(media?.matches ?? readDesktopViewport());
    update();
    media?.addEventListener("change", update);
    return () => media?.removeEventListener("change", update);
  }, []);

  return isDesktop && !desktopVirtualKeyboardEnabled ? "native" : "virtual";
}
