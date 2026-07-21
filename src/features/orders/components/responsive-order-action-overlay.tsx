"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";

type VisualViewportMetrics = {
  height: number;
  offsetTop: number;
  keyboardInset: number;
};

export function ResponsiveOrderActionOverlay({
  open,
  pending,
  dirty = false,
  onOpenChange,
  title,
  description,
  children,
  footer,
  contentClassName,
  dataAttribute,
}: {
  open: boolean;
  pending: boolean;
  dirty?: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  contentClassName?: string;
  dataAttribute?: string;
}) {
  const desktop = useDesktopActionSurface();
  const viewport = useVisualViewportMetrics(open);
  const requestOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (pending) return;
    if (dirty && !window.confirm("当前选择尚未提交，确定放弃吗？")) return;
    onOpenChange(false);
  };
  const preventPendingClose = (event: Event) => {
    if (pending) event.preventDefault();
  };
  const dataProps = dataAttribute ? { [dataAttribute]: "true" } : {};

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={requestOpenChange}>
        <DialogContent
          {...dataProps}
          className={cn(
            "grid w-[min(760px,calc(100vw-24px))] max-w-[calc(100vw-24px)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0",
            componentOverlay.actionContent,
            contentClassName,
          )}
          style={{
            top: viewport.offsetTop + viewport.height / 2,
            maxHeight: Math.max(240, viewport.height - 24),
          }}
          onEscapeKeyDown={preventPendingClose}
          onPointerDownOutside={preventPendingClose}
          onInteractOutside={preventPendingClose}
          aria-busy={pending}
        >
          <DialogHeader className="border-b border-[var(--border-panel)] px-4 py-3 pr-12 text-left">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className={componentOverlay.actionBody}>{children}</div>
          <DialogFooter className={componentOverlay.actionFooter}>{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={requestOpenChange}>
      <SheetContent
        {...dataProps}
        side="bottom"
        className={cn(
          "grid grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-t-[var(--radius-lg)] p-0",
          componentOverlay.actionContent,
          contentClassName,
        )}
        style={
          {
            bottom: viewport.keyboardInset,
            maxHeight: Math.max(240, viewport.height - 8),
            "--rd-visual-viewport-height": `${viewport.height}px`,
            "--rd-overlay-keyboard-inset": `${viewport.keyboardInset}px`,
          } as CSSProperties
        }
        onEscapeKeyDown={preventPendingClose}
        onPointerDownOutside={preventPendingClose}
        onInteractOutside={preventPendingClose}
        aria-busy={pending}
      >
        <SheetHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className={componentOverlay.actionBody}>{children}</div>
        <SheetFooter className="border-t border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
          {footer}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function useDesktopActionSurface() {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return desktop;
}

export function useVisualViewportMetrics(active = true): VisualViewportMetrics {
  const [metrics, setMetrics] = useState<VisualViewportMetrics>({
    height: 720,
    offsetTop: 0,
    keyboardInset: 0,
  });

  useEffect(() => {
    if (!active) return;
    const viewport = window.visualViewport;
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      setMetrics({
        height,
        offsetTop,
        keyboardInset: Math.max(0, window.innerHeight - height - offsetTop),
      });
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [active]);

  return metrics;
}
