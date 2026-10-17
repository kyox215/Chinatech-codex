import 'server-only';
import { BackendError, type AuthIdentity } from '@/lib/backend/database';
import { readStoreValue, signStoreValue } from './store-tokens';

export const admissionPageSize = 25;
export type AdmissionFilter = 'pending' | 'history';
export type AdmissionQuery = { applicationStatus: AdmissionFilter; applicationCursor?: string; invitationCursor?: string };
export type StorePageCursor = { createdAt: string; id: string };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function admissionQuery(url: URL): AdmissionQuery {
  for (const key of url.searchParams.keys()) if (!['storeId', 'applicationStatus', 'applicationCursor', 'invitationCursor'].includes(key) || url.searchParams.getAll(key).length !== 1) throw new BackendError('分页请求无效。');
  const applicationStatus = url.searchParams.get('applicationStatus') ?? 'pending';
  if (applicationStatus !== 'pending' && applicationStatus !== 'history') throw new BackendError('分页请求无效。');
  return { applicationStatus, applicationCursor: url.searchParams.get('applicationCursor') ?? undefined, invitationCursor: url.searchParams.get('invitationCursor') ?? undefined };
}

export function pageScope(identity: AuthIdentity, kind: string, storeId = '', filter = '', revision = 0) {
  return JSON.stringify([kind, identity.userId, identity.sessionId, storeId, filter, revision]);
}

export function decodeStoreCursor(value: unknown, scope: string): StorePageCursor | null {
  if (value === undefined || value === null) return null;
  const data = readStoreValue('store-page', value);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new BackendError('分页请求无效。');
  const cursor = data as StorePageCursor & { scope: string };
  if (Object.keys(cursor).sort().join(',') !== 'createdAt,id,scope' || cursor.scope !== scope || typeof cursor.id !== 'string' || !uuid.test(cursor.id) || typeof cursor.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(cursor.createdAt) || (!Number.isFinite(Date.parse(cursor.createdAt)) || new Date(cursor.createdAt).toISOString() !== cursor.createdAt.replace(/(\.\d{3})\d{3}Z$/, '$1Z'))) throw new BackendError('分页请求无效。');
  return { createdAt: cursor.createdAt, id: cursor.id };
}

export function storePage<T extends { id: string; cursor_created_at: string }>(rows: T[], totalCount: number, scope: string) {
  const items = rows.slice(0, admissionPageSize), last = items.at(-1), hasMore = rows.length > admissionPageSize;
  const nextCursor = hasMore && last ? signStoreValue('store-page', { scope, createdAt: last.cursor_created_at, id: last.id }) : null;
  return { items, page: { totalCount, hasMore, nextCursor } };
}
