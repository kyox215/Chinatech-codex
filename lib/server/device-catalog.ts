import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { TransactionSql } from 'postgres';
import { withDatabase, BackendError, type AuthIdentity } from '@/lib/backend/database';
import { memberInTransaction } from '@/lib/backend/context';
import { CatalogError, canonicalCatalogBrand, catalogQueryCategories, catalogIdentity, catalogSearchText, catalogSearchTerms, catalogNormalize, catalogNameSort, catalogPickerScopeKey, previewCatalogImport, validateCatalogEntry, type CatalogEntry, type CatalogImportRow, type CatalogPage, type CatalogPreview, type CatalogQuery, type CatalogRow, type CatalogState, type CatalogPickerResponse, type CatalogPickerScope, type CatalogPickerModel } from '@/lib/device-catalog';
import { catalogSeedRows, catalogSeedSources, catalogSeedCoverage } from '@/lib/device-catalog-seed';
type Access = { identity: AuthIdentity; storeId: string; readTransaction?: { tx: TransactionSql; control: Control; scope: CatalogPickerScope } };
type Control = { revision: string; admin_user_id: string | null };
type Stored = { data: CatalogEntry; version: number };
const asRow = (row: Stored): CatalogRow => ({ ...row.data, version: row.version });
function digestRows(rows: CatalogImportRow[], revision: string) { return createHash('sha256').update(JSON.stringify({ revision, rows })).digest('hex'); }
async function readControl(tx: TransactionSql, lock = false): Promise<Control> {
  const [row] = lock
    ? await tx<Control[]>`select revision::text,admin_user_id from chinatech_v2_private.device_catalog_control where singleton for update`
    : await tx<Control[]>`select revision::text,admin_user_id from chinatech_v2_private.device_catalog_control where singleton`;
  if (!row) throw new CatalogError('设备目录暂不可用，请稍后重试。', 503);
  return row;
}
function requireManager(state: Control, access: Access, manage: boolean) {
  if (manage && state.admin_user_id !== access.identity.userId) throw new CatalogError('你没有设备目录维护权限。', 403);
}
async function control(tx: TransactionSql, access: Access, manage = false, lock = false): Promise<Control> {
  await memberInTransaction(tx, access.storeId, access.identity.userId);
  const state = await readControl(tx, lock);
  requireManager(state, access, manage);
  return state;
}
// The session lock/live check, store selection, membership registration and all
// reads share one serializable transaction. withDatabase retries this whole unit.
export async function withCatalogRead<T>(identity: AuthIdentity, selected: string | undefined, run: (access: Access) => Promise<T>): Promise<T> {
  return withDatabase(identity, null, async tx => {
    const rows = selected
      ? await tx`select store_id from chinatech_v2.store_memberships where user_id=${identity.userId} and store_id=${selected} and membership_status='active' limit 1`
      : await tx`select store_id from chinatech_v2.store_memberships where user_id=${identity.userId} and membership_status='active' order by store_id limit 1`;
    const storeId: string | undefined = rows[0]?.store_id;
    if (!storeId) throw new CatalogError('当前账号没有获授权的门店。', 403);
    await tx`select set_config('app.store_id',${storeId},true)`;
    const member = await memberInTransaction(tx, storeId, identity.userId);
    const state = await readControl(tx);
    const scope = { accountId: identity.userId, sessionId: identity.sessionId, storeId, memberId: member.id, memberRevision: member.revision };
    return run({ identity, storeId, readTransaction: { tx, control: state, scope } });
  });
}
async function catalogRead<T>(access: Access, manage: boolean, run: (tx: TransactionSql, state: Control) => Promise<T>): Promise<T> {
  if (access.readTransaction) {
    requireManager(access.readTransaction.control, access, manage);
    return run(access.readTransaction.tx, access.readTransaction.control);
  }
  return withDatabase(access.identity, access.storeId, async tx => run(tx, await control(tx, access, manage)));
}
export function catalogReadScope(access: Access): CatalogPickerScope {
  if (!access.readTransaction) throw new CatalogError('设备目录暂不可用，请稍后重试。', 503);
  return access.readTransaction.scope;
}
export async function catalogState(access: Access): Promise<CatalogState> {
  return catalogRead(access, false, async (_tx, row) => ({ revision: row.revision, canManage: row.admin_user_id === access.identity.userId, accountId: access.identity.userId, sessionId: access.identity.sessionId, storeId: access.storeId }));
}
export async function queryCatalog(access: Access, query: CatalogQuery): Promise<CatalogPage> {
  return catalogRead(access, Boolean(query.includeDisabled), async (tx, state) => {
    const categories = query.category ? catalogQueryCategories(query.category) : [];
    const brand = query.brand ? canonicalCatalogBrand(query.brand) : '';
    const phrase = catalogNormalize(query.q ?? ''); const page = query.page ?? 1;
    const search = phrase ? tx`and search_text like ${'%' + phrase + '%'}` : tx``;
    const where = tx`where (${query.includeDisabled === true} or enabled=true) and (${!categories.length} or category=any(${tx.array(categories,25)})) and (${!brand} or brand=${brand}) and (${!query.family && !query.familyExact} or family=${query.family ?? ''}) ${search}`;
    const [count] = await tx`select count(*)::int as total from chinatech_v2_private.device_catalog_entries ${where}`;
    const rows = await tx<Stored[]>`select data,version from chinatech_v2_private.device_catalog_entries ${where} order by release_sort desc,name_sort desc,id limit 50 offset ${(page-1)*50}`;
    return { rows: rows.map(asRow), total: count.total, page, pageSize: 50, revision: state.revision };
  });
}
export async function catalogGroups(access: Access, category: string, brand: string, q = '') {
  return catalogRead(access, false, async (tx, state) => {
    const selected = catalogQueryCategories(category);
    if (category && !selected.length) throw new CatalogError('目录类别无效。');
    const canonical = canonicalCatalogBrand(brand);
    const terms=catalogSearchTerms(q);const search=terms.reduce((filter,term)=>tx`${filter} and search_text like ${'%' + term + '%'}`,tx``);
    const brands = await tx<{ value: string; total: number }[]>`select brand as value,count(*)::int as total from chinatech_v2_private.device_catalog_entries where enabled and (${!selected.length} or category=any(${tx.array(selected,25)})) ${search} group by brand order by brand limit 200`;
    const families = canonical ? await tx<{ value: string; total: number }[]>`select family as value,count(*)::int as total from chinatech_v2_private.device_catalog_entries where enabled and (${!selected.length} or category=any(${tx.array(selected,25)})) and brand=${canonical} group by family order by family limit 200` : [];
    return { revision: state.revision, brands, families };
  });
}
export async function catalogPickerIndex(access: Access, query: CatalogQuery, knownRevision?: string, knownScope?: string): Promise<CatalogPickerResponse> {
  return catalogRead(access, false, async (tx, state) => {
    const scope = catalogReadScope(access);
    const category = query.category ?? ''; const categories = catalogQueryCategories(category);
    const brand = canonicalCatalogBrand(query.brand ?? ''); const family = query.family ?? '';
    const base = { formatVersion: 1 as const, scope, revision: state.revision, category, brand, family };
    if (knownRevision === state.revision && knownScope === catalogPickerScopeKey(scope)) return { ...base, unchanged: true };
    const categoryWhere = tx`where enabled and category=any(${tx.array(categories,25)})`;
    // Group metadata always covers the whole selected category/brand, even when
    // the model branch is too large. No truncated branch can claim completeness.
    const brands = await tx<{ value: string; total: number }[]>`select brand as value,count(*)::int as total from chinatech_v2_private.device_catalog_entries ${categoryWhere} group by brand order by brand`;
    const families = await tx<{ brand: string; value: string; total: number }[]>`select brand,family as value,count(*)::int as total from chinatech_v2_private.device_catalog_entries ${categoryWhere} and (${!brand} or brand=${brand}) group by brand,family order by brand,family`;
    const where = tx`${categoryWhere} and (${!brand} or brand=${brand}) and (${!family && !query.familyExact} or family=${family})`;
    const [count] = await tx<{ total: number }[]>`select count(*)::int as total from chinatech_v2_private.device_catalog_entries ${where}`;
    const complete = count.total <= 3000;
    const models = complete ? await tx<CatalogPickerModel[]>`select id,category,brand,family,data->>'name' as name,data->>'releasedAt' as "releasedAt",(data->>'year')::int as year,data->>'network' as network,data->>'platform' as platform,data->'modelCodes' as "modelCodes",data->'aliases' as aliases,data->>'status' as status from chinatech_v2_private.device_catalog_entries ${where} order by release_sort desc,name_sort desc,id limit 3000` : [];
    return { ...base, unchanged: false, complete, brands, families, models };
  });
}
async function relevantRows(tx: TransactionSql, rows: CatalogImportRow[]) {
  const ids = rows.map(row => row.entry.id); const keys = rows.map(row => catalogIdentity(row.entry));
  return (await tx<Stored[]>`select data,version from chinatech_v2_private.device_catalog_entries where id=any(${tx.array(ids,25)}) or identity_key=any(${tx.array(keys,25)})`).map(asRow);
}
function incomingRows(raw: unknown): CatalogImportRow[] {
  if (!Array.isArray(raw) || !raw.length || raw.length > 10000) throw new CatalogError('一次导入须为1至10000行。');
  return raw.map(row => {
    if (!row || typeof row !== 'object' || Object.keys(row).sort().join(',') !== 'entry,expectedVersion') throw new CatalogError('目录行格式无效。');
    const entry = validateCatalogEntry(row.entry);
    if (!entry.id) entry.id = 'model-' + randomUUID();
    if (!Number.isSafeInteger(row.expectedVersion) || row.expectedVersion < 0) throw new CatalogError('目录行版本无效。');
    return { entry, expectedVersion: row.expectedVersion };
  });
}
export async function previewCatalog(access: Access, raw: unknown, expectedRevision: string): Promise<CatalogPreview> {
  const rows = incomingRows(raw);
  return withDatabase(access.identity, access.storeId, async tx => {
    const state = await control(tx, access, true);
    if (state.revision !== expectedRevision) throw new CatalogError('目录已变化，请刷新后重新核对。', 409);
    const preview = previewCatalogImport(await relevantRows(tx, rows), rows, state.revision);
    return { ...preview, digest: preview.errors.length ? '' : digestRows(preview.rows, preview.revision) };
  });
}
export async function applyCatalog(access: Access, raw: unknown, revision: string, expectedDigest: string, requestId: string) {
  const rows = incomingRows(raw); const digest = digestRows(rows, revision);
  if (digest !== expectedDigest) throw new CatalogError('导入内容已变化，请重新预览后确认。', 409);
  return withDatabase(access.identity, access.storeId, async tx => {
    const state = await control(tx, access, true, true);
    const [receipt] = await tx`select actor_id,session_id,digest,result from chinatech_v2_private.device_catalog_receipts where request_id=${requestId}`;
    if (receipt) {
      if (receipt.actor_id !== access.identity.userId || receipt.session_id !== access.identity.sessionId || receipt.digest !== digest) throw new CatalogError('请求编号已被使用，请重新核对。', 409);
      return { ...receipt.result, replayed: true };
    }
    if (state.revision !== revision) throw new CatalogError('目录已变化，请刷新后重新核对。', 409);
    const beforeRows = await relevantRows(tx, rows); const before = new Map(beforeRows.map(row => [row.id, row]));
    const preview = previewCatalogImport(beforeRows, rows, revision);
    if (preview.errors.length) throw new CatalogError(preview.errors[0].message, 409);
    const changed = preview.changes.filter(change => change.kind !== 'unchanged');
    const ids = new Set(changed.map(change => change.id));
    const changedRows = rows.filter(row => ids.has(row.entry.id));
    const history = changedRows.map(({ entry }) => ({ id: entry.id, before: before.get(entry.id) ?? null, after: { ...entry, version: (before.get(entry.id)?.version ?? 0) + 1 } }));
    for (let offset = 0; offset < changedRows.length; offset += 250) {
      const values = changedRows.slice(offset, offset+250).map(({ entry }) => ({ id: entry.id, category: entry.category, brand: entry.brand, family: entry.family, enabled: entry.enabled, release_sort: entry.releasedAt ?? (entry.year ? `${entry.year}-01-01` : ''), name_sort: catalogNameSort(entry.name), search_text: catalogSearchText(entry), identity_key: catalogIdentity(entry), version: (before.get(entry.id)?.version ?? 0) + 1, data: tx.json(entry) }));
      if (values.length) await tx`insert into chinatech_v2_private.device_catalog_entries ${tx(values)} on conflict(id) do update set category=excluded.category,brand=excluded.brand,family=excluded.family,enabled=excluded.enabled,release_sort=excluded.release_sort,name_sort=excluded.name_sort,search_text=excluded.search_text,identity_key=excluded.identity_key,version=excluded.version,data=excluded.data`;
    }
    let nextRevision = revision;
    if (history.length) {
      const [updated] = await tx`update chinatech_v2_private.device_catalog_control set revision=revision+1,updated_by=${access.identity.userId},updated_at=now() where singleton returning revision::text`;
      nextRevision = updated.revision;
      await tx`insert into chinatech_v2_private.device_catalog_history(revision,actor_id,session_id,request_id,changes) values(${nextRevision},${access.identity.userId},${access.identity.sessionId},${requestId},${tx.json(history)})`;
    }
    const result = { revision: nextRevision, applied: history.length, replayed: false };
    await tx`insert into chinatech_v2_private.device_catalog_receipts(request_id,actor_id,session_id,digest,result) values(${requestId},${access.identity.userId},${access.identity.sessionId},${digest},${tx.json(result)})`;
    return result;
  });
}
export async function exportCatalog(access: Access, query: CatalogQuery) {
  return withDatabase(access.identity, access.storeId, async tx => {
    const state = await control(tx, access, true); const categories = query.category ? catalogQueryCategories(query.category) : []; const brand = query.brand ? canonicalCatalogBrand(query.brand) : '';
    const where = tx`where (${!categories.length} or category=any(${tx.array(categories,25)})) and (${!brand} or brand=${brand})`;
    const [count] = await tx`select count(*)::int as total from chinatech_v2_private.device_catalog_entries ${where}`;
    if (count.total > 10000) throw new CatalogError('超过单次导出上限，请按类别或品牌分别导出。');
    const rows = await tx<Stored[]>`select data,version from chinatech_v2_private.device_catalog_entries ${where} order by category,brand,family,release_sort desc,name_sort desc,id limit 10000`;
    return { revision: state.revision, rows: rows.map(asRow) };
  });
}
export async function catalogHistory(access: Access) { return catalogRead(access, true, async tx => await tx`select revision::text,created_at,jsonb_array_length(changes)::int as count from chinatech_v2_private.device_catalog_history order by revision desc limit 20`); }
export async function restoreCatalogPreview(access: Access, targetRevision: string, expectedRevision: string) {
  const rows = await withDatabase(access.identity, access.storeId, async tx => {
    const state = await control(tx, access, true); if (state.revision !== expectedRevision) throw new CatalogError('目录已变化，请刷新后重新核对。', 409);
    const [history] = await tx<{ changes: { id: string; before: CatalogRow | null; after: CatalogRow }[] }[]>`select changes from chinatech_v2_private.device_catalog_history where revision=${targetRevision}`;
    if (!history) throw new CatalogError('目录历史不存在。', 404);
    const current = await tx<Stored[]>`select data,version from chinatech_v2_private.device_catalog_entries where id=any(${tx.array(history.changes.map(change => change.id),25)})`;
    const versions = new Map(current.map(row => [row.data.id, row.version]));
    return history.changes.map(change => { const entry = Object.fromEntries(Object.entries(change.before ?? { ...change.after, enabled: false }).filter(([key])=>key!=='version')) as CatalogEntry; return { entry, expectedVersion: versions.get(change.id) ?? 0 }; });
  });
  return previewCatalog(access, rows, expectedRevision);
}
export const initialCatalog = { rows: catalogSeedRows, sources: catalogSeedSources, coverage: catalogSeedCoverage };
export function catalogKnownFailure(error: unknown) { return error instanceof CatalogError || error instanceof BackendError; }
