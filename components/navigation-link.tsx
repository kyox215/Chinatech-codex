"use client";

import NextLink, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { useLanguage } from "./language-provider";
import { useActivityFeedback, useNavigationIntent } from "./operation-feedback";

type NavigationAttempt = { token: symbol; destination: string };

function NavigationFeedback({ attempt, onSettled }: { attempt: NavigationAttempt | null; onSettled: (token: symbol, committed: boolean) => void }) {
  const { pending: nextPending } = useLinkStatus();
  const navigation = useNavigationIntent();
  const current = Boolean(attempt && (!navigation || navigation.current === attempt.token));
  const pending = nextPending && current;
  const pathname = usePathname();
  const observed = useRef<{ token: symbol; pending: boolean } | null>(null);
  const { t } = useLanguage();
  useActivityFeedback(pending, { kind: "navigation" });
  useEffect(() => {
    if (!attempt) { observed.current = null; return; }
    if (!current) { onSettled(attempt.token, false); return; }
    if (observed.current?.token !== attempt.token) observed.current = { token: attempt.token, pending: false };
    if (pending) { observed.current.pending = true; return; }
    const committed = window.location.href === attempt.destination;
    if (committed || observed.current.pending) { observed.current = null; onSettled(attempt.token, committed); }
  }, [pending, pathname, attempt, current, onSettled]);
  return <><span className="navigation-feedback" data-pending={pending} aria-hidden="true"><LoaderCircle size={14} className="spin" /></span><span className="sr-only" aria-live="polite" aria-atomic="true" role={pending ? "status" : undefined}>{pending ? t("正在打开页面…") : ""}</span></>;
}

/** Next supplies real pending; the latest click owns its presentation. */
export function NavigationLink({ children, className, prefetch = false, onClick, onNavigate, onNavigationComplete, ...props }: ComponentProps<typeof NextLink> & { onNavigationComplete?: () => void }) {
  const clickedHref = useRef("");
  const [attempt, setAttempt] = useState<NavigationAttempt | null>(null);
  const liveAttempt = useRef<NavigationAttempt | null>(null);
  const navigation = useNavigationIntent();
  const finish = navigation?.finish;
  const settled = useCallback((token: symbol, committed: boolean) => {
    if (liveAttempt.current?.token !== token) return;
    liveAttempt.current = null; setAttempt(null); finish?.(token);
    if (committed) onNavigationComplete?.();
  }, [finish, onNavigationComplete]);
  const token = attempt?.token;
  useEffect(() => () => { if (token) finish?.(token); }, [token, finish]);
  return <NextLink {...props} prefetch={prefetch} className={[className, "navigation-link"].filter(Boolean).join(" ")} onClick={event => { onClick?.(event); clickedHref.current = event.currentTarget.href; }} onNavigate={event => {
    let prevented = false;
    onNavigate?.({ preventDefault: () => { prevented = true; event.preventDefault(); } });
    if (prevented) return;
    const next = { token: Symbol("navigation"), destination: clickedHref.current };
    navigation?.start(next.token);
    const destination = new URL(next.destination, window.location.href);
    if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search) {
      liveAttempt.current = null; setAttempt(null); finish?.(next.token); onNavigationComplete?.(); return;
    }
    liveAttempt.current = next; setAttempt(next);
  }}>{children}<NavigationFeedback attempt={attempt} onSettled={settled} /></NextLink>;
}
