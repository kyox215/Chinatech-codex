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
  const loadAtBoundary = useEffectEvent(() => { if (hasMore && !loading && !disabled && !error) onLoadMore(); });
  const active = shown > 0 || hasMore;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    entered.current = false;
    const observer = new IntersectionObserver(entries => {
      const entry = entries.at(-1);
      if (!entry) return;
      const wasInside = entered.current;
      entered.current = entry.isIntersecting;
      // A footer that stays visible must not recursively drain every batch.
      if (entry.isIntersecting && !wasInside) loadAtBoundary();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [resetKey, active]);
  if (!shown && !hasMore) return null;
  return <div ref={sentinel} className="list-pagination" role="region" aria-label={label || t("列表加载")}>
    <span role="status">{start > 0 && total !== undefined ? t("当前窗口 {v0}–{v1} / {v2} 条", { v0:start+1,v1:shown,v2:total }) : total === undefined ? t("已显示 {v0} 条", { v0: shown }) : t("已显示 {v0} / {v1} 条", { v0: shown, v1: total })}{!hasMore ? ` · ${t("已全部显示")}` : ""}</span>
    {hasMore ? <button type="button" className="button button--secondary" disabled={loading || disabled} aria-busy={loading} onClick={onLoadMore}>{t(error ? "重试加载" : "加载更多")}</button> : null}
  </div>;
}
