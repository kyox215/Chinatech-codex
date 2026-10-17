"use client";

import { useBackendState } from "./backend-snapshot";
import { scopedStoreUrl } from "@/lib/store-scope";
import NextLink, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { backendSnapshot } from "@/lib/backend/client";
import { backendScopeKey } from "@/lib/backend/read-plan";
import { useLanguage } from "./language-provider";
import { useActivityFeedback, useNavigationIntent } from "./operation-feedback";

type NavigationAttempt = { token: symbol; destination: string; refresh: boolean };

function NavigationFeedback({ attempt, onSettled, icon, iconClassName, resolvedPending=false }: { attempt: NavigationAttempt | null; onSettled: (token: symbol, committed: boolean) => void; icon?: ReactNode; iconClassName?: string; resolvedPending?:boolean }) {
  const { pending: nextPending } = useLinkStatus();
  const navigation = useNavigationIntent();
  const current = Boolean(attempt && (!navigation || navigation.current === attempt.token));
  const pending = (nextPending || resolvedPending) && current;
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
export function NavigationLink({ children, icon, iconClassName, iconPosition = "start", className, prefetch = false, onClick, onNavigate, onPointerDown, onFocus, onContextMenu, onAuxClick, onNavigationComplete, focusTargetId, resolveHref, ...props }: ComponentProps<typeof NextLink> & { icon?: ReactNode; iconClassName?: string; iconPosition?: "start" | "end"; onNavigationComplete?: () => void; focusTargetId?: string; resolveHref?:(anchor:HTMLAnchorElement)=>string|null }) {
  const backend = useBackendState(),{snapshot}=backend,router=useRouter();
  const [resolvedPending,startResolvedTransition]=useTransition();
  const owner=snapshot?.read?.scope?backendScopeKey(snapshot.read.scope):"";
  const resolved=useRef<{href:string;owner:string}|null>(null);
  const previousOwner=useRef({owner,resolving:Boolean(resolveHref)});
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
  useEffect(()=>{const previous=previousOwner.current,resolving=Boolean(resolveHref);if((previous.resolving||resolving)&&(previous.owner!==owner||previous.resolving!==resolving)){resolved.current=null;const attempt=liveAttempt.current;if(attempt)settled(attempt.token,false);}previousOwner.current={owner,resolving};},[owner,resolveHref,settled]);
  function currentOwner(){const scope=backendSnapshot()?.read?.scope;return scope?backendScopeKey(scope):"";}
  function prepare(anchor:HTMLAnchorElement){
    if(!resolveHref)return true;
    resolved.current=null;
    if(backend.formal&&(!backend.active||!owner||currentOwner()!==owner))return false;
    try{const raw=resolveHref(anchor);if(typeof raw!=="string"||!raw.startsWith("/")||raw.startsWith("//"))return false;
      const url=new URL(raw,window.location.origin);if(url.origin!==window.location.origin||url.username||url.password)return false;
      if(snapshot?.storeId&&url.pathname.startsWith('/app/')){const requested=url.searchParams.get('storeId');if(requested&&requested!==snapshot.storeId)return false;url.searchParams.set('storeId',snapshot.storeId);}
      if(backend.formal&&currentOwner()!==owner)return false;
      anchor.href=url.href;resolved.current={href:url.href,owner};return true;
    }catch{return false;}
  }
  const feedback = <NavigationFeedback attempt={attempt} onSettled={settled} icon={icon} iconClassName={iconClassName} resolvedPending={resolvedPending} />;
  return <NextLink {...props} prefetch={prefetch} data-navigation-icon={Boolean(icon)} className={[className, "navigation-link"].filter(Boolean).join(" ")} onPointerDown={event=>{if(resolveHref)prepare(event.currentTarget);onPointerDown?.(event);}} onFocus={event=>{if(resolveHref)prepare(event.currentTarget);onFocus?.(event);}} onContextMenu={event=>{if(resolveHref)prepare(event.currentTarget);onContextMenu?.(event);}} onAuxClick={event=>{if(resolveHref&&!prepare(event.currentTarget))event.preventDefault();onAuxClick?.(event);}} onClick={event => { if(resolveHref&&!prepare(event.currentTarget)){event.preventDefault();return;}onClick?.(event); clickedHref.current = event.currentTarget.href; }} onNavigate={event => {
    let prevented = false;
    onNavigate?.({ preventDefault: () => { prevented = true; event.preventDefault(); } });
    if (prevented) return;
    if(resolveHref&&(!resolved.current||resolved.current.owner!==owner||backend.formal&&currentOwner()!==owner)){event.preventDefault();return;}
    const next = { token: Symbol("navigation"), destination: clickedHref.current, refresh: clickedHref.current === window.location.href };
    navigation?.start(next.token);
    liveAttempt.current = next; setAttempt(next);
    if(resolveHref){event.preventDefault();const href=resolved.current!.href;startResolvedTransition(()=>{if(props.replace)router.replace(href,{scroll:props.scroll});else router.push(href,{scroll:props.scroll});});}
  }}>{icon && iconPosition === "start" ? feedback : null}{children}{!icon || iconPosition === "end" ? feedback : null}</NextLink>;
}
