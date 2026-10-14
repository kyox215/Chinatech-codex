"use client";

import NextLink, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { useLanguage } from "./language-provider";
import { useActivityFeedback } from "./operation-feedback";

function NavigationFeedback({ destination, onSettled }: { destination: string | null; onSettled: (committed: boolean) => void }) {
  const { pending } = useLinkStatus();
  const pathname = usePathname();
  const wasPending = useRef(false);
  const { t } = useLanguage();
  useActivityFeedback(pending, { kind: "navigation" });
  useEffect(() => {
    if (pending) { wasPending.current = true; return; }
    if (!destination) return;
    const committed = window.location.href === destination;
    if (committed || wasPending.current) { wasPending.current = false; onSettled(committed); }
  }, [pending, pathname, destination, onSettled]);
  return <><span className="navigation-feedback" data-pending={pending} aria-hidden="true"><LoaderCircle size={14} className="spin" /></span><span className="sr-only" aria-live="polite" aria-atomic="true" role={pending ? "status" : undefined}>{pending ? t("正在打开页面…") : ""}</span></>;
}

/** Next owns navigation cancellation and completion; no timers invent progress. */
export function NavigationLink({ children, className, prefetch = false, onClick, onNavigate, onNavigationComplete, ...props }: ComponentProps<typeof NextLink> & { onNavigationComplete?: () => void }) {
  const clickedHref = useRef("");
  const [destination, setDestination] = useState<string | null>(null);
  const settled = useCallback((committed: boolean) => { setDestination(null); if (committed) onNavigationComplete?.(); }, [onNavigationComplete]);
  return <NextLink {...props} prefetch={prefetch} className={[className, "navigation-link"].filter(Boolean).join(" ")} onClick={event => { onClick?.(event); clickedHref.current = event.currentTarget.href; }} onNavigate={event => {
    let prevented = false;
    onNavigate?.({ preventDefault: () => { prevented = true; event.preventDefault(); } });
    if (!prevented && onNavigationComplete) setDestination(clickedHref.current);
  }}>{children}<NavigationFeedback destination={destination} onSettled={settled} /></NextLink>;
}
