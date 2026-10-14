"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import styles from "./operation-feedback.module.css";

type ActivityKind = "navigation" | "read" | "submit" | "retry";
type ActivityOptions = { kind?: ActivityKind; scope?: string };
type Activity = { kind: ActivityKind; scope?: string };
type Registry = { add: (token: symbol, activity: Activity) => void; remove: (token: symbol) => void };
const RegistryContext = createContext<Registry | null>(null);
const ActivitiesContext = createContext<ReadonlyMap<symbol, Activity>>(new Map());

function isVisibleControl(element: HTMLElement) {
  if (element.closest('[hidden], [aria-hidden="true"], [data-operation-feedback="background"]')) return false;
  if (element.getClientRects().length === 0) return false;
  return getComputedStyle(element).visibility !== "hidden";
}

/** Compatibility for existing controls: only their live, rendered busy state counts. */
function BusyControlFeedback() {
  const registry = useContext(RegistryContext);
  useEffect(() => {
    if (!registry) return;
    const token = Symbol("busy-controls");
    const scan = () => {
      const busy = Array.from(document.querySelectorAll<HTMLElement>('button[aria-busy="true"], form[aria-busy="true"]')).some(isVisibleControl);
      if (busy) registry.add(token, { kind: "submit" });
      else registry.remove(token);
    };
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-busy", "hidden", "aria-hidden", "style", "class", "open", "data-operation-feedback"] });
    scan();
    return () => { observer.disconnect(); registry.remove(token); };
  }, [registry]);
  return null;
}

export function OperationFeedbackProvider({ children }: { children: ReactNode }) {
  const [activities, setActivities] = useState<ReadonlyMap<symbol, Activity>>(() => new Map());
  const add = useCallback((token: symbol, activity: Activity) => {
    setActivities(current => {
      const previous = current.get(token);
      if (previous?.kind === activity.kind && previous.scope === activity.scope) return current;
      const next = new Map(current); next.set(token, activity); return next;
    });
  }, []);
  const remove = useCallback((token: symbol) => {
    setActivities(current => {
      if (!current.has(token)) return current;
      const next = new Map(current); next.delete(token); return next;
    });
  }, []);
  const registry = useMemo(() => ({ add, remove }), [add, remove]);
  return <RegistryContext.Provider value={registry}><ActivitiesContext.Provider value={activities}><BusyControlFeedback />{children}</ActivitiesContext.Provider></RegistryContext.Provider>;
}

/** Each pending lifetime owns a token, so old cleanup cannot clear newer work. */
export function useActivityFeedback(pending: boolean, { kind = "read", scope }: ActivityOptions = {}) {
  const registry = useContext(RegistryContext);
  useEffect(() => {
    if (!pending || !registry) return;
    const token = Symbol(kind);
    registry.add(token, { kind, scope });
    return () => registry.remove(token);
  }, [pending, kind, scope, registry]);
}

export function ContentProgress({ scope, placement = "content" }: { scope?: string; placement?: "content" | "public" }) {
  const activities = useContext(ActivitiesContext);
  const active = Array.from(activities.values()).some(activity => !scope || !activity.scope || activity.scope === scope);
  return <div className={styles.progress} data-content-progress data-active={active} data-placement={placement} aria-hidden="true"><span className={styles.line} /></div>;
}
