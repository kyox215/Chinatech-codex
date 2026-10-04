"use client";

import { useEffect } from "react";
import { requestLegacyServiceWorkerRetirement } from "@/lib/legacy-service-worker";

export function LegacyServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let running = false;
    let disposed = false;
    const retry = () => {
      if (disposed || running || document.visibilityState === "hidden") return;
      running = true;
      void requestLegacyServiceWorkerRetirement(navigator.serviceWorker, window.location.origin)
        .catch(() => undefined)
        .finally(() => { running = false; });
    };
    const whenVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    retry();
    window.addEventListener("online", retry);
    window.addEventListener("pageshow", retry);
    document.addEventListener("visibilitychange", whenVisible);
    return () => {
      disposed = true;
      window.removeEventListener("online", retry);
      window.removeEventListener("pageshow", retry);
      document.removeEventListener("visibilitychange", whenVisible);
    };
  }, []);
  return null;
}
