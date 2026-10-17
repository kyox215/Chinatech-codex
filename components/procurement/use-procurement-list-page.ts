"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBackendState } from "@/components/backend-snapshot";
import { useActivityFeedback } from "@/components/operation-feedback";
import { mergeProcurementWindow } from "@/lib/backend/procurement-list-window";
import { backendScopeKey } from "@/lib/backend/read-plan";
import { procurementListQuery, type ProcurementListPage, type ProcurementListQuery } from "@/lib/backend/procurement-list-contract";
import { requestProcurementList } from "./procurement-read-client";
import { can } from "@/lib/staff";
export function useProcurementListPage(raw: ProcurementListQuery, returnAnchor?: string) {
  const backend = useBackendState(), member=backend.snapshot?.staff.members.find(row=>row.id===backend.snapshot?.staff.currentId);
  const scope = backend.snapshot?.procurementListEnabled && can(member,"repairs.view") ? backend.snapshot.read?.scope : undefined;
  const scopeKey = scope ? backendScopeKey(scope) : "";
  const initial = scope ? backend.snapshot?.procurementList : undefined;
  const normalized = procurementListQuery({...raw,q:raw.q.slice(0,160)}), queryKey = JSON.stringify(normalized);
  const [data, setData] = useState<{ scope: string; page: ProcurementListPage } | null>(() => initial ? { scope: scopeKey, page: initial } : null);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const active = useRef<{ key: string; controller: AbortController } | null>(null);
  const latest = useRef({ scope, scopeKey, queryKey });
  const anchor = useRef<string | undefined>(undefined);
  const loadRef = useRef<(direction?: "before"|"after"|"seek",seek?:number) => Promise<void>>(async () => {});
  const visible = data?.scope === scopeKey ? data : null;
  useActivityFeedback(pending, { kind: "read" });
  const load = useCallback(async (direction?: "before"|"after"|"seek",seek?:number) => {
    const expected = latest.current;
    const append = direction === "before" || direction === "after", seeking = direction === "seek";
    const boundary = direction === "before" ? visible?.page.previousCursor : visible?.page.nextCursor;
    if (!expected.scope || append && (!visible || !boundary || JSON.stringify(visible.page.query) !== expected.queryKey || active.current)) return;
    active.current?.controller.abort();
    const controller = new AbortController(), flight = { key: expected.scopeKey+expected.queryKey, controller }; active.current = flight;
    const isCurrent = () => active.current === flight && !controller.signal.aborted && latest.current.scopeKey === expected.scopeKey && latest.current.queryKey === expected.queryKey;
    setPending(true); setError("");
    try {
      const previous = visible?.page;
      const sameQuery = previous && JSON.stringify(previous.query) === expected.queryKey;
      // Back navigation can reuse the old RSC first page even though its URL
      // carries a deep return anchor. Authorize that window again rather than
      // treating the cached first page as the requested location.
      const missingReturn = returnAnchor && !anchor.current && !previous?.items.some(row=>row.id===returnAnchor);
      const value = await requestProcurementList(expected.scope, JSON.parse(expected.queryKey), { cursor: append ? boundary ?? undefined : undefined, known: !append && !seeking && sameQuery && !missingReturn ? previous.stateToken : undefined, seek, anchor: !append && !seeking ? missingReturn ? returnAnchor : sameQuery ? anchor.current ?? previous.items[0]?.id : undefined : undefined, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      if (!isCurrent() || "unchanged" in value) return;
      let window = (direction === "before" || direction === "after") && previous ? mergeProcurementWindow(previous,value,direction) : value;
      // Refresh the loaded window around the current visible anchor. A changed
      // generation cannot collapse a 500-row window into its first 50 rows.
      const target = !append && !seeking && sameQuery ? Math.min(500,previous.items.length) : window.items.length;
      while (!append && isCurrent() && window.items.length < target) {
        const forward = Boolean(window.nextCursor), cursor = window.nextCursor ?? window.previousCursor;
        if (!cursor) break;
        const next = await requestProcurementList(expected.scope, JSON.parse(expected.queryKey), { cursor, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        if (!isCurrent() || "unchanged" in next) return;
        window = mergeProcurementWindow(window,next,forward ? "after" : "before");
      }
      if (isCurrent()) setData({ scope: expected.scopeKey, page: window });
    } catch (reason) {
      if (!isCurrent()) return;
      if (append && typeof reason === "object" && reason && "code" in reason && reason.code === "READ_VERSION_CHANGED") {
        // A cursor belongs to one exact authorized generation. Keep current
        // content visible while re-reading the first window; never mix versions.
        active.current = null; void loadRef.current(); return;
      }
      setError(reason instanceof Error ? reason.message : "后台资料暂不可用。");
    } finally { if (active.current === flight) { active.current = null; if (!controller.signal.aborted) setPending(false); } }
  }, [visible, returnAnchor]);
  useLayoutEffect(() => { if (latest.current.scopeKey !== scopeKey || latest.current.queryKey !== queryKey) anchor.current = undefined; latest.current = { scope, scopeKey, queryKey }; loadRef.current = load; }, [scope, scopeKey, queryKey, load]);
  const hasCurrentInitial=Boolean(initial&&visible&&(!returnAnchor||initial.items.some(row=>row.id===returnAnchor))&&visible.page.stateToken===initial.stateToken&&backendScopeKey(initial.scope)===scopeKey&&JSON.stringify(visible.page.query)===queryKey);
  useEffect(() => {
    if(!scopeKey||hasCurrentInitial)return;
    let live = true;
    const timeout = setTimeout(() => { if (live) void loadRef.current(); }, 150);
    return () => { live = false; clearTimeout(timeout); active.current?.controller.abort(); active.current = null; };
  }, [scopeKey, queryKey, initial, hasCurrentInitial]);
  return { page: visible?.page ?? (initial && backendScopeKey(initial.scope) === scopeKey ? initial : null), removed: visible?.page.startIndex ?? 0, pending, error, loadMore: () => void load("after"), loadPrevious: () => void load("before"), seek: (position:number) => { if (!active.current) void load("seek",position); }, rememberAnchor: (id: string) => { anchor.current = id; }, retry: () => void load(), resetKey: scopeKey+queryKey };
}
