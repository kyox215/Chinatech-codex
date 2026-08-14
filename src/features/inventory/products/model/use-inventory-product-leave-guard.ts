"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LeaveBlockReason = "dirty" | "pending";
export type InventoryLeaveAction = () => void | Promise<void>;
export type InventoryLeaveIntentKind = "explicit" | "history";

type InventoryProductLeaveGuardOptions = {
  enabled?: boolean;
  isDirty: boolean;
  isPending: boolean;
  onBlocked?: (reason: LeaveBlockReason) => void;
};

type PendingLeave = {
  kind: InventoryLeaveIntentKind;
  action?: InventoryLeaveAction;
};

/**
 * Protects a full-page inventory form without using a synchronous browser
 * confirmation. A history sentinel keeps a browser-back attempt reversible;
 * callers render the controlled consequence dialog and decide when to confirm.
 */
export function useInventoryProductLeaveGuard({
  enabled = true,
  isDirty,
  isPending,
  onBlocked,
}: InventoryProductLeaveGuardOptions) {
  const dirtyRef = useRef(isDirty);
  const pendingRef = useRef(isPending);
  const blockedRef = useRef(onBlocked);
  const pendingLeaveRef = useRef<PendingLeave | undefined>(undefined);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const bypassNextPopRef = useRef(false);
  const restoringSentinelRef = useRef(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [isConfirmingLeave, setIsConfirmingLeave] = useState(false);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);
  useEffect(() => {
    pendingRef.current = isPending;
  }, [isPending]);
  useEffect(() => {
    blockedRef.current = onBlocked;
  }, [onBlocked]);

  const openDirtyConfirmation = useCallback(
    (
      kind: InventoryLeaveIntentKind,
      action?: InventoryLeaveAction,
      focusTarget?: HTMLElement | null,
    ) => {
      pendingLeaveRef.current = { kind, action };
      if (focusTarget) returnFocusRef.current = focusTarget;
      setLeaveDialogOpen(true);
    },
    [],
  );

  const requestLeave = useCallback(
    (action?: InventoryLeaveAction, focusTarget?: HTMLElement | null) => {
      if (pendingRef.current) {
        blockedRef.current?.("pending");
        return false;
      }
      if (dirtyRef.current) {
        openDirtyConfirmation("explicit", action, focusTarget);
        return false;
      }
      if (action) void action();
      return true;
    },
    [openDirtyConfirmation],
  );

  const cancelLeave = useCallback(() => {
    const intent = pendingLeaveRef.current;
    pendingLeaveRef.current = undefined;
    setLeaveDialogOpen(false);
    setIsConfirmingLeave(false);
    if (intent?.kind === "history") {
      // The browser already consumed the sentinel before opening the dialog.
      // Restore that entry so a cancelled back action leaves the form/history
      // pair intact.
      restoringSentinelRef.current = true;
      window.history.go(1);
    }
  }, []);

  const confirmLeave = useCallback(async () => {
    if (pendingRef.current) {
      blockedRef.current?.("pending");
      return;
    }
    const intent = pendingLeaveRef.current;
    if (!intent) return;
    pendingLeaveRef.current = undefined;
    setLeaveDialogOpen(false);
    if (intent.kind === "history") {
      // The popstate that opened the dialog left the browser at the form's
      // original entry. One more back reaches the entry before the form.
      bypassNextPopRef.current = true;
      window.history.go(-1);
      return;
    }
    setIsConfirmingLeave(true);
    try {
      await intent.action?.();
    } finally {
      setIsConfirmingLeave(false);
    }
  }, []);

  const markSaved = useCallback(() => {
    dirtyRef.current = false;
    pendingRef.current = false;
    pendingLeaveRef.current = undefined;
    setLeaveDialogOpen(false);
    setIsConfirmingLeave(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const initialUrl = window.location.href;
    const initialState = window.history.state;
    const marker = `inventory-product-form:${Math.random().toString(36).slice(2)}`;
    window.history.pushState(
      {
        ...(initialState && typeof initialState === "object" ? initialState : {}),
        __repairdeskInventoryFormGuard: marker,
      },
      "",
      initialUrl,
    );

    const restoreSentinel = () => {
      restoringSentinelRef.current = true;
      window.history.go(1);
    };

    const onPopState = () => {
      if (bypassNextPopRef.current) {
        bypassNextPopRef.current = false;
        return;
      }
      if (restoringSentinelRef.current) {
        restoringSentinelRef.current = false;
        return;
      }
      if (pendingLeaveRef.current) {
        restoreSentinel();
        return;
      }
      if (pendingRef.current) {
        blockedRef.current?.("pending");
        restoreSentinel();
        return;
      }
      if (!dirtyRef.current) {
        // The browser already popped the sentinel; consume the original page
        // entry as the actual back navigation.
        bypassNextPopRef.current = true;
        window.history.go(-1);
        return;
      }
      // Do not navigate or synchronously prompt. The browser is currently at
      // the original form entry; cancel restores the sentinel, confirm goes
      // one more step back.
      openDirtyConfirmation("history");
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !pendingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (window.history.state?.__repairdeskInventoryFormGuard === marker) {
        window.history.replaceState(initialState, "", initialUrl);
      }
    };
  }, [enabled, openDirtyConfirmation]);

  return {
    markSaved,
    requestLeave,
    cancelLeave,
    confirmLeave,
    leaveDialogOpen,
    leaveReturnFocusRef: returnFocusRef,
    isConfirmingLeave,
  };
}
