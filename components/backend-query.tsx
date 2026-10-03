"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useBackendMode, useBackendState } from "@/lib/backend/react";
import { backendSnapshot, requestBackendScope } from "@/lib/backend/client";

const temporaryScopes: { scope: string }[] = [];
const scopeListeners = new Set<() => void>();
const subscribeScopes = (listener: () => void) => { scopeListeners.add(listener); return () => { scopeListeners.delete(listener); }; };
const temporaryScope = () => temporaryScopes.at(-1)?.scope ?? "";
const notifyScopes = () => scopeListeners.forEach(listener => listener());

/** A modal owns a temporary query only until close; navigation/identity changes win. */
export function beginTemporaryPageScope(scope: string, previous = backendSnapshot()) {
  const location = window.location.href;
  const lease = { scope }; temporaryScopes.push(lease); notifyScopes();
  return () => {
    const index = temporaryScopes.indexOf(lease); if (index < 0) return;
    const owned = temporaryScopes.at(-1) === lease; temporaryScopes.splice(index, 1); notifyScopes();
    const current = backendSnapshot();
    if (!owned || !previous || !current || current.storeId !== previous.storeId || current.staff.currentId !== previous.staff.currentId || window.location.href !== location) return;
    // Don't take over a page/filter which changed while the modal was closing.
    if (current.scope !== scope && current.scope !== previous.scope) return;
    const target = temporaryScope() || previous.scope;
    if (target && target !== scope) void requestBackendScope(target).catch(() => {});
  };
}
export function usePageQuery(scope: string, enabled = true) {
  const backend = useBackendMode(); const state = useBackendState();
  const overlay = useSyncExternalStore(subscribeScopes, temporaryScope, () => "");
  const suspended = Boolean(overlay && overlay !== scope);
  const [status, setStatus] = useState({ scope, loading: false, error: "" });
  useEffect(() => {
    if (!backend || !enabled || suspended) return;
    let active = true;
    if (state?.scope === scope) return;
    queueMicrotask(() => { if (active) setStatus({ scope, loading: true, error: "" }); });
    void requestBackendScope(scope).then(() => { if (active) setStatus({ scope, loading: false, error: "" }); }).catch(error => { if (active) setStatus({ scope, loading: false, error: error instanceof Error ? error.message : "读取失败，请重试。" }); });
    return () => { active = false; };
    // Query versions are controlled by refreshBackend; modal release reactivates the parent query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, scope, enabled, suspended]);
  const error = backend && enabled && status.scope === scope ? status.error : "";
  return { backend, state, loading: backend && enabled && !suspended && !error && (state?.scope !== scope || status.scope === scope && status.loading), error, retry: async () => { if (!enabled || suspended) return; setStatus({ scope, loading: true, error: "" }); try { await requestBackendScope(scope); setStatus({ scope, loading: false, error: "" }); } catch (error) { setStatus({ scope, loading: false, error: error instanceof Error ? error.message : "读取失败，请重试。" }); } } };
}
export function useTemporaryPageQuery(scope: string | null) {
  const backend = useBackendMode();
  const initial = useBackendState(); const [origin] = useState(initial);
  useEffect(() => { if (backend && scope) return beginTemporaryPageScope(scope, origin); }, [backend, scope, origin]);
  return usePageQuery(scope ?? "", Boolean(scope));
}
export function QueryNotice({ query }: { query: ReturnType<typeof usePageQuery> }) {
  return query.loading ? <p className="section-empty" role="status">正在核对查询结果…</p> : query.error ? <div className="form-error" role="alert">{query.error} <button type="button" className="button button--secondary" onClick={() => void query.retry().catch(() => {})}>重试读取</button></div> : null;
}
export function PageControls({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (page: number) => void }) {
  return pageCount > 1 ? <nav className="query-pagination" aria-label="记录分页"><span role="status">第 {page} / {pageCount} 页 · 每页50条</span><button type="button" className="button button--secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>上一页</button><button type="button" className="button button--secondary" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>下一页</button></nav> : null;
}
