import { canonicalCatalogBrand, catalogQueryCategories, type CatalogPickerModel } from './device-catalog';
import { directoryFailure, directoryTimeout, directoryTTL, parseDirectoryManifest, parseDirectoryShard, directorySHA, validateDirectoryPackage, type DirectoryPackage } from './device-directory';
export type DirectoryQuery = { category: string; brand?: string; family?: string };
export type DirectoryIndex = { revision: string; complete: true; brands: {value:string;total:number}[]; families: {brand:string;value:string;total:number}[]; models: CatalogPickerModel[] };
export type DirectoryRead = { data: DirectoryIndex | null; loading: boolean; error: string; ready: boolean };
type Store = { load: () => Promise<DirectoryPackage | null>; save: (value: DirectoryPackage) => Promise<void> };
type Environment = { fetch: typeof fetch; store: Store; now?: () => number; timeoutMs?: number };
const empty: DirectoryRead = Object.freeze({data:null,loading:false,error:'',ready:false});
export function createDeviceDirectoryClient(env: Environment) {
  const now = env.now ?? Date.now;
  const listeners = new Set<()=>void>(); const memo = new Map<string,DirectoryRead>();
  let active: { pack: DirectoryPackage; models: CatalogPickerModel[] } | null = null;
  let restored = false, loading = false, error = '', lastAttempt = 0;
  let flight: Promise<void> | null = null;
  let forceQueued=false, flightForced=false;
  const publish = () => { memo.clear(); for (const listener of listeners) listener(); };
  function read(query: DirectoryQuery): DirectoryRead {
    const key = JSON.stringify(query); const prior = memo.get(key); if (prior) return prior;
    if (!active) { const result = !loading && !error ? empty : {data:null,ready:false,loading,error}; memo.set(key,result); return result; }
    const categories = catalogQueryCategories(query.category);
    const categoryRows = active.models.filter(row => !categories.length || categories.includes(row.category));
    const brand = canonicalCatalogBrand(query.brand ?? '');
    const brandRows = categoryRows.filter(row => !brand || row.brand === brand);
    const brands = new Map<string,number>(), families = new Map<string,{brand:string;value:string;total:number}>();
    for (const row of categoryRows) brands.set(row.brand,(brands.get(row.brand) ?? 0)+1);
    for (const row of brandRows) {
      const id=JSON.stringify([row.brand,row.family]);
      const family=families.get(id)??{brand:row.brand,value:row.family,total:0}; family.total++; families.set(id,family);
    }
    const result: DirectoryRead = {data:{revision:parseDirectoryManifest(active.pack.manifest).version,complete:true,brands:[...brands].sort(([a],[b])=>a.localeCompare(b)).map(([value,total])=>({value,total})),families:[...families.values()],models:brandRows.filter(row => query.family === undefined || row.family === query.family)},ready:true,loading:false,error};
    memo.set(key,result); return result;
  }
  function ensure(force = false): Promise<void> {
    if (flight) { if(force && !flightForced)forceQueued=true; return flight; }
    const checked = Math.max(active?.pack.checkedAt ?? 0,lastAttempt);
    if (!force && restored && checked > 0 && now() - checked < directoryTTL) return Promise.resolve();
    flightForced=force;
    loading=!active; error=''; publish();
    const controller = new AbortController(); let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_resolve,reject) => {
      timer=setTimeout(()=>{live=false;controller.abort();reject(new Error(directoryTimeout));},env.timeoutMs ?? 10000);
    });
    const current = () => { if (!live || controller.signal.aborted) throw new Error(directoryTimeout); };
    const text = async (url: string, limit: number) => {
      current();
      const response = await env.fetch(url,{credentials:'omit',cache:force?'reload':'default',signal:controller.signal});
      if (!response.ok || Number(response.headers.get('content-length') ?? 0) > limit) throw new Error(directoryFailure);
      const raw = await response.text(); current();
      if (new TextEncoder().encode(raw).length > limit) throw new Error(directoryFailure);
      return raw;
    };
    const work = async () => {
      if (!restored) {
        // Storage cannot hold first use hostage, including browsers with a blocked upgrade.
        let storageTimer: ReturnType<typeof setTimeout>;
        const stored = await Promise.race([env.store.load().catch(()=>null),new Promise<null>(resolve=>{storageTimer=setTimeout(()=>resolve(null),1200);})]).finally(()=>clearTimeout(storageTimer));
        current(); restored=true;
        if (stored) try {
          const verified=await validateDirectoryPackage(stored); current();
          active={pack:{...stored,checkedAt:Math.min(stored.checkedAt,now())},models:verified.models}; error=''; publish();
        } catch { /* Invalid storage is replaced only by a completely validated public package. */ }
        current();
        if (active && !force && now()-active.pack.checkedAt < directoryTTL) return;
      }
      lastAttempt=now();
      const manifestRaw=await text('/api/device-directory/manifest',1024*1024);
      const manifest=parseDirectoryManifest(manifestRaw);
      if (active) {
        const previous=parseDirectoryManifest(active.pack.manifest);
        if (BigInt(manifest.revision)<BigInt(previous.revision)) return;
        if (manifest.revision===previous.revision && manifest.version!==previous.version) throw new Error(directoryFailure);
      }
      if (active && parseDirectoryManifest(active.pack.manifest).version === manifest.version) {
        current(); active={...active,pack:{...active.pack,checkedAt:now()}}; return;
      }
      let rawShards:Record<string,string>={};
      if (!active) {
        // The measured initial directory is <1 MiB but has 56 shards. One immutable
        // package avoids 19 network rounds; later versions reuse unchanged shards.
        const raw=await text('/api/device-directory/'+manifest.version+'/package',64*1024*1024);
        const bundled:unknown=JSON.parse(raw);
        if (!bundled || typeof bundled !== 'object' || Array.isArray(bundled) || Object.keys(bundled).sort().join('|')!=='manifest|shards' || !('manifest' in bundled) || bundled.manifest!==manifestRaw || !('shards' in bundled) || !bundled.shards || typeof bundled.shards!=='object' || Array.isArray(bundled.shards)) throw new Error(directoryFailure);
        rawShards=bundled.shards as Record<string,string>;
      } else {
        const reusable=new Map<string,string>();
        for (const shard of parseDirectoryManifest(active.pack.manifest).shards) reusable.set(shard.sha256,active.pack.shards[shard.key]);
        let next=0,bytes=0;
        const worker=async()=>{
          for (;;) {
            current(); const descriptor=manifest.shards[next++]; if(!descriptor)return;
            const raw=reusable.get(descriptor.sha256)??await text('/api/device-directory/'+manifest.version+'/'+descriptor.key,16*1024*1024);
            current(); bytes+=new TextEncoder().encode(raw).length;
            if(bytes>64*1024*1024||await directorySHA(raw)!==descriptor.sha256)throw new Error(directoryFailure);
            parseDirectoryShard(raw,descriptor); rawShards[descriptor.key]=raw;
          }
        };
        await Promise.all(Array.from({length:Math.min(3,manifest.shards.length)},worker)); current();
      }
      const pack={manifest:manifestRaw,shards:rawShards,checkedAt:now()};
      const verified=await validateDirectoryPackage(pack); current();
      active={pack,models:verified.models};
    };
    flight=Promise.race([work(),timeout]).catch(reason=>{
      error=reason instanceof Error&&reason.message===directoryTimeout?directoryTimeout:directoryFailure;
    }).finally(()=>{
      live=false;controller.abort();clearTimeout(timer);loading=false;flight=null;publish();
      if(active)void env.store.save(active.pack).catch(()=>{});
      if(forceQueued){forceQueued=false;void ensure(true);}
    });
    return flight;
  }
  return {read,ensure,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};}};
}
