"use client";
import { flushSync } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBackendState } from "@/components/backend-snapshot";
import { useActivityFeedback } from "@/components/operation-feedback";
import { mergeCustomerWindow } from "@/lib/backend/customer-list-window";
import { backendSnapshot, clearBackend } from "@/lib/backend/client";
import { backendScopeKey, type BackendReadScope } from "@/lib/backend/read-plan";
import { customerListQuery, type CustomerListPage, type CustomerListQuery } from "@/lib/backend/customer-list-contract";
import { can } from "@/lib/staff";

export async function requestCustomerList(scope: BackendReadScope, query: CustomerListQuery, options: { cursor?: string; known?: string; anchor?: string; seek?: number; signal?: AbortSignal } = {}) {
  const params = new URLSearchParams({ q: query.q, mode: query.mode });
  if (options.seek !== undefined) params.set("seek",String(options.seek));
  if (options.anchor) params.set("anchor",options.anchor);
  if (options.cursor) params.set("cursor", options.cursor);
  if (options.known) params.set("known", options.known);
  const response = await fetch("/api/backend/v2/customers?"+params, { cache: "no-store", headers: { "x-ct-store-id": scope.storeId, "x-ct-read-scope": backendScopeKey(scope) }, signal: options.signal });
  const before = backendSnapshot()?.read?.scope;
  if (!before || backendScopeKey(before) !== backendScopeKey(scope)) throw new Error("登录身份或页面版本已变化，请刷新后重新核对。" );
  if (response.status === 401 || response.status === 403) {
    flushSync(()=>clearBackend());
    window.location.assign(response.status === 401 ? "/login" : "/account/pending");
  }
  const payload = await response.json();
  const current = backendSnapshot()?.read?.scope;
  if (!current || backendScopeKey(current) !== backendScopeKey(scope)) throw new Error("登录身份或页面版本已变化，请刷新后重新核对。");
  if (payload.code === "IDENTITY_CHANGED") { flushSync(()=>clearBackend()); window.location.reload(); }
  if (!response.ok) throw Object.assign(new Error(payload.message || "后台资料暂不可用。"), { code: payload.code, status: response.status });
  if (payload.unchanged === true) return payload as { unchanged: true; stateToken: string };
  if (!payload.scope || backendScopeKey(payload.scope) !== backendScopeKey(scope) || payload.query?.q !== query.q || payload.query?.mode !== query.mode || !Array.isArray(payload.items) || payload.items.length > (query.mode === "directory" ? 50 : 12)) throw new Error("后台资料暂不可用。");
  return payload as CustomerListPage;
}
export function useCustomerListPage(query: string, mode: CustomerListQuery["mode"] = "directory", returnAnchor?: string) {
  const backend = useBackendState(), member=backend.snapshot?.staff.members.find(row=>row.id===backend.snapshot?.staff.currentId);
  const scope = backend.snapshot?.customerListEnabled && can(member,"customers.view") ? backend.snapshot.read?.scope : undefined;
  const scopeKey = scope ? backendScopeKey(scope) : "";
  const initial = scope && mode === "directory" ? backend.snapshot?.customerList : undefined;
  const normalized = customerListQuery(query.slice(0,160), mode), queryKey = JSON.stringify(normalized);
  const [data, setData] = useState<{ scope: string; page: CustomerListPage } | null>(() => initial ? { scope: scopeKey, page: initial } : null);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const active = useRef<{ key: string; controller: AbortController } | null>(null);
  const latest = useRef({ scope, scopeKey, queryKey });
  const anchor = useRef<string | undefined>(undefined);
  const loadRef = useRef<(direction?: "before"|"after"|"seek",seek?:number) => Promise<void>>(async () => {});
  const visible = data?.scope === scopeKey && (mode === "directory" || JSON.stringify(data.page.query) === queryKey) ? data : null;
  useActivityFeedback(pending, { kind: "read" });
  const load = useCallback(async (direction?: "before"|"after"|"seek",seek?:number) => {
    const expected = latest.current;
    const append = direction === "before" || direction === "after", seeking = direction === "seek";
    const boundary = direction === "before" ? visible?.page.previousCursor : visible?.page.nextCursor;
    if (!expected.scope || append && (!visible || !boundary || JSON.stringify(visible.page.query) !== expected.queryKey || active.current)) return;
    if (mode === "phone" && JSON.parse(expected.queryKey).q.replace(/\D/g, "").length < 3) { setPending(false); return; }
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
      const missingReturn = mode === "directory" && returnAnchor && !anchor.current && !previous?.items.some(row=>row.phone===returnAnchor);
      const value = await requestCustomerList(expected.scope, JSON.parse(expected.queryKey), { cursor: append ? boundary ?? undefined : undefined, known: !append && !seeking && sameQuery && !missingReturn ? previous.stateToken : undefined, seek, anchor: !append && !seeking && mode === "directory" ? missingReturn ? returnAnchor : sameQuery ? anchor.current ?? previous.items[0]?.phone : undefined : undefined, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      if (!isCurrent() || "unchanged" in value) return;
      let window = (direction === "before" || direction === "after") && previous ? mergeCustomerWindow(previous,value,direction) : value;
      // Refresh the loaded window around the current visible anchor. A changed
      // generation cannot collapse a 500-row window into its first 50 rows.
      const target = !append && !seeking && sameQuery ? Math.min(500,previous.items.length) : window.items.length;
      while (!append && isCurrent() && window.items.length < target) {
        const forward = Boolean(window.nextCursor), cursor = window.nextCursor ?? window.previousCursor;
        if (!cursor) break;
        const next = await requestCustomerList(expected.scope, JSON.parse(expected.queryKey), { cursor, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        if (!isCurrent() || "unchanged" in next) return;
        window = mergeCustomerWindow(window,next,forward ? "after" : "before");
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
  }, [visible, mode, returnAnchor]);
  useLayoutEffect(() => { if (latest.current.scopeKey !== scopeKey || latest.current.queryKey !== queryKey) anchor.current = undefined; latest.current = { scope, scopeKey, queryKey }; loadRef.current = load; }, [scope, scopeKey, queryKey, load]);
  const hasCurrentInitial=Boolean(initial&&visible&&(!returnAnchor||initial.items.some(row=>row.phone===returnAnchor))&&visible.page.stateToken===initial.stateToken&&backendScopeKey(initial.scope)===scopeKey&&JSON.stringify(visible.page.query)===queryKey);
  useEffect(() => {
    if(!scopeKey||hasCurrentInitial)return;
    let live = true;
    const timeout = setTimeout(() => { if (live) void loadRef.current(); }, 150);
    return () => { live = false; clearTimeout(timeout); active.current?.controller.abort(); active.current = null; };
  }, [scopeKey, queryKey, initial, hasCurrentInitial]);
  return { page: visible?.page ?? (initial && backendScopeKey(initial.scope) === scopeKey ? initial : null), removed: visible?.page.startIndex ?? 0, pending, error, loadMore: () => void load("after"), loadPrevious: () => void load("before"), seek: (position:number) => { if (!active.current) void load("seek",position); }, rememberAnchor: (phone: string) => { anchor.current = phone; }, retry: () => void load(), resetKey: scopeKey+queryKey };
}
