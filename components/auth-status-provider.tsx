"use client";
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import type { AuthStatus } from "@/lib/auth-status";
import { subscribeAuthChanged } from "@/lib/auth-events";
import { clearBackend } from "@/lib/backend/client";

const Context = createContext<{ status: AuthStatus; checking: boolean; refresh: () => void } | null>(null);
export function AuthStatusProvider({ initial, children }: { initial: AuthStatus; children: React.ReactNode }) {
  const [status, setStatus] = useState(initial);
  const [checking, setChecking] = useState(false);
  const pathname = usePathname();
  const lastPathname = useRef(pathname);
  const control = useRef<(() => void) | null>(null);
  const needsDocumentRefresh = useRef(false);
  const refresh = useCallback(() => { if (needsDocumentRefresh.current) window.location.reload(); else control.current?.(); }, []);
  useEffect(() => {
    let alive = true, epoch = 0, foregroundTimer: number | undefined, flight: AbortController | undefined;
    let current = initial;
    let lastActivity = 0;
    queueMicrotask(() => { if (alive) setStatus(initial); });
    const check = (invalidate = false) => {
      if (!alive || document.visibilityState !== "visible") return;
      if (flight && !invalidate) return;
      flight?.abort();
      const controller = new AbortController(); flight = controller;
      const generation = ++epoch;
      setChecking(true);
      void fetch("/api/auth/status", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) }).then(async response => {
        if (response.status === 409) {
          if (alive && epoch === generation) { needsDocumentRefresh.current = true; current = { ...current, state: "unavailable" }; setStatus(current); }
          return;
        }
        const next: AuthStatus = await response.json();
        if ((!response.ok && response.status !== 503) || !["anonymous", "unverified", "account", "workspace", "unavailable"].includes(next.state)) throw new Error("无法核对登录状态，请稍后重试。");
        if (!alive || epoch !== generation) return;
        needsDocumentRefresh.current = false;
        if (next.state !== "unavailable" && (next.scope !== current.scope || next.state === "anonymous")) clearBackend();
        current = next; setStatus(next);
      }).catch(() => {
        if (alive && epoch === generation && !controller.signal.aborted) { current = { ...current, state: "unavailable" }; setStatus(current); }
      }).finally(() => { if (alive && epoch === generation) { flight = undefined; setChecking(false); } });
    };
    control.current = () => check(true);
    const interacted = (event: Event) => {
      if (!event.isTrusted || !current.formal || !["account", "workspace"].includes(current.state) || !/^\/(?:toolbox(?:\/|$)|$)/.test(window.location.pathname) || document.visibilityState !== "visible" || !navigator.onLine || Date.now() - lastActivity < 60000) return;
      lastActivity = Date.now();
      // Only trusted foreground interaction renews inactivity, never status polls.
      void fetch("/api/auth/activity", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ store: false }), signal: AbortSignal.timeout(10000) }).then(response => { if (!response.ok) { lastActivity = 0; if (alive) check(true); } }).catch(() => { lastActivity = 0; });
    };
    const foreground = () => { window.clearTimeout(foregroundTimer); foregroundTimer = window.setTimeout(() => check(true), 60); };
    const unsubscribe = subscribeAuthChanged(foreground);
    window.addEventListener("focus", foreground); window.addEventListener("online", foreground); window.addEventListener("pageshow", foreground);
    document.addEventListener("visibilitychange", foreground);
    document.addEventListener("pointerdown", interacted); document.addEventListener("keydown", interacted);
    const timer = window.setInterval(() => check(), 30000);
    queueMicrotask(() => { if (alive) check(); });
    return () => { alive = false; epoch++; flight?.abort(); window.clearInterval(timer); window.clearTimeout(foregroundTimer); control.current = null; unsubscribe(); window.removeEventListener("focus", foreground); window.removeEventListener("online", foreground); window.removeEventListener("pageshow", foreground); document.removeEventListener("visibilitychange", foreground); document.removeEventListener("pointerdown", interacted); document.removeEventListener("keydown", interacted); };
  }, [initial]);
  useEffect(() => { if (lastPathname.current !== pathname) { lastPathname.current = pathname; control.current?.(); } }, [pathname]);
  return <Context.Provider value={{ status, checking, refresh }}>{children}</Context.Provider>;
}
export function useAuthStatus() {
  const context = useContext(Context);
  if (!context) throw new Error("账号状态暂不可用");
  return context;
}
