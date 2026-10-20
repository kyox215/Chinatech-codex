"use client";
import{useCallback,useEffect,useLayoutEffect,useRef,useState}from'react';
import{useActivityFeedback}from'./operation-feedback';
import{backendScopeKey,type BackendReadScope}from'@/lib/backend/read-plan';
type SummaryPage<Item>={formatVersion:number;scope:BackendReadScope;stateToken:string;query:unknown;items:Item[];startIndex:number;total:number;previousCursor:string|null;nextCursor:string|null;windowExtent?:number};
type ReadOptions={cursor?:string;known?:string;anchor?:string;seek?:number;signal?:AbortSignal};
/** Single-query list ownership shared by bounded summary domains. Domain
 * authorization, normalization, cursor format and merge rules stay with callers. */
export function useSummaryListPage<Query extends{q:string},Item extends{id:string},Page extends SummaryPage<Item>>({scope,initial,query,returnAnchor,invalidQuery=false,formatVersion,rowKey,request,merge}:{scope?:BackendReadScope;initial?:Page;query:Query;returnAnchor?:string;invalidQuery?:boolean;formatVersion:number;rowKey:(item:Item)=>string;request:(scope:BackendReadScope,query:Query,options:ReadOptions)=>Promise<Page|{unchanged:true;stateToken:string}>;merge:(current:Page,incoming:Page,direction:'before'|'after')=>Page}){
  const scopeKey = scope ? backendScopeKey(scope) : "";
  const queryKey=JSON.stringify(query);
  const [data, setData] = useState<{ scope: string; page: Page } | null>(() => initial ? { scope: scopeKey, page: initial } : null);
  const requestKey=JSON.stringify([scopeKey,queryKey,invalidQuery,formatVersion]);
  const [status,setStatus]=useState({key:requestKey,pending:false,error:""});
  // Reset only this hook's presentation before rendering a different read
  // owner. Cancellation itself happens in layout, before a late microtask.
  if(status.key!==requestKey)setStatus({key:requestKey,pending:false,error:""});
  const pending=status.key===requestKey&&status.pending,error=status.key===requestKey?status.error:"";
  const active = useRef<{ key: string; controller: AbortController } | null>(null);
  const latest = useRef({ scope, scopeKey, queryKey,requestKey,invalidQuery });
  const anchor = useRef<string | undefined>(undefined);
  const loadRef = useRef<(direction?: "before"|"after"|"seek",seek?:number) => Promise<void>>(async () => {});
  const visible = data?.scope === scopeKey&&data.page.formatVersion===formatVersion ? data : null;
  useActivityFeedback(pending&&!invalidQuery, { kind: "read" });
  const load = useCallback(async (direction?: "before"|"after"|"seek",seek?:number) => {
    const expected = latest.current;
    const append = direction === "before" || direction === "after", seeking = direction === "seek";
    const boundary = direction === "before" ? visible?.page.previousCursor : visible?.page.nextCursor;
    if (expected.invalidQuery||!expected.scope || append && (!visible || !boundary || JSON.stringify(visible.page.query) !== expected.queryKey || active.current)) return;
    active.current?.controller.abort();
    const controller = new AbortController(), flight = { key: expected.requestKey, controller }; active.current = flight;
    const isCurrent = () => active.current === flight && !controller.signal.aborted && latest.current.requestKey===expected.requestKey&&!latest.current.invalidQuery;
    setStatus({key:expected.requestKey,pending:true,error:""});
    try {
      const previous = visible?.page;
      const sameQuery = previous && JSON.stringify(previous.query) === expected.queryKey;
      // Back navigation can reuse the old RSC first page even though its URL
      // carries a deep return anchor. Authorize that window again rather than
      // treating the cached first page as the requested location.
      const missingReturn = returnAnchor && !anchor.current && !previous?.items.some(row=>rowKey(row)===returnAnchor);
      const value = await request(expected.scope, JSON.parse(expected.queryKey), { cursor: append ? boundary ?? undefined : undefined, known: !append && !seeking && sameQuery && !missingReturn ? previous.stateToken : undefined, seek, anchor: !append && !seeking ? missingReturn ? returnAnchor : sameQuery ? anchor.current ?? (previous.items[0]?rowKey(previous.items[0]):undefined) : undefined : undefined, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      if (!isCurrent() || "unchanged" in value) return;
      let window = (direction === "before" || direction === "after") && previous ? merge(previous,value,direction) : value;
      // Refresh the loaded window around the current visible anchor. A changed
      // generation cannot collapse a 500-row window into its first 50 rows.
      const target = !append && !seeking && sameQuery ? Math.min(500,previous.items.length) : window.items.length;
      let responses=1;
      while (!append && isCurrent() && window.items.length < target && responses<10) {
        const forward = Boolean(window.nextCursor), cursor = window.nextCursor ?? window.previousCursor;
        if (!cursor) break;
        const next = await request(expected.scope, JSON.parse(expected.queryKey), { cursor, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        if (!isCurrent() || "unchanged" in next) return;
        window = merge(window,next,forward ? "after" : "before");
        responses++;
      }
      if(sameQuery)window={...window,windowExtent:Math.max(previous.windowExtent??previous.startIndex+previous.items.length,window.startIndex+window.items.length)};
      if (isCurrent()) setData({ scope: expected.scopeKey, page: window });
    } catch (reason) {
      if (!isCurrent()) return;
      if (append && typeof reason === "object" && reason && "code" in reason && reason.code === "READ_VERSION_CHANGED") {
        // A cursor belongs to one exact authorized generation. Keep current
        // content visible while re-reading the first window; never mix versions.
        active.current = null; void loadRef.current(); return;
      }
      setStatus({key:expected.requestKey,pending:false,error:reason instanceof Error?reason.message:"后台资料暂不可用。"});
    } finally { if (active.current === flight) { active.current = null; if (!controller.signal.aborted) setStatus(previous=>previous.key===expected.requestKey?{...previous,pending:false}:previous); } }
  },[visible,returnAnchor,request,merge,rowKey,setData,setStatus]);
  useLayoutEffect(()=>{
    if(latest.current.requestKey!==requestKey){anchor.current=undefined;active.current?.controller.abort();active.current=null;}
    latest.current={scope,scopeKey,queryKey,requestKey,invalidQuery};loadRef.current=load;
  },[scope,scopeKey,queryKey,requestKey,invalidQuery,load]);
  // This lifecycle exists even when SSR supplied a ready page. A manual retry
  // still belongs to this owner and must be aborted on unmount/scope change.
  useEffect(()=>()=>{if(active.current?.key===requestKey){active.current.controller.abort();active.current=null;}},[requestKey]);
  const hasCurrentInitial=Boolean(initial&&visible&&(!returnAnchor||initial.items.some(row=>rowKey(row)===returnAnchor))&&visible.page.stateToken===initial.stateToken&&backendScopeKey(initial.scope)===scopeKey&&JSON.stringify(visible.page.query)===queryKey);
  useEffect(() => {
    if(!scopeKey||hasCurrentInitial||invalidQuery)return;
    let live = true;
    const timeout = setTimeout(() => { if (live) void loadRef.current(); }, 150);
    return () => { live = false; clearTimeout(timeout); active.current?.controller.abort(); active.current = null; };
  }, [scopeKey, queryKey, initial, hasCurrentInitial,invalidQuery]);
  return { page: visible?.page ?? (initial && backendScopeKey(initial.scope) === scopeKey ? initial : null), extent:visible?.page.windowExtent, removed: visible?.page.startIndex ?? 0, pending:pending&&!invalidQuery, error:invalidQuery?"请求资料无效。":error, loadMore: () => void load("after"), loadPrevious: () => void load("before"), seek: (position:number) => { if (!active.current) void load("seek",position); }, rememberAnchor: (id: string) => { anchor.current = id; }, retry: () => void load(), resetKey: scopeKey+queryKey };
}
