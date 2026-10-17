"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useBackendState } from "./backend-snapshot";
import { useLanguage } from "./language-provider";
import { useStaff } from "./staff/use-staff";

export const listPageSize = 50;
/** Presentation only: filtering and counts still use the full authorized dataset. */
export function useListWindow(total: number, filterKey: string) {
  const backend = useBackendState();
  const staff = useStaff();
  const key = JSON.stringify([backend.snapshot?.storeId, staff.member?.id, staff.member?.revision, filterKey]);
  const [window, setWindow] = useState({ key, limit: listPageSize });
  if (window.key !== key) setWindow({ key, limit: listPageSize });
  const limit = window.key === key ? window.limit : listPageSize;
  return { limit, loadMore: () => setWindow({ key, limit: Math.min(total, limit + listPageSize) }), resetKey: key };
}

/** Existing list footer, with one append per new bottom-boundary entry. */
export function ListPagination({ start = 0, shown, total, hasMore, onLoadMore, loading = false, disabled = false, error = false, resetKey = "", label }: {
  start?: number; shown: number; total?: number; hasMore: boolean; onLoadMore: () => void;
  loading?: boolean; disabled?: boolean; error?: boolean; resetKey?: string; label?: string;
}) {
  const { t } = useLanguage();
  const sentinel = useRef<HTMLDivElement>(null);
  const entered = useRef(false);
  const dispatched = useRef(false);
  const loadAtBoundary = useEffectEvent(() => {
    if (!entered.current || dispatched.current || !hasMore || loading || disabled || error) return;
    // A busy boundary remains an intent until it can actually be dispatched.
    // This is consumed before the callback so a still-visible footer cannot
    // drain the next batch when its loading prop returns to false.
    dispatched.current = true;
    onLoadMore();
  });
  const active = shown > 0 || hasMore;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    entered.current = false;
    dispatched.current = false;
    const observer = new IntersectionObserver(entries => {
      const entry = entries.at(-1);
      if (!entry) return;
      const wasInside = entered.current;
      entered.current = entry.isIntersecting;
      if (!entry.isIntersecting || !wasInside) dispatched.current = false;
      if (entry.isIntersecting && !wasInside) loadAtBoundary();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [resetKey, active]);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || loading || disabled || error || !hasMore || !entered.current || dispatched.current || typeof IntersectionObserver === "undefined") return;
    // Recheck actual clipping after React inserts rows or releases a busy
    // state. A stale pre-render intersection must not load an offscreen footer.
    const observer = new IntersectionObserver(entries => {
      if (entries.at(-1)?.isIntersecting) loadAtBoundary();
      observer.disconnect();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, disabled, error, hasMore]);
  if (!shown && !hasMore) return null;
  return <div ref={sentinel} className="list-pagination" role="region" aria-label={label || t("列表加载")}>
    <span role="status">{start > 0 && total !== undefined ? t("当前窗口 {v0}–{v1} / {v2} 条", { v0:start+1,v1:shown,v2:total }) : total === undefined ? t("已显示 {v0} 条", { v0: shown }) : t("已显示 {v0} / {v1} 条", { v0: shown, v1: total })}{!hasMore ? ` · ${t("已全部显示")}` : ""}</span>
    {hasMore ? <button type="button" className="button button--secondary" disabled={loading || disabled} aria-busy={loading} onClick={() => { entered.current = true; dispatched.current = true; onLoadMore(); }}>{t(error ? "重试加载" : "加载更多")}</button> : null}
  </div>;
}
