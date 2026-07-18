"use client";

import { useEffect } from "react";

import {
  getRepairDeskStyleRecoveryDecision,
  parseRepairDeskStyleReloadedAt,
  repairDeskStyleReadyProperty,
  repairDeskStyleReloadedAtKey,
} from "@/shared/lib/app-style-recovery";

const initialStyleCheckDelayMs = 1_500;
const resumedStyleCheckDelayMs = 250;

function areRepairDeskStylesReady() {
  return (
    window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(repairDeskStyleReadyProperty)
      .trim() === "1"
  );
}

export function AppStyleRecovery() {
  useEffect(() => {
    let checkTimer: number | undefined;

    const verifyStyles = () => {
      const stylesReady = areRepairDeskStylesReady();
      let lastReloadedAt: number | null = null;
      let recoveryStorageAvailable = true;

      try {
        lastReloadedAt = parseRepairDeskStyleReloadedAt(
          window.sessionStorage.getItem(repairDeskStyleReloadedAtKey),
        );
      } catch {
        // Storage can be disabled in private or restricted browser contexts.
        recoveryStorageAvailable = false;
      }

      const decision = recoveryStorageAvailable
        ? getRepairDeskStyleRecoveryDecision({ stylesReady, lastReloadedAt })
        : stylesReady
          ? "ready"
          : "wait";
      if (decision === "ready") {
        document.documentElement.removeAttribute("data-style-recovery");
        return;
      }

      document.documentElement.setAttribute("data-style-recovery", decision);
      if (decision !== "reload") return;

      try {
        window.sessionStorage.setItem(repairDeskStyleReloadedAtKey, String(Date.now()));
      } catch {
        // The availability check above prevents entering this branch when storage is blocked.
        return;
      }
      window.location.reload();
    };

    const scheduleStyleCheck = (delay = resumedStyleCheckDelayMs) => {
      if (checkTimer !== undefined) window.clearTimeout(checkTimer);
      checkTimer = window.setTimeout(verifyStyles, delay);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") scheduleStyleCheck();
    };
    const handlePageShow = () => scheduleStyleCheck();
    const handleResume = () => scheduleStyleCheck();
    const handleOnline = () => scheduleStyleCheck();
    const handleResourceError = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLLinkElement && target.rel === "stylesheet") {
        scheduleStyleCheck(0);
      }
    };

    scheduleStyleCheck(initialStyleCheckDelayMs);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("resume", handleResume);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("online", handleOnline);
    window.addEventListener("error", handleResourceError, true);

    return () => {
      if (checkTimer !== undefined) window.clearTimeout(checkTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("resume", handleResume);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("error", handleResourceError, true);
    };
  }, []);

  return null;
}
