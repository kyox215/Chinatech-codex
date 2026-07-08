"use client";

import type * as React from "react";
import { useLayoutEffect } from "react";
import { createPortal } from "react-dom";

export function PrintPortal({ children }: { children: React.ReactNode }) {
  const portalRoot = typeof document === "undefined" ? null : document.body;

  useLayoutEffect(() => {
    if (!portalRoot) return;

    portalRoot.classList.add("has-repair-print");

    return () => {
      portalRoot.classList.remove("has-repair-print");
    };
  }, [portalRoot]);

  if (!portalRoot) return null;

  return createPortal(children, portalRoot);
}
