import 'server-only';
import { createHash } from 'node:crypto';
import { readDeviceDirectoryResource } from '@/lib/backend/database';
import { isSupabaseMode } from '@/lib/supabase/config';
import { catalogPickerModel } from '@/lib/device-catalog';
import { catalogSeedRows } from '@/lib/device-catalog-seed';
import { directoryFailure, type DirectoryManifest, type DirectoryShard } from '@/lib/device-directory';
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
let packaged: { manifest: string; shards: Map<string,string>; version: string } | undefined;
function seedDirectory() {
  if (packaged) return packaged;
  const groups = new Map<string,ReturnType<typeof catalogPickerModel>[]>();
  for (const row of catalogSeedRows.filter(row => row.enabled)) { const key = row.category + '-' + hash(row.brand); const list = groups.get(key) ?? []; list.push(catalogPickerModel(row)); groups.set(key,list); }
  const shards = new Map<string,string>(); const descriptors: DirectoryShard[] = [];
  for (const [key,models] of [...groups].sort(([a],[b])=>a.localeCompare(b))) {
    models.sort((a,b)=>a.id.localeCompare(b.id)); const { category,brand } = models[0]; const body = JSON.stringify({formatVersion:1,category,brand,models});
    shards.set(key,body); descriptors.push({key,category,brand,count:models.length,sha256:hash(body)});
  }
  const base = {formatVersion:1 as const,revision:'0',shards:descriptors}; const version = hash(JSON.stringify(base));
  packaged = {manifest:JSON.stringify({...base,version} satisfies DirectoryManifest),shards,version}; return packaged;
}
export async function deviceDirectoryResource(version?: string, shard?: string): Promise<string | null> {
  if (isSupabaseMode()) return readDeviceDirectoryResource(version,shard);
  const seed = seedDirectory();
  if (!version) return seed.manifest;
  if(version !== seed.version) return null;
  return shard === 'package' ? JSON.stringify({manifest:seed.manifest,shards:Object.fromEntries(seed.shards)}) : seed.shards.get(shard ?? '') ?? null;
}
export function directoryResponse(body: string, immutable = false) {
  return new Response(body,{headers:{'content-type':'application/json; charset=utf-8','cache-control':immutable?'public, max-age=31536000, immutable':'public, max-age=0, s-maxage=60','cdn-cache-control':immutable?'public, max-age=31536000, immutable':'public, max-age=60','x-content-type-options':'nosniff'}});
}
export function directoryError(status = 503) { return Response.json({message:directoryFailure},{status,headers:{'cache-control':'no-store','cdn-cache-control':'no-store'}}); }
