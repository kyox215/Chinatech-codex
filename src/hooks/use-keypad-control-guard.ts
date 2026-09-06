"use client";

import { useEffect, type RefObject } from "react";

type KeypadControl = HTMLInputElement | HTMLButtonElement;

// The dock can live outside a fieldset; authorization to edit stays with its source control.
export function useKeypadControlGuard({
  controlRef,
  open,
  disabled,
  readOnly,
  onClose,
}: {
  controlRef: RefObject<KeypadControl | null>;
  open: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  onClose: () => void;
}) {
  const canEdit = () => {
    const control = controlRef.current;
    return Boolean(
      control &&
      !disabled &&
      !readOnly &&
      !control.matches(":disabled") &&
      !(control instanceof HTMLInputElement && control.readOnly),
    );
  };

  useEffect(() => {
    if (!open) return;
    const check = () => {
      if (!canEdit()) onClose();
    };
    check();
    const observer = new MutationObserver(check);
    let node: HTMLElement | null = controlRef.current;
    while (node) {
      observer.observe(node, { attributes: true, attributeFilter: ["disabled", "readonly"] });
      node = node.parentElement;
    }
    return () => observer.disconnect();
  });

  return canEdit;
}
