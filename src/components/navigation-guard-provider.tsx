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
import { toast } from "sonner";

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
import { useLocale } from "@/shared/i18n/locale-provider";

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

export type GuardedTransitionStartOutcome =
  | { status: "executed" }
  | { status: "prompted" }
  | {
      status: "ignored";
      reason: "transition-pending" | "guard-closing" | "source-busy";
    }
  | { status: "failed"; error: Error };

interface NavigationGuardContextValue {
  registerGuard: (source: NavigationGuardSource) => () => void;
  runGuardedTransition: (transition: GuardedTransition) => Promise<GuardedTransitionStartOutcome>;
}

interface PendingTransition {
  source: NavigationGuardSource;
  transition: GuardedTransition;
}

const HISTORY_POINT_KEY = "__repairdeskNavigationPoint";
const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t } = useLocale();
  const sourcesRef = useRef(new Map<string, NavigationGuardSource>());
  const pendingRef = useRef<PendingTransition | null>(null);
  const guardDialogRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const closeSequenceRef = useRef(0);
  const [pending, setPending] = useState<PendingTransition | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const getDirtySource = useCallback(() => {
    const sources = Array.from(sourcesRef.current.values()).reverse();
    return sources.find((source) => source.isDirty());
  }, []);

  const executeTransition = useCallback(
    async (transition: GuardedTransition) => {
      try {
        await Promise.resolve().then(transition.run);
        return { status: "executed" } as const;
      } catch (cause) {
        const error =
          cause instanceof Error ? cause : new Error(t("orders2b1.nav.transitionFailed"));
        console.error("[navigation-guard] transition failed");
        toast.error(t("orders2b1.nav.transitionFailed"));
        return { status: "failed", error } as const;
      }
    },
    [t],
  );

  const closeGuardDialog = useCallback(
    async ({
      current,
      transition,
      focusFallback,
    }: {
      current: PendingTransition;
      transition?: GuardedTransition;
      focusFallback?: boolean;
    }) => {
      if (pendingRef.current !== current) return;
      const closingDialog = guardDialogRef.current;
      const sequence = closeSequenceRef.current + 1;
      closeSequenceRef.current = sequence;
      closingRef.current = true;
      pendingRef.current = null;
      setPending(null);
      setIsResolving(false);

      const detached = await waitForGuardDialogToClose(closingDialog);
      if (closeSequenceRef.current !== sequence) return;
      if (!detached) {
        closingRef.current = false;
        toast.error(t("orders2b1.nav.dialogCloseFailed"));
        console.error("[navigation-guard] dialog remained attached; transition cancelled");
        return;
      }
      releaseStaleBodyPointerLock();
      if (!transition) {
        closingRef.current = false;
        if (focusFallback) queueMicrotask(() => current.source.focusFallback?.());
        return;
      }
      await nextAnimationFrame();
      releaseStaleBodyPointerLock();

      const outcome = await executeTransition(transition);
      if (closeSequenceRef.current === sequence) closingRef.current = false;
      return outcome;
    },
    [executeTransition, t],
  );

  const cancelPending = useCallback(
    (focus = true) => {
      const current = pendingRef.current;
      if (!current) return;
      void closeGuardDialog({ current, focusFallback: focus });
    },
    [closeGuardDialog],
  );

  const runGuardedTransition = useCallback(
    async (transition: GuardedTransition): Promise<GuardedTransitionStartOutcome> => {
      if (closingRef.current) return { status: "ignored", reason: "guard-closing" };
      if (pendingRef.current) return { status: "ignored", reason: "transition-pending" };
      const source = getDirtySource();
      if (!source) {
        return executeTransition(transition);
      }
      if (source.isBusy()) {
        toast.info(t("orders2b1.nav.sourceBusy", { source: source.label() }));
        return { status: "ignored", reason: "source-busy" };
      }
      const next = { source, transition };
      pendingRef.current = next;
      setPending(next);
      return { status: "prompted" };
    },
    [executeTransition, getDirtySource, t],
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
      await closeGuardDialog({ current, transition: current.transition });
    },
    [closeGuardDialog, getDirtySource],
  );

  const resolveWithSave = useCallback(async () => {
    const current = pendingRef.current;
    if (!current || isResolving || current.source.isBusy()) return;
    setIsResolving(true);
    let resolution: NavigationGuardResolution;
    try {
      resolution = await current.source.save();
    } catch {
      toast.error(t("orders2b1.nav.saveFailed"));
      await closeGuardDialog({ current, focusFallback: true });
      return;
    }
    await Promise.resolve();
    if (resolution.status === "blocked" || current.source.isDirty()) {
      const focus = resolution.status === "blocked" ? resolution.focus : undefined;
      await closeGuardDialog({ current });
      queueMicrotask(() => (focus ? focus() : current.source.focusFallback?.()));
      return;
    }
    await continueOrCompleteTransition(current);
  }, [closeGuardDialog, continueOrCompleteTransition, isResolving, t]);

  const resolveWithDiscard = useCallback(async () => {
    const current = pendingRef.current;
    if (!current || isResolving || current.source.isBusy()) return;
    setIsResolving(true);
    let resolution: NavigationGuardResolution;
    try {
      resolution = await current.source.discard();
    } catch {
      toast.error(t("orders2b1.nav.discardFailed"));
      await closeGuardDialog({ current, focusFallback: true });
      return;
    }
    await Promise.resolve();
    if (resolution.status === "blocked" || current.source.isDirty()) {
      const focus = resolution.status === "blocked" ? resolution.focus : undefined;
      await closeGuardDialog({ current });
      queueMicrotask(() => (focus ? focus() : current.source.focusFallback?.()));
      return;
    }
    await continueOrCompleteTransition(current);
  }, [closeGuardDialog, continueOrCompleteTransition, isResolving, t]);

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
      void runGuardedTransition({
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
        queueMicrotask(
          () =>
            void runGuardedTransition({
              kind: "history",
              label: t("orders2b1.nav.history"),
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
  }, [getDirtySource, runGuardedTransition, t]);

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
          ref={guardDialogRef}
          data-navigation-guard-dialog="true"
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
            <AlertDialogTitle>{t("orders2b1.nav.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? pending.transition.label
                  ? t("orders2b1.nav.descriptionTo", {
                      source: pending.source.label(),
                      target: pending.transition.label,
                    })
                  : t("orders2b1.nav.descriptionAction", { source: pending.source.label() })
                : t("orders2b1.nav.handleFirst")}
            </AlertDialogDescription>
            {pending?.source.canSave?.() === false ? (
              <p className="text-sm text-status-warn-foreground" role="status">
                {pending.source.saveUnavailableReason?.() ?? t("orders2b1.nav.saveUnavailable")}
              </p>
            ) : null}
          </AlertDialogHeader>
          <p className="sr-only" aria-live="polite">
            {isResolving ? t("orders2b1.nav.resolvingLabel") : ""}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel ref={cancelRef} className="min-h-11" disabled={isResolving}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={isResolving || pending?.source.isBusy()}
              onClick={() => void resolveWithDiscard()}
            >
              {t("orders2b1.nav.discard")}
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={
                isResolving || pending?.source.isBusy() || pending?.source.canSave?.() === false
              }
              onClick={() => void resolveWithSave()}
            >
              {isResolving ? t("orders2b1.nav.resolving") : t("orders2b1.nav.saveContinue")}
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

function waitForGuardDialogToClose(node: HTMLElement | null) {
  if (!node?.isConnected) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (detached: boolean) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(fallback);
      resolve(detached);
    };
    const observer = new MutationObserver(() => {
      if (!node.isConnected) finish(true);
    });
    const fallback = window.setTimeout(() => finish(!node.isConnected), 500);
    observer.observe(document.body, { childList: true, subtree: true });
    if (!node.isConnected) finish(true);
  });
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function releaseStaleBodyPointerLock() {
  const openBlockingLayer = document.querySelector(
    [
      '[role="dialog"][data-state="open"]',
      '[role="alertdialog"][data-state="open"]',
      '[role="menu"][data-state="open"]',
      '[role="listbox"][data-state="open"]',
    ].join(", "),
  );
  if (!openBlockingLayer && document.body.style.pointerEvents === "none") {
    document.body.style.removeProperty("pointer-events");
  }
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
