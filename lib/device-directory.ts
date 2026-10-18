import { catalogCategories, catalogNetworks, type CatalogPickerModel } from './device-catalog';
export type DirectoryShard = { key: string; category: string; brand: string; count: number; sha256: string };
export type DirectoryManifest = { formatVersion: 1; version: string; revision: string; shards: DirectoryShard[] };
export type DirectoryShardBody = { formatVersion: 1; category: string; brand: string; models: CatalogPickerModel[] };
export type DirectoryPackage = { manifest: string; shards: Record<string, string>; checkedAt: number };
export const directoryFailure = '设备目录暂不可用，请稍后重试。';
export const directoryTimeout = '设备目录查询超时，请重试或手动填写。';
export const directoryTTL = 300000;
export const directoryVersion = /^[a-f0-9]{64}$/;
export const directoryShardKey = /^(phone|tablet|laptop|desktop|console|other)-[a-f0-9]{64}$/;
const rowKeys = ['id','category','brand','family','name','releasedAt','year','network','platform','modelCodes','aliases','status'];
function record(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) throw new Error(directoryFailure);
}
function text(value: unknown, max: number, nonempty = false): value is string { return typeof value === 'string' && value.length <= max && (!nonempty || value.trim().length > 0); }
export function parseDirectoryManifest(raw: string): DirectoryManifest {
  if (new TextEncoder().encode(raw).length > 1024 * 1024) throw new Error(directoryFailure);
  const value: unknown = JSON.parse(raw); record(value, ['formatVersion','version','revision','shards']);
  if (value.formatVersion !== 1 || typeof value.version !== 'string' || !directoryVersion.test(value.version) || typeof value.revision !== 'string' || !/^\d{1,20}$/.test(value.revision) || !Array.isArray(value.shards) || value.shards.length > 1024) throw new Error(directoryFailure);
  const keys = new Set<string>(); let total = 0;
  for (const row of value.shards) {
    record(row, ['key','category','brand','count','sha256']);
    if (typeof row.key !== 'string' || !directoryShardKey.test(row.key) || !row.key.startsWith(String(row.category)+'-') || !catalogCategories.includes(row.category as typeof catalogCategories[number]) || !text(row.brand,60,true) || !Number.isSafeInteger(row.count) || (row.count as number) < 1 || typeof row.sha256 !== 'string' || !directoryVersion.test(row.sha256) || keys.has(row.key)) throw new Error(directoryFailure);
    keys.add(row.key); total += row.count as number;
  }
  if (total > 200000) throw new Error(directoryFailure);
  return value as DirectoryManifest;
}
export function parseDirectoryShard(raw: string, descriptor: DirectoryShard): DirectoryShardBody {
  if (new TextEncoder().encode(raw).length > 16 * 1024 * 1024) throw new Error(directoryFailure);
  const value: unknown = JSON.parse(raw); record(value, ['formatVersion','category','brand','models']);
  if (value.formatVersion !== 1 || value.category !== descriptor.category || value.brand !== descriptor.brand || !Array.isArray(value.models) || value.models.length !== descriptor.count) throw new Error(directoryFailure);
  const ids = new Set<string>();
  for (const row of value.models) {
    record(row,rowKeys);
    if (!text(row.id,100,true) || !/^[a-z0-9][a-z0-9-]+$/.test(row.id) || ids.has(row.id) || row.category !== descriptor.category || row.brand !== descriptor.brand || !text(row.family,100) || !text(row.name,120,true) || !text(row.platform,300) || !catalogNetworks.includes(row.network as typeof catalogNetworks[number]) || !['verified','review'].includes(row.status as string) || !(row.releasedAt === null || typeof row.releasedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.releasedAt)) || !(row.year === null || Number.isInteger(row.year) && (row.year as number) >= 1900 && (row.year as number) <= 2200)) throw new Error(directoryFailure);
    for (const key of ['aliases','modelCodes']) if (!Array.isArray(row[key]) || row[key].length > 100 || !row[key].every(v => text(v,200,true))) throw new Error(directoryFailure);
    ids.add(row.id);
  }
  return value as DirectoryShardBody;
}
export async function directorySHA(raw: string) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))].map(v => v.toString(16).padStart(2,'0')).join(''); }
export async function validateDirectoryPackage(value: DirectoryPackage) {
  const manifest = parseDirectoryManifest(value.manifest); const models: CatalogPickerModel[] = []; const ids = new Set<string>(); let bytes = 0;
  if (!value.shards || Object.keys(value.shards).length !== manifest.shards.length || !Number.isFinite(value.checkedAt)) throw new Error(directoryFailure);
  for (const descriptor of manifest.shards) {
    const raw = value.shards[descriptor.key]; if (typeof raw !== 'string') throw new Error(directoryFailure);
    bytes += new TextEncoder().encode(raw).length; if (bytes > 64 * 1024 * 1024 || await directorySHA(descriptor.brand) !== descriptor.key.slice(descriptor.category.length+1) || await directorySHA(raw) !== descriptor.sha256) throw new Error(directoryFailure);
    for (const row of parseDirectoryShard(raw,descriptor).models) { if (ids.has(row.id)) throw new Error(directoryFailure); ids.add(row.id); models.push(row); }
  }
  return { manifest, models, bytes };
}
