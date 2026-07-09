"use client";

import type * as React from "react";
import { useLayoutEffect } from "react";
import { createPortal } from "react-dom";

export type PrintPaperMode = "a5-landscape" | "a4-portrait-half";

const A4_PORTRAIT_HALF_STYLE_ID = "repairdesk-print-a4-portrait-half-page";
const A4_PORTRAIT_HALF_STYLE = [
  "@media print {",
  "  @page {",
  "    size: A4 portrait;",
  "    margin: 6mm;",
  "  }",
  "}",
].join("\n");

const activeBodyClasses = new Map<string, number>();
let activeA4PortraitHalfPortals = 0;

export function PrintPortal({
  children,
  paperMode = "a5-landscape",
}: {
  children: React.ReactNode;
  paperMode?: PrintPaperMode;
}) {
  const portalRoot = typeof document === "undefined" ? null : document.body;

  useLayoutEffect(() => {
    if (!portalRoot) return;

    retainBodyClass(portalRoot, "has-repair-print");
    retainBodyClass(portalRoot, `has-repair-print-${paperMode}`);

    if (paperMode === "a4-portrait-half") {
      activeA4PortraitHalfPortals += 1;
      ensureA4PortraitHalfStyle(portalRoot.ownerDocument);
    }

    return () => {
      releaseBodyClass(portalRoot, "has-repair-print");
      releaseBodyClass(portalRoot, `has-repair-print-${paperMode}`);

      if (paperMode === "a4-portrait-half") {
        activeA4PortraitHalfPortals = Math.max(0, activeA4PortraitHalfPortals - 1);
        if (activeA4PortraitHalfPortals === 0) {
          portalRoot.ownerDocument.getElementById(A4_PORTRAIT_HALF_STYLE_ID)?.remove();
        }
      }
    };
  }, [paperMode, portalRoot]);

  if (!portalRoot) return null;

  return createPortal(children, portalRoot);
}

function retainBodyClass(portalRoot: HTMLElement, className: string) {
  const count = activeBodyClasses.get(className) ?? 0;
  activeBodyClasses.set(className, count + 1);
  portalRoot.classList.add(className);
}

function releaseBodyClass(portalRoot: HTMLElement, className: string) {
  const nextCount = Math.max(0, (activeBodyClasses.get(className) ?? 0) - 1);

  if (nextCount === 0) {
    activeBodyClasses.delete(className);
    portalRoot.classList.remove(className);
    return;
  }

  activeBodyClasses.set(className, nextCount);
}

function ensureA4PortraitHalfStyle(ownerDocument: Document) {
  if (ownerDocument.getElementById(A4_PORTRAIT_HALF_STYLE_ID)) return;

  const style = ownerDocument.createElement("style");
  style.id = A4_PORTRAIT_HALF_STYLE_ID;
  style.textContent = A4_PORTRAIT_HALF_STYLE;
  ownerDocument.head.appendChild(style);
}
