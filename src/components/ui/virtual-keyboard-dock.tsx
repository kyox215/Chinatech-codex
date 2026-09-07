"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export interface VirtualKeyboardDockProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  children: ReactNode;
  triggerRef?: RefObject<HTMLElement | null>;
  className?: string;
  panelClassName?: string;
  contentClassName?: string;
  "data-testid"?: string;
}

const keyboardBottomOffset = "calc(env(safe-area-inset-bottom) + 0.75rem)";

export function VirtualKeyboardDock({
  open,
  onOpenChange,
  label,
  children,
  triggerRef,
  className,
  panelClassName,
  contentClassName,
  "data-testid": testId,
}: VirtualKeyboardDockProps) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const scopeHost =
    mounted && open
      ? (triggerRef?.current
          ?.closest("[data-keypad-scope]")
          ?.querySelector<HTMLElement>("[data-virtual-keyboard-host]") ?? null)
      : null;
  const restoreFocus = useRef(true);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      restoreFocus.current = true;
    } else if (wasOpen.current && restoreFocus.current && triggerRef?.current?.isConnected) {
      triggerRef.current.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open, triggerRef]);

  useEffect(() => {
    if (open && scopeHost) panelRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [open, scopeHost]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!scopeHost && event.key === "Escape") onOpenChange(false);
    };

    const dismissOutside = (event: globalThis.PointerEvent | globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      restoreFocus.current = false;
      onOpenChange(false);
    };
    const defersDismiss = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest("[data-keypad-defer-dismiss]"));
    const handlePointerDown = (event: globalThis.PointerEvent) => {
      // Removing a scoped dock can move this opt-in popup trigger before pointerup.
      // Keep its geometry until the same click activates the next surface.
      if (!defersDismiss(event.target)) dismissOutside(event);
    };
    const handleClick = (event: globalThis.MouseEvent) => {
      if (defersDismiss(event.target)) dismissOutside(event);
    };
    const dismiss = () => onOpenChange(false);
    scopeHost?.addEventListener("rd-keypad-dismiss", dismiss);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("click", handleClick);

    return () => {
      scopeHost?.removeEventListener("rd-keypad-dismiss", dismiss);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("click", handleClick);
    };
  }, [onOpenChange, open, triggerRef, scopeHost]);

  useEffect(() => {
    if (!open || scopeHost) {
      clearKeyboardVariables();
      return undefined;
    }

    const root = document.documentElement;
    const updateMetrics = () => {
      const height = Math.ceil(panelRef.current?.getBoundingClientRect().height ?? 0);
      root.style.setProperty("--rd-virtual-keyboard-bottom", keyboardBottomOffset);
      root.style.setProperty("--rd-virtual-keyboard-height", `${height}px`);
      root.style.setProperty(
        "--rd-virtual-keyboard-top",
        `calc(100dvh - ${keyboardBottomOffset} - ${height}px)`,
      );
      root.style.setProperty(
        "--rd-overlay-avoid-bottom",
        `calc(${keyboardBottomOffset} + ${height}px + 0.5rem)`,
      );
    };

    updateMetrics();

    if (typeof ResizeObserver === "undefined" || !panelRef.current) {
      return clearKeyboardVariables;
    }

    const observer = new ResizeObserver(updateMetrics);
    observer.observe(panelRef.current);

    return () => {
      observer.disconnect();
      clearKeyboardVariables();
    };
  }, [open, scopeHost]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      data-virtual-keyboard-dock="true"
      data-testid={testId}
      className={cn(
        "z-[130] flex justify-center pointer-events-none",
        scopeHost
          ? "relative w-full py-1"
          : "fixed inset-x-0 px-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]",
        className,
      )}
    >
      <div
        id={id}
        ref={panelRef}
        role="dialog"
        aria-label={label}
        // Portal clicks still bubble through the owning form's React tree.
        // Keep pointerdown available to Radix's outside-interaction tracking.
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "pointer-events-auto w-[min(430px,calc(100vw-24px))] rounded-xl border border-[var(--border-panel)] bg-card p-2 shadow-[var(--shadow-overlay)]",
          scopeHost && "max-h-[55dvh] max-w-full overflow-y-auto overscroll-contain",
          panelClassName,
        )}
      >
        <div className={cn("min-w-0", contentClassName)}>{children}</div>
      </div>
    </div>,
    scopeHost ?? document.body,
  );
}

function clearKeyboardVariables() {
  const root = document.documentElement;
  root.style.removeProperty("--rd-virtual-keyboard-bottom");
  root.style.removeProperty("--rd-virtual-keyboard-height");
  root.style.removeProperty("--rd-virtual-keyboard-top");
  root.style.removeProperty("--rd-overlay-avoid-bottom");
}
