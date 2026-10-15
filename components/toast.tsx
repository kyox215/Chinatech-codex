"use client";

import { CheckCircle2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "./language-provider";
import styles from "./toast.module.css";

type Entry = { token: symbol; priority: "local" | "global"; dismiss: () => void; noticeId?: string | number; deadline?: number };
const identities = new WeakMap<object, string>();
let identitySequence = 0;
/** Stable for the same retained feedback, fresh for a new preview acknowledgement. */
export function toastNoticeId(notice: object & { requestId?: string }) {
  if (notice.requestId) return notice.requestId;
  let id = identities.get(notice);
  if (!id) { id = `preview-notice:${++identitySequence}`; identities.set(notice, id); }
  return id;
}
const ToastContext = createContext<{ selected?: symbol; register: (entry: Entry, noticeId?: string | number) => () => void; dismiss: (token: symbol) => void } | null>(null);
function selected(entries: Entry[]) { return entries.filter(entry => entry.priority === "local").at(-1) ?? entries.at(-1); }

/** One visible acknowledgement; local feedback takes precedence over the global receipt fallback. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const current = useRef<Entry[]>([]);
  const seen = useRef(new Set<string | number>());
  const deadlines = useRef(new Map<symbol | string | number, number>());
  const register = useCallback((entry: Entry, noticeId?: string | number) => {
    if (noticeId !== undefined && seen.current.has(noticeId)) return () => {};
    const key = noticeId ?? entry.token;
    const deadline = deadlines.current.get(key) ?? Date.now() + 1800;
    deadlines.current.set(key, deadline);
    if (deadline <= Date.now()) { if (noticeId !== undefined) seen.current.add(noticeId); return () => {}; }
    const previous = current.current.filter(item => (item.noticeId ?? item.token) !== key);
    current.current = [...current.current.filter(item => (item.noticeId ?? item.token) === key), { ...entry, noticeId, deadline }]; setEntries(current.current);
    // New operations replace older acknowledgements. Only duplicates of this event share dismissal.
    previous.forEach(item => { if (item.noticeId !== undefined) seen.current.add(item.noticeId); item.dismiss(); });
    return () => { current.current = current.current.filter(item => item.token !== entry.token); setEntries(current.current); };
  }, []);
  const dismiss = useCallback((token: symbol) => {
    if (selected(current.current)?.token !== token) return;
    const previous = current.current; current.current = []; setEntries([]);
    previous.forEach(entry => { if (entry.noticeId !== undefined) seen.current.add(entry.noticeId); entry.dismiss(); });
  }, []);
  const winningEntry = selected(entries);
  const winner = winningEntry?.token;
  const deadline = winningEntry?.deadline;
  useEffect(() => {
    if (!winner) return;
    const timer = window.setTimeout(() => dismiss(winner), Math.max(0, (deadline ?? Date.now() + 1800) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [winner, deadline, dismiss]);
  const value = useMemo(() => ({ selected: winner, register, dismiss }), [winner, register, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

type ToastProps = { message: string; noticeId?: string | number; onDismiss?: () => void; priority?: "local" | "global" };
/** A confirmed acknowledgement only. Recovery actions and errors stay with their owner. */
export function Toast(props: ToastProps) { return props.message ? <ToastMessage key={props.noticeId ?? props.message} {...props} /> : null; }

function ToastMessage({ message, noticeId, onDismiss, priority = "local" }: ToastProps) {
  const { t } = useLanguage();
  const registry = useContext(ToastContext);
  const register = registry?.register;
  const [token] = useState(() => Symbol("toast"));
  const [visible, setVisible] = useState(true);
  const anchor = useRef<HTMLSpanElement>(null);
  const callback = useRef(onDismiss);
  useEffect(() => { callback.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    let consumed = false;
    const dismiss = () => { consumed = true; setVisible(false); callback.current?.(); };
    if (register) {
      let release: (() => void) | undefined;
      const update = () => {
        let parent = anchor.current?.parentElement;
        let shown = !consumed && Boolean(parent?.isConnected);
        while (parent && shown) {
          const style = getComputedStyle(parent);
          if (parent.hidden || parent.inert || parent.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden") shown = false;
          parent = parent.parentElement;
        }
        if (shown && !release) release = register({ token, priority, dismiss }, noticeId);
        else if (!shown && release) { release(); release = undefined; }
      };
      const observer = new MutationObserver(update);
      observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["hidden", "inert", "aria-hidden", "class", "style", "open"] });
      update();
      return () => { observer.disconnect(); release?.(); };
    }
    const timer = window.setTimeout(dismiss, 1800);
    return () => window.clearTimeout(timer);
  }, [register, token, priority, noticeId]);
  return <><span hidden ref={anchor} data-toast-anchor />{visible && (!registry || registry.selected === token) ? <div className={styles.toast} data-toast role="status" aria-live="polite"><button type="button" className={styles.dismiss} aria-label={`${message} · ${t("关闭操作提示")}`} onClick={() => { if (registry) registry.dismiss(token); else { setVisible(false); callback.current?.(); } }}><CheckCircle2 size={18} className={styles.icon} aria-hidden="true" /><span>{message}</span><X size={16} aria-hidden="true" /></button></div> : null}</>;
}
