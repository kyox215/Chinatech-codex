import { CatalogError, catalogPickerScopeKey, type CatalogPickerResponse } from './device-catalog';

export type PickerQuery = { category: string; brand?: string; family?: string };
export type PickerData = Extract<CatalogPickerResponse, { unchanged: false }>;
export type PickerRead = { data: PickerData | null; loading: boolean; error: string; ready: boolean };
const empty: PickerRead = Object.freeze({ data: null, loading: false, error: '', ready: false });
type Environment = {
  scope: () => string;
  headers: () => Record<string, string>;
  matches: (response: CatalogPickerResponse) => boolean;
  fetch: typeof fetch;
};
type Entry = { query: PickerQuery; scope: string; snapshot: PickerRead; touched: number };

/** Authorized, document-local references. No business drafts or privileges are cached here. */
export function createCatalogIndexClient(env: Environment) {
  const entries = new Map<string, Entry>();
  const flights = new Map<string, AbortController>();
  const listeners = new Set<() => void>();
  const readers = new Map<string,number>();
  let generation = 0;
  let blocked: { scope: string; snapshot: PickerRead } | null = null;
  let authorizedScope: { client: string; server: string } | null = null;
  let catalogRevision: string | null = null;
  const key = (q: PickerQuery, scope = env.scope()) => JSON.stringify([scope, q.category, q.brand ?? '', q.family ?? '',q.family!==undefined]);
  const publish = () => listeners.forEach(listener => listener());
  const read = (q: PickerQuery): PickerRead => blocked?.scope===env.scope()?blocked.snapshot:entries.get(key(q))?.snapshot ?? empty;
  function invalidate(clear = true) {
    if(!clear&&blocked?.scope===env.scope())return;
    generation++;
    blocked=null;
    flights.forEach(controller => controller.abort()); flights.clear();
    if (clear) {entries.clear();authorizedScope=null;catalogRevision=null;}
    else entries.forEach(entry => { entry.snapshot = { ...entry.snapshot, ready: false, loading: true, error: '' }; });
    publish();
  }
  function retain(q:PickerQuery){const cacheKey=key(q);readers.set(cacheKey,(readers.get(cacheKey)??0)+1);return()=>{const remaining=Math.max(0,(readers.get(cacheKey)??1)-1);if(remaining){readers.set(cacheKey,remaining);return;}readers.delete(cacheKey);const flight=flights.get(cacheKey);if(flight){flights.delete(cacheKey);flight.abort();const entry=entries.get(cacheKey);if(entry){entry.snapshot={...entry.snapshot,loading:false,ready:false,error:''};publish();}}};}
  async function load(q: PickerQuery, force = false) {
    const scope = env.scope(); if (!scope) { invalidate(); return; }
    if(blocked?.scope===scope&&!force)return;
    if(force)blocked=null;
    const query = { ...q }; const cacheKey = key(query, scope);
    const prior = entries.get(cacheKey);
    if (flights.has(cacheKey) || (!force && prior?.snapshot.ready)) return;
    const entry: Entry = prior ?? { query, scope, snapshot: empty, touched: Date.now() };
    const cached = entry.snapshot.data;
    const controller = new AbortController(); const ticket = generation;
    const headers = { ...env.headers() };
    const params = new URLSearchParams({ kind: 'picker-index', category: query.category });
    if (query.brand) params.set('brand', query.brand);
    if (query.family!==undefined) {params.set('family', query.family);params.set('familyExact','1');}
    if (cached) { params.set('knownRevision', cached.revision); headers['x-ct-catalog-scope'] = catalogPickerScopeKey(cached.scope); }
    entry.snapshot = { data: cached, loading: true, error: '', ready: false }; entry.touched = Date.now();
    entries.set(cacheKey, entry); flights.set(cacheKey, controller); publish();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const current = () => ticket === generation && scope === env.scope() && flights.get(cacheKey) === controller;
    let authorizationFailure = false;
    try {
      const response = await env.fetch('/api/catalog?' + params, { credentials: 'same-origin', cache: 'no-store', headers, signal: controller.signal });
      const result = await response.json().catch(()=>null);
      if (!current()) return;
      if (!response.ok) {
        if ([401,403,409].includes(response.status)) { authorizationFailure = true; invalidate(); }
        const fallback=response.status===401?'请先登录后查看设备目录。':response.status===403?'当前账号没有获授权的门店。':response.status===409?'登录会话已变化，请刷新后重试。':'设备目录暂不可用，请稍后重试。';
        throw new CatalogError(typeof result?.message === 'string' ? result.message : fallback,response.status);
      }
      if(!result||typeof result!=='object'||Array.isArray(result))throw new CatalogError('设备目录暂不可用，请稍后重试。');
      const value = result as CatalogPickerResponse;
      if (value.scope && !env.matches(value)) { authorizationFailure = true; invalidate(); throw new CatalogError('登录会话已变化，请刷新后重试。'); }
      if (value.formatVersion !== 1 || !value.scope || value.category !== query.category || value.brand !== (query.brand ?? '') || value.family !== (query.family ?? '') || typeof value.revision !== 'string') throw new CatalogError('登录会话已变化，请刷新后重试。');
      const unchanged = value.unchanged === true;
      const serverScope=catalogPickerScopeKey(value.scope);
      if(authorizedScope?.client===scope&&authorizedScope.server!==serverScope){authorizationFailure=true;invalidate();throw new CatalogError('登录会话已变化，请刷新后重试。');}
      if (unchanged && (!cached || cached.revision !== value.revision || catalogPickerScopeKey(cached.scope) !== catalogPickerScopeKey(value.scope))) throw new CatalogError('目录已变化，请刷新后重新核对。');
      if (!unchanged && (typeof value.complete!=='boolean' || !Array.isArray(value.models) || value.models.length > 3000 || !Array.isArray(value.brands) || !Array.isArray(value.families))) throw new CatalogError('设备目录暂不可用，请稍后重试。');
      if(catalogRevision!==null&&catalogRevision!==value.revision){generation++;for(const [other,flight] of flights)if(other!==cacheKey){flight.abort();flights.delete(other);}for(const other of entries.keys())if(other!==cacheKey)entries.delete(other);}
      catalogRevision=value.revision;
      entry.snapshot = { data: unchanged ? cached! : value, loading: false, error: '', ready: true };
      authorizedScope={client:scope,server:serverScope};
      entries.set(cacheKey, entry);
      // Bound memory to a few visited categories/branches without persisting private scope.
      const idle = [...entries].filter(([k]) => k !== cacheKey && !flights.has(k)&&!readers.has(k)).sort((a,b) => a[1].touched-b[1].touched);
      while (entries.size > 12 && idle.length) entries.delete(idle.shift()![0]);
    } catch (reason) {
      if (scope !== env.scope() || (ticket !== generation && !authorizationFailure) || flights.get(cacheKey)!==controller&&!authorizationFailure) return;
      entry.snapshot = { data: null, loading: false, ready: false, error: controller.signal.aborted&&!authorizationFailure ? '设备目录查询超时，请重试或手动填写。' : reason instanceof CatalogError ? reason.message : '设备目录暂不可用，请稍后重试。' };
      if(authorizationFailure)blocked={scope,snapshot:entry.snapshot};
      entries.set(cacheKey, entry);
    } finally {
      clearTimeout(timeout);
      if (flights.get(cacheKey) === controller) flights.delete(cacheKey);
      publish();
    }
  }
  return { read, load, retain, invalidate, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } };
}
