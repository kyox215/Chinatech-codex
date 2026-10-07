"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearBackend } from "@/lib/backend/client";

export function LoginActivity({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const lastReport = useRef(0);
  useEffect(() => {
    if (!enabled || (!pathname.startsWith("/app/") && !pathname.startsWith("/account/"))) return;
    let alive = true, busy = false;
    const controller = new AbortController();
    const report = async () => {
      if (!alive || busy || document.visibilityState !== "visible" || !navigator.onLine || Date.now()-lastReport.current < 60000) return;
      busy = true; lastReport.current = Date.now();
      try {
        const send = () => fetch("/api/auth/activity", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ store: pathname.startsWith("/app/") }), keepalive: true });
        let response = await send();
        if (alive && response.status === 409 && (await response.clone().json()).code === "SESSION_REFRESH_REQUIRED") {
          const fresh = await fetch("/api/auth/account/session", { cache: "no-store", signal: controller.signal });
          if (!alive) return;
          response = fresh.ok ? await send() : fresh;
        }
        if (alive && (response.status === 401 || response.status === 403)) { clearBackend(); router.replace(response.status === 401 ? "/login" : "/account/pending"); router.refresh(); }
        if (!response.ok) lastReport.current = 0;
      } catch { lastReport.current = 0; } finally { busy = false; }
    };
    const interacted = (event: Event) => { if (event.isTrusted) void report(); };
    const foreground = () => { if (document.visibilityState === "visible") void report(); };
    // Discard Strict Mode’s first effect before sending a real request. Activity
    // writes finish across navigation; late responses cannot update client state.
    queueMicrotask(() => { if (alive) void report(); });
    document.addEventListener("pointerdown", interacted); document.addEventListener("keydown", interacted); document.addEventListener("visibilitychange", foreground); window.addEventListener("focus", foreground);
    // A read-only check observes remote logout without renewing inactivity.
    const timer = window.setInterval(async () => {
      if (!alive || document.visibilityState !== "visible" || !navigator.onLine || !pathname.startsWith("/account/")) return;
      try { const response = await fetch("/api/auth/account/sessions", { cache: "no-store", signal: controller.signal }); if (alive && response.status === 401) { clearBackend(); router.replace("/login"); router.refresh(); } } catch { /* Transient failures do not destroy drafts. */ }
    }, 30000);
    return () => { alive = false; controller.abort(); window.clearInterval(timer); document.removeEventListener("pointerdown", interacted); document.removeEventListener("keydown", interacted); document.removeEventListener("visibilitychange", foreground); window.removeEventListener("focus", foreground); };
  }, [enabled, pathname, router]);
  return null;
}
