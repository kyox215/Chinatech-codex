"use client";

import { useBackendState } from "./backend-snapshot";
import { scopedStoreUrl } from "@/lib/store-scope";
import NextLink, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useLanguage } from "./language-provider";
import { useActivityFeedback, useNavigationIntent } from "./operation-feedback";

type NavigationAttempt = { token: symbol; destination: string; refresh: boolean };

function NavigationFeedback({ attempt, onSettled, icon, iconClassName }: { attempt: NavigationAttempt | null; onSettled: (token: symbol, committed: boolean) => void; icon?: ReactNode; iconClassName?: string }) {
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
    // A same-URL click can refresh dynamic segments. Its unchanged URL is not a receipt.
    if ((!attempt.refresh && committed) || observed.current.pending) { observed.current = null; onSettled(attempt.token, committed); }
  }, [pending, pathname, attempt, current, onSettled]);
  return <><span className={["navigation-feedback", iconClassName].filter(Boolean).join(" ")} data-pending={pending} data-has-icon={Boolean(icon)} aria-hidden="true">{icon ? <span className="navigation-feedback__icon">{icon}</span> : null}<LoaderCircle size={16} className="spin" /></span><span className="sr-only" aria-live="polite" aria-atomic="true" role={pending ? "status" : undefined}>{pending ? t("正在打开页面…") : ""}</span></>;
}

/** Next supplies real pending; the latest click owns its presentation. */
export function NavigationLink({ children, icon, iconClassName, iconPosition = "start", className, prefetch = false, onClick, onNavigate, onNavigationComplete, focusTargetId, ...props }: ComponentProps<typeof NextLink> & { icon?: ReactNode; iconClassName?: string; iconPosition?: "start" | "end"; onNavigationComplete?: () => void; focusTargetId?: string }) {
  const { snapshot } = useBackendState();
  if(typeof props.href === "string") props.href=scopedStoreUrl(props.href,snapshot?.storeId);
  const clickedHref = useRef("");
  const [attempt, setAttempt] = useState<NavigationAttempt | null>(null);
  const liveAttempt = useRef<NavigationAttempt | null>(null);
  const navigation = useNavigationIntent();
  const finish = navigation?.finish;
  const settled = useCallback((token: symbol, committed: boolean) => {
    if (liveAttempt.current?.token !== token) return;
    liveAttempt.current = null; setAttempt(null); finish?.(token);
    if (committed) {
      if (focusTargetId) document.getElementById(focusTargetId)?.focus({ preventScroll: true });
      onNavigationComplete?.();
    }
  }, [finish, onNavigationComplete, focusTargetId]);
  const token = attempt?.token;
  useEffect(() => () => { if (token) finish?.(token); }, [token, finish]);
  const feedback = <NavigationFeedback attempt={attempt} onSettled={settled} icon={icon} iconClassName={iconClassName} />;
  return <NextLink {...props} prefetch={prefetch} data-navigation-icon={Boolean(icon)} className={[className, "navigation-link"].filter(Boolean).join(" ")} onClick={event => { onClick?.(event); clickedHref.current = event.currentTarget.href; }} onNavigate={event => {
    let prevented = false;
    onNavigate?.({ preventDefault: () => { prevented = true; event.preventDefault(); } });
    if (prevented) return;
    const next = { token: Symbol("navigation"), destination: clickedHref.current, refresh: clickedHref.current === window.location.href };
    navigation?.start(next.token);
    liveAttempt.current = next; setAttempt(next);
  }}>{icon && iconPosition === "start" ? feedback : null}{children}{!icon || iconPosition === "end" ? feedback : null}</NextLink>;
}
