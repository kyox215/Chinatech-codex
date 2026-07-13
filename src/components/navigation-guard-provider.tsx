"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type NavigationGuardResolution =
  | { status: "resolved" }
  | { status: "blocked"; focus?: () => void };

export interface NavigationGuardSource {
  id: string;
  label: () => string;
  isDirty: () => boolean;
  isBusy: () => boolean;
  canSave?: () => boolean;
  saveUnavailableReason?: () => string;
  save: () => Promise<NavigationGuardResolution>;
  discard: () => NavigationGuardResolution | Promise<NavigationGuardResolution>;
  focusFallback?: () => void;
}

export interface GuardedTransition {
  kind: "route" | "history" | "store-switch" | "store-create" | "sign-out";
  label?: string;
  run: () => void | Promise<unknown>;
}

interface NavigationGuardContextValue {
  registerGuard: (source: NavigationGuardSource) => () => void;
  runGuardedTransition: (transition: GuardedTransition) => void;
}

interface PendingTransition {
  source: NavigationGuardSource;
  transition: GuardedTransition;
}

const HISTORY_POINT_KEY = "__repairdeskNavigationPoint";
const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const sourcesRef = useRef(new Map<string, NavigationGuardSource>());
  const pendingRef = useRef<PendingTransition | null>(null);
  const [pending, setPending] = useState<PendingTransition | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const getDirtySource = useCallback(() => {
    const sources = Array.from(sourcesRef.current.values()).reverse();
    return sources.find((source) => source.isDirty());
  }, []);

  const cancelPending = useCallback((focus = true) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    setIsResolving(false);
    if (focus) queueMicrotask(() => current?.source.focusFallback?.());
  }, []);

  const runGuardedTransition = useCallback(
    (transition: GuardedTransition) => {
      if (pendingRef.current) return;
      const source = getDirtySource();
      if (!source) {
        void Promise.resolve()
          .then(transition.run)
          .catch(() => undefined);
        return;
      }
      const next = { source, transition };
      pendingRef.current = next;
      setPending(next);
    },
    [getDirtySource],
  );

  const registerGuard = useCallback(
    (source: NavigationGuardSource) => {
      sourcesRef.current.set(source.id, source);
      return () => {
        if (sourcesRef.current.get(source.id) !== source) return;
        sourcesRef.current.delete(source.id);
        if (pendingRef.current?.source === source) cancelPending(false);
      };
    },
    [cancelPending],
  );

  const completeTransition = useCallback(async (current: PendingTransition) => {
    if (pendingRef.current !== current) return;
    pendingRef.current = null;
    setPending(null);
    setIsResolving(false);
    await Promise.resolve(current.transition.run()).catch(() => undefined);
  }, []);

  const continueOrCompleteTransition = useCallback(
    async (current: PendingTransition) => {
      const nextSource = getDirtySource();
      if (nextSource) {
        const next = { source: nextSource, transition: current.transition };
        pendingRef.current = next;
        setPending(next);
        setIsResolving(false);
        return;
      }
      await completeTransition(current);
    },
    [completeTransition, getDirtySource],
  );

  const resolveWithSave = useCallback(async () => {
    const current = pendingRef.current;
    if (!current || isResolving || current.source.isBusy()) return;
    setIsResolving(true);
    let resolution: NavigationGuardResolution;
    try {
      resolution = await current.source.save();
    } catch {
      cancelPending(false);
      queueMicrotask(() => current.source.focusFallback?.());
      return;
    }
    await Promise.resolve();
    if (resolution.status === "blocked" || current.source.isDirty()) {
      const focus = resolution.status === "blocked" ? resolution.focus : undefined;
      cancelPending(false);
      queueMicrotask(() => {
        if (focus) focus();
        else current.source.focusFallback?.();
      });
      return;
    }
    await continueOrCompleteTransition(current);
  }, [cancelPending, continueOrCompleteTransition, isResolving]);

  const resolveWithDiscard = useCallback(async () => {
    const current = pendingRef.current;
    if (!current || isResolving || current.source.isBusy()) return;
    setIsResolving(true);
    let resolution: NavigationGuardResolution;
    try {
      resolution = await current.source.discard();
    } catch {
      cancelPending(false);
      queueMicrotask(() => current.source.focusFallback?.());
      return;
    }
    await Promise.resolve();
    if (resolution.status === "blocked" || current.source.isDirty()) {
      const focus = resolution.status === "blocked" ? resolution.focus : undefined;
      cancelPending(false);
      queueMicrotask(() => {
        if (focus) focus();
        else current.source.focusFallback?.();
      });
      return;
    }
    await continueOrCompleteTransition(current);
  }, [cancelPending, continueOrCompleteTransition, isResolving]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.dataset.navigationGuardBypass === "true"
      ) {
        return;
      }
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }
      if (!getDirtySource()) return;
      event.preventDefault();
      if (pendingRef.current) {
        event.stopPropagation();
        return;
      }
      const href = `${url.pathname}${url.search}${url.hash}`;
      const scroll = anchor.dataset.navigationScroll !== "preserve";
      runGuardedTransition({
        kind: "route",
        label: anchor.textContent?.trim() || href,
        run: () => router.push(href, { scroll }),
      });
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [getDirtySource, router, runGuardedTransition]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!getDirtySource()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [getDirtySource]);

  useEffect(() => {
    if (pending) return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const openModal = document.querySelector(
          '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
        );
        if (!openModal && document.body.style.pointerEvents === "none") {
          document.body.style.removeProperty("pointer-events");
        }
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [pending]);

  useEffect(() => {
    const history = window.history;
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    let currentPoint = readHistoryPoint(history.state) ?? 0;
    let bypassNextPop = false;
    let restoring: { delta: number } | null = null;

    originalReplaceState.call(
      history,
      withHistoryPoint(history.state, currentPoint),
      "",
      window.location.href,
    );

    const wrappedPushState: History["pushState"] = (data, unused, url) => {
      currentPoint += 1;
      originalPushState.call(history, withHistoryPoint(data, currentPoint), unused, url);
    };
    const wrappedReplaceState: History["replaceState"] = (data, unused, url) => {
      originalReplaceState.call(history, withHistoryPoint(data, currentPoint), unused, url);
    };
    history.pushState = wrappedPushState;
    history.replaceState = wrappedReplaceState;

    const handlePopState = (event: PopStateEvent) => {
      const targetPoint = readHistoryPoint(event.state) ?? currentPoint - 1;
      if (bypassNextPop) {
        bypassNextPop = false;
        currentPoint = targetPoint;
        return;
      }
      if (restoring) {
        event.stopImmediatePropagation();
        const transition = restoring;
        restoring = null;
        queueMicrotask(() =>
          runGuardedTransition({
            kind: "history",
            label: "浏览器历史",
            run: () => {
              bypassNextPop = true;
              history.go(transition.delta);
            },
          }),
        );
        return;
      }
      if (!getDirtySource()) {
        currentPoint = targetPoint;
        return;
      }
      const delta = targetPoint - currentPoint;
      if (delta === 0) return;
      event.stopImmediatePropagation();
      restoring = { delta };
      history.go(-delta);
    };

    window.addEventListener("popstate", handlePopState, true);
    return () => {
      window.removeEventListener("popstate", handlePopState, true);
      if (history.pushState === wrappedPushState) history.pushState = originalPushState;
      if (history.replaceState === wrappedReplaceState) history.replaceState = originalReplaceState;
    };
  }, [getDirtySource, runGuardedTransition]);

  const value = useMemo(
    () => ({ registerGuard, runGuardedTransition }),
    [registerGuard, runGuardedTransition],
  );

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
      <AlertDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open && !isResolving) cancelPending(false);
        }}
      >
        <AlertDialogContent
          aria-busy={isResolving}
          onEscapeKeyDown={(event) => {
            if (isResolving) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => cancelRef.current?.focus());
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>当前设置尚未保存</AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? `${pending.source.label()}有未保存修改。要继续${pending.transition.label ? `前往“${pending.transition.label}”` : "当前操作"}吗？`
                : "请先处理未保存修改。"}
            </AlertDialogDescription>
            {pending?.source.canSave?.() === false ? (
              <p className="text-sm text-status-warn-foreground" role="status">
                {pending.source.saveUnavailableReason?.() ?? "当前草稿暂不支持直接保存。"}
              </p>
            ) : null}
          </AlertDialogHeader>
          <p className="sr-only" aria-live="polite">
            {isResolving ? "正在处理未保存设置" : ""}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel ref={cancelRef} className="min-h-11" disabled={isResolving}>
              取消
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={isResolving || pending?.source.isBusy()}
              onClick={() => void resolveWithDiscard()}
            >
              放弃修改
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={
                isResolving || pending?.source.isBusy() || pending?.source.canSave?.() === false
              }
              onClick={() => void resolveWithSave()}
            >
              {isResolving ? "正在处理…" : "保存并继续"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  const context = useContext(NavigationGuardContext);
  if (!context) throw new Error("useNavigationGuard must be used inside NavigationGuardProvider");
  return context;
}

function readHistoryPoint(state: unknown) {
  if (!state || typeof state !== "object") return undefined;
  const point = (state as Record<string, unknown>)[HISTORY_POINT_KEY];
  return typeof point === "number" && Number.isFinite(point) ? point : undefined;
}

function withHistoryPoint(state: unknown, point: number) {
  const current = state && typeof state === "object" ? state : {};
  return { ...current, [HISTORY_POINT_KEY]: point };
}
