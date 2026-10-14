"use client";
import { useCallback, useEffect, useRef } from "react";

/** Preserve the background position while native Office dialogs scroll on phones. */
export function useOfficeModalScrollLock() {
  const saved = useRef<{ x: number; y: number; position: string; top: string; left: string; width: string; overflow: string } | null>(null);
  const unlock = useCallback(() => {
    const state = saved.current;
    if (!state) return;
    saved.current = null;
    Object.assign(document.body.style, { position: state.position, top: state.top, left: state.left, width: state.width, overflow: state.overflow });
    const behavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(state.x, state.y);
    document.documentElement.style.scrollBehavior = behavior;
  }, []);
  const lock = useCallback(() => {
    if (saved.current) return;
    const { style } = document.body;
    saved.current = { x: scrollX, y: scrollY, position: style.position, top: style.top, left: style.left, width: style.width, overflow: style.overflow };
    Object.assign(style, { position: "fixed", top: `-${scrollY}px`, left: `-${scrollX}px`, width: "100%", overflow: "hidden" });
  }, []);
  useEffect(() => unlock, [unlock]);
  return { lock, unlock };
}
