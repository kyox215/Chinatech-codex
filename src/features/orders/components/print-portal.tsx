"use client";

import type * as React from "react";
import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type PrintPaperMode =
  | "a5-landscape"
  | "a4-landscape-full"
  | "a4-portrait-half"
  | "a4-portrait-duplicate";

const PAPER_STYLE_ID = "repairdesk-print-paper-page";
const PAPER_STYLES: Record<PrintPaperMode, string> = {
  "a5-landscape": ["@media print {", "  @page { size: A5 landscape; margin: 0; }", "}"].join("\n"),
  "a4-landscape-full": ["@media print {", "  @page { size: A4 landscape; margin: 0; }", "}"].join(
    "\n",
  ),
  "a4-portrait-half": ["@media print {", "  @page { size: A4 portrait; margin: 0; }", "}"].join(
    "\n",
  ),
  "a4-portrait-duplicate": [
    "@media print {",
    "  @page { size: A4 portrait; margin: 0; }",
    "}",
  ].join("\n"),
};

const activeBodyClasses = new Map<string, number>();
const activePaperPortals: Array<{ token: symbol; mode: PrintPaperMode }> = [];

export function PrintPortal({
  children,
  paperMode = "a5-landscape",
}: {
  children: React.ReactNode;
  paperMode?: PrintPaperMode;
}) {
  const portalRoot = typeof document === "undefined" ? null : document.body;
  const tokenRef = useRef(Symbol("repair-print-portal"));

  useLayoutEffect(() => {
    if (!portalRoot) return;

    retainBodyClass(portalRoot, "has-repair-print");
    retainBodyClass(portalRoot, `has-repair-print-${paperMode}`);

    const token = tokenRef.current;
    activePaperPortals.push({ token, mode: paperMode });
    ensurePaperStyle(portalRoot.ownerDocument, paperMode);

    return () => {
      releaseBodyClass(portalRoot, "has-repair-print");
      releaseBodyClass(portalRoot, `has-repair-print-${paperMode}`);

      const index = activePaperPortals.findIndex((entry) => entry.token === token);
      if (index >= 0) activePaperPortals.splice(index, 1);
      const current = activePaperPortals.at(-1);
      if (current) {
        ensurePaperStyle(portalRoot.ownerDocument, current.mode);
      } else {
        portalRoot.ownerDocument.getElementById(PAPER_STYLE_ID)?.remove();
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

function ensurePaperStyle(ownerDocument: Document, paperMode: PrintPaperMode) {
  const style =
    ownerDocument.getElementById(PAPER_STYLE_ID) ?? ownerDocument.createElement("style");
  style.id = PAPER_STYLE_ID;
  style.dataset.paperMode = paperMode;
  style.textContent = PAPER_STYLES[paperMode];
  if (!style.isConnected) ownerDocument.head.appendChild(style);
}

export function getPrintContentFit(contentUnits: number) {
  if (contentUnits > 2_400) return { scale: 0.72, overflow: true };
  if (contentUnits > 1_850) return { scale: 0.72, overflow: false };
  if (contentUnits > 1_400) return { scale: 0.8, overflow: false };
  if (contentUnits > 1_050) return { scale: 0.9, overflow: false };
  return { scale: 1, overflow: false };
}

export function FittedPrintPage({
  children,
  contentUnits = 0,
}: {
  children: React.ReactNode;
  contentUnits?: number;
}) {
  const { scale, overflow } = getPrintContentFit(contentUnits);

  return (
    <div
      className="repair-print-page"
      data-print-layout-ready="true"
      data-print-overflow={overflow ? "true" : "false"}
    >
      <div
        className="repair-print-page-content"
        style={{ "--repair-print-scale": scale } as React.CSSProperties}
      >
        {children}
      </div>
      <div className="repair-print-cut-line" aria-hidden="true" />
    </div>
  );
}
