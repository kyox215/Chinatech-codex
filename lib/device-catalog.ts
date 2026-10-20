export const catalogCategories = ['phone', 'tablet', 'laptop', 'desktop', 'console', 'other'] as const;
export type DeviceCatalogCategory = typeof catalogCategories[number];
export const catalogNetworks = ['unknown', '2G', '3G', '4G', '5G', 'Wi-Fi', 'Wi-Fi + Cellular'] as const;
export type CatalogEntry = {
  id: string; category: DeviceCatalogCategory; brand: string; family: string; name: string;
  releasedAt: string | null; year: number | null; generation: string; network: typeof catalogNetworks[number];
  platform: string; modelCodes: string[]; aliases: string[]; markets: string[];
  status: 'verified' | 'review'; enabled: boolean; sourceUrls: string[]; checkedAt: string | null; notes: string;
};
export type CatalogRow = CatalogEntry & { version: number };
export type CatalogCoverage = { category: string; brand: string; verifiedCount: number; scope: string; gaps: string[]; sourceIds: string[] };
export type CatalogSource = { id: string; title: string; url: string; checkedAt: string };
export type CatalogState = { revision: string; canManage: boolean; accountId: string; sessionId: string; storeId: string };
export type CatalogQuery = { category?: string; brand?: string; family?: string; familyExact?: boolean; q?: string; page?: number; includeDisabled?: boolean };
export type CatalogPage = { rows: CatalogRow[]; total: number; page: number; pageSize: number; revision: string };
export type CatalogInitialData = { formatVersion: 1; scope: CatalogPickerScope; state: CatalogState; page: CatalogPage; includeDisabled: boolean };
export type CatalogImportRow = { entry: CatalogEntry; expectedVersion: number };
export type CatalogChange = { id: string; kind: 'add' | 'update' | 'disable' | 'unchanged'; name: string };
export type CatalogPreview = { revision: string; rows: CatalogImportRow[]; changes: CatalogChange[]; errors: { row: number; message: string }[]; digest: string };
export type CatalogPickerScope = { accountId: string; sessionId: string; storeId: string; memberId: string; memberRevision: number };
export type CatalogPickerModel = Pick<CatalogEntry, 'id' | 'category' | 'brand' | 'family' | 'name' | 'releasedAt' | 'year' | 'network' | 'platform' | 'modelCodes' | 'aliases' | 'status'>;
export type CatalogPickerResponse = {
  formatVersion: 1; scope: CatalogPickerScope; revision: string; category: string; brand: string; family: string;
} & ({ unchanged: true } | {
  unchanged: false; complete: boolean; brands: { value: string; total: number }[];
  families: { brand: string; value: string; total: number }[]; models: CatalogPickerModel[];
});
export function catalogPickerScopeKey(scope: CatalogPickerScope): string {
  return JSON.stringify([1, scope.accountId, scope.sessionId, scope.storeId, scope.memberId, scope.memberRevision]);
}
export function catalogPickerModel(entry: CatalogEntry): CatalogPickerModel {
  return { id: entry.id, category: entry.category, brand: entry.brand, family: entry.family, name: entry.name,
    releasedAt: entry.releasedAt, year: entry.year, network: entry.network, platform: entry.platform,
    modelCodes: entry.modelCodes, aliases: entry.aliases, status: entry.status };
}
export class CatalogError extends Error { constructor(message: string, public status = 400) { super(message); } }
const brandAliases: Record<string, readonly string[]> = {
  Apple: ['苹果'], Samsung: ['三星'], Xiaomi: ['小米', 'Mi'], Redmi: ['红米', 'REDMI'],
  POCO: ['Pocophone'], Huawei: ['华为'], Honor: ['荣耀', 'HONOR'], OPPO: ['欧珀'],
  realme: ['Realme', '真我'], vivo: ['VIVO'], OnePlus: ['一加'], Google: ['谷歌'], Motorola: ['摩托罗拉'],
  Lenovo: ['联想'], HP: ['惠普', 'Hewlett-Packard'], Dell: ['戴尔'], ASUS: ['华硕'], Acer: ['宏碁'],
  MSI: ['微星'], Microsoft: ['微软'], Sony: ['索尼'], Nintendo: ['任天堂'], Nokia: ['诺基亚'],
  TCL: ['tcl'], ZTE: ['中兴'], LG: ['乐金'], Dynabook: ['dynabook'], Gigabyte: ['技嘉'],
};
export function catalogNormalize(value: string) { return value.normalize('NFKC').toLocaleLowerCase('en-US').replace(/\+/g, 'plus').replace(/[^\p{L}\p{N}]/gu, ''); }
export function canonicalCatalogBrand(value: string) {
  const key = catalogNormalize(value);
  return Object.entries(brandAliases).find(([brand, aliases]) => [brand, ...aliases].some(alias => catalogNormalize(alias) === key))?.[0] ?? value.trim();
}
export function catalogBrandAliases(brand: string) { return [brand, ...(brandAliases[canonicalCatalogBrand(brand)] ?? [])]; }
export function catalogNameSort(value: string) { return catalogNormalize(value).replace(/\d+/g,digits=>digits.padStart(8,'0')); }
export function catalogSearchText(entry: CatalogEntry) { return [entry.name, entry.family, ...entry.aliases, ...entry.modelCodes, ...catalogBrandAliases(entry.brand)].map(catalogNormalize).join(' '); }
export function catalogSearchTerms(q: string) { return q.normalize('NFKC').trim().split(/\s+/u).map(catalogNormalize).filter(Boolean).slice(0, 8); }
export function catalogCategory(value: string): DeviceCatalogCategory | null {
  const map: Record<string, DeviceCatalogCategory> = { 手机: 'phone', 平板: 'tablet', 电脑: 'laptop', 笔记本: 'laptop', 台式机: 'desktop', 游戏机: 'console', 其他: 'other' };
  return catalogCategories.includes(value as DeviceCatalogCategory) ? value as DeviceCatalogCategory : map[value] ?? null;
}
export function catalogQueryCategories(value: string): DeviceCatalogCategory[] {
  if(value==='computer'||value==='电脑')return ['laptop','desktop'];
  const category=catalogCategory(value);return category?[category]:[];
}
function text(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value) || (required && !value.trim())) throw new CatalogError('请核对目录字段内容及长度。');
  return value.trim();
}
function stringList(value: unknown, max: number, length: number): string[] {
  if (!Array.isArray(value) || value.length > max) throw new CatalogError('目录列表字段格式无效。');
  const result = value.map(item => text(item, length, true));
  if (new Set(result.map(catalogNormalize)).size !== result.length) throw new CatalogError('目录别名、代码或地区存在重复。');
  return result;
}
function date(value: unknown): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) < '1970') throw new CatalogError('目录日期须为有效日期，未知请留空。');
  const parsed = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new CatalogError('目录日期须为有效日期，未知请留空。');
  return value;
}
export function validateCatalogEntry(raw: unknown): CatalogEntry {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CatalogError('目录行格式无效。');
  const r = raw as Record<string, unknown>;
  const keys = ['id','category','brand','family','name','releasedAt','year','generation','network','platform','modelCodes','aliases','markets','status','enabled','sourceUrls','checkedAt','notes'];
  if (Object.keys(r).some(key => !keys.includes(key))) throw new CatalogError('目录行包含未知字段。');
  const id = text(r.id, 100);
  if (id && !/^[a-z0-9][a-z0-9-]{1,99}$/.test(id)) throw new CatalogError('目录ID格式无效。');
  if (!catalogCategories.includes(r.category as DeviceCatalogCategory) || !catalogNetworks.includes(r.network as typeof catalogNetworks[number]) || !['verified','review'].includes(r.status as string) || typeof r.enabled !== 'boolean') throw new CatalogError('请核对目录类别、网络和状态。');
  const releasedAt = date(r.releasedAt); const checkedAt = date(r.checkedAt);
  const year = r.year === null || r.year === '' ? null : r.year;
  if (year !== null && (!Number.isInteger(year) || Number(year) < 1970 || Number(year) > 2200 || (releasedAt && Number(releasedAt.slice(0,4)) !== year))) throw new CatalogError('目录年份与发布日期不一致。');
  const sourceUrls = stringList(r.sourceUrls, 20, 1000);
  for (const url of sourceUrls) { let parsed: URL; try { parsed = new URL(url); } catch { throw new CatalogError('来源须为有效HTTPS链接。'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new CatalogError('来源须为有效HTTPS链接。'); }
  if (r.status === 'verified' && (!sourceUrls.length || !checkedAt)) throw new CatalogError('已核验型号必须填写来源与核验日期。');
  return { id, category: r.category as DeviceCatalogCategory, brand: canonicalCatalogBrand(text(r.brand, 60, true)), family: text(r.family, 100, true), name: text(r.name, 120, true), releasedAt, year: year as number | null,
    generation: text(r.generation, 100), network: r.network as typeof catalogNetworks[number], platform: text(r.platform, 120), modelCodes: stringList(r.modelCodes, 100, 120), aliases: stringList(r.aliases, 80, 160), markets: stringList(r.markets, 30, 50), status: r.status as CatalogEntry['status'], enabled: r.enabled, sourceUrls, checkedAt, notes: text(r.notes, 1000) };
}
export function catalogIdentity(entry: CatalogEntry) { return [entry.category, entry.brand, entry.name, entry.network, entry.platform].map(catalogNormalize).join('|'); }
export function catalogRowName(entry: CatalogEntry) { return entry.name; }
export function compareCatalogRows(a: CatalogEntry, b: CatalogEntry) {
  return (b.releasedAt ?? (b.year ? `${b.year}-01-01` : '')).localeCompare(a.releasedAt ?? (a.year ? `${a.year}-01-01` : '')) || b.name.localeCompare(a.name, 'en', { numeric: true });
}
export function catalogQueryPage(rows: readonly CatalogRow[], query: CatalogQuery, revision: string): CatalogPage {
  const categories = query.category ? catalogQueryCategories(query.category) : [];
  const brand = query.brand ? canonicalCatalogBrand(query.brand) : '';
  const phrase = catalogNormalize(query.q ?? ''); const page = Math.max(1, query.page ?? 1);
  const matched = rows.filter(row => (query.includeDisabled || row.enabled) && (!categories.length || categories.includes(row.category)) && (!brand || row.brand === brand) && ((!query.family && !query.familyExact) || row.family === (query.family ?? '')) && catalogSearchText(row).includes(phrase)).sort(compareCatalogRows);
  return { rows: matched.slice((page-1)*50, page*50), total: matched.length, page, pageSize: 50, revision };
}
export function catalogEntryEqual(a: CatalogEntry, b: CatalogEntry) {
  const clean = (entry: CatalogEntry) => Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'version'));
  return JSON.stringify(validateCatalogEntry(clean(a))) === JSON.stringify(validateCatalogEntry(clean(b)));
}
export function previewCatalogImport(current: readonly CatalogRow[], incoming: CatalogImportRow[], revision: string): Omit<CatalogPreview, 'digest'> {
  if (!incoming.length || incoming.length > 10000) throw new CatalogError('一次导入须为1至10000行。');
  const errors: CatalogPreview['errors'] = []; const rows: CatalogImportRow[] = []; const changes: CatalogChange[] = [];
  const ids = new Set<string>(); const identities = new Map<string, string>();
  const currentIds = new Map(current.map(row => [row.id, row]));
  const replacing = new Set(incoming.map(row => row.entry?.id).filter(Boolean));
  for (const entry of current) if (!replacing.has(entry.id)) identities.set(catalogIdentity(entry), entry.id);
  incoming.forEach((raw, index) => { try {
    const entry = validateCatalogEntry(raw.entry);
    if (!entry.id) throw new CatalogError('新目录行缺少生成的ID。');
    if (!Number.isSafeInteger(raw.expectedVersion) || raw.expectedVersion < 0) throw new CatalogError('目录行版本无效。');
    if (ids.has(entry.id)) throw new CatalogError('导入文件存在重复ID。'); ids.add(entry.id);
    const before = currentIds.get(entry.id);
    if ((before?.version ?? 0) !== raw.expectedVersion) throw new CatalogError('目录行已变化，请重新导出并核对。', 409);
    const identity = catalogIdentity(entry);
    if (identities.has(identity) && identities.get(identity) !== entry.id) throw new CatalogError('同一型号与版本已存在，请使用原目录ID。');
    identities.set(identity, entry.id); rows.push({ entry, expectedVersion: raw.expectedVersion });
    changes.push({ id: entry.id, kind: !before ? 'add' : catalogEntryEqual(before, entry) ? 'unchanged' : before.enabled && !entry.enabled ? 'disable' : 'update', name: entry.name });
  } catch (error) { errors.push({ row: index + 2, message: error instanceof CatalogError ? error.message : '目录行格式无效。' }); } });
  return { revision, rows, changes, errors };
}
