"use client";

import { useCallback, useEffect, useRef } from "react";

type LeaveBlockReason = "dirty" | "pending";

type InventoryProductLeaveGuardOptions = {
  enabled?: boolean;
  isDirty: boolean;
  isPending: boolean;
  onBlocked?: (reason: LeaveBlockReason) => void;
};

/**
 * Protects the full-page create/edit workspace without taking over dialog
 * close handling. A history sentinel lets the user cancel a browser-back
 * attempt and keeps the form mounted; accepted navigation is then replayed
 * once with the guard bypassed.
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

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);
  useEffect(() => {
    pendingRef.current = isPending;
  }, [isPending]);
  useEffect(() => {
    blockedRef.current = onBlocked;
  }, [onBlocked]);

  const requestLeave = useCallback(() => {
    if (pendingRef.current) {
      blockedRef.current?.("pending");
      return false;
    }
    if (dirtyRef.current && !window.confirm("当前商品资料尚未保存，确定要离开吗？")) {
      blockedRef.current?.("dirty");
      return false;
    }
    return true;
  }, []);

  const markSaved = useCallback(() => {
    dirtyRef.current = false;
    pendingRef.current = false;
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

    let bypassNextPop = false;
    let restoringSentinel = false;
    const restoreSentinel = () => {
      restoringSentinel = true;
      window.history.go(1);
    };

    const onPopState = () => {
      if (bypassNextPop) {
        bypassNextPop = false;
        return;
      }
      if (restoringSentinel) {
        restoringSentinel = false;
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
        bypassNextPop = true;
        window.history.go(-1);
        return;
      }
      if (window.confirm("当前商品资料尚未保存，确定要离开吗？")) {
        // The browser already popped the sentinel; consume the original form
        // entry and land on the route before the form.
        bypassNextPop = true;
        window.history.go(-1);
      } else {
        blockedRef.current?.("dirty");
        restoreSentinel();
      }
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
  }, [enabled]);

  return { markSaved, requestLeave };
}
